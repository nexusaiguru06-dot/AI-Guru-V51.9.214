/**
 * Extra pictures for formerly text-only DNAs (V51.9.46): the identity tried with numbers in two
 * columns (left side | right side), and a pair of equations tied together by a brace. Everything
 * shown is computed from the plan: the values come from the verified evaluator in wp-check.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { DUR, type Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import { pill } from './arc-builders';
import { checkLines, type Vars } from './wp-check';
import type { Bi, ChainPlan } from './types';

type Pt = [number, number];
const W = 720;
const H = 380;
const ROLES: Role[] = ['a', 'b', 'c'];

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');

/** Tokens → one line of text: no space before a superscript, after "(" or before ")". */
export function joinTokens(tokens: string[]): string {
  let out = '';
  tokens.forEach((t, i) => {
    const prev = tokens[i - 1];
    const tight = i === 0 || t === '²' || t === '³' || t === ')' || prev === '(';
    out += (tight ? '' : ' ') + t;
  });
  return out;
}

const LABELS = {
  try: { en: 'TRY NUMBERS', ml: 'സംഖ്യകൾ ഇട്ടുനോക്കാം' },
  left: { en: 'LEFT SIDE', ml: 'ഇടത് വശം' },
  right: { en: 'RIGHT SIDE', ml: 'വലത് വശം' },
  system: { en: 'BOTH AT ONCE', ml: 'ഒരേസമയം' },
};

const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);

/** The numbers an identity is tried with, or null when the plan has no identity line we can evaluate. */
export function identityTry(plan: ChainPlan): { vars: Vars; left: string[]; right: string[]; value: number } | null {
  const vars = plan.solutions?.[0];
  const line = plan.lines.find((l) => l.tokens.includes('='));
  if (!vars || !line) return null;
  const c = checkLines([{ tokens: line.tokens }], vars)?.[0];
  if (!c) return null;
  const at = c.tokens.indexOf('=');
  return { vars, left: c.tokens.slice(0, at), right: c.tokens.slice(at + 1), value: c.left };
}

function fitSize(text: string, max: number, size: number): number {
  let s = size;
  while (s > 16 && tokenWidth(text, s) > max) s -= 1;
  return s;
}

export function buildIdentityTry(plan: ChainPlan, lang: Lang, title: string): MotionScene | null {
  const it = identityTry(plan);
  if (!it) return null;
  const m = new Motion(title, W, H);
  m.camH.set(0, H);
  m.camY.set(0, H / 2);
  const vars = Object.entries(it.vars).map(([k, v]) => `${k} = ${fmt(v)}`).join(', ');
  const say =
    lang === 'ml'
      ? `സംഖ്യകൾ ഇട്ടുനോക്കാം: ${vars}. ഇരുവശത്തും ${fmt(it.value)} കിട്ടുന്നു.`
      : `Try numbers: ${vars}. Both sides give ${fmt(it.value)}.`;
  let t = m.step(say, 300, 2800);
  t = pill(m, 'tn', pick(LABELS.try as Bi, lang), t);
  const xs = [185, 535];
  const exprs = [joinTokens(it.left), joinTokens(it.right)];
  const heads = [pick(LABELS.left as Bi, lang), pick(LABELS.right as Bi, lang)];
  [0, 1].forEach((c) => {
    m.text(`h${c}`, heads[c], xs[c], 96, { size: 22, color: ROLES[c] });
    m.rule(`hr${c}`, xs[c] - 150, 114, xs[c] + 150, 114, t, { color: ROLES[c], width: 3 });
    m.text(`e${c}`, exprs[c], xs[c], 168, { size: fitSize(exprs[c], 310, 36), color: 'ink' });
    m.text(`v${c}`, fmt(it.value), xs[c], 262, { size: 56, color: ROLES[c] });
  });
  t = m.write(['h0', 'h1'], t + 200, 150) + 200;
  t = m.write(['e0', 'e1'], t, 250) + 300;
  [0, 1].forEach((c) => m.arrow(`ar${c}`, xs[c], 192, xs[c], 232, t + c * 200, ROLES[c]));
  t = m.appear(['v0', 'v1'], t + 700, 250) + 200;
  m.text('eq', '=', W / 2, 262, { size: 56, color: 'accent' });
  t = m.appear(['eq'], t, 0) + 150;
  t = m.tick('tntick', W / 2, 330, t, 44) + 200;
  m.hold(t + 1200);
  return m.build(900);
}

/** A left curly brace "{" whose vertical stroke is at x, from y0 to y1; the tip points left by d. */
export function bracePoints(x: number, y0: number, y1: number, d = 16, n = 8): Pt[] {
  const mid = (y0 + y1) / 2;
  const k = Math.min(22, (y1 - y0) / 4);
  const quad = (p0: Pt, c: Pt, p1: Pt): Pt[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const u = i / n;
      return [(1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * c[0] + u * u * p1[0], (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * c[1] + u * u * p1[1]] as Pt;
    });
  return [
    ...quad([x + d, y0], [x, y0], [x, y0 + k]),
    ...quad([x, mid - k], [x, mid], [x - d, mid]).slice(0),
    ...quad([x - d, mid], [x, mid], [x, mid + k]).slice(1),
    ...quad([x, y1 - k], [x, y1], [x + d, y1]),
  ];
}

const isLabel = (t: string) => /^\(\d\)$/.test(t);

/** Two equations tied by a brace: "both must be true at the same time". */
export function buildPairBrace(plan: ChainPlan, lang: Lang, title: string): MotionScene | null {
  const eqs = plan.lines.filter((l) => l.tokens.includes('=')).slice(0, 2);
  if (eqs.length !== 2) return null;
  const texts = eqs.map((l) => joinTokens(l.tokens.filter((t) => !isLabel(t))));
  if (texts.some((s) => !s || tokenWidth(s, 40) > 520)) return null;
  const m = new Motion(title, W, H);
  m.camH.set(0, H);
  m.camY.set(0, H / 2);
  const say = lang === 'ml' ? 'ഈ രണ്ട് സമവാക്യങ്ങളും ഒരേസമയം ശരിയാകണം.' : 'These two equations must both be true at the same time.';
  let t = m.step(say, 300, 2600);
  t = pill(m, 'pb', pick(LABELS.system as Bi, lang), t);
  const ys = [150, 235];
  const w = Math.max(...texts.map((s) => tokenWidth(s, 40)));
  const x0 = W / 2 - w / 2;
  texts.forEach((s, i) => m.text(`q${i}`, s, W / 2, ys[i], { size: 40, color: ROLES[i] }));
  t = m.write(['q0'], t + 200, 0, 600) + 200;
  t = m.write(['q1'], t, 0, 600) + 200;
  t = m.poly('brace', bracePoints(x0 - 30, ys[0] - 34, ys[1] + 34, 16), t, { color: 'accent', closed: false, width: 4, dur: 700 }) + 200;
  m.text('both', lang === 'ml' ? 'രണ്ടും ശരി' : 'both true', W / 2 + w / 2 + 28 + tokenWidth('both true', 26) / 2, (ys[0] + ys[1]) / 2, { size: 26, color: 'accent' });
  t = m.write(['both'], t, 0, 500) + 200;
  t = m.tick('pbtick', W / 2, 320, t, 40) + 100;
  m.hold(t + DUR.beat + 1100);
  return m.build(900);
}
