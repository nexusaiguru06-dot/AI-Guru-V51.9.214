/**
 * DNA builders: filled plan + language → motion scenes.
 *
 * Every builder uses only the motion grammar (appear / write / focus / recolor /
 * move / swap / merge / strike / box / tick / camera), so each DNA looks like
 * every other reel. Board geometry depends only on the plan's maths, so the
 * English and Malayalam builds of a plan share the same graphics; only captions,
 * voice and word labels change language.
 */

import { buildSketch } from './sketch-builders';
import type { SketchPlan } from './sketch-math';
import { buildConcept } from './concept-builders';
import { pill } from './arc-builders';
import { mathBox, mathProblem, showMath } from '../../reels/motion/typeset';
import { buildIdentityTry, buildPairBrace } from './visual-builders';
import { DUR, type Role } from '../../reels/motion/grammar';
import { Motion, type MotionScene } from '../../reels/motion/engine';
import { tokenWidth } from '../../reels/motion/metrics';
import { buildDerivation, type DerivationInput } from '../../reels/motion/recipes/derivation';
import { buildIntro } from '../../reels/motion/recipes/intro';
import { buildReel } from '../../reels/motion/reel';
import type { Lang } from '../../reels/motion/captions';
import { planTemplateSolution } from '../../math/template-solver';
import { buildGraph, buildPlane } from './plane-builders';
import { buildFractions, buildHistogram, buildTree } from './board-builders';
import { buildMatrix } from './matrix-builders';
import { buildShape } from './shape-builders';
import { buildVenn } from './venn-builders';
import { buildTrig } from './trig-builders';
import { buildLinear } from './lin-builders';
import { buildSeq } from './as-builders';
import { buildQuad } from './q-builders';
import { buildPoly } from './p-builders';
import { buildAngle } from './a-builders';
import { buildSolid } from './s-builders';
import { buildRatio } from './rp-builders';
import { buildBalance } from './bal-builders';
import { buildBeam } from './beam-builders';
import { buildPair } from './pair-builders';
import { buildTypeset } from './ts-builders';
import { buildQuadraticDerivation } from './qd-builders';
import { buildHclm } from './hl-builders';
import { checkLines, type CheckLine } from './wp-check';
import { buildPie } from './pc-builders';
import { buildFracLine } from './fl-builders';
import { buildChapterIntro } from './ci-builders';
import { buildMatrixOps } from './mo-builders';
import { buildAreaFig } from './af-builders';
import { buildCoord } from './cg-builders';
import { buildSquareIdentity } from './sq-builders';
import type {
  AreaModelPlan,
  Bi,
  BoardPlan,
  ChainLine,
  ChainPlan,
  ColumnPlan,
  CompositePlan,
  DnaId,
  FigurePlan,
  GraphPlan,
  FractionPlan,
  HistogramPlan,
  TreePlan,
  MatrixPlan,
  ShapePlan,
  VennPlan,
  TrigPlan,
  LinPlan,
  SeqPlan,
  QuadPlan,
  PolyPlan,
  AnglePlan,
  SolidPlan,
  RatioPlan,
  BalPlan,
  PairPlan,
  TsPlan,
  QdPlan,
  HlPlan,
  PiePlan, FracLinePlan, MatrixOpsPlan, AreaFigPlan, CoordPlan, SqPlan,
  KeyResultPlan,
  NumberLinePlan,
  PlanePlan,
  TablePlan,
  WordProblemPlan,
  ChapterIntroPlan,
} from './types';

export const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');

const ROLES: Role[] = ['a', 'b', 'c'];

/* ---------------- tokens ---------------- */

/** "2x − 10 = 100" → ["2","x","−","10","=","100"]; keeps {a/b} fractions and x^2 powers whole. */
export function tokenize(src: string): string[] {
  const s = src.replace(/-/g, '−').replace(/\*/g, '×').replace(/\s+/g, ' ').trim();
  const out = s.match(/\{[^{}]*\}|√?\d+(?:\.\d+)?(?:\^(?:\{[^}]*\}|\d+))?%?|[a-zA-Zθπ](?:\^(?:\{[^}]*\}|\d+))?|[−+×÷=()<>≤≥≈,√→←]|\S/g) ?? [];
  return out;
}

/* ---------------- paragraph writer ---------------- */

interface WordItem {
  id: string;
  text: string;
  line: number;
}

/**
 * Writes a paragraph as one item per word (so phrases can be coloured/focused).
 * Returns the word items and the bottom y.
 */
