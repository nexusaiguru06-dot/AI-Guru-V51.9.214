/**
 * V51.9.178 — moving an old "whole list in one record" (e.g. progress/sessions.json) into one row per item, once.
 * The old record is kept as `<name>.migrated.json`. Safe to call on every read: it costs one small lookup.
 */
import { docs } from './index';

export async function migrateLegacyList<T>(legacyKey: string, lock: string, keyOf: (item: T) => string): Promise<void> {
  if (!(await docs.get(legacyKey))) return;
  await docs.transaction(lock, async (tx) => {
    const old = await tx.get<T[]>(legacyKey); // a damaged file throws here and nothing is changed
    if (!old) return; // another copy of the app has just done it
    for (const item of Array.isArray(old) ? old : []) {
      const key = keyOf(item);
      if (!(await tx.get(key))) await tx.put(key, item); // rows written since the move win
    }
    await tx.put(legacyKey.replace(/\.json$/, '.migrated.json'), old);
    await tx.del(legacyKey);
  });
}
