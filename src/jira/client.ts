import { fetchJson } from '../http/retryClient.js';

export type JiraClientOptions = {
  cloudId: string;
  accessToken: string;
};

export class JiraClient {
  private base: string;
  constructor(private opts: JiraClientOptions) {
    this.base = `https://api.atlassian.com/ex/jira/${opts.cloudId}/rest/api/3`;
  }

  private headers() {
    return {
      authorization: `Bearer ${this.opts.accessToken}`,
      'content-type': 'application/json',
      accept: 'application/json',
    };
  }

  async get(path: string) {
    return fetchJson(`${this.base}${path}`, { headers: this.headers() });
  }

  async post(path: string, body: any) {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    return fetchJson(`${this.base}${path}`, { method: 'POST', headers: this.headers(), body: payload });
  }

  async del(path: string) {
    return fetchJson(`${this.base}${path}`, { method: 'DELETE', headers: this.headers() });
  }
}

