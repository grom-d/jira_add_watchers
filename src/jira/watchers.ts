import { JiraClient } from './client.js';

export async function addWatcher(client: JiraClient, issueKey: string, accountId: string) {
  // Bodyは accountId のJSON文字列そのもの
  return client.post(`/issue/${encodeURIComponent(issueKey)}/watchers`, JSON.stringify(accountId));
}

export async function deleteWatcher(client: JiraClient, issueKey: string, accountId: string) {
  return client.del(`/issue/${encodeURIComponent(issueKey)}/watchers?accountId=${encodeURIComponent(accountId)}`);
}

export async function getWatchers(client: JiraClient, issueKey: string) {
  return client.get(`/issue/${encodeURIComponent(issueKey)}/watchers`);
}

