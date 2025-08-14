import { setTimeout as delay } from 'node:timers/promises';
import { HttpError } from '../lib/errors.js';
import { logger } from '../logger.js';

export type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  retry?: { retries: number; baseMs: number; maxMs: number };
};

export async function fetchJson(url: string, opts: RequestOptions = {}) {
  const { method = 'GET', headers = {}, body, timeoutMs = 15000 } = opts;
  const retry = opts.retry ?? { retries: 3, baseMs: 300, maxMs: 3000 };

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  let attempt = 0;

  while (true) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      } as any);

      if (res.status === 204) return { status: 204 };
      const text = await res.text();
      let json: any = undefined;
      try { json = text ? JSON.parse(text) : undefined; } catch {}

      if (res.ok) return json ?? { status: res.status };

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retry.retries) {
          const retryAfter = Number(res.headers.get('retry-after'));
          const backoff = Math.min(retry.maxMs, retry.baseMs * 2 ** attempt) + Math.random() * 100;
          const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : backoff;
          attempt++;
          logger.warn({ url, status: res.status, attempt }, 'HTTPレート/サーバーエラー。再試行');
          await delay(waitMs);
          continue;
        }
      }

      // 代表的なステータスにヒントを付与
      let hint: string | undefined = json?.hint;
      if (!hint) {
        if (res.status === 401) hint = 'reauthorize';
        else if (res.status === 403) hint = 'forbidden';
        else if (res.status === 404) hint = 'not_found';
        else if (res.status === 400) hint = 'bad_request';
      }
      throw new HttpError(res.status, json?.message ?? `HTTP ${res.status}`, hint, json);
    } catch (e: any) {
      if (e instanceof HttpError) {
        // 上流で整形済みのHTTPエラーはそのまま伝播
        throw e;
      }
      if (e?.name === 'AbortError') {
        throw new HttpError(408, 'リクエストがタイムアウトしました', 'timeout', e);
      }
      if (attempt < retry.retries) {
        attempt++;
        const backoff = Math.min(retry.maxMs, retry.baseMs * 2 ** attempt) + Math.random() * 100;
        logger.warn({ url, attempt, err: e?.message }, 'ネットワーク例外。再試行');
        await delay(backoff);
        continue;
      }
      throw new HttpError(503, 'ネットワークエラー', 'network', e);
    } finally {
      clearTimeout(id);
    }
  }
}
