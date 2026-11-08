/**
 * Toffee quiz (V51.9.62) — surprising multiple-choice questions, one toffee per right answer.
 *
 * Marking follows OpenMAIC's quiz view: choice questions are marked here, in the app, by matching the answer key
 * (never by the AI at answer time), each question has points, and a session ends with a percentage and an
 * encouragement tier (90+ high, 70+ mid, below that low). On top of that: a golden question worth two toffees,
 * a streak bonus, and a full-box bonus for a perfect session.
 */

export type McqKind = 'standard' | 'twist' | 'spot-the-mistake' | 'what-if' | 'real-life' | 'odd-one-out';
export const MCQ_KINDS: McqKind[] = ['standard', 'twist', 'spot-the-mistake', 'what-if', 'real-life', 'odd-one-out'];

export interface McqOption { id: 'A' | 'B' | 'C' | 'D'; text: string }
export interface McqItem {
  id: string;
  kind: McqKind;
  stem: string;
  options: McqOption[];
  answer: McqOption['id'];
  /** Why the right answer is right (shown after answering). */
  why: string;
  /** Concept the question tests (for the teacher's weak-spot view). */
  concept: string;
  /** The golden question: worth two toffees. */
  golden?: boolean;
}

const IDS: McqOption['id'][] = ['A', 'B', 'C', 'D'];

/** Checks one question coming from the AI; returns null when it cannot be used. */
export function cleanMcq(raw: unknown, index: number): McqItem | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return null;
  const stem = String(r.stem ?? r.question ?? '').trim();
  const optsIn = Array.isArray(r.options) ? r.options : [];
  const texts = optsIn.map((o) => String(typeof o === 'object' && o ? (o as { text?: unknown }).text ?? '' : o).trim());
  if (!stem || texts.length !== 4 || texts.some((t) => !t)) return null;
  if (new Set(texts.map((t) => t.toLowerCase())).size !== 4) return null; // two options the same
  const ans = String(r.answer ?? '').trim().toUpperCase().slice(0, 1) as McqOption['id'];
  if (!IDS.includes(ans)) return null;
  const why = String(r.why ?? r.explanation ?? '').trim();
  if (!why) return null;
  const kind = (MCQ_KINDS as string[]).includes(String(r.kind)) ? (r.kind as McqKind) : 'standard';
  return {
    id: `q${index + 1}`,
    kind,
    stem,
    options: texts.map((text, i) => ({ id: IDS[i], text })),
    answer: ans,
    why,
    concept: String(r.concept ?? '').trim() || 'this lesson',
  };
}

/** Marks the golden question: one per quiz, chosen from the seed so a retry of the same quiz keeps it. */
export function placeGolden(items: McqItem[], seed: number): McqItem[] {
  if (items.length < 3) return items;
  const at = 1 + (Math.abs(Math.floor(seed)) % (items.length - 1)); // never the first question
  return items.map((q, i) => ({ ...q, golden: i === at }));
}

/** Moves the right answer to a spread of positions (the AI tends to put it on B). Keeps A–D labels in order. */
export function spreadAnswers(items: McqItem[], seed: number): McqItem[] {
  return items.map((q, i) => {
    const want = (seed + i * 3) % 4;
    const cur = IDS.indexOf(q.answer);
    if (cur === want) return q;
    const texts = q.options.map((o) => o.text);
    [texts[cur], texts[want]] = [texts[want], texts[cur]];
    return { ...q, options: texts.map((text, k) => ({ id: IDS[k], text })), answer: IDS[want] };
  });
}

export interface McqAnswer { id: string; chosen: McqOption['id'] | null; correct: boolean; toffees: number; /** 1 for a wrong answer, else 0. */ chillies: number; ms: number }

/** Toffees for the answer just given. `streakBefore` = right answers in a row before this one. */
export function toffeesFor(q: McqItem, correct: boolean, streakBefore: number): number {
  if (!correct) return 0;
  const base = q.golden ? 2 : 1;
  const streak = (streakBefore + 1) % 3 === 0 ? 1 : 0;
  return base + streak;
}

