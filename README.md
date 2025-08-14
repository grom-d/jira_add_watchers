# jira_add_watchers / MCP Server

Jira Cloud のウォッチャー機能（追加・削除・取得）と、アカウント解決（表示名ベース）を扱う最小サーバー実装です。MCPクライアントからの連携を想定しつつ、HTTP APIでも動作確認できます。

## 概要
- OAuth 3LO + PKCE で Atlassian に認可し、トークンと `cloudId` を保存（暗号化）。
- Watchers API: 追加/削除は並列処理（部分成功を集計）、取得は最小スキーマに整形。
- Resolver: 日本語向け正規化＋スコアリング。`mode=fuzzy|exact`、`disambiguation=auto|ask`に対応。最終的に閲覧可能性を再確認。
- 監査ログ: 相関ID付きの構造化ログを出力。PIIは最小化。

## セットアップ
1) 依存の準備
- Node.js 20+ を推奨
- 依存インストール: `npm ci`（初回）

2) Atlassian OAuth アプリ
- Authorization URL: `https://auth.atlassian.com/authorize`
- Token URL: `https://auth.atlassian.com/oauth/token`
- Scopes: `offline_access read:user:jira read:issue.watcher:jira write:issue.watcher:jira`
- Redirect URI: 例 `http://localhost:3000/auth/atlassian/callback`

3) .env 設定（`.env.example` を参照）
- `ATLAS_CLIENT_ID` / `ATLAS_CLIENT_SECRET`
- `REDIRECT_URI`（上記で登録したもの）
- `ENCRYPTION_KEY`（32文字以上を推奨）
- `FEATURE_FLAGS`（例: `feature.watchers=true,feature.resolve_fuzzy=true`）
- `PORT`（既定: 3000）
- `WATCHERS_CONCURRENCY`（既定: 5、最大: 20）
- `REQUEST_TIMEOUT_MS`（既定: 15000）

4) ビルド/起動
- 開発: `npm run dev`
- 本番: `npm run build && npm start`

## 認可フロー
1) ブラウザで `GET http://localhost:3000/auth/atlassian/login` にアクセス
2) 同意後、`/auth/atlassian/callback` にリダイレクト
3) `accessible-resources` を取得し、既定の `cloudId` を保存（必要なら API 呼び出し時に `cloudId` で上書き可能）

ヘルスチェック:
- `GET /health` -> `{ status: 'ok' }`
- `GET /ready` -> `{ status: 'ready' }`

切断/再同意:
- `POST /auth/disconnect` -> ローカルトークン破棄 + revoke試行

## API 一覧（HTTP）

1) 取得: `GET /api/watchers?issueKey=PROJ-123[&cloudId=...]`
- 返却: `{ watchCount: number, watchers: [{ accountId, displayName, active? }] }`

2) 追加: `POST /api/watchers/add`
```
{
  "issueKey": "PROJ-123",
  "accountIds": ["abc123", "def456"],
  "cloudId": "<optional>"
}
```
- 返却: `{ results: [{ accountId, ok, error? }, ...] }`
- 並列数は `WATCHERS_CONCURRENCY`、部分成功を集計（重複追加はJira側が204のため成功扱い）

3) 削除: `POST /api/watchers/remove`
```
{
  "issueKey": "PROJ-123",
  "accountIds": ["abc123"],
  "cloudId": "<optional>"
}
```
- 返却形式は追加と同様

4) 解決: `GET /api/resolve?query=<name>&issueKey=PROJ-123&mode=fuzzy&disambiguation=auto[&limit=10][&cloudId=...]`
- 返却: 以下のいずれか
  - `{ resolved: [{ accountId, displayName }] }`
  - `{ ambiguous: [{ accountId, displayName }, ...] }`
  - `{ none: true, hint?: string }`
- 仕様: 日本語向け正規化（NFKC、敬称除去、中黒/句読点/全角空白の統一、小文字化）+ スコアリング（完全一致>前方一致>部分一致、active優先）
- `disambiguation=auto` は高スコア単一候補のみ自動確定
- 最終バリデーション: `issueKey` 指定時、閲覧可能ユーザーに含まれるか再確認（不可なら除外）

Feature Flag:
- `feature.watchers=false` の場合、`/api/watchers*` は 503 を返す
- `feature.resolve_fuzzy=false` の場合、`/api/resolve` は `mode=exact` を強制

## バリデーション/リトライ
- 入力バリデーション: zod
  - `issueKey` 形式チェック（例 `PROJ-123`）。`accountIds` は最大20
- HTTP呼び出し: タイムアウト（`REQUEST_TIMEOUT_MS`）、429/5xx は指数バックオフ＋Jitter、`Retry-After`尊重

## ロギング/監査/PII最小化
- ロガー: pino（`src/logger.ts`）。`authorization/token/email` 等は redact 設定
- リクエストごとに `reqId` を付与
- 監査ログ（`audit: true`）: `actor/issueKey/cloudId/targetIds/successIds/failures` を構造化出力
- PII最小化: クエリ文字列（表示名等）は監査に残さない。メールは必要時にハッシュ（`hashEmail()`）

## ストレージ
- `TokenStore`: AES-256-GCM で `.data/tokens.enc.json` に保存
- `defaultCloudId` を保持し、呼び出し時に `cloudId` 未指定なら既定を使用

## 既知の前提/制限
- Jira サイト設定「Allow users to watch issues」が必要
- プロジェクト権限: 追加/削除には Manage Watcher List、一覧表示には View Voters and Watchers
- Resolverはまず `user/viewissue/search` を利用（課題閲覧可能ユーザーに限定）

## トラブルシュート
- 401/invalid_grant: トークン失効 -> 認可フローをやり直し
- 403: ユーザー検索権限不足（Browse users and groups）
- 404: 課題が見つからない/アクセス不可
- 429: レート制限 -> 自動リトライ、連続する大量操作は `WATCHERS_CONCURRENCY` を下げる

## 開発コマンド
- `npm run dev` 開発起動（ホットリロード）
- `npm run build` ビルド
- `npm start` ビルド成果物起動
- `npm run lint` / `npm run test` 整備予定

## MCPツール/スキーマ
- `GET /mcp/tools` でツール一覧（スキーマURL付き）を取得
- スキーマは `/schemas/*.json` で提供

## CI/Docker
- GitHub Actions: `.github/workflows/ci.yml`（build/test）
- Docker: `Dockerfile`（最小ランタイムイメージ）

## 追加資料
- docs/integration.md（統合テスト手順）
- docs/e2e.md（MCP連携E2E手順）
- docs/faq.md（FAQ/トラブルシュート）

## 実装状況（抜粋）
- Foundations: ENVローダ/型安全設定, 共通HTTP例外
- OAuth: 認可/PKCE/リフレッシュ, accessible-resources 取得
- JiraClient: 再試行・バックオフ, v2/v3 呼び分け
- Tools: add/remove（並列・部分成功）, get_watchers（スキーマ化）
- Resolver: 正規化/ランキング/最終バリデーション/ヒント
- Ops: 監査ログ/PII最小化（相関ID）
