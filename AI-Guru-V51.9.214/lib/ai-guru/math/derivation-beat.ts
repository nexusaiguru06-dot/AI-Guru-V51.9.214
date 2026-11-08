/**
 * Board grammar for worked mathematics = the worked-solution TEMPLATE (see template-types.ts):
 *
 *   - the ORIGINAL expression is on the board before anything is manipulated;
 *   - every transformation is its own line, in its own colour;
 *   - an ARC over the part just operated on (or a CIRCLE around the isolated term);
 *   - a coloured LABEL to the right of the line ("Subtract 5 from both sides");
 *   - the answer BOXED; then the CHECK.
 *
 * Rows come from either the deterministic solver (template-solver.ts, all steps + check) or, when the
 * problem is not one the solver knows, from the lesson's own before/operation/after steps, drawn in the
 * exact same look. The board carries mathematics only; captions and voice are separate.
 *
 * Pure module (no React / DOM): it only talks to anything with `reveal(action)`.
 */
import type { VisualAction } from '../lesson/types';
import { computeFocus } from './template-focus';
import { rowToSpec, type TemplateRow, type RowKind } from './template-types';

export interface RevealTarget { reveal(action: VisualAction): Promise<void> | void }

export interface DerivationState {
  /** Language of default captions (the step's own caption always wins). */
  lang?: CaptionLanguage;
  /** Unique per paragraph/section - used to build stable block ids. */
  key: string;
  /** How many math lines have been written so far. */
  lines: number;
  /** Text of the most recent math line. */
  lastText: string;
  /** Number of transformation rows so far (picks the colour of the next one). */
  ordinal: number;
}

export function newDerivation(key: string): DerivationState {
  return { key, lines: 0, lastText: '', ordinal: 0 };
}

/** True when a string contains actual mathematics (digits, an operator or a relation).
 *  Narrative labels such as "Dynamic GeoGebra Model" are NOT mathematics and must not
 *  be painted on the board as if they were a solution line. */
export function isMathLike(text: unknown): boolean {
  return /[0-9=+\u2212\u00d7\u00f7/^\u221a\u03c0<>\u2264\u2265]/.test(String(text ?? ''));
}

