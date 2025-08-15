import { describe, it, expect, beforeAll } from 'vitest';
import { TokenStore } from './tokenStore.js';

beforeAll(() => {
  process.env.ATLAS_CLIENT_ID = process.env.ATLAS_CLIENT_ID || 'test-client-id';
  process.env.ATLAS_CLIENT_SECRET = process.env.ATLAS_CLIENT_SECRET || 'test-client-secret';
  process.env.REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/atlassian/callback';
  // base64 for 32-byte key (44 chars)
  process.env.ENCRYPTION_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
});

describe('TokenStore: 暗号化保存/自己診断', () => {
  it('set/get/clear と defaultCloudId の往復', async () => {
    const rec = { accessToken: 'at', refreshToken: 'rt', expiresAt: Date.now() + 60_000, cloudId: 'cid-1' };
    await TokenStore.set('u1', rec as any);
    const got = await TokenStore.get('u1');
    expect(got?.accessToken).toBe('at');
    await TokenStore.setDefaultCloudId('cid-1');
    expect(await TokenStore.getDefaultCloudId()).toBe('cid-1');
    await TokenStore.clear('u1');
    expect(await TokenStore.get('u1')).toBeUndefined();
  });

  it('selfCheck が writable を返す', async () => {
    const hc = await TokenStore.selfCheck();
    expect(hc.ok).toBeTypeOf('boolean');
  });
});
