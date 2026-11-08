/**
 * V51.9.117 — every toffee and chilli as one line for the teacher and parent portals ("Arjun got a chilli in class:
 * what is x? chose 110, right 55"), newest first. Built from the saved quiz records; the in-class questions are saved
 * as one-question records, so each reward in the class shows up here at once. Pure.
 */
import type { SessionRecord } from './records';

export interface RewardEvent {
  id: string;
  at: string;
  studentName: string;
  code: string;
  kind: 'toffee' | 'chilli' | 'redeem';
  count: number;
  /** 'class' = a question inside the class; 'quiz' = a quiz or the daily challenge. */
  where: 'class' | 'quiz';
  chapter: string;
  question: string;
  chosen?: string;
  right?: string;
}

const optText = (it: SessionRecord['items'][number], id: string | null | undefined) => (id ? it.options?.find((o) => o.id === id)?.text ?? id.toUpperCase() : undefined);

export function rewardEvents(records: SessionRecord[], limit = 40): RewardEvent[] {
  const out: RewardEvent[] = [];
  for (const r of records) {
    const where = /^In-class question/.test(r.section) ? 'class' : 'quiz';
    const chapter = r.chapter || r.section.replace(/^In-class question · /, '');
    if (r.kind === 'redo') {
      if (r.toffees > 0) out.push({ id: `${r.id}:redo`, at: r.at, studentName: r.studentName, code: r.code, kind: 'redeem', count: r.toffees, where, chapter, question: `Redid ${r.toffees === 1 ? 'a missed question' : `${r.toffees} missed questions`}` });
      continue;
    }
    r.items.forEach((it, k) => {
      const base = { at: r.at, studentName: r.studentName, code: r.code, where, chapter, question: it.stem, chosen: optText(it, it.chosen), right: optText(it, it.answer) } as const;
      if (it.correct && it.toffees > 0) out.push({ ...base, id: `${r.id}:${k}:t`, kind: 'toffee', count: it.toffees });
      if (!it.correct) out.push({ ...base, id: `${r.id}:${k}:c`, kind: 'chilli', count: 1 });
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
