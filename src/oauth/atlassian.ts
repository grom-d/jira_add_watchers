import crypto from 'node:crypto';
import { AppConfig } from '../config.js';

function base64url(input: Buffer) {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function pkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function generateAuthUrl(state: string, cfg: AppConfig) {
  const { verifier, challenge } = pkcePair();
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: cfg.ATLAS_CLIENT_ID,
    scope: 'offline_access read:user:jira read:issue.watcher:jira write:issue.watcher:jira',
    redirect_uri: cfg.REDIRECT_URI,
    state,
    response_type: 'code',
    prompt: 'consent',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  const authUrl = `https://auth.atlassian.com/authorize?${params.toString()}`;
  return { authUrl, verifier };
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number; token_type: string };

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`token_exchange_failed: ${res.status}`);
  return (await res.json()) as TokenResponse;
}

export async function handleCallback(code: string, verifier: string, cfg: AppConfig) {
  // Create request body with client_secret, avoiding long-lived references
  const requestBody = {
    grant_type: 'authorization_code',
    client_id: cfg.ATLAS_CLIENT_ID,
    client_secret: cfg.ATLAS_CLIENT_SECRET,
    code,
    redirect_uri: cfg.REDIRECT_URI,
    code_verifier: verifier,
  };
  
  const tok = await postToken(requestBody);
  
  // Clear sensitive data from memory (best effort)
  requestBody.client_secret = '';
  
  const now = Date.now();
  const rec = { accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt: now + (tok.expires_in - 60) * 1000 };
  return rec;
}

export async function refreshAccessToken(refreshToken: string, cfg: AppConfig) {
  // Create request body with client_secret, avoiding long-lived references
  const requestBody = {
    grant_type: 'refresh_token',
    client_id: cfg.ATLAS_CLIENT_ID,
    client_secret: cfg.ATLAS_CLIENT_SECRET,
    refresh_token: refreshToken,
  };
  
  const tok = await postToken(requestBody);
  
  // Clear sensitive data from memory (best effort)
  requestBody.client_secret = '';
  
  const now = Date.now();
  return { accessToken: tok.access_token, refreshToken: tok.refresh_token ?? refreshToken, expiresAt: now + (tok.expires_in - 60) * 1000 };
}

export type AccessibleResource = { id: string; name: string; scopes: string[] };

import { LruTtl } from '../lib/lru.js';
const resourcesCache = new LruTtl<string, AccessibleResource[]>(100, 10 * 60_000);

export async function getAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
  const key = accessToken.slice(0, 24); // tokenの先頭でキャッシュキー
  const hit = resourcesCache.get(key);
  if (hit) return hit;
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`accessible_resources_failed: ${res.status}`);
  const json = (await res.json()) as AccessibleResource[];
  resourcesCache.set(key, json);
  return json;
}

export async function revokeToken(token: string, cfg: AppConfig): Promise<void> {
  const res = await fetch('https://auth.atlassian.com/oauth/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, client_id: cfg.ATLAS_CLIENT_ID, token_type_hint: 'refresh_token' })
  });
  if (!res.ok) {
    // ログ用途: 失敗でもローカルは破棄する
    // noop
  }
}
