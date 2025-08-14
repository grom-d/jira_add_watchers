# E2E: MCPクライアント連携

目標: 「『田中さんを SANDBOX-1 のウォッチャーに追加』→ resolver(disambiguation=ask) → 候補提示 → 選択 → add」までを通す。

準備:
- MCPクライアント（例: Claude Desktop）で、このサーバーをMCPサーバとして登録
- `GET http://localhost:3000/health` が `ok` を返すこと

ツール仕様（要点）:
- `jira_resolve_accountIds` 入力: `query, issueKey, mode, disambiguation, limit, cloudId?`
- `jira_add_watchers` 入力: `issueKey, accountIds[], cloudId?`（最大20）

フロー例:
1. ユーザー発話: 「田中さんを SANDBOX-1 のウォッチャーに追加して」
2. MCPクライアント → `jira_resolve_accountIds`（`disambiguation=ask`）
3. 候補が複数 → クライアントがユーザーへ選択肢を提示
4. 選択された `accountId` を用いて `jira_add_watchers` 呼び出し
5. 結果（部分成功含む）をユーザーへ提示

I/O スキーマは `/mcp/tools` と `/schemas/*.json` で参照可能。

