import { describe, it, expect } from 'vitest';
import { getAccessibleResources } from './atlassian.js';

function makeResponse(status: number, body?: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  } as any;
}

describe('oauth: accessible-resources キャッシュ', () => {
  it('同一トークンでは2回目以降はfetchされない', async () => {
    let n = 0;
    (global as any).fetch = async () => { n++; return makeResponse(200, [{ id: 'c1', name: 'site' }]); };
    const token = 'tok_abcdefghijklmnopqrstuvwxyz';
    const a = await getAccessibleResources(token);
    const b = await getAccessibleResources(token);
    expect(a[0].id).toBe('c1');
    expect(b[0].id).toBe('c1');
    expect(n).toBe(1);
  });
});