function paragraph(
  m: Motion,
  prefix: string,
  text: string,
  o: { x: number; y: number; width: number; size: number; color?: Role | string; align?: 'left' | 'center'; lineGap?: number },
): { words: WordItem[]; bottom: number; lines: string[][] } {
  const words = text.split(/\s+/).filter(Boolean);
  const space = tokenWidth(' ', o.size) * 1.05;
  const lines: string[][] = [[]];
  let w = 0;
  for (const word of words) {
    const ww = tokenWidth(word, o.size);
    if (w > 0 && w + space + ww > o.width) {
      lines.push([]);
      w = 0;
    }
    lines[lines.length - 1].push(word);
    w += (w > 0 ? space : 0) + ww;
  }
  const lh = o.size * (o.lineGap ?? 1.45);
  const items: WordItem[] = [];
  let k = 0;
  lines.forEach((ln, li) => {
    const widths = ln.map((t) => tokenWidth(t, o.size));
    const total = widths.reduce((a, b) => a + b, 0) + space * (ln.length - 1);
    let x = o.align === 'center' ? o.x + (o.width - total) / 2 : o.x;
    const y = o.y + li * lh;
    ln.forEach((t, i) => {
      const id = m.text(`${prefix}${k++}`, t, x + widths[i] / 2, y, { size: o.size, color: o.color ?? 'ink' });
      items.push({ id, text: t, line: li });
      x += widths[i] + space;
    });
  });
  return { words: items, bottom: o.y + (lines.length - 1) * lh + o.size * 0.7, lines };
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Word item ids that make up each phrase (first match, in order). */
function phraseIds(words: WordItem[], phrases: string[]): string[][] {
  return phrases.map((p) => {
    const target = p.split(/\s+/).map(norm).filter(Boolean);
    if (!target.length) return [];
    for (let i = 0; i + target.length <= words.length; i++) {
      if (target.every((t, j) => norm(words[i + j].text) === t || (j === target.length - 1 && norm(words[i + j].text).startsWith(t)))) {
        return words.slice(i, i + target.length).map((w) => w.id);
      }
    }
    return [];
  });
}

/* ---------------- DNA: concept board / section intro ---------------- */

export function buildBoard(plan: BoardPlan, lang: Lang, title: string): MotionScene[] {
  if (plan.layout || (plan.points?.length ?? 0) > 0) return buildConcept(plan, lang, title);
  return [
    buildIntro({
      title,
      heading: pick(plan.heading, lang) || title,
      points: plan.points.map((p) => ({ board: p.board ? pick(p.board, lang) : undefined, math: p.math, say: pick(p.say, lang) })),
    }),
  ];
}

/* ---------------- DNA: equation chain / pair / identity / mental math ---------------- */

export function chainToDerivation(plan: ChainPlan, lang: Lang, title: string): DerivationInput {
  return {
    title: plan.title || title,
    answer: plan.answer,
    lines: plan.lines.map((l: ChainLine) => ({
      tokens: l.tokens,
      caption: pick(l.caption, lang),
      note: l.note ? pick(l.note, lang) : undefined,
      links: l.links,
      fresh: l.fresh,
      cancel: l.cancel,
      check: l.check,
    })),
  };
}

export function buildChain(plan: ChainPlan, lang: Lang, title: string): MotionScene[] {
  return [buildDerivation(chainToDerivation(plan, lang, title))];
}

/** The verified solver (existing AI Guru template solver) as a chain plan with EN + ML captions. */
export function solverChain(problem: string): ChainPlan | null {
  const sol = planTemplateSolution(problem);
  if (!sol || !sol.verified) return null;
  const rows = sol.rows.filter((r) => r.kind === 'original' || r.kind === 'step' || r.kind === 'result');
  const lines: ChainLine[] = [];
  let lastText = '';
  rows.forEach((r, i) => {
    // "2x / 2 = 110 / 2" is shown as fractions.
    const text = r.text
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/(\d*[a-zA-Z]|\d+(?:\.\d+)?)\s*\/\s*(−?\d+(?:\.\d+)?)/g, '{$1/$2}');
    if (text === lastText) return; // "Simplifies to" rows that repeat the line add nothing on screen
    lastText = text;
    // Results "x = 1000,   y = 10000" → tokens with a comma.
    const tokens = tokenize(text.replace(/,\s+/g, ' , '));
    lines.push({
      tokens,
      caption: { en: r.captionEn, ml: r.captionMl },
      note: r.label && r.kind === 'step' && !/simplif/i.test(r.label) ? { en: r.label, ml: r.labelMl } : undefined,
      fresh: r.kind === 'original' && i > 0,
      check: !/[(]\d+[)]|,/.test(text),
    });
  });
  const vars: Record<string, number> = {};
  for (const m of sol.answerText.matchAll(/([a-z])\s*=\s*(−?-?\d+(?:\.\d+)?)/g)) vars[m[1]] = Number(m[2].replace('−', '-'));
  return { lines, solutions: Object.keys(vars).length ? [vars] : undefined };
}

/* ---------------- DNA: word problem ---------------- */

/**
 * A word problem as the viewer meets it (V51.9.44): the problem stays in the card at the top of every
 * frame (the class sets `scene.problem`), the white board defines the unknowns ("Let the price of a
 * chair be x"), turns each sentence into an equation, solves step by step, checks the answers in
 * every equation and says the answer in words.
 */
