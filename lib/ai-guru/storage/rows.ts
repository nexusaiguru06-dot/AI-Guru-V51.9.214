/**
 * V51.9.178 — keeping a list as one record per item ("rows"), so a change writes only the items that changed.
 * Used by the school records (admin/store.ts), quiz history and attendance.
 */
import { createHash } from 'node:crypto';
import type { DocReader, DocTx } from './index';

/** A storage-safe name for an id: the id itself when it is plain, else a hash of it. */
export const rowName = (id: string): string =>
  /^[A-Za-z0-9_:-]{1,100}$/.test(id) && !/^[.]/.test(id) ? id : `h_${createHash('sha1').update(id).digest('hex')}`;

export const rowKey = (dir: string, id: string) => `${dir}/${rowName(id)}.json`;

/** JSON with object keys sorted, so the same value always gives the same text (PostgreSQL's jsonb reorders keys). */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));
}

/** Reads every row under `dir` as name → value. */
export async function readRows<T>(tx: DocReader, dir: string): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  for (const { key, value } of await tx.entries<T>(dir)) out.set(key.slice(dir.length + 1, -'.json'.length), value);
  return out;
}

/** Puts the rows back in the saved order (rows missing from the order list go last, oldest key first). */
export function inOrder<T>(rows: Map<string, T>, order: string[] | undefined): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const name of order ?? []) { const v = rows.get(name); if (v !== undefined && !seen.has(name)) { out.push(v); seen.add(name); } }
  for (const [name, v] of rows) if (!seen.has(name)) out.push(v);
  return out;
}

/**
 * Writes a list as rows: only items whose JSON changed are written, removed items are deleted.
 * `before` holds each row's stableJson as it was read.
 * Returns the order (row names) to save. Two items with the same id keep both (the second gets a suffix).
 */
export async function writeRows<T>(tx: DocTx, dir: string, before: Map<string, string>, items: T[], idOf: (item: T) => string): Promise<string[]> {
  const order: string[] = [];
  const used = new Set<string>();
  for (const item of items) {
    let name = rowName(String(idOf(item) ?? ''));
    for (let n = 2; used.has(name); n++) name = `${rowName(String(idOf(item) ?? ''))}~${n}`;
    used.add(name);
    order.push(name);
    const json = stableJson(item);
    if (before.get(name) !== json) await tx.put(`${dir}/${name}.json`, item);
  }
  for (const name of before.keys()) if (!used.has(name)) await tx.del(`${dir}/${name}.json`);
  return order;
}
