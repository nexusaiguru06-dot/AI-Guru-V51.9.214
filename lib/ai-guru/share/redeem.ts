/**
 * Redo: a missed question can be tried again. Each one answered right turns one chilli into a toffee (once per question).
 * Pure rules; the server re-checks them when the redo is saved.
 */
import { itemKey, type SessionItem, type SessionRecord } from '../quiz/records';
import type { McqItem, McqKind } from '../quiz/mcq';

export interface RedoQuestion { key: string; item: McqItem }

/** Missed questions that still hold a chilli: wrong, with their four choices kept, and not redeemed before. Newest first. */
export function redeemable(records: SessionRecord[], max = 10): RedoQuestion[] {
  const done = new Set(records.flatMap((r) => (r.kind === 'redo' ? r.redeem ?? [] : [])));
  const out: RedoQuestion[] = [];
  for (const r of [...records].sort((a, b) => b.at.localeCompare(a.at))) {
    if (r.kind === 'redo') continue;
    r.items.forEach((i, k) => {
      const key = itemKey(r.id, k);
      if (i.correct || done.has(key) || !i.options || i.options.length !== 4 || out.length >= max) return;
      out.push({ key, item: toMcq(i, key) });
    });
  }
  return out;
}

const toMcq = (i: SessionItem, key: string): McqItem => ({
  id: key, kind: (i.kind || 'standard') as McqKind, stem: i.stem, options: (i.options ?? []).map((o) => ({ id: o.id as McqItem['options'][number]['id'], text: o.text })),
  answer: i.answer as McqItem['answer'], why: i.why ?? '', concept: i.concept,
});

/** Server check: which of the claimed redeem keys are real, missed, this student's and not yet redeemed. */
export function validRedeem(all: SessionRecord[], studentId: string, claimed: string[]): string[] {
  const mine = all.filter((r) => r.studentId === studentId);
  const ok = new Set(redeemable(mine, 1000).map((q) => q.key));
  const seen = new Set<string>();
  return claimed.filter((k) => ok.has(k) && !seen.has(k) && seen.add(k));
}
