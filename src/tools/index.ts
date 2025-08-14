import { z } from 'zod';

export const AddWatchersInput = z.object({
  issueKey: z.string().min(1),
  accountIds: z.array(z.string().min(1)).min(1).max(20),
  cloudId: z.string().optional(),
});

export const RemoveWatchersInput = AddWatchersInput;

export const GetWatchersInput = z.object({
  issueKey: z.string().min(1),
  cloudId: z.string().optional(),
});

export const ResolveAccountsInput = z.object({
  query: z.string().min(1),
  issueKey: z.string().optional(),
  projectKey: z.string().optional(),
  mode: z.enum(['fuzzy', 'exact']).default('fuzzy'),
  disambiguation: z.enum(['ask', 'auto']).default('auto'),
  limit: z.number().int().positive().max(20).default(10),
});

export type AddWatchersInput = z.infer<typeof AddWatchersInput>;
export type RemoveWatchersInput = z.infer<typeof RemoveWatchersInput>;
export type GetWatchersInput = z.infer<typeof GetWatchersInput>;
export type ResolveAccountsInput = z.infer<typeof ResolveAccountsInput>;