/** The reward pair: a right answer earns toffees, a wrong one earns a chilli. */
export const chilliesFor = (correct: boolean): number => (correct ? 0 : 1);

export type Tier = 'high' | 'mid' | 'low';
export const tierFor = (pct: number): Tier => (pct >= 90 ? 'high' : pct >= 70 ? 'mid' : 'low');

export interface McqSummary {
  total: number;
  correct: number;
  pct: number;
  toffees: number;
  chillies: number;
  fullBox: number;
  bestStreak: number;
  tier: Tier;
}

export function summarise(answers: McqAnswer[], total = answers.length): McqSummary {
  const correct = answers.filter((a) => a.correct).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  let run = 0;
  let best = 0;
  for (const a of answers) { run = a.correct ? run + 1 : 0; best = Math.max(best, run); }
  const fullBox = total >= 3 && correct === total && answers.length === total ? 2 : 0;
  return { total, correct, pct, fullBox, bestStreak: best, toffees: answers.reduce((s, a) => s + a.toffees, 0) + fullBox, chillies: answers.reduce((s, a) => s + a.chillies, 0), tier: tierFor(pct) };
}

/** The question-writing prompt. The model writes the question and the answer key; the app marks. */
export function mcqPrompt(o: { chapter: string; section: string; text: string; count: number; language: 'english' | 'malayalam'; grade: string | number }): { system: string; user: string } {
  const lang = o.language === 'malayalam' ? 'Malayalam (keep numbers, symbols and maths terms as in the textbook)' : 'English';
  return {
    system: [
      `You write multiple-choice questions for a class ${o.grade} student, in ${lang}.`,
      'Every question must be answerable from the lesson text given. Never use facts that are not in it.',
      'Make them surprising and fun, not a plain recall list. Use a mix of these kinds:',
      '- "twist": looks like one thing, tests another (a common trap, but fair).',
      '- "spot-the-mistake": show a short working with one wrong step; the options say which step is wrong.',
      '- "what-if": change one number or condition and ask what happens.',
      '- "real-life": a one-line everyday situation (market, bus, cricket, rain) using the idea.',
      '- "odd-one-out": three belong together, one does not.',
      '- "standard": a clear direct question (at most one).',
      'Exactly 4 options per question, only one correct, wrong options that a student could really pick (no silly ones).',
      'Work out every calculation carefully and check that the answer key is right before writing it.',
      'Keep each stem under 220 characters and each option under 80.',
      'Reply with JSON only: {"questions":[{"kind":"twist","stem":"...","options":["...","...","...","..."],"answer":"B","why":"one or two sentences","concept":"2-4 words"}]}',
    ].join('\n'),
    user: `Chapter: ${o.chapter}\nSection: ${o.section}\nWrite ${o.count} questions.\n\nLESSON TEXT:\n${o.text.slice(0, 9000)}`,
  };
}

export type McqLlm = (system: string, user: string) => Promise<string>;

export async function generateMcqs(llm: McqLlm, o: Parameters<typeof mcqPrompt>[0] & { seed?: number }): Promise<McqItem[]> {
  const { system, user } = mcqPrompt(o);
  const seed = o.seed ?? Date.now();
  let last = 'no usable questions';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await llm(system, attempt ? `${user}\n\nYour last reply could not be used (${last}). Reply with valid JSON only.` : user);
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : text) as { questions?: unknown[] };
      const items = (parsed.questions ?? []).map((q, i) => cleanMcq(q, i)).filter((q): q is McqItem => !!q).slice(0, o.count);
      if (items.length >= Math.min(3, o.count)) return placeGolden(spreadAnswers(items, seed), seed);
      last = `only ${items.length} valid questions`;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Could not make the quiz: ${last}`);
}
