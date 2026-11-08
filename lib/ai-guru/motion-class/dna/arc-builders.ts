/**
 * Scenes of the lesson arc (V51.9.46): the mascot's hook and "why?", the rule typeset, the check with
 * numbers and the summary. Each is one short scene with the same grammar (captions, colours, verbs) as
 * every DNA; English and Malayalam have identical pictures, only the words change.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import { drawMascot, hopMascot, setPose, speechBubble, thoughtBubble, type Mascot } from '../../reels/motion/mascot';
import { mathBox, showMath } from '../../reels/motion/typeset';
import { decomposeMath, locateParts } from '../../reels/motion/decompose';
import type { Bi, LessonArc } from './types';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const W = 720;
const H = 444;

/** Where she stands, how big, and where the bubbles sit. */
const MX = 118;
const MY = 318;
const MS = 1.15;
const BUBBLE_X = 410;
const BUBBLE_Y = 118;
const BUBBLE_W = 500;

export const ARC_LABELS: Record<'rule' | 'check' | 'mistake', Bi> = {
  rule: { en: 'RULE', ml: 'നിയമം' },
  check: { en: 'CHECK', ml: 'പരിശോധന' },
  mistake: { en: 'COMMON MISTAKE', ml: 'പതിവ് തെറ്റ്' },
};

export const ARC_WORDS = { hook: 16, whyQuestion: 16, whyAnswer: 30, summary: 28, mistake: 30, partLabel: 8 };

function newScene(title: string): Motion {
  const m = new Motion(title, W, H);
  m.fixView(W / 2, W);
  return m;
}

function standing(m: Motion, t: number, look: 1 | -1 = 1): { mc: Mascot; end: number } {
  const { mascot, end } = drawMascot(m, 'mc', MX, MY, MS, t, 'idle', look);
  return { mc: mascot, end };
}

const head = (mc: Mascot): [number, number] => [mc.x + 18, mc.box.y0 + 8];

/** The mascot wonders about a question (thought bubble) before the picture. */
export function buildHook(text: Bi, lang: Lang, title: string): MotionScene {
  const m = newScene(title);
  let t = m.step(pick(text, lang), 300, 2600);
  const { mc, end } = standing(m, t + 100);
  t = setPose(m, mc, 'think', end + 150) + 150;
  const b = thoughtBubble(m, 'hk', pick(text, lang), t, { x: BUBBLE_X, y: BUBBLE_Y, maxW: BUBBLE_W, toward: head(mc) });
  t = m.write(b.lines, t + 800, 150) + 200;
  m.hold(t + 800);
  return m.build(900);
}

/** "But why?": the mascot asks in a thought bubble, then answers in a speech bubble and cheers. */
export function buildWhy(why: NonNullable<LessonArc['why']>, lang: Lang, title: string): MotionScene {
  const m = newScene(title);
  let t = m.step(pick(why.question, lang), 300, 2400);
  const { mc, end } = standing(m, t + 100);
  t = setPose(m, mc, 'ask', end + 150) + 150;
  const q = thoughtBubble(m, 'wq', pick(why.question, lang), t, { x: BUBBLE_X, y: BUBBLE_Y, maxW: BUBBLE_W, toward: head(mc) });
  t = m.write(q.lines, t + 800, 150) + 400;
  t = m.step(pick(why.answer, lang), t, 2800);
  m.fadeOut(q.ids, t, 350);
  t = setPose(m, mc, 'cheer', t + 150) + 100;
  const a = speechBubble(m, 'wa', pick(why.answer, lang), t, { x: BUBBLE_X, y: BUBBLE_Y + 8, maxW: BUBBLE_W, toward: head(mc) });
  t = m.write(a.lines, t + 600, 120) + 200;
  t = hopMascot(m, mc, t) + 200;
  m.hold(t + 800);
  return m.build(900);
}

/** A label pill at the top left of the board. */
export function pill(m: Motion, id: string, text: string, t: number, o: { widen?: number } = {}): number {
  const w = tokenWidth(text, 22) * (o.widen ?? 1) + 44;
  m.poly(`${id}_p`, [[34, 22], [34 + w, 22], [34 + w, 56], [34, 56]], t, { color: 'accent', closed: true, width: 3, dur: 400, silent: true, z: 2 });
  m.text(`${id}_t`, text, 34 + w / 2, 39, { size: 22, color: 'accent', z: 5 });
  return m.appear([`${id}_t`], t + 200, 0, false);
}

