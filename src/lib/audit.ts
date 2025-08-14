import crypto from 'node:crypto';
import { Logger } from 'pino';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v);
}

export function hashEmail(email: string): string {
  const h = crypto.createHash('sha256').update(email).digest('hex');
  return `sha256:${h}`;
}

export type AuditEvent = {
  category?: string; // e.g., 'watchers'
  action: 'RESOLVE' | 'ADD' | 'REMOVE';
  actor: string; // caller id
  issueKey?: string;
  cloudId?: string;
  targetIds?: string[]; // input targets
  successIds?: string[]; // succeeded ids
  failures?: { accountId: string; error: string }[];
  hint?: string;
};

export function audit(log: Logger, ev: AuditEvent) {
  log.info({ audit: true, category: ev.category ?? 'watchers', ...ev });
}

