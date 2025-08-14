import { JiraClient } from '../jira/client.js';
import { isHttpError } from '../lib/errors.js';

export type ResolveResult = {
  resolved?: { accountId: string; displayName: string }[];
  candidates?: { accountId: string; displayName: string }[];
  ambiguous?: { accountId: string; displayName: string }[];
  none?: boolean;
  hint?: string;
};

function normalizeQuery(q: string) {
  const honorifics = /(さん|様|君|ちゃん|氏|殿)/g;
  return q
    .normalize('NFKC')
    .replace(/[\u3000\s・･·\.、，,]+/g, ' ') // 全角空白/中黒/句読点→空白
    .replace(honorifics, '')
    .trim()
    .toLowerCase();
}

export async function resolveAccounts(
  client: JiraClient,
  params: { query: string; issueKey?: string; maxResults?: number; mode?: 'fuzzy' | 'exact'; disambiguation?: 'ask' | 'auto' }
) {
  const query = normalizeQuery(params.query);
  const max = params.maxResults ?? 10;
  const mode = params.mode ?? 'fuzzy';
  const dis = params.disambiguation ?? 'auto';
  const issueKey = params.issueKey ?? '';
  try {
    const data = await client.getV2(
      `/user/viewissue/search?issueKey=${encodeURIComponent(issueKey)}&query=${encodeURIComponent(query)}&maxResults=${max}`
    );
    const raw = Array.isArray(data) ? data : [];
    const candidates = raw.map((u: any) => ({ accountId: u.accountId, displayName: u.displayName, active: !!u.active }));
    if (candidates.length === 0) return { none: true } as ResolveResult;

    const lcq = query.toLowerCase();
    const scored = candidates.map((c) => {
      const name = String(c.displayName ?? '').toLowerCase();
      let s = 0;
      if (name === lcq) s = 3;
      else if (name.startsWith(lcq)) s = 2;
      else if (name.includes(lcq)) s = 1;
      return { ...c, score: s };
    });

    const byScore = scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.active !== b.active) return a.active ? -1 : 1; // active優先
      return a.displayName.localeCompare(b.displayName);
    });

    // exactモードは完全一致のみ
    if (mode === 'exact') {
      const exact = byScore.filter((c) => c.score === 3);
      if (exact.length === 1) return { resolved: exact.map(({ accountId, displayName }) => ({ accountId, displayName })) };
      if (exact.length > 1) return { ambiguous: exact.map(({ accountId, displayName }) => ({ accountId, displayName })) };
      return { none: true };
    }

    // fuzzy
    const topScore = byScore[0]?.score ?? 0;
    const top = byScore.filter((c) => c.score === topScore);
    if (dis === 'auto' && top.length === 1 && topScore >= 2) {
      // 前方一致以上で単一候補のみ自動確定
      return { resolved: top.map(({ accountId, displayName }) => ({ accountId, displayName })) };
    }
    // 1件のみなら確定
    if (byScore.length === 1) return { resolved: byScore.map(({ accountId, displayName }) => ({ accountId, displayName })) };
    // 複数→ambiguous（並びはスコア順）
    return { ambiguous: byScore.map(({ accountId, displayName }) => ({ accountId, displayName })) };
  } catch (e) {
    if (isHttpError(e)) {
      if (e.status === 403) return { none: true, hint: 'ユーザー検索権限不足（Browse users and groups）' };
      if (e.status === 404) return { none: true, hint: '課題が見つかりません（issueKeyを確認）' };
      if (e.status === 400) return { none: true, hint: 'リクエストが不正です（入力を確認）' };
    }
    return { none: true, hint: '検索に失敗しました（ネットワーク/サーバー）' };
  }
}
