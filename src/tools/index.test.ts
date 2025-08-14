import { describe, it, expect } from 'vitest';
import { AddWatchersInput, GetWatchersInput } from './index.js';

describe('tools: 入力スキーマ', () => {
  it('issueKey 形式を検証し、上限を適用', () => {
    const good = AddWatchersInput.safeParse({ issueKey: 'PROJ-123', accountIds: ['a'], cloudId: 'cid' });
    expect(good.success).toBe(true);

    const badKey = AddWatchersInput.safeParse({ issueKey: 'proj-123', accountIds: ['a'] });
    expect(badKey.success).toBe(false);

    const tooMany = AddWatchersInput.safeParse({ issueKey: 'P-1', accountIds: Array.from({ length: 21 }, (_, i) => String(i)) });
    expect(tooMany.success).toBe(false);
  });

  it('GetWatchersInput は issueKey を必須にする', () => {
    expect(GetWatchersInput.safeParse({ issueKey: 'A-1' }).success).toBe(true);
    expect(GetWatchersInput.safeParse({}).success).toBe(false);
  });
});

