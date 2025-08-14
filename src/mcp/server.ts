// MCPサーバ雛形（実装は今後追加）
import http from 'node:http';
import { loadConfig } from '../config.js';
import { logger } from '../logger.js';
import { URL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { generateAuthUrl, handleCallback, getAccessibleResources } from '../oauth/atlassian.js';
import { TokenStore } from '../storage/tokenStore.js';
import { JiraClient } from '../jira/client.js';
import { addWatcher, deleteWatcher, getWatchers } from '../jira/watchers.js';
import { AddWatchersInput, GetWatchersInput, RemoveWatchersInput, ResolveAccountsInput } from '../tools/index.js';
import { ensureFreshToken, getCloudId } from '../auth/session.js';
import { resolveAccounts } from '../resolver/index.js';

const config = loadConfig();

const pendingStates = new Map<string, { verifier: string }>();

function send(res: http.ServerResponse, code: number, data: unknown) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function parseBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${config.PORT}`);
  if (url.pathname === '/health') return send(res, 200, { status: 'ok' });
  if (url.pathname === '/ready') return send(res, 200, { status: 'ready' });

  if (url.pathname === '/auth/atlassian/login' && req.method === 'GET') {
    const state = randomBytes(16).toString('hex');
    const { authUrl, verifier } = generateAuthUrl(state, config);
    pendingStates.set(state, { verifier });
    res.writeHead(302, { location: authUrl });
    res.end();
    return;
  }

  if (url.pathname === '/auth/atlassian/callback' && req.method === 'GET') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') ?? '';
    const pv = pendingStates.get(state);
    if (!code || !pv) return send(res, 400, { error: 'invalid_state_or_code' });
    try {
      const tokens = await handleCallback(code, pv.verifier, config);
      pendingStates.delete(state);
      // アクセス可能リソースの取得と既定cloudIdの保存
      const resources = await getAccessibleResources(tokens.accessToken);
      const defaultCloudId = resources?.[0]?.id;
      await TokenStore.set('default', { ...tokens, cloudId: defaultCloudId });
      if (defaultCloudId) await TokenStore.setDefaultCloudId(defaultCloudId);
      return send(res, 200, { ok: true, defaultCloudId });
    } catch (e: any) {
      logger.error({ err: e?.message }, 'oauth callback error');
      return send(res, 500, { error: 'oauth_failed' });
    }
  }

  // 簡易API: MCPツールと同等の動作をHTTPで確認
  if (url.pathname === '/api/watchers/add' && req.method === 'POST') {
    if (config.flags['feature.watchers'] === false) return send(res, 503, { error: 'feature_disabled' });
    const body = await parseBody(req);
    const parsed = AddWatchersInput.safeParse(body);
    if (!parsed.success) return send(res, 400, { error: 'invalid_input', issues: parsed.error.issues });
    const user = await ensureFreshToken('default');
    if (!user) return send(res, 401, { error: 'unauthorized' });
    const input = parsed.data;
    const cloudId = await getCloudId('default', input.cloudId);
    if (!cloudId) return send(res, 400, { error: 'no_cloudId' });
    const client = new JiraClient({ cloudId, accessToken: user.accessToken, timeoutMs: config.REQUEST_TIMEOUT_MS });
    const limit = Math.max(1, Math.min(config.WATCHERS_CONCURRENCY, 20));
    const ids = input.accountIds;
    const results: Array<{ accountId: string; ok: boolean; error?: string }> = [];
    let idx = 0;
    async function worker() {
      while (idx < ids.length) {
        const my = idx++;
        const id = ids[my];
        try {
          await addWatcher(client, input.issueKey, id);
          results.push({ accountId: id, ok: true });
        } catch (e: any) {
          results.push({ accountId: id, ok: false, error: e?.message });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, () => worker()));
    logger.info({
      action: 'ADD',
      actor: 'default',
      issueKey: input.issueKey,
      cloudId,
      total: ids.length,
      ok: results.filter(r => r.ok).length,
      ng: results.filter(r => !r.ok).length,
    }, 'watchers add results');
    return send(res, 200, { results });
  }

  if (url.pathname === '/api/watchers/remove' && req.method === 'POST') {
    if (config.flags['feature.watchers'] === false) return send(res, 503, { error: 'feature_disabled' });
    const body = await parseBody(req);
    const parsed = RemoveWatchersInput.safeParse(body);
    if (!parsed.success) return send(res, 400, { error: 'invalid_input', issues: parsed.error.issues });
    const user = await ensureFreshToken('default');
    if (!user) return send(res, 401, { error: 'unauthorized' });
    const input = parsed.data;
    const cloudId = await getCloudId('default', input.cloudId);
    if (!cloudId) return send(res, 400, { error: 'no_cloudId' });
    const client = new JiraClient({ cloudId, accessToken: user.accessToken, timeoutMs: config.REQUEST_TIMEOUT_MS });
    const limit = Math.max(1, Math.min(config.WATCHERS_CONCURRENCY, 20));
    const ids = input.accountIds;
    const results: Array<{ accountId: string; ok: boolean; error?: string }> = [];
    let idx = 0;
    async function worker() {
      while (idx < ids.length) {
        const my = idx++;
        const id = ids[my];
        try {
          await deleteWatcher(client, input.issueKey, id);
          results.push({ accountId: id, ok: true });
        } catch (e: any) {
          results.push({ accountId: id, ok: false, error: e?.message });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, () => worker()));
    logger.info({
      action: 'REMOVE',
      actor: 'default',
      issueKey: input.issueKey,
      cloudId,
      total: ids.length,
      ok: results.filter(r => r.ok).length,
      ng: results.filter(r => !r.ok).length,
    }, 'watchers remove results');
    return send(res, 200, { results });
  }

  if (url.pathname === '/api/watchers' && req.method === 'GET') {
    if (config.flags['feature.watchers'] === false) return send(res, 503, { error: 'feature_disabled' });
    const parsed = GetWatchersInput.safeParse({ issueKey: url.searchParams.get('issueKey'), cloudId: url.searchParams.get('cloudId') ?? undefined });
    if (!parsed.success) return send(res, 400, { error: 'invalid_input', issues: parsed.error.issues });
    const user = await ensureFreshToken('default');
    if (!user) return send(res, 401, { error: 'unauthorized' });
    const cloudId = await getCloudId('default', parsed.data.cloudId);
    if (!cloudId) return send(res, 400, { error: 'no_cloudId' });
    const client = new JiraClient({ cloudId, accessToken: user.accessToken, timeoutMs: config.REQUEST_TIMEOUT_MS });
    const data = await getWatchers(client, parsed.data.issueKey);
    // Jiraの生レスポンスを最小形に整形
    const shaped = {
      watchCount: Number(data?.watchCount ?? (Array.isArray(data?.watchers) ? data.watchers.length : 0)),
      watchers: Array.isArray(data?.watchers)
        ? data.watchers.map((w: any) => ({ accountId: w.accountId, displayName: w.displayName, active: w.active }))
        : [],
    };
    // スキーマ検証
    // 過剰プロパティはクライアントに返さない
    const { GetWatchersOutput } = await import('../tools/index.js');
    const ok = GetWatchersOutput.parse(shaped);
    return send(res, 200, ok);
  }

  if (url.pathname === '/api/resolve' && req.method === 'GET') {
    const parsed = ResolveAccountsInput.safeParse({
      query: url.searchParams.get('query') ?? '',
      issueKey: url.searchParams.get('issueKey') ?? undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      mode: (url.searchParams.get('mode') as any) ?? undefined,
      disambiguation: (url.searchParams.get('disambiguation') as any) ?? undefined,
      cloudId: url.searchParams.get('cloudId') ?? undefined,
    });
    if (!parsed.success) return send(res, 400, { error: 'invalid_input', issues: parsed.error.issues });
    // fuzzy機能のFeature Flag: OFFなら強制exact
    const _data = parsed.data;
    const mode = config.flags['feature.resolve_fuzzy'] === false ? 'exact' : _data.mode;
    const user = await ensureFreshToken('default');
    if (!user) return send(res, 401, { error: 'unauthorized' });
    const cloudId = await getCloudId('default', parsed.data.cloudId);
    if (!cloudId) return send(res, 400, { error: 'no_cloudId' });
    const client = new JiraClient({ cloudId, accessToken: user.accessToken, timeoutMs: config.REQUEST_TIMEOUT_MS });
    const out = await resolveAccounts(client, {
      query: parsed.data.query,
      issueKey: parsed.data.issueKey,
      maxResults: parsed.data.limit,
      mode,
      disambiguation: parsed.data.disambiguation,
    });
    return send(res, 200, out);
  }

  send(res, 404, { error: 'not_found' });
});

server.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'MCP server bootstrap listening');
});
