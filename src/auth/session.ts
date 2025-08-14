import { loadConfig } from '../config.js';
import { TokenStore } from '../storage/tokenStore.js';
import { refreshAccessToken } from '../oauth/atlassian.js';

export async function ensureFreshToken(userId: string) {
  const cfg = loadConfig();
  const rec = await TokenStore.get(userId);
  if (!rec) return undefined;
  const now = Date.now();
  if (rec.expiresAt && rec.expiresAt - now > 60_000) {
    return rec; // still fresh (>60s)
  }
  const next = await refreshAccessToken(rec.refreshToken, cfg);
  const updated = { ...rec, ...next };
  await TokenStore.set(userId, updated);
  return updated;
}

export async function getCloudId(userId: string, override?: string) {
  if (override) return override;
  const rec = await TokenStore.get(userId);
  if (rec?.cloudId) return rec.cloudId;
  return TokenStore.getDefaultCloudId();
}