export function buildWordProblem(plan: WordProblemPlan, lang: Lang, title: string): MotionScene[] {
  const parts: MotionScene[] = [];
  const statement = pick(plan.statement, lang);
  const unknownRole = new Map<string, Role>(plan.unknowns.map((u, i) => [u.symbol, ROLES[i % 3]]));
  const label = lang === 'ml' ? 'പ്രശ്നം' : 'PROBLEM';
  const pin = (sc: MotionScene): MotionScene => {
    sc.problem = statement;
    sc.problemLabel = label;
    return sc;
  };

  // Part 1: unknowns → equations. The statement is in the card above, so the board starts straight away.
  const m = new Motion(title, 720, 0);
  let t = 300;
  t = m.step(lang === 'ml' ? 'പ്രശ്നം ശ്രദ്ധിച്ച് വായിക്കാം. അറിയാത്ത സംഖ്യകളെ അക്ഷരങ്ങളായി എടുക്കാം.' : 'Read the problem at the top. Now we name the unknown numbers with letters.', t, 2200);

  let y = 74;
  const unknownIds: string[] = [];
  for (const u of plan.unknowns) {
    const meaning = pick(u.meaning, lang);
    t = m.step(lang === 'ml' ? `${meaning} = ${u.symbol} എന്ന് എടുക്കാം.` : `Let ${u.symbol} be the ${meaning}.`, t, 1800);
    const sym = m.text(`u_${u.symbol}`, u.symbol, 80, y, { size: 44, color: unknownRole.get(u.symbol) });
    const eq = m.text(`ueq_${u.symbol}`, '=', 125, y, { size: 36 });
    const mw = Math.min(520, tokenWidth(meaning, 28));
    const mean = m.text(`umean_${u.symbol}`, meaning, 155 + mw / 2, y, { size: 28, color: 'ink' });
    t = m.appear([sym, eq], t, 100);
    t = m.write(mean, t) + DUR.beat;
    unknownIds.push(sym);
    y += 52;
  }

  // Equations: words → equation, letters keep their colours.
  y += 18;
  const tEquations = t;
  plan.equations.forEach((e, k) => {
    const phrase = pick(e.phrase, lang);
    t = m.step(phrase, t, 2000);
    const toks = e.tokens;
    const size = 40;
    const gap = 8;
    const widths = toks.map((tk) => tokenWidth(tk, size));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (toks.length - 1);
    let x = 360 - total / 2;
    const ids: string[] = [];
    toks.forEach((tk, j) => {
      const role: Role = unknownRole.get(tk) ?? (/^\d/.test(tk) ? 'result' : 'ink');
      ids.push(m.text(`eq${k}_${j}`, tk, x + widths[j] / 2, y, { size, color: role }));
      x += widths[j] + gap;
    });
    const num = m.text(`eqn${k}`, `(${k + 1})`, Math.min(690, 360 + total / 2 + 40), y, { size: 24, color: 'done' });
    // The unknown letters fly from the "Let x = …" lines into the equation.
    const flyers: string[] = [];
    toks.forEach((tk, j) => {
      if (unknownRole.has(tk)) {
        const c = m.clone(`u_${tk}`, m.uid('fl'), t);
        m.move(c, m.pos(ids[j], t).x, y, t, { dur: 600, arc: 30, sound: flyers.length === 0 });
        m.fadeOut(c, t + 600, 150);
        flyers.push(c);
        m.get(ids[j]).alpha.set(t + 600, 1);
      }
    });
    const others = ids.filter((_, j) => !unknownRole.has(toks[j]));
    t = m.appear(others, t + (flyers.length ? 350 : 0), 70);
    m.appear(num, t, 0, false);
    t += DUR.beat * 2;
    y += 66;
  });
  m.height = Math.max(420, y + 20);
  const view = Math.min(m.height, 620);
  m.camH.set(0, view);
  m.camY.set(0, view / 2);
  if (m.height > view && tEquations > 0) m.look(tEquations, m.height - view / 2);
  m.hold(t + 800);
  parts.push(pin(m.build(600)));

  // The textbook solves it later (or another scene does, e.g. on the balance scale): stop after the equations.
  if (plan.solvedLater) return parts;

  // Part 2: solve (explicit lines or the verified solver).
  const chain: ChainPlan | null = plan.solution?.lines?.length
    ? { lines: plan.solution.lines, solutions: plan.solutions }
    : plan.solution?.solver
      ? solverChain(plan.solution.solver)
      : null;
  if (chain) parts.push(...buildChain(chain, lang, title).map(pin));

  // Part 3: check the answers in every equation (only when each one really holds).
  const vars = plan.solutions?.[0] ?? chain?.solutions?.[0];
  const checks = checkLines(plan.equations, vars);
  if (checks && checks.length) parts.push(pin(buildWordCheck(checks, vars!, lang, title)));

  // Part 4: answer in words.
  if (!plan.answer || !pick(plan.answer, lang)) return parts;
  const a = new Motion(title, 720, 300);
  let ta = 300;
  ta = a.step(pick(plan.answer, lang), ta, 2600);
  const ans = paragraph(a, 'ans', pick(plan.answer, lang), { x: 60, y: 120, width: 600, size: 38, align: 'center', color: 'result' });
  ta = a.write(ans.words.map((w) => w.id), ta, 90, 320);
  ta = a.box('ansbox', 360, (120 + ans.bottom) / 2 - 2, 640, ans.bottom - 120 + 70, ta, 'accent');
  ta = a.tick('anstick', 650, 120 - 30, ta - 200);
  a.hold(ta + 1200);
  parts.push(pin(a.build(800)));
  return parts;
}

/** The check board: each equation with the answers put in, then a tick. */
function buildWordCheck(lines: CheckLine[], vars: Record<string, number>, lang: Lang, title: string): MotionScene {
  const m = new Motion(title, 720, 0);
  let t = 300;
  const given = Object.entries(vars).map(([k, v]) => `${k} = ${v}`).join(', ');
  t = m.step(lang === 'ml' ? `ഉത്തരം ശരിയാണോ എന്ന് നോക്കാം: ${given} എന്ന് ഓരോ സമവാക്യത്തിലും ചേർത്ത് നോക്കാം.` : `Let us check the answer: put ${given} into each equation.`, t, 2400);
  let y = 90;
  lines.forEach((ln, k) => {
    t = m.step(lang === 'ml' ? `സമവാക്യം (${k + 1}) ൽ ചേർക്കുമ്പോൾ ഇടതുവശം ${ln.left}; അത് വലതുവശത്തിനോട് തുല്യം.` : `In equation (${k + 1}) the left side comes to ${ln.left}, the same as the right side.`, t, 2200);
    const size = 36;
    const gap = 8;
    const toks = ln.tokens;
    const widths = toks.map((tk) => tokenWidth(tk, size));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (toks.length - 1);
    const scale = total > 600 ? 600 / total : 1;
    let x = 360 - (total * scale) / 2 - 20;
    const ids: string[] = [];
    toks.forEach((tk, j) => {
      const role: Role = /^\d/.test(tk) ? 'result' : 'ink';
      ids.push(m.text(`ck${k}_${j}`, tk, x + (widths[j] * scale) / 2, y, { size: Math.round(size * scale), color: role }));
      x += (widths[j] + gap) * scale;
    });
    t = m.appear(ids, t, 70) + 200;
    t = m.tick(`cktick${k}`, x + 24, y, t, 34) + 200;
    y += 74;
  });
  m.height = Math.max(300, y + 30);
  m.camH.set(0, m.height);
  m.camY.set(0, m.height / 2);
  m.hold(t + 900);
  return m.build(600);
}

/* ---------------- DNA: key result ---------------- */

const KEY_RESULT_LABEL: Bi = { en: 'KEY RESULT', ml: 'പ്രധാന ഫലം' };

