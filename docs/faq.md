# トラブルシュート/FAQ

- 0件（none）になる:
  - 表示名の揺れ → 別表記で試す / プロジェクトを跨ぐと表示名が異なる場合あり
  - 課題閲覧不可 → `issueKey` を確認 / 権限を見直し
  - ユーザー検索権限不足 → 管理者に Browse users and groups を依頼

- 403 が返る:
  - サイト側の権限不足（プロジェクト/グローバル）
  - スコープ不足（read:user:jira 等）

- 429 が多い:
  - 呼び出しレートを下げる / `WATCHERS_CONCURRENCY` を小さく
  - リトライ待機時間は `Retry-After` 優先

- 401/invalid_grant:
  - `/auth/disconnect` でローカルを破棄し、再度 `/auth/atlassian/login` から同意

