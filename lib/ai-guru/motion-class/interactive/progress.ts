/**
 * Class progress per student and per chapter section (V51.9.50).
 *
 * Saves where the student is (time and step), which steps they have seen, and how they answered the
 * questions inside the animation. Answers are kept in the student-intelligence agent's
 * `StudentAttempt` shape, so mastery can be computed from them without conversion.
 *
 * Stored in localStorage in the browser (the same student id the RAG classroom uses); in memory in
 * Node (tests). Storage failures never stop the class.
 */

import type { StudentAttempt } from '../../agents/student-intelligence/student-intelligence-agent';

export const STUDENT_ID_KEY = 'ai-guru:student-id';
const PREFIX = 'ai-guru-class-progress:v1:';
const MAX_VISITED = 4000;

export interface AnswerRecord {
  correct: boolean;
  /** First answer counts for mastery; later tries are kept as a count. */
  firstCorrect: boolean;
  tries: number;
  skipped?: boolean;
  at: string;
}

export interface ClassProgress {
  studentId: string;
  /** Book · chapter · section key (see progressKey). */
  key: string;
  label?: string;
  timeMs: number;
  step: number;
  maxStep: number;
  /** Total steps when last saved (a re-planned class may have a different count). */
  totalSteps: number;
  visited: number[];
  answers: Record<string, AnswerRecord>;
  attempts: StudentAttempt[];
  updatedAt: string;
}

const memory = new Map<string, string>();

function store(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { keys(): string[] } {
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        getItem: (k) => localStorage.getItem(k),
        setItem: (k, v) => localStorage.setItem(k, v),
        removeItem: (k) => localStorage.removeItem(k),
        keys: () => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '').filter(Boolean),
      };
    }
  } catch {
    /* storage blocked: fall through to memory */
  }
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k),
    keys: () => [...memory.keys()],
  };
}

/** The student id shared with the RAG classroom (created once per device). */
export function currentStudentId(): string {
  try {
    const s = store();
    const existing = s.getItem(STUDENT_ID_KEY);
    if (existing) return existing;
    const id = `student:${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
    s.setItem(STUDENT_ID_KEY, id);
    return id;
  } catch {
    return 'local-student';
  }
}

/** Stable key for one class: book, chapter and section (whitespace-insensitive). */
export function progressKey(book: string, chapter: string, section: string): string {
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  let h = 2166136261;
  for (const ch of `${clean(book)}|${clean(chapter)}|${clean(section)}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}

const storageKey = (studentId: string, key: string) => `${PREFIX}${studentId}:${key}`;

export function emptyProgress(studentId: string, key: string, label?: string): ClassProgress {
  return { studentId, key, label, timeMs: 0, step: 0, maxStep: 0, totalSteps: 0, visited: [], answers: {}, attempts: [], updatedAt: new Date(0).toISOString() };
}

export function loadProgress(studentId: string, key: string, label?: string): ClassProgress {
  try {
    const raw = store().getItem(storageKey(studentId, key));
    if (!raw) return emptyProgress(studentId, key, label);
    const p = JSON.parse(raw) as Partial<ClassProgress>;
    return {
      ...emptyProgress(studentId, key, label),
      ...p,
      visited: Array.isArray(p.visited) ? p.visited.filter((n) => Number.isInteger(n)) : [],
      answers: p.answers && typeof p.answers === 'object' ? p.answers : {},
      attempts: Array.isArray(p.attempts) ? p.attempts : [],
    };
  } catch {
    return emptyProgress(studentId, key, label);
  }
}

export function saveProgress(p: ClassProgress): void {
  try {
    p.updatedAt = new Date().toISOString();
    if (p.visited.length > MAX_VISITED) p.visited = p.visited.slice(-MAX_VISITED);
    store().setItem(storageKey(p.studentId, p.key), JSON.stringify(p));
  } catch {
    /* quota or blocked: progress stays in memory for this session */
  }
}

export function clearProgress(studentId: string, key: string): void {
  try {
    store().removeItem(storageKey(studentId, key));
  } catch {
    /* ignore */
  }
}

/** Every saved class of this student (most recent first). */
export function listProgress(studentId: string): ClassProgress[] {
  const out: ClassProgress[] = [];
  const pre = `${PREFIX}${studentId}:`;
  try {
    const s = store();
    for (const k of s.keys()) {
      if (!k.startsWith(pre)) continue;
      out.push(loadProgress(studentId, k.slice(pre.length)));
    }
  } catch {
    /* ignore */
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Marks the student's position; returns the same object (mutated) for chaining. */
export function markPosition(p: ClassProgress, timeMs: number, step: number, totalSteps: number): ClassProgress {
  p.timeMs = Math.max(0, Math.round(timeMs));
  p.step = Math.max(0, step);
  p.totalSteps = totalSteps;
  p.maxStep = Math.max(p.maxStep, step);
  if (!p.visited.includes(step)) p.visited.push(step);
  return p;
}

/** Records an answer; the first answer to a question becomes a StudentAttempt (mastery input). */
export function recordAnswer(
  p: ClassProgress,
  q: { id: string; blockId: string; conceptId: string },
  correct: boolean,
  o: { skipped?: boolean; now?: Date } = {},
): { record: AnswerRecord; attempt: StudentAttempt | null } {
  const at = (o.now ?? new Date()).toISOString();
  const prev = p.answers[q.id];
  const record: AnswerRecord = prev
    ? { ...prev, correct: prev.correct || correct, tries: prev.tries + 1, at, skipped: prev.skipped && o.skipped }
    : { correct, firstCorrect: correct, tries: 1, skipped: o.skipped || undefined, at };
  p.answers[q.id] = record;
  let attempt: StudentAttempt | null = null;
  if (!prev && !o.skipped) {
    attempt = { studentId: p.studentId, itemId: q.id, paragraphId: q.blockId, conceptId: q.conceptId, correct, score: correct ? 1 : 0, timestamp: at };
    p.attempts.push(attempt);
  }
  return { record, attempt };
}

/** Where to resume: the saved time, unless the class was finished or re-planned past it. */
export function resumePoint(p: ClassProgress, durationMs: number, totalSteps: number): { timeMs: number; step: number } | null {
  if (p.timeMs <= 1500 || p.timeMs >= durationMs - 1500) return null;
  if (p.step >= totalSteps) return null;
  return { timeMs: p.timeMs, step: p.step };
}