export function buildKeyResult(plan: KeyResultPlan, lang: Lang, title: string): MotionScene[] {
  const tex = plan.formula?.length ? plan.formula.join(' ') : '';
  const typeset = !!tex && mathProblem(tex) === null;
  const m = new Motion(title, 720, plan.formula?.length ? 480 : 380);
  m.camH.set(0, m.height);
  m.camY.set(0, m.height / 2);
  let t = 300;
  t = m.step(pick(plan.say, lang) || pick(plan.statement, lang), t, 2600);
  t = pill(m, 'krp', pick(KEY_RESULT_LABEL, lang), t);
  const p = paragraph(m, 'kr', pick(plan.statement, lang), { x: 60, y: 110, width: 600, size: 36, align: 'center', color: 'ink' });
  t = m.write(p.words.map((w) => w.id), t, 80, 300) + DUR.beat;
  const terms = (lang === 'ml' ? plan.keyTerms?.ml : plan.keyTerms?.en) ?? [];
  phraseIds(p.words, terms).forEach((ids, i) => {
    if (!ids.length) return;
    m.recolor(ids, ROLES[i % 3], t);
    t = m.focus(ids, t) + 250;
    m.unfocus(ids, t + 400);
  });
  t = m.box('krbox', 360, (110 + p.bottom) / 2 - 4, 660, p.bottom - 110 + 74, t + 200, 'accent');
  if (plan.formula?.length) {
    const y = p.bottom + 120;
    if (typeset) {
      const letters = [...new Set(tex.match(/[a-z]/g) ?? [])];
      const colors: Record<string, Role> = {};
      letters.forEach((c, j) => (colors[c] = ROLES[j % 3]));
      const f = showMath(m, 'krf', tex, 360, y, t + 150, { size: 52, maxWidth: 580, colors });
      const bx = mathBox(f.h);
      t = m.box('krfbox', (bx.x0 + bx.x1) / 2, (bx.y0 + bx.y1) / 2, bx.x1 - bx.x0 + 44, bx.y1 - bx.y0 + 30, f.end + 150, 'result');
    } else {
      const size = 46;
      const ws = plan.formula.map((tk) => tokenWidth(tk, size));
      const total = ws.reduce((a, b) => a + b, 0) + 10 * (ws.length - 1);
      let x = 360 - total / 2;
      const ids = plan.formula.map((tk, j) => {
        const id = m.text(`kf${j}`, tk, x + ws[j] / 2, y, { size, color: /^[a-z]$/.test(tk) ? ROLES[j % 3] : 'ink' });
        x += ws[j] + 10;
        return id;
      });
      t = m.appear(ids, t, 70);
    }
  }
  t = m.tick('krtick', 360, plan.formula?.length ? p.bottom + 195 : p.bottom + 85, t);
  m.hold(t + 1400);
  return [m.build()];
}

/* ---------------- DNA: area model ---------------- */

