# コンテキストと前提
## 目的：MCPクライアント（Claude等）から「課題にウォッチャー追加・削除・参照」を安全に実行できるツール群を提供。

- API根拠：Jira Cloudは /rest/api/3/issue/{issueIdOrKey}/watchers の POST でウォッチャー追加でき、ボディは accountId の“JSON文字列そのもの”（例 "5b10..."）。スコープは write:jira-work か粒度スコープ write:issue.watcher:jira。GET/DELETEもあり。
    - Atlassian Developer(https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-watchers/#api-group-issue-watchers)

- 権限要件：組織側で「Allow users to watch issues」がON、かつ Manage Watcher List／View Voters and Watchers のプロジェクト権限が整っていること（後者は一覧表示に必要）。


## スコープ（MVP）
### 提供ツール（MCP Tools）
- jira_add_watchers(issueKey: string, accountIds: string[]) … 複数追加（内部はAPIを1件ずつPOST）。

- jira_remove_watchers(issueKey: string, accountIds: string[]) … 複数削除（DELETE with ?accountId=）。

- jira_get_watchers(issueKey: string) … 現在のウォッチャー取得（権限があれば他者も見える）。

- jira_resolve_accountIds(emailsOrNames: string[]) … メール/表示名（あいまい検索を含む）→accountId 解決（運用で便利）。

## 設計方針（要点）
- 認証：OAuth 2.0（推奨）。クラシックスコープ write:jira-work/read:jira-work または粒度スコープ write:issue.watcher:jira/read:issue.watcher:jira + read:user:jira。
- 入力：issueKey は人間可読（例 PROJ-123）。accountIds は最大N個（Nは安全値 20 など）。メール入力を許す場合は内部で解決→冪等追加。
- API呼び出し：追加は1ユーザーずつ POST /watchers、bodyは "accountId" 文字列。成功は204、重複追加も204。
- 権限・設定検査：初回呼出時にサイト設定（「Allow users to watch issues」）やプロジェクト権限エラーを分かりやすい業務例外に変換。
- レート制御：429/Retry-After尊重、指数バックオフ＋ジャitter。アカウント解決のバルク時はN並列上限を設ける。
- 監査：誰が誰を追加/削除したかをMCPサーバの監査ログに記録（呼出元ユーザーID、Jiraサイト、issueKey、accountIds、結果）。
- エラーマップ：400（無効ID）/403（権限不足）/404（課題なし）を、ユーザー向けに整形。

## 技術前提・方針
- Node 20+/TypeScript、HTTPクライアントは undici か axios。入力検証に zod、ログに pino。
- OAuth 3LO（Authorization Code）、offline_access＋granular scopes（read:issue.watcher:jira, write:issue.watcher:jira, read:user:jira）。
- 呼び出し先は Atlassian プラットフォーム経由（https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...）。
- トークンは暗号化保管（KMS or OS keychain相当/自前AES）。回転Refreshトークンに対応。
-  MCP “tool”は ①schema定義 ②handler 実装 ③エラー整形 ④監査ログ の4点を標準化。