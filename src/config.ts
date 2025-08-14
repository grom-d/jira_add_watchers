import 'dotenv/config';
import { z } from 'zod';
import { ConfigError } from './lib/errors.js';

const EnvSchema = z.object({
  ATLAS_CLIENT_ID: z.string().min(1),
  ATLAS_CLIENT_SECRET: z.string().min(1),
  REDIRECT_URI: z.string().url().refine(
    (url) => {
      // Allow HTTP for local development (localhost or 127.0.0.1)
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || 
             ['localhost', '127.0.0.1'].includes(parsed.hostname) ||
             parsed.hostname.startsWith('192.168.') ||
             parsed.hostname.startsWith('10.');
    },
    {
      message: 'REDIRECT_URI must use HTTPS in production. HTTP is only allowed for local development (localhost, 127.0.0.1, private IP ranges)',
    }
  ),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEYは32文字以上（推奨32バイト）で指定してください'),
  FEATURE_FLAGS: z.string().optional().default(''),
  PORT: z.coerce.number().int().positive().default(3000),
  WATCHERS_CONCURRENCY: z.coerce.number().int().positive().max(20).default(5),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
});

export type AppConfig = z.infer<typeof EnvSchema> & {
  flags: Record<string, boolean>;
};

export function loadConfig(): AppConfig {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new ConfigError(`ENV検証に失敗しました: ${issues}`);
  }
  const { FEATURE_FLAGS, ...rest } = parsed.data;
  const flags: Record<string, boolean> = {};
  for (const pair of FEATURE_FLAGS.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = pair.split('=');
    flags[k] = String(v).toLowerCase() !== 'false';
  }
  return { ...rest, FEATURE_FLAGS, flags } as AppConfig;
}
