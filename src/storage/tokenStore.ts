import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadConfig } from '../config.js';
import { logger } from '../logger.js';

type TokenRecord = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch millis
  cloudId?: string;
};

type StoreShape = {
  users: Record<string, TokenRecord>;
  defaultCloudId?: string;
};

const DATA_DIR = path.resolve('.data');
const TOKEN_FILE = path.join(DATA_DIR, 'tokens.enc.json');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function getKey(): Buffer {
  const { ENCRYPTION_KEY } = loadConfig();
  // Use first 32 bytes of utf8 string as key. In production, pass raw 32-byte secret.
  const key = Buffer.from(ENCRYPTION_KEY, 'utf8');
  return key.length >= 32 ? key.subarray(0, 32) : Buffer.concat([key, Buffer.alloc(32 - key.length)]);
}

function encryptJson(obj: unknown): Buffer {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj));
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

function decryptJson(buf: Buffer): any {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

async function readStore(): Promise<StoreShape> {
  try {
    const buf = await fs.readFile(TOKEN_FILE);
    return decryptJson(buf);
  } catch (e: any) {
    if (e && (e.code === 'ENOENT' || e.name === 'SyntaxError')) {
      return { users: {} };
    }
    logger.warn({ err: e }, 'TokenStore: 読み込みに失敗');
    return { users: {} };
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  await ensureDir();
  const enc = encryptJson(store);
  await fs.writeFile(TOKEN_FILE, enc);
}

export const TokenStore = {
  async get(userId: string): Promise<TokenRecord | undefined> {
    const s = await readStore();
    return s.users[userId];
  },
  async set(userId: string, rec: TokenRecord): Promise<void> {
    const s = await readStore();
    s.users[userId] = rec;
    await writeStore(s);
  },
  async clear(userId: string): Promise<void> {
    const s = await readStore();
    delete s.users[userId];
    await writeStore(s);
  },
  async setDefaultCloudId(cloudId: string): Promise<void> {
    const s = await readStore();
    s.defaultCloudId = cloudId;
    await writeStore(s);
  },
  async getDefaultCloudId(): Promise<string | undefined> {
    const s = await readStore();
    return s.defaultCloudId;
  },
};

// keytarは補助的に使用（将来の拡張）。
export async function tryKeytar() {
  try {
    const mod = await import('keytar');
    return mod.default ?? (mod as any);
  } catch {
    return null;
  }
}

