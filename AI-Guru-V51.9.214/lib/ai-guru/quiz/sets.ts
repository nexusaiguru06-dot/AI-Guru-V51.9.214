/**
 * Question sets made by the teacher (V51.9.63b): a named list of multiple-choice questions the students can take
 * from the Quiz button instead of the AI's surprise quiz. Marked, rewarded and reported exactly the same way.
 */
import { cleanMcq, type McqItem } from './mcq';

export interface QuestionSet {
  id: string;
  name: string;
  grade: string;
  chapter: string;
  /** Students see only active sets. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
  items: McqItem[];
}

export const MAX_ITEMS = 30;

/** Checks a set from the network or the form. Bad questions are dropped; a set needs a name and at least one question. */
export function cleanSet(raw: unknown, now = new Date().toISOString()): QuestionSet | null {
  const r = raw as Partial<QuestionSet> | null;
  if (!r || typeof r !== 'object') return null;
  const name = String(r.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!name) return null;
  const items: McqItem[] = [];
  for (const q of (Array.isArray(r.items) ? r.items : []).slice(0, MAX_ITEMS)) {
    const c = cleanMcq(q, items.length);
    if (c) items.push({ ...c, golden: !!(q as McqItem).golden });
  }
  if (!items.length) return null;
  return {
    id: String(r.id ?? '').replace(/[^\w-]/g, '').slice(0, 40) || `set-${Date.now().toString(36)}`,
    name, grade: String(r.grade ?? '').slice(0, 10), chapter: String(r.chapter ?? '').slice(0, 120), active: r.active !== false,
    createdAt: String(r.createdAt ?? '') || now, updatedAt: now, items,
  };
}

/** What the questions form holds while the teacher is typing. */
export interface Draft { stem: string; options: [string, string, string, string]; answer: 0 | 1 | 2 | 3; why: string; concept: string; golden: boolean }
export const emptyDraft = (): Draft => ({ stem: '', options: ['', '', '', ''], answer: 0, why: '', concept: '', golden: false });

/** null when the form is complete; otherwise what is missing, in the teacher's words. */
export function draftProblem(d: Draft): string | null {
  if (!d.stem.trim()) return 'Write the question.';
  if (d.options.some((o) => !o.trim())) return 'Fill all four answers.';
  if (new Set(d.options.map((o) => o.trim().toLowerCase())).size < 4) return 'Two answers are the same.';
  if (!d.why.trim()) return 'Write why the right answer is right (students see it after answering).';
  return null;
}

export const draftToItem = (d: Draft, index: number): McqItem | null =>
  draftProblem(d) ? null : { ...(cleanMcq({ kind: 'standard', stem: d.stem, options: d.options, answer: 'ABCD'[d.answer], why: d.why, concept: d.concept }, index) as McqItem), golden: d.golden };

export const itemToDraft = (q: McqItem): Draft => ({ stem: q.stem, options: q.options.map((o) => o.text) as Draft['options'], answer: 'ABCD'.indexOf(q.answer) as Draft['answer'], why: q.why, concept: q.concept, golden: !!q.golden });