/** The rule as a typeset formula in a box, under a RULE pill. */
export function buildFormal(formal: NonNullable<LessonArc['formal']>, lang: Lang, title: string): MotionScene {
  const m = newScene(title);
  let t = m.step(pick(formal.say, lang), 300, 2600);
  t = pill(m, 'fm', pick(ARC_LABELS.rule, lang), t);
  // V51.9.51: with parts, the formula sits higher so the braces and labels fit under it.
  const located = formal.parts?.length ? locateParts(formal.tex, formal.parts) : null;
  const parts = located && 'ranges' in located ? located.ranges : null;
  const { h, end } = showMath(m, 'fx', formal.tex, W / 2, parts ? 150 : 215, t + 200, { size: parts ? 52 : 56, maxWidth: 620 });
  let at = end;
  if (parts && formal.parts) {
    at = decomposeMath(
      m,
      'fx',
      h,
      formal.parts.map((p, i) => ({ range: parts[i], label: pick(p.label, lang), say: p.say ? pick(p.say, lang) : undefined })),
      end + 400,
    );
  }
  const b = mathBox(h);
  t = m.box('fxbox', (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.x1 - b.x0 + 40, b.y1 - b.y0 + 28, at + 200, 'result') + 200;
  m.hold(t + 900);
  return m.build(900);
}

/** The numbers put back into the rule, with a tick. */
export function buildCheck(check: NonNullable<LessonArc['check']>, lang: Lang, title: string): MotionScene {
  const m = newScene(title);
  let t = m.step(pick(check.say, lang), 300, 2600);
  t = pill(m, 'ck', pick(ARC_LABELS.check, lang), t);
  const { h, end } = showMath(m, 'cx', check.tex, W / 2 - 24, 215, t + 200, { size: 52, maxWidth: 560 });
  const b = mathBox(h);
  t = m.tick('cktick', Math.min(W - 40, b.x1 + 40), (b.y0 + b.y1) / 2, end + 200, 40) + 200;
  m.hold(t + 900);
  return m.build(900);
}

/**
 * V51.9.51 — the common mistake: "You might think…" with the wrong line in red; the reason, as the wrong
 * line is struck out with a cross; then the right line in green with a tick. Same picture in both languages.
 */
export function buildMistake(mk: NonNullable<LessonArc['mistake']>, lang: Lang, title: string): MotionScene {
  const m = newScene(title);
  let t = m.step(pick(mk.wrong.say, lang), 300, 2600);
  // long capitals: the measured width runs short, so this pill is drawn a little wider
  t = pill(m, 'mk', pick(ARC_LABELS.mistake, lang), t, { widen: 1.22 });
  const wrong = showMath(m, 'mw', mk.wrong.tex, W / 2, 150, t + 200, { size: 50, maxWidth: 560, color: 'a' });
  const wb = mathBox(wrong.h);
  t = wrong.end + 500;
  m.hold(t);
  t = m.step(pick(mk.why, lang), t, 2600);
  const cy = (wb.y0 + wb.y1) / 2;
  t = m.rule('mw_x', wb.x0 - 14, cy, wb.x1 + 14, cy, t, { color: 'accent', width: 5 }) + 100;
  // a drawn cross (two pen strokes), not a font glyph
  const cx = Math.min(W - 30, wb.x1 + 46);
  m.rule('mw_c1', cx - 14, cy - 14, cx + 14, cy + 14, t, { color: 'accent', width: 5 });
  t = m.rule('mw_c2', cx + 14, cy - 14, cx - 14, cy + 14, t + 150, { color: 'accent', width: 5 }) + 150;
  m.dim(wrong.h.glyphs.map((g) => g.id), t + 200);
  t += 700;
  m.hold(t);
  t = m.step(pick(mk.right.say, lang), t, 2600);
  const right = showMath(m, 'mr', mk.right.tex, W / 2, 300, t + 150, { size: 50, maxWidth: 560, color: 'c' });
  const rb = mathBox(right.h);
  t = m.tick('mr_tick', Math.min(W - 30, rb.x1 + 44), (rb.y0 + rb.y1) / 2, right.end + 200, 40) + 200;
  m.hold(t + 900);
  return m.build(900);
}

/** The mascot cheers and says the summary. */
export function buildSummary(text: Bi, lang: Lang, title: string): MotionScene {
  const m = newScene(title);
  let t = m.step(pick(text, lang), 300, 2800);
  const { mc, end } = standing(m, t + 100);
  t = setPose(m, mc, 'cheer', end + 150) + 100;
  const b = speechBubble(m, 'sm', pick(text, lang), t, { x: BUBBLE_X, y: BUBBLE_Y + 8, maxW: BUBBLE_W, toward: head(mc) });
  t = m.write(b.lines, t + 600, 120) + 200;
  t = hopMascot(m, mc, t) + 200;
  m.hold(t + 800);
  return m.build(900);
}

/** The arc's scenes: those that come before the unit's picture, and those after it. */
export function arcScenes(arc: LessonArc | undefined, lang: Lang, title: string): { before: MotionScene[]; after: MotionScene[] } {
  const before: MotionScene[] = [];
  const after: MotionScene[] = [];
  if (!arc) return { before, after };
  if (arc.hook) before.push(buildHook(arc.hook, lang, title));
  if (arc.mistake && arc.mistake.at === 'before') before.push(buildMistake(arc.mistake, lang, title));
  if (arc.mistake && arc.mistake.at !== 'before') after.push(buildMistake(arc.mistake, lang, title));
  if (arc.why) after.push(buildWhy(arc.why, lang, title));
  if (arc.formal) after.push(buildFormal(arc.formal, lang, title));
  if (arc.check) after.push(buildCheck(arc.check, lang, title));
  if (arc.summary) after.push(buildSummary(arc.summary, lang, title));
  return { before, after };
}
