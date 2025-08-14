import { describe, it, expect, vi } from 'vitest';
import { fetchJson } from './retryClient.js';

function makeResponse(status: number, body?: any, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null },
    async text() { return body !== undefined ? JSON.stringify(body) : ''; },
  } as any;
}

describe('fetchJson: 429/5xxは再試行', () => {
  it('429後に成功レスポンスへ回復', async () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    // 1回目: 429, 2回目: 200
    // Retry-Afterを1にして、タイマーを進める
    (global as any).fetch = vi.fn(async () => {
      calls.push(Date.now());
      if (calls.length === 1) return makeResponse(429, { message: 'rate' }, { 'retry-after': '1' });
      return makeResponse(200, { ok: true });
    });

    const p = fetchJson('http://example.com', { retry: { retries: 2, baseMs: 1, maxMs: 10 } });
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res).toEqual({ ok: true });
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('タイムアウトでHttpError(408)相当', async () => {
    (global as any).fetch = vi.fn(async () => {
      const err: any = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    });
    const p = fetchJson('http://example.com', { timeoutMs: 1, retry: { retries: 0, baseMs: 1, maxMs: 1 } });
    await expect(p).rejects.toThrow();
  });

  it('5xxからの自動再試行後に成功', async () => {
    vi.useFakeTimers();
    let n = 0;
    (global as any).fetch = vi.fn(async () => {
      n++;
      if (n === 1) return makeResponse(500, { message: 'server boom' });
      return makeResponse(200, { ok: true });
    });
    const p = fetchJson('http://example.com', { retry: { retries: 1, baseMs: 1, maxMs: 5 } });
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res).toEqual({ ok: true });
    expect(n).toBe(2);
  });

  it('403は即時エラーでhint=forbidden', async () => {
    (global as any).fetch = vi.fn(async () => makeResponse(403, { message: 'nope' }));
    await expect(fetchJson('http://example.com', { retry: { retries: 0, baseMs: 1, maxMs: 1 } }))
      .rejects.toMatchObject({ status: 403, hint: 'forbidden' });
  });
});