export function buildAreaModel(plan: AreaModelPlan, lang: Lang, title: string): MotionScene[] {
  const W = plan.widthParts;
  const H = plan.heightParts;
  const num = (v: number | string) => (typeof v === 'number' ? v : NaN);
  const numeric = [...W, ...H].every((v) => typeof v === 'number');
  const wSum = numeric ? W.reduce<number>((a, b) => a + num(b), 0) : W.length;
  const hSum = numeric ? H.reduce<number>((a, b) => a + num(b), 0) : H.length;
  const boxW = 520;
  const boxH = Math.min(300, Math.max(140, (boxW * hSum) / wSum));
  const x0 = 360 - boxW / 2;
  const y0 = 90;
  // Small parts still get a readable minimum width.
  const share = (parts: Array<number | string>, total: number, len: number) => {
    const raw = parts.map((p) => (numeric ? (num(p) / total) * len : len / parts.length));
    const min = len * 0.18;
    const fixed = raw.map((r) => Math.max(min, r));
    const k = len / fixed.reduce((a, b) => a + b, 0);
    return fixed.map((r) => r * k);
  };
  const ws = share(W, wSum, boxW);
  const hs = share(H, hSum, boxH);
  const m = new Motion(title, 720, y0 + boxH + 230);
  let t = 300;
  const wLabel = W.join(' + ');
  const hLabel = H.join(' + ');
  t = m.step(pick(plan.say.setup, lang), t, 2200);
  t = m.poly('outer', [[x0, y0], [x0 + boxW, y0], [x0 + boxW, y0 + boxH], [x0, y0 + boxH]], t, { color: 'accent', fill: '#fde3a7', fillAlpha: 0.6, width: 3 });
  const wTot = m.text('wtot', numeric ? String(wSum) : wLabel, 360, y0 + boxH + 36, { size: 30, color: 'a' });
  const hTot = m.text('htot', numeric ? String(hSum) : hLabel, x0 - 40, y0 + boxH / 2, { size: 30, color: 'b' });
  t = m.appear([wTot, hTot], t, 150) + DUR.beat;

  // Split the sides: the totals roll into their parts.
  t = m.step(pick(plan.say.split, lang), t, 2400);
  m.swap('wtot', wLabel, t, 'a');
  t = m.swap('htot', hLabel, t + 200, 'b');
  m.fadeOut(['wtot', 'htot'], t + 500);
  let x = x0;
  const xs: number[] = [];
  ws.forEach((w, i) => {
    xs.push(x + w / 2);
    if (i > 0) m.poly(`vs${i}`, [[x, y0], [x, y0 + boxH]], t, { color: 'accent', closed: false, width: 2.5 });
    m.text(`wl${i}`, String(W[i]), x + w / 2, y0 + boxH + 36, { size: 28, color: 'a' });
    x += w;
  });
  let y = y0;
  const ys: number[] = [];
  hs.forEach((h, j) => {
    ys.push(y + h / 2);
    if (j > 0) m.poly(`hs${j}`, [[x0, y], [x0 + boxW, y]], t, { color: 'accent', closed: false, width: 2.5 });
    m.text(`hl${j}`, String(H[j]), x0 - 40, y + h / 2, { size: 28, color: 'b' });
    y += h;
  });
  t = m.appear([...W.map((_, i) => `wl${i}`), ...H.map((_, j) => `hl${j}`)], t + 500, 120) + DUR.beat;

  // Each small rectangle: its product appears, then rolls into the number.
  t = m.step(pick(plan.say.parts, lang), t, 2400);
  const cellColors = ['#f4a261', '#ffd166', '#f8c291', '#e76f51', '#fcd5a5', '#f6bd60'];
  const products: string[] = [];
  const values: number[] = [];
  let k = 0;
  let cx = x0;
  ws.forEach((w, i) => {
    let cy = y0;
    hs.forEach((h, j) => {
      const id = `cell${i}_${j}`;
      m.poly(id, [[cx, cy], [cx + w, cy], [cx + w, cy + h], [cx, cy + h]], t, { color: 'accent', width: 1, dur: 10 });
      m.get(id).alpha.set(0, 0);
      m.get(id).alpha.set(t, 1);
      m.fillTo(id, cellColors[k % cellColors.length], t + k * 350, 0.75);
      const prod = `${W[i]} × ${H[j]}`;
      const pid = m.text(`p${i}_${j}`, prod, cx + w / 2, cy + h / 2, { size: Math.min(26, w / 4.2), color: 'ink' });
      m.focus([`wl${i}`, `hl${j}`], t + k * 350, false);
      m.appear(pid, t + k * 350 + 150, 0, true);
      m.unfocus([`wl${i}`, `hl${j}`], t + k * 350 + 600);
      products.push(pid);
      if (numeric) values.push(num(W[i]) * num(H[j]));
      cy += h;
      k++;
    });
    cx += w;
  });
  t += k * 350 + 500;
  if (numeric) {
    products.forEach((pid, i) => m.swap(pid, String(values[i]), t + i * 220, 'result'));
    t += products.length * 220 + 500;
  } else {
    // Letters: "x × u" becomes "xu".
    products.forEach((pid, i) => m.swap(pid, m.get(pid).text.replace(/\s×\s/, ''), t + i * 220, 'result'));
    t += products.length * 220 + 500;
  }

  // Total.
  t = m.step(pick(plan.say.total, lang), t, 2600);
  const sumTokens = numeric
    ? [...values.flatMap((v, i) => (i ? ['+', String(v)] : [String(v)])), '=', String(values.reduce((a, b) => a + b, 0))]
    : [...products.flatMap((p, i) => (i ? ['+', m.get(p).swaps.at(-1)?.to ?? ''] : [m.get(p).swaps.at(-1)?.to ?? '']))];
  const size = 36;
  const tw = sumTokens.map((tk) => tokenWidth(tk, size));
  const total = tw.reduce((a, b) => a + b, 0) + 10 * (tw.length - 1);
  let sx = 360 - total / 2;
  const sy = y0 + boxH + 110;
  const sumIds: string[] = [];
  let pi = 0;
  sumTokens.forEach((tk, j) => {
    const id = m.text(`sum${j}`, tk, sx + tw[j] / 2, sy, { size, color: tk === '=' || tk === '+' ? 'ink' : 'result' });
    sumIds.push(id);
    sx += tw[j] + 10;
    if (/^\d|^[a-z]/.test(tk) && pi < products.length && (j < sumTokens.length - 1 || !numeric)) {
      // Each product flies down into the sum.
      const c = m.clone(products[pi], m.uid('pf'), t);
      m.move(c, m.pos(id, t).x, sy, t + pi * 160, { arc: 40, sound: pi === 0 });
      m.fadeOut(c, t + pi * 160 + 650, 120);
      m.get(id).alpha.set(t + pi * 160 + 650, 1);
      pi++;
    }
  });
  const ops = sumIds.filter((_, j) => sumTokens[j] === '+' || sumTokens[j] === '=');
  t = m.appear(ops, t + pi * 160 + 400, 60);
  if (numeric) {
    const last = sumIds[sumIds.length - 1];
    t = m.appear(last, t + 150) + 200;
    const lw = tokenWidth(sumTokens[sumTokens.length - 1], size);
    t = m.box('sumbox', m.pos(last, t).x, sy, lw + 40, size * 1.4, t, 'accent');
    t = m.tick('sumtick', m.pos(last, t).x + lw / 2 + 40, sy, t - 150);
  }
  m.hold(t + 1400);
  return [m.build()];
}

/* ---------------- DNA: numbers-only table ---------------- */

