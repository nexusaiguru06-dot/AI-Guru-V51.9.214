/**
 * A teacher's own notes, templates and exams for their class. Only students of that class can see them (the server checks
 * the student's class on every read). Pure rules: no I/O here.
 */
import type { ClassGroup } from './groups';
import type { Student } from './fees';

export type ItemKind = 'note' | 'template' | 'exam';
export interface ExamQuestion { q: string; options: string[]; answer: number; explain?: string }
export interface ClassItem {
  id: string; classId: string; kind: ItemKind; title: string; body: string;
  /** Exams only. */
  questions?: ExamQuestion[]; minutes?: number;
  /** Students of the class can see it. Templates start private: they are the teacher's blueprints. */
  shared: boolean;
  /** Exams only: students can take it right now. */
  open: boolean;
  /** Exams only: sent into the regular class, so it pops up for the class's students while they learn. */
  live?: boolean;
  /** When it was last shown to the class (the red dot on the student's menu counts items newer than their last visit). */
  sharedAt?: string;
  createdAt: string; updatedAt: string;
}
export interface Attempt { id: string; itemId: string; classId: string; studentId: string; answers: number[]; score: number; total: number; at: string }

const clip = (x: unknown, n: number) => String(x ?? '').replace(/\r/g, '').trim().slice(0, n);
const oneLine = (x: unknown, n: number) => clip(x, n).replace(/\s+/g, ' ');

export function cleanQuestions(x: unknown): ExamQuestion[] | string {
  if (!Array.isArray(x) || !x.length) return 'Add at least one question';
  if (x.length > 60) return 'An exam can have up to 60 questions';
  const out: ExamQuestion[] = [];
  for (let i = 0; i < x.length; i++) {
    const r = (x[i] ?? {}) as Record<string, unknown>;
    const q = oneLine(r.q, 400);
    const options = (Array.isArray(r.options) ? r.options : []).map((o) => oneLine(o, 200)).filter(Boolean);
    const answer = Number(r.answer);
    if (!q) return `Question ${i + 1} is empty`;
    if (options.length < 2 || options.length > 5) return `Question ${i + 1} needs 2 to 5 answers`;
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return `Question ${i + 1} has two same answers`;
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return `Mark the right answer for question ${i + 1}`;
    const explain = oneLine(r.explain, 400);
    out.push({ q, options, answer, ...(explain ? { explain } : {}) });
  }
  return out;
}

/** Checks what the teacher typed. Returns the fields to store, or a message to show. */
export function cleanItem(b: Record<string, unknown>): { kind: ItemKind; title: string; body: string; questions?: ExamQuestion[]; minutes?: number } | string {
  const kind = b.kind === 'exam' ? 'exam' : b.kind === 'template' ? 'template' : 'note';
  const title = oneLine(b.title, 120);
  if (!title) return 'Give it a title';
  const body = clip(b.body, 10000);
  if (kind === 'exam') {
    const qs = cleanQuestions(b.questions);
    if (typeof qs === 'string') return qs;
    const m = Number(b.minutes);
    return { kind, title, body, questions: qs, minutes: Number.isFinite(m) && m > 0 ? Math.min(300, Math.round(m)) : undefined };
  }
  if (!body) return 'Write something in it';
  return { kind, title, body };
}

export function scoreAttempt(item: Pick<ClassItem, 'questions'>, answers: unknown): { answers: number[]; score: number; total: number } {
  const qs = item.questions ?? [];
  const a = qs.map((_, i) => { const v = Number(Array.isArray(answers) ? answers[i] : NaN); return Number.isInteger(v) ? v : -1; });
  return { answers: a, score: qs.reduce((s, q, i) => s + (a[i] === q.answer ? 1 : 0), 0), total: qs.length };
}

/** What a student of the class may see: no right answers until they have handed the exam in. Private items are hidden. */
export function studentView(item: ClassItem, attempt?: Attempt, seenAt?: string) {
  if (!item.shared) return null;
  const isNew = !!item.sharedAt && (!seenAt || item.sharedAt > seenAt);
  if (item.kind === 'exam') {
    const done = !!attempt;
    return {
      id: item.id, kind: item.kind, title: item.title, body: item.body, minutes: item.minutes, open: item.open, live: !!item.live && item.open && !done, isNew, sharedAt: item.sharedAt, createdAt: item.createdAt,
      questions: (item.questions ?? []).map((q) => (done ? q : { q: q.q, options: q.options })),
      attempt: attempt ? { score: attempt.score, total: attempt.total, answers: attempt.answers, at: attempt.at } : null,
    };
  }
  return { id: item.id, kind: item.kind, title: item.title, body: item.body, isNew, sharedAt: item.sharedAt, createdAt: item.createdAt };
}

/** Starting points the teacher can copy and change. */
export const STARTERS: Array<{ id: string; kind: ItemKind; title: string; body: string; questions?: ExamQuestion[] }> = [
  { id: 'note-outline', kind: 'note', title: 'Lesson notes: <chapter>', body: 'Chapter:\nKey ideas:\n1. \n2. \n3. \n\nImportant formulae / words:\n\nWorked example:\n\nRemember:\n' },
  { id: 'worksheet', kind: 'template', title: 'Worksheet: <topic>', body: 'Name:            Roll no.:            Date:\n\nA. Fill in the blanks\n1. ______\n2. ______\n\nB. Answer briefly\n1. \n2. \n\nC. Think about it\n' },
  { id: 'revision', kind: 'template', title: 'Revision plan: <chapter>', body: 'Day 1: read the notes, copy the formulae\nDay 2: solve the worked examples again\nDay 3: do the exercise without looking\nDay 4: take the class quiz\nDay 5: fix the mistakes\n' },
  { id: 'mcq-exam', kind: 'exam', title: 'Unit test: <chapter>', body: 'Choose the right answer for each question.', questions: [{ q: 'Question 1', options: ['Option A', 'Option B', 'Option C', 'Option D'], answer: 0 }] },
];

/** The next roll number in a class (never reused). */
export function assignSerial(g: Pick<ClassGroup, 'serialCounter'>, s: Pick<Student, 'classSerial'>): number {
  g.serialCounter = (g.serialCounter ?? 0) + 1;
  s.classSerial = g.serialCounter;
  return g.serialCounter;
}

/** Gives a roll number to members who joined before roll numbers existed, in the order they joined. */
export function ensureSerials(classes: ClassGroup[], students: Student[]): boolean {
  let changed = false;
  for (const g of classes) {
    const ms = students.filter((s) => s.classId === g.id);
    g.serialCounter = Math.max(g.serialCounter ?? 0, ...ms.map((s) => s.classSerial ?? 0));
    for (const s of ms.filter((x) => !x.classSerial).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) { assignSerial(g, s); changed = true; }
  }
  return changed;
}
