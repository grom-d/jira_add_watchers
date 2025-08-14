export const ja = {
  'hint.no_permission': 'ユーザー検索権限不足（Browse users and groups）',
  'hint.issue_not_found': '課題が見つかりません（issueKeyを確認）',
  'hint.invalid_request': 'リクエストが不正です（入力を確認）',
  'hint.network_failure': '検索に失敗しました（ネットワーク/サーバー）',
  'hint.not_viewable_excluded': '閲覧不可のため除外されました',
  'hint.reauthorize': '認可が必要です（再同意）',
  'hint.forbidden': '権限が不足しています',
  'hint.not_found': '対象が見つかりません',
  'hint.bad_request': 'リクエストが不正です',
} as const;

export type JaKeys = keyof typeof ja;

