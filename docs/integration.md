# 統合テスト（サンドボックスJira）

目的: 実機Jiraプロジェクトで resolver → add/remove の一連を検証し、成功/複数候補/0件/権限不足を再現・記録する。

前提:
- OAuth同意済み（`/auth/atlassian/login` → `/auth/atlassian/callback`）
- サンドボックス用プロジェクト（例: `SANDBOX`）を用意
- Manage Watcher List / View Voters and Watchers権限が整備済み

シナリオ:
1. 候補1件（resolved）
   - `GET /api/resolve?query=<表示名>&issueKey=SANDBOX-1&disambiguation=auto`
   - `resolved` 配列が1件を返す
   - `POST /api/watchers/add` で追加 → `204`相当の成功が集計される
2. 複数候補（ambiguous）
   - `GET /api/resolve?query=田中&issueKey=SANDBOX-1&disambiguation=ask`
   - `ambiguous` 配列が複数返る
3. 0件（none）
   - 存在しない表示名で `GET /api/resolve?query=xxxxx`
4. 権限不足（403）
   - Browse users and groupsを外したユーザーで `GET /api/resolve` を呼ぶ

記録:
- サーバーログ（`audit: true`）を収集
- 代表レスポンスをこのファイルに追記（鍵情報はマスキング）

