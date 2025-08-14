import { describe, it, expect } from 'vitest';
import { addWatcher, deleteWatcher, getWatchers } from './watchers.js';

class FakeClient {
  public last: any;
  constructor(public cloudId = 'cid') {}
  async post(path: string, body: any) { this.last = { method: 'POST', path, body }; return { status: 204 }; }
  async del(path: string) { this.last = { method: 'DELETE', path }; return { status: 204 }; }
  async get(path: string) { this.last = { method: 'GET', path }; return { watchers: [] }; }
}

describe('jira.watchers helpers', () => {
  it('addWatcher は JSON文字列ボディでPOSTする', async () => {
    const c = new FakeClient();
    await addWatcher(c as any, 'PROJ-1', 'acc-123');
    expect(c.last.method).toBe('POST');
    expect(c.last.path).toBe('/issue/PROJ-1/watchers');
    expect(c.last.body).toBe(JSON.stringify('acc-123'));
  });

  it('deleteWatcher は accountId クエリでDELETEする', async () => {
    const c = new FakeClient();
    await deleteWatcher(c as any, 'PR-2', 'acc-9');
    expect(c.last.method).toBe('DELETE');
    expect(c.last.path).toBe('/issue/PR-2/watchers?accountId=acc-9');
  });

  it('getWatchers は GET /watchers を呼ぶ', async () => {
    const c = new FakeClient();
    await getWatchers(c as any, 'A-1');
    expect(c.last.method).toBe('GET');
    expect(c.last.path).toBe('/issue/A-1/watchers');
  });
});

