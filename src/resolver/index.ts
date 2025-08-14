import { JiraClient } from '../jira/client.js';

export type ResolveResult = {
  resolved?: { accountId: string; displayName: string }[];
  candidates?: { accountId: string; displayName: string }[];
  ambiguous?: { accountId: string; displayName: string }[];
  none?: boolean;
};

function normalizeQuery(q: string) {
  return q
    .replace(/[\s・・]/g, ' ')
    .replace(/[さん|様|君|ちゃん|氏|殿]/g, '')
    .trim()
    .toLowerCase();
}

export async function resolveAccounts(client: JiraClient, params: { query: string; issueKey?: string; maxResults?: number }) {
  const query = normalizeQuery(params.query);
  const max = params.maxResults ?? 10;
  // 優先: viewissue検索（課題閲覧可能ユーザーに限定）: v2
  const issueKey = params.issueKey ?? '';
  const data = await client.getV2(`/user/viewissue/search?issueKey=${encodeURIComponent(issueKey)}&query=${encodeURIComponent(query)}&maxResults=${max}`);

  const candidates = Array.isArray(data)
    ? data.map((u: any) => ({ accountId: u.accountId, displayName: u.displayName }))
    : [];

  if (candidates.length === 0) return { none: true } as ResolveResult;
  if (candidates.length === 1) return { resolved: candidates } as ResolveResult;

  // 簡易ランキング: 完全一致>前方一致>その他
  const lcq = query.toLowerCase();
  const exact = candidates.filter((c) => c.displayName.toLowerCase() === lcq);
  if (exact.length === 1) return { resolved: exact } as ResolveResult;
  const prefix = candidates.filter((c) => c.displayName.toLowerCase().startsWith(lcq));
  if (prefix.length === 1) return { resolved: prefix } as ResolveResult;
  return { ambiguous: candidates } as ResolveResult;
}

