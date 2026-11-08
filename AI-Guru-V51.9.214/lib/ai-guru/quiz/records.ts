/**
 * Session records (V51.9.62) — what the teacher and parent portals read.
 * One record per finished quiz. Saved on the server (data/ai-guru/progress, see /api/ai-guru/progress) so another
 * device can read it, and in the browser as a backup so a failed save is retried and nothing is lost.
 */
import type { McqKind, Tier } from './mcq';

export interface SessionItem { id: string; kind: McqKind; stem: string; concept: string; chosen: string | null; answer: string; correct: boolean; toffees: number; /** A chilli (1) for a wrong answer. */ chillies?: number; seconds: number;
  /** The four choices and the explanation, kept so a missed question can be tried again (Redo). */
  options?: Array<{ id: string; text: string }>; why?: string }

export interface SessionRecord {
  id: string;
  studentId: string;
  /** Short code a parent types to see their child's reports. */
  code: string;
  studentName: string;
  at: string;
  grade: string;
  chapter: string;
  section: string;
  total: number;
  correct: number;
  pct: number;
  toffees: number;
  /** One chilli for every wrong answer. Older records have none saved: use `chilliesOf`. */
  chillies?: number;
  tier: Tier;
  bestStreak: number;
  seconds: number;
  items: SessionItem[];
  /** Set when the quiz was one of the teacher's question sets. */
  setId?: string;
  setName?: string;
  /** 'redo': the student tried missed questions again. Each right answer turns one chilli into a toffee. Not counted as a quiz. */
  kind?: 'redo';
  /** Redo only: the missed questions that were redeemed, as `<record id>#<question number>`. */
  redeem?: string[];
}

/** Chillies of a record: one per wrong answer (also for records saved before chillies existed). */
export const chilliesOf = (r: Pick<SessionRecord, 'items' | 'chillies' | 'kind'>): number => (r.kind === 'redo' ? 0 : typeof r.chillies === 'number' ? r.chillies : r.items.filter((i) => !i.correct).length);

/** Key of one question of one record: what a redo refers to. */
export const itemKey = (recordId: string, index: number) => `${recordId}#${index}`;

export const studentCode = (studentId: string): string => (studentId.replace(/[^a-z0-9]/gi, '').slice(-6) || 'LOCAL0').toUpperCase();

/** Checks and trims a record that arrives over the network. */
export function cleanRecord(raw: unknown): SessionRecord | null {
  const r = raw as Partial<SessionRecord> | null;
  if (!r || typeof r !== 'object' || !r.studentId || !Array.isArray(r.items)) return null;
  const n = (v: unknown, max = 1e6) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const s = (v: unknown, max = 300) => String(v ?? '').slice(0, max);
  const items = r.items.slice(0, 30).map((i) => ({
    id: s(i.id, 20), kind: s(i.kind, 20) as McqKind, stem: s(i.stem, 400), concept: s(i.concept, 80), chosen: i.chosen ? s(i.chosen, 1) : null,
    answer: s(i.answer, 1), correct: !!i.correct, toffees: n(i.toffees, 10), chillies: i.correct ? 0 : 1, seconds: n(i.seconds, 3600),
    ...(Array.isArray(i.options) && i.options.length === 4 ? { options: i.options.map((o) => ({ id: s(o?.id, 1), text: s(o?.text, 120) })) } : {}), ...(i.why ? { why: s(i.why, 300) } : {}),
  }));
  const total = items.length;
  const correct = items.filter((i) => i.correct).length; // recomputed: the client's totals are not trusted
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return {
    id: s(r.id, 60) || `s-${Date.now()}`, studentId: s(r.studentId, 80), code: studentCode(s(r.studentId, 80)),
    studentName: s(r.studentName, 40) || 'Student', at: s(r.at, 40) || new Date().toISOString(), grade: s(r.grade, 10), chapter: s(r.chapter), section: s(r.section),
    total, correct, pct, toffees: n(r.toffees, 200), chillies: total - correct, tier: pct >= 90 ? 'high' : pct >= 70 ? 'mid' : 'low', bestStreak: n(r.bestStreak, 30), seconds: n(r.seconds, 36000), items,
    ...(r.kind === 'redo' ? { kind: 'redo' as const, redeem: (Array.isArray(r.redeem) ? r.redeem : []).slice(0, 30).map((k) => s(k, 90)), chillies: 0, toffees: (Array.isArray(r.redeem) ? r.redeem : []).slice(0, 30).length } : {}),
    ...(r.setId ? { setId: s(r.setId, 40), setName: s(r.setName, 80) } : {}),
  };
}

/** Per-student totals for a list of records (newest first in `recent`). Redo sessions add toffees and take chillies away, but are not quizzes. */
export function rollup(records: SessionRecord[]) {
  const sorted = [...records].sort((a, b) => b.at.localeCompare(a.at));
  const quizzes = sorted.filter((r) => r.kind !== 'redo');
  const total = quizzes.reduce((s, r) => s + r.total, 0);
  const correct = quizzes.reduce((s, r) => s + r.correct, 0);
  const concepts = new Map<string, { right: number; all: number }>();
  for (const r of quizzes) for (const i of r.items) { const c = concepts.get(i.concept) ?? { right: 0, all: 0 }; c.all++; if (i.correct) c.right++; concepts.set(i.concept, c); }
  const weak = [...concepts.entries()].filter(([, v]) => v.all >= 2 && v.right / v.all < 0.6).map(([concept, v]) => ({ concept, pct: Math.round((v.right / v.all) * 100), asked: v.all })).sort((a, b) => a.pct - b.pct);
  const earned = sorted.reduce((s, r) => s + chilliesOf(r), 0);
  const redeemed = sorted.reduce((s, r) => s + (r.kind === 'redo' ? (r.redeem?.length ?? 0) : 0), 0);
  return { sessions: quizzes.length, toffees: sorted.reduce((s, r) => s + r.toffees, 0), chillies: Math.max(0, earned - redeemed), chilliesEarned: earned, redeemed, pct: total ? Math.round((correct / total) * 100) : 0, recent: sorted, weak };
}

const BACKUP = 'ai-guru:quiz-outbox:v1';

/** Saves a record: server first; if that fails it waits in the browser and is sent next time. */
export async function saveRecord(rec: SessionRecord, fetcher: typeof fetch = fetch): Promise<boolean> {
  const queue = readOutbox();
  queue.push(rec);
  writeOutbox(queue);
  return flushOutbox(fetcher);
}

export async function flushOutbox(fetcher: typeof fetch = fetch): Promise<boolean> {
  const left: SessionRecord[] = [];
  for (const rec of readOutbox()) {
    try {
      const res = await fetcher('/api/ai-guru/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ record: rec }) });
      if (!res.ok) left.push(rec);
    } catch { left.push(rec); }
  }
  writeOutbox(left);
  return left.length === 0;
}

function readOutbox(): SessionRecord[] {
  try { return JSON.parse(localStorage.getItem(BACKUP) || '[]') as SessionRecord[]; } catch { return []; }
}
function writeOutbox(q: SessionRecord[]) {
  try { localStorage.setItem(BACKUP, JSON.stringify(q.slice(-50))); } catch { /* storage blocked: the save still went to the server */ }
}
