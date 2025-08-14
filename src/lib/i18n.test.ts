import { describe, it, expect } from 'vitest';
import { withHintText, t } from './i18n.js';

describe('i18n: hint解決', () => {
  it('hintコードを日本語へ解決する', () => {
    const out = withHintText({ hint: 'hint.no_permission' });
    expect(out.hintText).toContain('ユーザー検索権限不足');
    expect(t('hint.not_found')).toBeDefined();
  });
});