const norm = (s: string) => s.replace(/\s+/g, '').replace(/[\u2212\u2013]/g, '-');
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}\u2026` : s);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function safe(target: RevealTarget | null | undefined, action: any) {
  try { await target?.reveal(action as VisualAction); } catch { /* the board must never block teaching */ }
}

/** Pin the problem statement (short, muted) at the top of the board. Once per paragraph, and only when the
 *  paragraph really has mathematics to draw. */
export async function pinProblem(target: RevealTarget | null | undefined, key: string, text: string) {
  const line = String(text || '').split(/\n/).map((s) => s.trim()).filter(Boolean)[0] || '';
  if (!line) return;
  await safe(target, { type: 'write', id: `${key}-problem`, content: clip(line, 90), x: 40, y: 30, width: 900, fontSize: 17, durationMs: 200, role: 'problem' });
}

/**
 * CAPTIONS ARE MANDATORY for every board row, whatever template/board mode is active: a row with no
 * caption gets a default one (the step icons are attached to every row by the board itself).
 */
export type CaptionLanguage = 'english' | 'malayalam';
const DEFAULT_CAPTIONS: Record<RowKind, [string, string]> = {
  original: ['Given', '\u0d24\u0d28\u0d4d\u0d28\u0d3f\u0d30\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d28\u0d4d\u0d28\u0d24\u0d4d'],
  step: ['Next step', '\u0d05\u0d1f\u0d41\u0d24\u0d4d\u0d24 \u0d18\u0d1f\u0d4d\u0d1f\u0d02'],
  result: ['Therefore', '\u0d05\u0d24\u0d3f\u0d28\u0d3e\u0d7d'],
  'check-title': ['Check the answer', '\u0d09\u0d24\u0d4d\u0d24\u0d30\u0d02 \u0d2a\u0d30\u0d3f\u0d36\u0d4b\u0d27\u0d3f\u0d15\u0d4d\u0d15\u0d3e\u0d02'],
  check: ['Substitute and check', '\u0d2a\u0d15\u0d30\u0d02 \u0d35\u0d46\u0d1a\u0d4d\u0d1a\u0d4d \u0d2a\u0d30\u0d3f\u0d36\u0d4b\u0d27\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15'],
  'check-ok': ['Both sides agree', '\u0d07\u0d30\u0d41\u0d35\u0d36\u0d19\u0d4d\u0d19\u0d33\u0d41\u0d02 \u0d12\u0d15\u0d4d\u0d15\u0d41\u0d28\u0d4d\u0d28\u0d41'],
  answer: ['Answer', '\u0d09\u0d24\u0d4d\u0d24\u0d30\u0d02'],
  note: ['Note', '\u0d15\u0d41\u0d31\u0d3f\u0d2a\u0d4d\u0d2a\u0d4d'],
};
export function ensureCaption(row: TemplateRow, lang: CaptionLanguage = 'english'): TemplateRow {
  const own = (lang === 'malayalam' ? row.labelMl || row.label : row.label) || '';
  if (own.trim()) return own === row.label ? row : { ...row, label: own };
  const d = DEFAULT_CAPTIONS[row.kind] ?? DEFAULT_CAPTIONS.step;
  return { ...row, label: lang === 'malayalam' ? d[1] : d[0] };
}

/** Draw one template row (colour, arc/circle, right-hand label, box). Always captioned. */
export async function playTemplateRow(target: RevealTarget | null | undefined, key: string, rawRow: TemplateRow, pace: { pause: (ms: number) => Promise<void> } = { pause: sleep }, lang: CaptionLanguage = 'english') {
  const row = ensureCaption(rawRow, lang);
  await safe(target, {
    type: 'write', id: `${key}-${row.id}`, content: row.text, x: 80, y: 120, width: 840,
    fontSize: 26, durationMs: 380, role: 'tpl', tpl: rowToSpec(row),
  });
  await pace.pause(220);
}

/**
 * A captioned step row for steps that have no derivation line of their own (geometry / graph / visual templates,
 * narrative steps, legacy notes). It carries the same caption + icon row as every other step, so the student can
 * pause, continue, repeat and move up/down in EVERY template.
 */
export async function playStepBar(
  target: RevealTarget | null | undefined, key: string,
  step: { id: string; n: number; caption: string; text?: string },
  ordinal: number, lang: CaptionLanguage = 'english',
  pace: { pause: (ms: number) => Promise<void> } = { pause: sleep },
) {
  // HARD SEPARATION: spoken/caption prose must never be copied onto the whiteboard.
  // The caption argument is retained for API compatibility and TTS/UI use by callers only.
  // A step bar contains only a mathematical line (when supplied) or a compact step marker.
  const stepWord = lang === 'malayalam' ? '\u0d18\u0d1f\u0d4d\u0d1f\u0d02' : 'Step';
  const boardText = step.text?.trim() || `${stepWord} ${step.n}`;
  const row: TemplateRow = {
    id: `bar-${step.id}`, kind: 'step', text: boardText,
    label: `${stepWord} ${step.n}`, ordinal, captionEn: '',
  };
  await playTemplateRow(target, key, row, pace, lang);
}

export interface DerivationStepInput { before: string; after: string; operation?: string; isLast?: boolean }

const capitalise = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * Generic path (the lesson's own steps): [original line] then this step's new line with an arc/circle on what
 * changed and the operation as its right-hand label; the final line is boxed. Resolves when the board is done,
 * so narration that follows stays in sync.
 */
export async function playDerivationStep(
  target: RevealTarget | null | undefined,
  st: DerivationState,
  step: DerivationStepInput,
  pace: { pause: (ms: number) => Promise<void> } = { pause: sleep },
): Promise<number> {
  let drawn = 0;
  const before = String(step.before || '').trim();
  const after = String(step.after || '').trim();
  const op = capitalise(String(step.operation || '').trim().replace(/^\u2193\s*/, ''));

  const draw = async (kind: RowKind, text: string, label?: string, boxed?: boolean) => {
    const prev = st.lastText || undefined;
    const isStep = kind === 'step' || kind === 'result';
    const row: TemplateRow = {
      id: `line-${st.lines}`, kind, text, label: label ? clip(label, 64) : undefined,
      focus: isStep ? computeFocus(prev, text) : undefined, ordinal: st.ordinal, boxed, captionEn: '',
    };
    st.lines += 1;
    if (isStep) st.ordinal += 1;
    st.lastText = text;
    await playTemplateRow(target, st.key, row, pace, st.lang ?? 'english');
    drawn += 1;
  };

  // 1) The starting expression is on the board before it is manipulated.
  //    Also re-anchor if the model's steps do not chain (before !== previous after), so no jump is hidden.
  if (before && (!st.lastText || norm(before) !== norm(st.lastText))) {
    await draw(st.lastText ? 'step' : 'original', before);
  }
  if (!after || norm(after) === norm(st.lastText)) return drawn;

  // 2) The new line: own colour, arc/circle over what changed, label on the right; the answer is boxed.
  // Add a short, visible token-flight between the old and new equations. It gives
  // the learner a 3B1B-style sense of transformation instead of two static text rows.
  const token = (after.match(/[0-9]+(?:\.[0-9]+)?/) || before.match(/[0-9]+(?:\.[0-9]+)?/))?.[0];
  if (token && before !== after) {
    const fromX = 390 + Math.min(150, Math.max(0, before.indexOf(token) * 11));
    const toX = 430 + Math.min(170, Math.max(0, after.indexOf(token) * 11));
    await safe(target, { type: 'token-move', id: `${st.key}-token-${st.lines}`, token, fromX, fromY: 150 + st.lines * 78, toX, toY: 150 + (st.lines + 1) * 78, durationMs: 520, fadeOut: true, fontSize: 34 });
  }
  await draw(step.isLast ? 'result' : 'step', after, op || (step.isLast ? 'Therefore' : undefined), !!step.isLast);
  return drawn;
}

/* ------------------------------------------------------------------ */
/* Grouping for the side panels: steps are numbered per paragraph so   */
/* the student can follow the order (Step 1, 2, 3 … of THIS problem).  */
/* ------------------------------------------------------------------ */
export interface HistoryLike { key: string; paragraph: number; heading: string; step: { before: string; after: string } }
export interface HistoryGroup<T extends HistoryLike> { paragraph: number; heading: string; items: { item: T; n: number }[] }

export function groupHistory<T extends HistoryLike>(items: T[], countStep?: (i: T) => boolean): HistoryGroup<T>[] {
  const groups: HistoryGroup<T>[] = [];
  const counts = new Map<HistoryGroup<T>, number>();
  for (const item of items) {
    let g = groups[groups.length - 1];
    if (!g || g.paragraph !== item.paragraph) { g = { paragraph: item.paragraph, heading: item.heading, items: [] }; groups.push(g); counts.set(g, 0); }
    // n = 1, 2, 3 … within THIS paragraph; entries that are not real steps get n = 0 ("Concept").
    let n = 0;
    if (!countStep || countStep(item)) { n = (counts.get(g) ?? 0) + 1; counts.set(g, n); }
    g.items.push({ item, n });
  }
  return groups;
}