export function buildTable(plan: TablePlan, lang: Lang, title: string): MotionScene[] {
  const cols = plan.headers.length;
  const colW = Math.min(150, 600 / cols);
  const x0 = 360 - (colW * cols) / 2;
  const rowH = 62;
  const maxRows = plan.rows.length + plan.ops.filter((o) => o.op !== 'focus').length;
  const m = new Motion(title, 720, 120 + rowH * (maxRows + 1) + 60);
  let t = 300;
  const head = plan.headers.map((h, c) => m.text(`h${c}`, pick(h, lang), x0 + colW * (c + 0.5), 70, { size: 28, color: ROLES[c % 3] }));
  t = m.step(lang === 'ml' ? 'സംഖ്യകൾ മാത്രം ഒരു പട്ടികയായി എഴുതാം.' : 'Write just the numbers in a table.', t, 1800);
  t = m.write(head, t, 120);
  t = m.rule('hrule', x0, 92, x0 + colW * cols, 92, t);
  const grid: string[][] = [];
  const values: Array<Array<number | string>> = [];
  const rowY = (r: number) => 130 + r * rowH;
  plan.rows.forEach((row, r) => {
    grid[r] = row.map((v, c) => m.text(`c${r}_${c}`, String(v), x0 + colW * (c + 0.5), rowY(r), { size: 38, color: ROLES[c % 3] }));
    values[r] = [...row];
    t = m.appear(grid[r], t, 90) + 120;
  });
  let nextRow = plan.rows.length;
  for (const op of plan.ops) {
    t = m.step(pick(op.say, lang), t, 2200);
    if (op.op === 'focus') {
      const ids = op.col !== undefined ? [grid[op.row][op.col]] : grid[op.row];
      t = m.focus(ids, t) + 600;
      m.unfocus(ids, t);
    } else if (op.op === 'scale') {
      // Copy the row down, then every cell rolls into its multiple ("digit transformation").
      const r = nextRow++;
      const tag = m.text(`sc${r}`, `×${op.by}`, x0 - 46, rowY(r), { size: 30, color: 'carry' });
      t = m.appear(tag, t);
      grid[r] = [];
      values[r] = [];
      grid[op.row].forEach((id, c) => {
        const copy = m.clone(id, `c${r}_${c}`, t);
        grid[r][c] = copy;
        m.move(copy, m.pos(id, t).x, rowY(r), t + c * 80, { arc: 26, sound: c === 0 });
        const v = Number(values[op.row][c]) * op.by;
        values[r][c] = v;
        m.swap(copy, String(v), t + 750 + c * 160, 'result');
      });
      t += 750 + cols * 160 + DUR.swap + DUR.beat;
    } else if (op.op === 'subtract' || op.op === 'add') {
      const a = op.op === 'subtract' ? op.from : op.a;
      const b = op.op === 'subtract' ? op.minus : op.b;
      const r = nextRow++;
      t = m.rule(`sr${r}`, x0, rowY(r) - rowH / 2 + 4, x0 + colW * cols, rowY(r) - rowH / 2 + 4, t);
      const sign = m.text(`sg${r}`, op.op === 'subtract' ? '−' : '+', x0 - 40, (rowY(a) + rowY(b)) / 2, { size: 38, color: 'carry' });
      t = m.appear(sign, t);
      grid[r] = [];
      values[r] = [];
      for (let c = 0; c < cols; c++) {
        const v = op.op === 'subtract' ? Number(values[a][c]) - Number(values[b][c]) : Number(values[a][c]) + Number(values[b][c]);
        values[r][c] = v;
        const id = m.text(`c${r}_${c}`, String(v), x0 + colW * (c + 0.5), rowY(r), { size: 38, color: v === 0 ? 'done' : 'result' });
        grid[r][c] = id;
        const flyers = [m.clone(grid[a][c], m.uid('tf'), t), m.clone(grid[b][c], m.uid('tf'), t)];
        m.focus([grid[a][c], grid[b][c]], t + c * 450, false);
        m.merge(flyers, id, x0 + colW * (c + 0.5), rowY(r), t + c * 450, 600);
        m.unfocus([grid[a][c], grid[b][c]], t + c * 450 + 650);
      }
      t += cols * 450 + 700;
    }
    m.hold(t + 600);
  }
  m.hold(t + 1200);
  return [m.build()];
}

/* ---------------- DNA: geometry construction ---------------- */

