import { fetchJson } from '../http/retryClient.js';

export type JiraClientOptions = {
  cloudId: string;
  accessToken: string;
  timeoutMs?: number;
};

export class JiraClient {
  private base3: string;
  private base2: string;
  constructor(private opts: JiraClientOptions) {
    this.base3 = `https://api.atlassian.com/ex/jira/${opts.cloudId}/rest/api/3`;
    this.base2 = `https://api.atlassian.com/ex/jira/${opts.cloudId}/rest/api/2`;
  }

  private headers() {
    return {
      authorization: `Bearer ${this.opts.accessToken}`,
      'content-type': 'application/json',
      accept: 'application/json',
    };
  }

  async get(path: string) {
    return fetchJson(`${this.base3}${path}`, { headers: this.headers(), timeoutMs: this.opts.timeoutMs });
  }

  async post(path: string, body: any) {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    return fetchJson(`${this.base3}${path}`, { method: 'POST', headers: this.headers(), body: payload, timeoutMs: this.opts.timeoutMs });
  }

  async del(path: string) {
    return fetchJson(`${this.base3}${path}`, { method: 'DELETE', headers: this.headers(), timeoutMs: this.opts.timeoutMs });
  }

  async getV2(path: string) {
    return fetchJson(`${this.base2}${path}`, { headers: this.headers(), timeoutMs: this.opts.timeoutMs });
  }
}
