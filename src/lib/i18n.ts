import { ja, JaKeys } from '../locales/ja.js';

export function t(key: string): string {
  const k = key as JaKeys;
  return (ja as any)[k] ?? key;
}

export function withHintText<T extends { hint?: string }>(obj: T): T & { hintText?: string; hintCode?: string } {
  if (!obj.hint) return obj as any;
  return { ...(obj as any), hintText: t(obj.hint), hintCode: obj.hint };
}

