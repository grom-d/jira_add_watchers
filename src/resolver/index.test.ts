import { describe, it, expect } from 'vitest';
import { resolveAccounts } from './index.js';

class FakeClient {
  // path を見て分岐（最終バリデーション用）
  // viewable: displayName(lowercased) -> accountId（trueならdisplayName小文字をそのままaccountIdに）
  constructor(private viewable: Record<string, string | boolean> = {}) {}
  async getV2(path: string) {
    const u = new URL('http://x' + path);
    const q = u.searchParams.get('query') ?? '';
    const issueKey = u.searchParams.get('issueKey') ?? '';
    const max = u.searchParams.get('maxResults') ?? '';
    // 最終バリデーション呼び出し: maxResults=20 を固定で使っている
    if (path.startsWith('/user/viewissue/search') && issueKey && q && max === '20') {
      const key = q.toLowerCase();
      const val = this.viewable[key];
      if (!val) return [];
      const accountId = val === true ? key : String(val);
      return [{ accountId, displayName: q, active: true }];
    }
    // 初回候補: 固定の候補を返す
    return [
      { accountId: 'tanaka', displayName: '田中', active: true },
      { accountId: 'tanaka-taro', displayName: '田中 太郎', active: true },
      { accountId: 'suzuki', displayName: 'Suzuki', active: false },
    ];
  }
}

describe('resolver: 正規化/ランキング/最終バリデーション', () => {
  it('敬称除去+NFKCで単一候補をresolved', async () => {
    const client = new FakeClient({ '田中': 'tanaka' });
    const out = await resolveAccounts(client as any, { query: '田中さん', issueKey: 'PROJ-1', mode: 'fuzzy', disambiguation: 'auto' });
    expect(out.resolved?.[0]?.accountId).toBe('tanaka');
  });

  it('exactモードは完全一致のみ', async () => {
    const client = new FakeClient({ '田中 太郎': true });
    const out = await resolveAccounts(client as any, { query: '田中', issueKey: 'PROJ-1', mode: 'exact', disambiguation: 'auto' });
    expect(out.none).toBeTruthy();
  });

  it('複数候補はambiguous', async () => {
    const client = new FakeClient();
    const out = await resolveAccounts(client as any, { query: '田中', mode: 'fuzzy', disambiguation: 'ask' });
    expect(out.ambiguous && out.ambiguous.length).toBeGreaterThan(1);
  });

  it('最終バリデーションで不可視候補は除外', async () => {
    const client = new FakeClient({});
    // キャッシュ衝突を避けるため別issueKeyを使用
    const out = await resolveAccounts(client as any, { query: '田中', issueKey: 'PROJ-2', mode: 'fuzzy', disambiguation: 'auto' });
    expect(out.none).toBeTruthy();
  });
});
