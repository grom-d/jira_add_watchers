import { z } from 'zod';

const ISSUE_KEY_REGEX = /^[A-Z][A-Z0-9_]+-\d+$/;

export const AddWatchersInput = z.object({
  issueKey: z.string().regex(ISSUE_KEY_REGEX, 'issueKeyの形式が不正です (例: PROJ-123)'),
  accountIds: z.array(z.string().min(1)).min(1).max(20),
  cloudId: z.string().optional(),
});

export const RemoveWatchersInput = AddWatchersInput;

export const GetWatchersInput = z.object({
  issueKey: z.string().min(1),
  cloudId: z.string().optional(),
});

export const Watcher = z.object({
  accountId: z.string().min(1),
  displayName: z.string().min(1),
  active: z.boolean().optional(),
});

export const GetWatchersOutput = z.object({
  watchCount: z.number().int().nonnegative(),
  watchers: z.array(Watcher),
});

export const ResolveAccountsInput = z.object({
  query: z.string().min(1),
  issueKey: z.string().optional(),
  projectKey: z.string().optional(),
  mode: z.enum(['fuzzy', 'exact']).default('fuzzy'),
  disambiguation: z.enum(['ask', 'auto']).default('auto'),
  limit: z.number().int().positive().max(20).default(10),
  cloudId: z.string().optional(),
});

export type AddWatchersInput = z.infer<typeof AddWatchersInput>;
export type RemoveWatchersInput = z.infer<typeof RemoveWatchersInput>;
export type GetWatchersInput = z.infer<typeof GetWatchersInput>;
export type GetWatchersOutput = z.infer<typeof GetWatchersOutput>;
export type ResolveAccountsInput = z.infer<typeof ResolveAccountsInput>;
