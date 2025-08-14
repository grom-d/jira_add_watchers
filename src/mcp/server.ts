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
import { AddWatchersInput, GetWatchersInput, RemoveWatchersInput } from '../tools/index.js';

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
    const body = await parseBody(req);
    const parsed = AddWatchersInput.safeParse(body);
    if (!parsed.success) return send(res, 400, { error: 'invalid_input', issues: parsed.error.issues });
    const user = await TokenStore.get('default');
    if (!user) return send(res, 401, { error: 'unauthorized' });
    const cloudId = parsed.data.cloudId ?? user.cloudId ?? (await TokenStore.getDefaultCloudId());
    if (!cloudId) return send(res, 400, { error: 'no_cloudId' });
    const client = new JiraClient({ cloudId, accessToken: user.accessToken });
    const results = [] as Array<{ accountId: string; ok: boolean; error?: string }>;
    for (const id of parsed.data.accountIds) {
      try { await addWatcher(client, parsed.data.issueKey, id); results.push({ accountId: id, ok: true }); }
      catch (e: any) { results.push({ accountId: id, ok: false, error: e?.message }); }
    }
    return send(res, 200, { results });
  }

  if (url.pathname === '/api/watchers/remove' && req.method === 'POST') {
    const body = await parseBody(req);
    const parsed = RemoveWatchersInput.safeParse(body);
    if (!parsed.success) return send(res, 400, { error: 'invalid_input', issues: parsed.error.issues });
    const user = await TokenStore.get('default');
    if (!user) return send(res, 401, { error: 'unauthorized' });
    const cloudId = parsed.data.cloudId ?? user.cloudId ?? (await TokenStore.getDefaultCloudId());
    if (!cloudId) return send(res, 400, { error: 'no_cloudId' });
    const client = new JiraClient({ cloudId, accessToken: user.accessToken });
    const results = [] as Array<{ accountId: string; ok: boolean; error?: string }>;
    for (const id of parsed.data.accountIds) {
      try { await deleteWatcher(client, parsed.data.issueKey, id); results.push({ accountId: id, ok: true }); }
      catch (e: any) { results.push({ accountId: id, ok: false, error: e?.message }); }
    }
    return send(res, 200, { results });
  }

  if (url.pathname === '/api/watchers' && req.method === 'GET') {
    const parsed = GetWatchersInput.safeParse({ issueKey: url.searchParams.get('issueKey'), cloudId: url.searchParams.get('cloudId') ?? undefined });
    if (!parsed.success) return send(res, 400, { error: 'invalid_input', issues: parsed.error.issues });
    const user = await TokenStore.get('default');
    if (!user) return send(res, 401, { error: 'unauthorized' });
    const cloudId = parsed.data.cloudId ?? user.cloudId ?? (await TokenStore.getDefaultCloudId());
    if (!cloudId) return send(res, 400, { error: 'no_cloudId' });
    const client = new JiraClient({ cloudId, accessToken: user.accessToken });
    const data = await getWatchers(client, parsed.data.issueKey);
    return send(res, 200, data);
  }

  send(res, 404, { error: 'not_found' });
});

server.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'MCP server bootstrap listening');
});
