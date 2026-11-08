/**
 * V51.9.111 — the questions inside the class earn the same rewards as the quiz: a right answer is a toffee, a wrong one
 * a chilli (a skip earns nothing). The counters change at once (on this device), and the answer is saved for the teacher
 * and the parent like a one-question quiz; a missed four-choice question can later be redone ("Turn my chillies into
 * toffees"). Each question counts once per class.
 */
import type { QuestionAnswer } from '@/components/ai-guru/motion-class/ClassQuestionOverlay';
import { addReward } from '@/lib/ai-guru/quiz/rewards';
import { saveRecord, studentCode, type SessionRecord } from '@/lib/ai-guru/quiz/records';
import type { PlacedQuestion } from './questions';

const LETTERS = ['a', 'b', 'c', 'd'];

/** The answer as a quiz record (pure). */
export function classAnswerRecord(q: PlacedQuestion, a: QuestionAnswer, o: { studentId: string; studentName: string; grade?: string | number; chapter: string; section: string; at?: Date }): SessionRecord {
  const lang = q.lang === 'ml' ? 'ml' : 'en';
  const opts = q.options ?? [];
  const four = opts.length === 4;
  const letter = (id: string | null) => (id === null ? null : four ? LETTERS[opts.findIndex((x) => x.id === id)] ?? null : null);
  const right = opts.find((x) => x.correct);
  const at = o.at ?? new Date();
  return {
    id: `class-${at.getTime().toString(36)}-${q.id.slice(-8)}`.slice(0, 60),
    studentId: o.studentId,
    code: studentCode(o.studentId),
    studentName: o.studentName || 'Student',
    at: at.toISOString(),
    grade: String(o.grade ?? ''),
    chapter: o.chapter,
    section: `In-class question · ${o.section}`.slice(0, 300),
    total: 1,
    correct: a.correct ? 1 : 0,
    pct: a.correct ? 100 : 0,
    toffees: a.correct ? 1 : 0,
    chillies: a.correct ? 0 : 1,
    tier: a.correct ? 'high' : 'low',
    bestStreak: a.correct ? 1 : 0,
    seconds: 0,
    items: [{
      id: q.id.slice(-20), kind: 'standard', stem: q.prompt[lang] || q.prompt.en, concept: q.conceptId, chosen: letter(a.picked), answer: four && right ? letter(right.id) ?? '' : '',
      correct: a.correct, toffees: a.correct ? 1 : 0, chillies: a.correct ? 0 : 1, seconds: 0,
      ...(four ? { options: opts.map((x, i) => ({ id: LETTERS[i], text: x.text[lang] || x.text.en })) } : {}),
      why: q.explain[lang] || q.explain.en,
    }],
  };
}

/** Adds the toffee or chilli now and sends the answer to the teacher and parent (kept on the device when offline). */
export function rewardClassAnswer(q: PlacedQuestion, a: QuestionAnswer, o: Parameters<typeof classAnswerRecord>[2]): void {
  if (a.skipped) return;
  addReward(o.studentId, a.correct ? { toffees: 1 } : { chillies: 1 }, { lang: q.lang === 'ml' ? 'ml' : 'en', reported: true }); // V51.9.117: celebrated, and said to be reported
  void saveRecord(classAnswerRecord(q, a, o)).catch(() => undefined);
}