export function buildFigure(plan: FigurePlan, lang: Lang, title: string): MotionScene[] {
  const B = { x: 70, y: 40, w: 580, h: 400 };
  const P = (name: string): [number, number] => {
    const p = plan.points[name];
    if (!p) throw new Error(`figure: unknown point ${name}`);
    return [B.x + (p[0] / 100) * B.w, B.y + (p[1] / 100) * B.h];
  };
  const m = new Motion(title, 720, B.y + B.h + 50);
  let t = 300;
  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);
  const segId = (a: string, b: string) => `seg_${[a, b].sort().join('')}`;
  let n = 0;
  for (const s of plan.steps) {
    if (s.say) t = m.step(pick(s.say, lang), t, 2200);
    const id = `f${n++}`;
    switch (s.op) {
      case 'segment':
        t = m.poly(m.has(segId(s.from, s.to)) ? id : segId(s.from, s.to), [P(s.from), P(s.to)], t, { color: s.color ?? 'ink', closed: false, width: s.width ?? 3, dashed: s.dashed, dur: 600 });
        break;
      case 'line': {
        const [a, b] = [P(s.through[0]), P(s.through[1])];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const k = 3;
        t = m.poly(id, [[a[0] - dx * k, a[1] - dy * k], [b[0] + dx * k, b[1] + dy * k]], t, { color: s.color ?? 'ink', closed: false, width: 2.5, dur: 700 });
        break;
      }
      case 'polygon':
        t = m.poly(id, s.points.map(P), t, { color: s.color ?? 'ink', fill: s.fill, fillAlpha: 0.4, dur: 800 });
        break;
      case 'right-angle': {
        const o = P(s.at);
        const u = P(s.arms[0]);
        const v = P(s.arms[1]);
        const unit = (p: [number, number]) => {
          const d = Math.hypot(p[0] - o[0], p[1] - o[1]) || 1;
          return [((p[0] - o[0]) / d) * 16, ((p[1] - o[1]) / d) * 16];
        };
        const a = unit(u);
        const b = unit(v);
        t = m.poly(id, [[o[0] + a[0], o[1] + a[1]], [o[0] + a[0] + b[0], o[1] + a[1] + b[1]], [o[0] + b[0], o[1] + b[1]]], t, { color: 'accent', closed: false, width: 2, dur: 300 });
        break;
      }
      case 'equal-ticks':
        s.segments.forEach(([a0, b0], i) => {
          const a = P(a0);
          const b = P(b0);
          const mx = (a[0] + b[0]) / 2;
          const my = (a[1] + b[1]) / 2;
          const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const nx = (-(b[1] - a[1]) / d) * 9;
          const ny = ((b[0] - a[0]) / d) * 9;
          const cnt = s.count ?? 1;
          for (let c = 0; c < cnt; c++) {
            const off = (c - (cnt - 1) / 2) * 6;
            const ox = ((b[0] - a[0]) / d) * off;
            const oy = ((b[1] - a[1]) / d) * off;
            m.poly(`${id}_${i}_${c}`, [[mx - nx + ox, my - ny + oy], [mx + nx + ox, my + ny + oy]], t + i * 200, { color: s.color ?? 'carry', closed: false, width: 3, dur: 200 });
          }
        });
        t += s.segments.length * 200 + 300;
        break;
      case 'label': {
        const [x, y] = P(s.at);
        m.text(id, s.text, x + (s.dx ?? 14), y + (s.dy ?? -14), { size: 26, color: 'ink' });
        t = m.appear(id, t);
        break;
      }
      case 'text': {
        const x = B.x + (s.at[0] / 100) * B.w;
        const y = B.y + (s.at[1] / 100) * B.h;
        m.text(id, pick(s.text, lang), x, y, { size: 24, color: s.color ?? 'ink' });
        t = m.write(id, t);
        break;
      }
      case 'point': {
        const [x, y] = P(s.at);
        t = m.dot(id, x, y, t, { color: s.color ?? 'ink', r: 5 });
        break;
      }
      case 'arc': {
        const [cx, cy] = P(s.center);
        const r = (s.radius / 100) * B.w;
        const pts: Array<[number, number]> = [];
        for (let k = 0; k <= 24; k++) {
          const a = ((s.fromDeg + ((s.toDeg - s.fromDeg) * k) / 24) * Math.PI) / 180;
          pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]);
        }
        t = m.poly(id, pts, t, { color: s.color ?? 'c', closed: false, width: 2.5, dur: 700 });
        break;
      }
      case 'highlight': {
        const ids = s.targets
          .map((tg) => {
            if (tg.length === 2 && m.has(segId(tg[0], tg[1]))) return segId(tg[0], tg[1]);
            return m.has(tg) ? tg : '';
          })
          .filter(Boolean);
        if (ids.length) {
          if (s.color) m.recolor(ids, s.color, t);
          t = m.focus(ids, t) + 700;
          m.unfocus(ids, t + 600);
        } else if (s.targets.length >= 3 && s.targets.every((p) => plan.points[p])) {
          t = m.poly(id, s.targets.map(P), t, { color: s.color ?? 'c', fill: s.color ?? 'c', fillAlpha: 0.3, dur: 500 });
        }
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

/* ---------------- DNA: number line ---------------- */

export function buildNumberLine(plan: NumberLinePlan, lang: Lang, title: string): MotionScene[] {
  const x0 = 60;
  const x1 = 660;
  const y = 220;
  const span = plan.max - plan.min || 1;
  const X = (v: number) => x0 + ((v - plan.min) / span) * (x1 - x0);
  const m = new Motion(title, 720, 380);
  let t = 300;
  t = m.poly('axis', [[x0 - 20, y], [x1 + 20, y]], t, { color: 'ink', closed: false, width: 3, dur: 600 });
  const ticks: string[] = [];
  for (let v = Math.ceil(plan.min); v <= plan.max; v++) {
    m.poly(`tk${v}`, [[X(v), y - 9], [X(v), y + 9]], t, { color: v === 0 ? 'accent' : 'ink', closed: false, width: v === 0 ? 3 : 2, dur: 120 });
    ticks.push(m.text(`tl${v}`, v < 0 ? `−${-v}` : String(v), X(v), y + 34, { size: 22, color: v === 0 ? 'accent' : v < 0 ? 'a' : 'b' }));
  }
  t = m.appear(ticks, t + 200, 30) + DUR.beat;
  let n = 0;
  for (const s of plan.steps) {
    t = m.step(pick(s.say, lang), t, 2200);
    const id = `nl${n++}`;
    if (s.op === 'point') {
      t = m.dot(id, X(s.at), y, t, { color: s.color ?? 'c', r: 8 });
      if (s.label) {
        m.text(`${id}l`, s.label, X(s.at), y - 30, { size: 26, color: s.color ?? 'c' });
        t = m.appear(`${id}l`, t);
      }
    } else if (s.op === 'jump') {
      const a = X(s.from);
      const b = X(s.from + s.by);
      const h = Math.min(110, Math.abs(b - a) * 0.45 + 30);
      const pts: Array<[number, number]> = [];
      for (let k = 0; k <= 20; k++) {
        const p = k / 20;
        pts.push([a + (b - a) * p, y - Math.sin(Math.PI * p) * h]);
      }
      t = m.poly(id, pts, t, { color: s.color ?? (s.by < 0 ? 'a' : 'b'), closed: false, width: 3, dur: 700 });
      const tag = s.by < 0 ? `−${-s.by}` : `+${s.by}`;
      m.text(`${id}t`, tag, (a + b) / 2, y - h - 22, { size: 26, color: s.color ?? (s.by < 0 ? 'a' : 'b') });
      m.appear(`${id}t`, t - 200);
      t = m.dot(`${id}d`, b, y, t, { color: 'result', r: 7 });
    } else if (s.op === 'text') {
      m.text(id, s.text, 360, 330, { size: 34, color: 'result' });
      t = m.appear(id, t);
    }
    t += DUR.beat;
  }
  m.hold(t + 1400);
  return [m.build()];
}

/* ---------------- DNA: words → equations table ---------------- */

export interface TranslatePlan {
  rows: Array<{ words: Bi; tokens: string[]; say?: Bi }>;
}

export function buildTranslate(plan: TranslatePlan, lang: Lang, title: string): MotionScene[] {
  const rowH = 74;
  const m = new Motion(title, 720, 60 + plan.rows.length * rowH + 40);
  const view = Math.min(m.height, 560);
  m.camH.set(0, view);
  m.camY.set(0, view / 2);
  let t = 300;
  const letters = new Map<string, Role>();
  plan.rows.forEach((row, r) => {
    const y = 60 + r * rowH;
    if (m.height > view) m.look(t, Math.min(m.height - view / 2, y + rowH - view / 2 + 120));
    t = m.step(pick(row.say, lang) || pick(row.words, lang), t, 2000);
    const words = paragraph(m, `w${r}_`, pick(row.words, lang), { x: 20, y: y - (pick(row.words, lang).length > 34 ? 12 : 0), width: 330, size: 22, color: 'ink', lineGap: 1.25 });
    t = m.write(words.words.map((w) => w.id), t, 30, 200);
    const arrow = m.text(`ar${r}`, '→', 372, y, { size: 30, color: 'done' });
    m.appear(arrow, t - 100, 0, false);
    const size = 32;
    const ws = row.tokens.map((tk) => tokenWidth(tk, size));
    let x = 400;
    const ids = row.tokens.map((tk, j) => {
      if (/^[a-z]$/.test(tk) && !letters.has(tk)) letters.set(tk, ROLES[letters.size % 3]);
      const id = m.text(`e${r}_${j}`, tk, x + ws[j] / 2, y, { size, color: letters.get(tk) ?? (/^\d/.test(tk) ? 'result' : 'ink') });
      x += ws[j] + 6;
      return id;
    });
    t = m.appear(ids, t + 100, 60) + DUR.beat;
    m.dim(words.words.map((w) => w.id), t + 600);
  });
  m.hold(t + 1200);
  return [m.build()];
}

/* ---------------- dispatcher ---------------- */

export function buildDnaScenes(dna: DnaId, plan: unknown, lang: Lang, title: string): MotionScene[] {
  switch (dna) {
    case 'section-intro':
    case 'concept-board':
      return buildBoard(plan as BoardPlan, lang, title);
    case 'mental-math':
    case 'equation-chain':
      return buildChain(plan as ChainPlan, lang, title);
    case 'equation-pair': {
      const pair = buildPairBrace(plan as ChainPlan, lang, title);
      return [...(pair ? [pair] : []), ...buildChain(plan as ChainPlan, lang, title)];
    }
    case 'identity-formula': {
      const tried = buildIdentityTry(plan as ChainPlan, lang, title);
      return [...buildChain(plan as ChainPlan, lang, title), ...(tried ? [tried] : [])];
    }
    case 'word-problem':
      return buildWordProblem(plan as WordProblemPlan, lang, title);
    case 'translate-table':
      return buildTranslate(plan as TranslatePlan, lang, title);
    case 'number-table':
      return buildTable(plan as TablePlan, lang, title);
    case 'key-result':
      return buildKeyResult(plan as KeyResultPlan, lang, title);
    case 'area-model':
      return buildAreaModel(plan as AreaModelPlan, lang, title);
    case 'column-arithmetic':
      return buildReel({ kind: 'arithmetic', text: (plan as ColumnPlan).sum, lang }).parts;
    case 'geometry-construction':
      return buildFigure(plan as FigurePlan, lang, title);
    case 'number-line':
      return buildNumberLine(plan as NumberLinePlan, lang, title);
    case 'plane-transform':
      return buildPlane(plan as PlanePlan, lang, title);
    case 'function-graph':
      return buildGraph(plan as GraphPlan, lang, title);
    case 'fraction-bars':
      return buildFractions(plan as FractionPlan, lang, title);
    case 'histogram':
      return buildHistogram(plan as HistogramPlan, lang, title);
    case 'probability-tree':
      return buildTree(plan as TreePlan, lang, title);
    case 'matrix-grid':
      return buildMatrix(plan as MatrixPlan, lang, title);
    case 'shape-formula':
      return buildShape(plan as ShapePlan, lang, title);
    case 'venn-sets':
      return buildVenn(plan as VennPlan, lang, title);
    case 'unit-circle':
      return buildTrig(plan as TrigPlan, lang, title);
    case 'linear-system':
      return buildLinear(plan as LinPlan, lang, title);
    case 'arithmetic-sequence':
      return buildSeq(plan as SeqPlan, lang, title);
    case 'quadratic-equation':
      return buildQuad(plan as QuadPlan, lang, title);
    case 'polynomial':
      return buildPoly(plan as PolyPlan, lang, title);
    case 'angle-geometry':
      return buildAngle(plan as AnglePlan, lang, title);
    case 'solid-figure':
      return buildSolid(plan as SolidPlan, lang, title);
    case 'ratio-percent':
      return buildRatio(plan as RatioPlan, lang, title);
    case 'balance-scale':
      return (plan as BalPlan).look === 'pans' ? buildBalance(plan as BalPlan, lang, title) : buildBeam(plan as BalPlan, lang, title);
    case 'balance-pair':
      return buildPair(plan as PairPlan, lang, title);
    case 'typeset-chain':
      return buildTypeset(plan as TsPlan, lang, title);
    case 'hcf-lcm':
      return buildHclm(plan as HlPlan, lang, title);
    case 'quadratic-derivation':
      return buildQuadraticDerivation(plan as QdPlan, lang, title);
    case 'pie-chart':
      return buildPie(plan as PiePlan, lang, title);
    case 'coordinate-geometry':
      return buildCoord(plan as CoordPlan, lang, title);
    case 'square-identity':
      return buildSquareIdentity(plan as SqPlan, lang, title);
    case 'area-figure':
      return buildAreaFig(plan as AreaFigPlan, lang, title);
    case 'matrix-ops':
      return buildMatrixOps(plan as MatrixOpsPlan, lang, title);
    case 'fraction-line':
      return buildFracLine(plan as FracLinePlan, lang, title);
    case 'ai-sketch':
      return buildSketch(plan as SketchPlan, lang, title);
    case 'chapter-intro':
      return buildChapterIntro(plan as ChapterIntroPlan, lang, title);
    case 'bridge':
      return [];
    default: {
      // ai-custom and learned DNAs are composites of built-in segments.
      const c = plan as CompositePlan;
      if (!c?.segments?.length) return [];
      return c.segments.flatMap((s) => buildDnaScenes(s.dna, s.plan, lang, title));
    }
  }
}
