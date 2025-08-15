import { describe, it, expect } from 'vitest';
import { getAccessibleResources, handleCallback, refreshAccessToken } from './atlassian.js';

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

  it('handleCallback/refreshAccessToken がexpiresAtを設定', async () => {
    let n = 0;
    (global as any).fetch = async (_url: string, init: any) => {
      n++;
      const body = init?.body ? JSON.parse(init.body) : {};
      if (body.grant_type === 'authorization_code') {
        return makeResponse(200, { access_token: 'a1', refresh_token: 'r1', expires_in: 120, token_type: 'bearer' });
      }
      if (body.grant_type === 'refresh_token') {
        return makeResponse(200, { access_token: 'a2', refresh_token: 'r2', expires_in: 120, token_type: 'bearer' });
      }
      return makeResponse(400, {});
    };
    const now = Date.now();
    const rec = await handleCallback('code', 'ver', {
      ATLAS_CLIENT_ID: 'id', ATLAS_CLIENT_SECRET: 'sec', REDIRECT_URI: 'http://localhost:3000/cb', ENCRYPTION_KEY: 'x'.repeat(32), FEATURE_FLAGS: '', PORT: 3000, flags: {},
    } as any);
    expect(rec.accessToken).toBe('a1');
    expect(rec.expiresAt).toBeGreaterThanOrEqual(now);

    const rec2 = await refreshAccessToken('r1', { ATLAS_CLIENT_ID: 'id', ATLAS_CLIENT_SECRET: 'sec' } as any);
    expect(rec2.accessToken).toBe('a2');
    expect(rec2.refreshToken).toBe('r2');
  });
});
