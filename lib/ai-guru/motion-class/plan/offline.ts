/**
 * Offline planner: fills DNA plans without any AI, from the textbook text and
 * AI Guru's verified template solver (which carries English + Malayalam step
 * captions). Malayalam reading text and word labels need the AI planner; when
 * they are missing the Malayalam passes of that block are skipped (never
 * replaced by English).
 */

import { planTemplateSolution } from '../../math/template-solver';
import type { BookBlock } from '../segment';
import { blockFeatures, offlineFallbackDna, selectDna } from '../dna/registry';
import { solverChain, tokenize } from '../dna/builders';
import { sentences } from '../reading';
import type { DnaSelection } from '../dna/types';
import { eqProblem, solve, eliminate } from '../dna/lin-math';
import { A_MAX, D_MAX, listIn } from '../dna/as-math';
import { disc as quadDisc, parseQuad, problem as quadProblem, rationalRoots, roots as quadRoots } from '../dna/q-math';
import { BETA_MAX, BETA_MIN, PAR_MAX, PAR_MIN, TRI_MAX, TRI_MIN, degreesIn } from '../dna/a-math';
import { DIV_DEG_MAX, R_MAX, fullyFactorable, identityOf, integerRoots, parsePoly } from '../dna/p-math';
import { solidProblem } from '../dna/s-math';
import { ratioProblem } from '../dna/rp-math';
import { pieProblem } from '../dna/pc-math';
import { flProblem } from '../dna/fl-math';
import { moProblem } from '../dna/mo-math';
import { afProblem } from '../dna/af-math';
import { cgProblem } from '../dna/cg-math';
import { sqProblem } from '../dna/sq-math';
import { findBalEquations } from '../dna/bal-math';
import { findPairEquations, pairFacts, combineNote as pairCombineNote } from '../dna/pair-math';
import { findTsFormulas } from '../dna/ts-math';
import { qdR } from '../dna/qd-math';
import { HL_MAX, HL_MIN } from '../dna/hl-math';
import type { BalPlan, BalStep, PairPlan, PairStep, Bi, BlockPlan, BoardPlan, ChainLine, ChainPlan, DnaId, FractionPlan, FractionStep, GraphPlan, MatrixPlan, KeyResultPlan, ShapeKind, ShapePlan, ShapeStep, VennPlan, VennStep, TrigPlan, TrigStep, LinPlan, LinStep, SeqPlan, SeqStep, QuadPlan, QuadStep, PolyPlan, PolyStep, AnglePlan, AngleStep, SolidPlan, SolidStep, RatioPlan, RatioStep, PiePlan, PieStep, FracLinePlan, FracLineStep, MatrixOpsPlan, MatrixOpsStep, AreaFigPlan, AreaFigStep, CoordPlan, CoordStep, SqPlan, SqStep, TablePlan, WordProblemPlan, TsPlan, TsStep, QdPlan, QdStep, HlPlan, HlStep } from '../dna/types';
import { evalExpr } from '../../math/animation/expr';
import { fnOf } from '../dna/plane-builders';
import { textOnlyWarning } from './visual-qa';
import type { TranslatePlan } from '../dna/builders';

const normEq = (s: string) => s.replace(/\s+/g, '').replace(/[−–-]/g, '-').replace(/[{}]/g, '').toLowerCase();

/** Captions for a chain of textbook equations, borrowed from the solver's own step captions. */
export function captionChain(lines: string[]): ChainPlan {
  const out: ChainLine[] = [];
  const sol = planTemplateSolution(lines[0]);
  const rows = sol?.rows ?? [];
  let cursor = 0;
  lines.forEach((text, i) => {
    const tokens = tokenize(text);
    if (i === 0) {
      out.push({ tokens, caption: { en: `We start with ${text}.`, ml: `നമ്മൾ തുടങ്ങുന്നത് ${text} എന്നതിൽ നിന്നാണ്.` } });
      return;
    }
    const hit = rows.findIndex((r, k) => k > cursor && normEq(r.text) === normEq(text));
    if (hit > 0) {
      const steps = rows.slice(cursor + 1, hit + 1).filter((r) => r.kind === 'step' || r.kind === 'result');
      const en = [...new Set(steps.map((r) => r.captionEn))].join(' ');
      const ml = [...new Set(steps.map((r) => r.captionMl).filter(Boolean))].join(' ');
      cursor = hit;
      out.push({ tokens, caption: { en: en || 'Simplify.', ml: ml || 'ലഘൂകരിക്കുക.' } });
    } else {
      const last = i === lines.length - 1 && /^[a-z]\s*=\s*−?\d/.test(text.trim());
      out.push({
        tokens,
        caption: last ? { en: `So ${text}.`, ml: `അതിനാൽ ${text}.` } : { en: 'Simplify both sides.', ml: 'ഇരുവശവും ലഘൂകരിക്കുക.' },
      });
    }
  });
  const vars: Record<string, number> = {};
  for (const m of (sol?.answerText ?? '').matchAll(/([a-z])\s*=\s*(−?-?\d+(?:\.\d+)?)/g)) vars[m[1]] = Number(m[2].replace('−', '-'));
  return { lines: out, solutions: Object.keys(vars).length ? [vars] : undefined };
}

function shortLine(sentence: string): string {
  const s = sentence.replace(/\s+/g, ' ').trim();
  if (s.length <= 46) return s;
  const cut = s.slice(0, 46);
  const at = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(';'), cut.lastIndexOf(' '));
  return `${s.slice(0, at > 20 ? at : 46)}…`;
}

const YEAR = /\b(1[0-9]{3}|20[0-9]{2})\b/;
const CUT = (s: string, n: number): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const c = t.slice(0, n);
  const at = Math.max(c.lastIndexOf(','), c.lastIndexOf(' '));
  return `${t.slice(0, at > n * 0.5 ? at : n)}…`;
};

/**
 * Subject-neutral concept board (V51.9.51): look at the wording and pick the picture. Years in order → timeline;
 * "cycle / again / back to" → cycle; "first, then, next, finally" → flow; otherwise idea cards.
 */
export function offlineConceptBoard(text: string, heading: string): BoardPlan {
  const sents = sentences(text);
  const years = sents.filter((s) => YEAR.test(s));
  const asPoint = (s: string, board: string) => ({ board: { en: board }, say: { en: s } });
  if (years.length >= 2 && years.length >= sents.length - 1) {
    const pts = years.slice(0, 6).map((s) => {
      const y = YEAR.exec(s)![1];
      return asPoint(s, `*${y}* ${CUT(s.replace(y, '').replace(/\s+/g, ' ').replace(/^[\s,:;–-]+|[\s,:;–-]+$/g, '').replace(/^(in|on|by)\s+/i, ''), 60)}`);
    });
    return { heading: { en: heading }, layout: 'timeline', points: pts };
  }
  if (sents.length >= 3 && sents.length <= 5 && /\b(cycle|cyclic|repeats?|again|goes back|back to|over and over)\b/i.test(text)) {
    return { heading: { en: heading }, layout: 'cycle', points: sents.slice(0, 5).map((s) => asPoint(s, CUT(s, 56))) };
  }
  if (sents.length >= 3 && /\b(first|then|next|after that|finally|lastly|step|afterwards)\b/i.test(text)) {
    return { heading: { en: heading }, layout: 'flow', points: sents.slice(0, 6).map((s) => asPoint(s, CUT(s.replace(/^(first|then|next|finally|lastly|after that|afterwards)[,\s]+/i, ''), 64))) };
  }
  return { heading: { en: heading }, points: sents.slice(0, 4).map((s) => ({ board: { en: shortLine(s) }, say: { en: s } })) };
}

/** Number phrases in a word problem ("100 beads", "10 more black", "11000 rupees"). */
function numberPhrases(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b\d+(?:\.\d+)?(?:\s+(?:more|less|times|rupees?|beads?|centimetres?|metres?|kg|litres?|pens?|pencils?|notebooks?|chairs?|boys?|girls?|years?|%))?/g)) {
    out.push(m[0]);
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * "y = 2x + 1" in the text → a graph plan without any AI: axes, the curve, a tracker reading
 * three points. The range is chosen so the whole curve fits. Captions come in English and
 * Malayalam (fixed sentences); the Malayalam reading text still needs the AI planner.
 */
export function offlineGraph(text: string): GraphPlan | null {
  const m = /\by\s*=\s*([−\-+×*/^().\dx\s]+?)(?=\s*(?:[.;:?,]|\band\b|\bis\b|\bare\b|\bwhere\b|\bfor\b|\bwhen\b|$))/i.exec(text.replace(/\s+/g, ' '));
  if (!m) return null;
  const expr = m[1].trim();
  if (!/x/i.test(expr) || expr.length > 40) return null;
  const f = fnOf(expr.toLowerCase());
  if (!Number.isFinite(f(1)) || !Number.isFinite(f(-1))) return null;
  for (const X of [5, 4, 3, 2, 1.5, 1]) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 80; i++) {
      const y = f(-X + (2 * X * i) / 80);
      if (!Number.isFinite(y)) {
        lo = -Infinity;
        break;
      }
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    if (!Number.isFinite(lo) || hi - lo > 40 || Math.max(Math.abs(lo), Math.abs(hi)) > 30) continue;
    const yMin = Math.min(-1, Math.floor(lo - 1));
    const yMax = Math.max(1, Math.ceil(hi + 1));
    const xr = Math.ceil(X);
    const pretty = `y = ${expr.replace(/-/g, '−').replace(/\*/g, '×')}`;
    const ints = [-2, 0, 2].map((v) => Math.max(-Math.floor(X), Math.min(Math.floor(X), v)));
    const stops = [...new Set(ints)];
    if (stops.length < 2) stops.push(Math.floor(X));
    return {
      xMin: -xr,
      xMax: xr,
      yMin,
      yMax,
      steps: [
        { op: 'axes', say: { en: 'Here are the axes: x goes across, y goes up.', ml: 'ഇതാ അക്ഷങ്ങൾ: x കുറുകെ, y മുകളിലേക്ക്.' } },
        {
          op: 'curve',
          fn: expr.toLowerCase(),
          from: -X,
          to: X,
          label: pretty.length <= 18 ? pretty : undefined,
          say: { en: `Here is the graph of ${pretty}. Every point on it makes the equation true.`, ml: `ഇതാണ് ${pretty} ന്റെ ഗ്രാഫ്. ഇതിലെ ഓരോ ബിന്ദുവും സമവാക്യത്തെ ശരിയാക്കുന്നു.` },
        },
        { op: 'tracker', stops: stops.sort((a, b) => a - b), say: { en: 'Slide along the curve: for each x, read the matching y.', ml: 'വക്രത്തിലൂടെ നീങ്ങുക: ഓരോ x-നും യോജിച്ച y വായിക്കുക.' } },
      ],
    };
  }
  void evalExpr;
  return null;
}

/**
 * Fractions written in the text ("3/4", "{1/2}") → one bar each (at most three, each with at
 * most 24 parts). The captions are fixed sentences in English and Malayalam; the app writes
 * every fraction itself. Returns null when the text has no proper fraction to draw.
 */
export function offlineFractions(text: string): FractionPlan | null {
  const seen = new Set<string>();
  const found: Array<[number, number]> = [];
  for (const m of text.matchAll(/\{(\d{1,2})\/(\d{1,2})\}|(?<![\d/.])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/g)) {
    const n = Number(m[1] ?? m[3]);
    const d = Number(m[2] ?? m[4]);
    if (d < 1 || d > 24 || n > d || seen.has(`${n}/${d}`)) continue;
    seen.add(`${n}/${d}`);
    found.push([n, d]);
    if (found.length === 3) break;
  }
  if (!found.length) return null;
  const steps: FractionStep[] = found.map(([n, d], i) => ({
    op: 'bar',
    n: d,
    shade: n,
    say:
      i === 0
        ? { en: `Cut a bar into ${d} equal parts and colour ${n} of them. That is ${n} out of ${d} parts.`, ml: `ഒരു പട്ടികയെ ${d} തുല്യ ഭാഗങ്ങളാക്കി അതിൽ ${n} ഭാഗത്തിന് നിറം നൽകുക. ${d} ഭാഗങ്ങളിൽ ${n} ഭാഗം.` }
        : { en: `Another bar: ${d} equal parts, ${n} coloured.`, ml: `മറ്റൊരു പട്ടിക: ${d} തുല്യ ഭാഗങ്ങൾ, ${n} ഭാഗത്തിന് നിറം.` },
  }));
  return { steps };
}

/**
 * "3 × 3 matrix" in the text → the anatomy of that matrix (entries, a row, a column, the diagonal,
 * the size, square or rectangular) with fixed captions in English and Malayalam. Sizes are read
 * from the text (1–5), otherwise 3 × 3.
 */
export function offlineMatrix(text: string): MatrixPlan {
  const m = /\b([1-5])\s*[×x]\s*([1-5])\b/.exec(text);
  const rows = m ? Number(m[1]) : 3;
  const cols = m ? Number(m[2]) : 3;
  const sq = rows === cols;
  return {
    name: 'A',
    rows,
    cols,
    steps: [
      { op: 'show', say: { en: 'A matrix is a grid of numbers inside brackets. Each entry has two small numbers: its row, then its column.', ml: 'ബ്രാക്കറ്റിനുള്ളിൽ സംഖ്യകൾ ഗ്രിഡായി എഴുതിയതാണ് മാട്രിക്സ്. ഓരോ എൻട്രിക്കും രണ്ട് ചെറിയ സംഖ്യകളുണ്ട്: വരിയും പിന്നെ നിരയും.' } },
      { op: 'row', index: 0, say: { en: 'A row runs across. This is the first row.', ml: 'വരി കുറുകെ പോകുന്നു. ഇത് ഒന്നാം വരിയാണ്.' } },
      { op: 'column', index: 0, say: { en: 'A column runs down. This is the first column.', ml: 'നിര താഴേക്ക് പോകുന്നു. ഇത് ഒന്നാം നിരയാണ്.' } },
      { op: 'diagonal', say: { en: 'The diagonal runs from the top left corner towards the bottom right.', ml: 'വികർണം മുകളിൽ ഇടത്തെ മൂലയിൽ നിന്ന് താഴെ വലത്തേക്ക് പോകുന്നു.' } },
      { op: 'size', say: { en: `It has ${rows} rows and ${cols} columns: a ${rows} by ${cols} matrix.`, ml: `ഇതിന് ${rows} വരികളും ${cols} നിരകളുമുണ്ട്: ${rows} ഗുണം ${cols} മാട്രിക്സ്.` } },
      {
        op: 'kind',
        say: sq
          ? { en: 'Rows and columns are equal, so it is a square matrix.', ml: 'വരികളും നിരകളും തുല്യമാണ്, അതിനാൽ ഇത് സമചതുര മാട്രിക്സ് ആണ്.' }
          : { en: 'Rows and columns differ, so it is a rectangular matrix.', ml: 'വരികളും നിരകളും വ്യത്യസ്തമാണ്, അതിനാൽ ഇത് ദീർഘചതുര മാട്രിക്സ് ആണ്.' },
      },
    ],
  };
}

/** Fixed captions per shape: what the offline planner says, in both languages (Malayalam drafted for teacher review). */
const SHAPE_SAY = {
  circle: {
    shape: { en: 'This is a circle. Every point on it is the same distance from the centre.', ml: 'ഇതൊരു വൃത്തമാണ്. ഇതിലെ ഓരോ ബിന്ദുവും കേന്ദ്രത്തിൽ നിന്ന് ഒരേ അകലത്തിലാണ്.' },
    label: { en: 'That distance is the radius, r.', ml: 'ആ അകലമാണ് ആരം, r.' },
    area: { en: 'The area of the circle is pi times r squared.', ml: 'വൃത്തത്തിന്റെ വിസ്തീർണം പൈ ഗുണം r വർഗം ആണ്.' },
    circumference: { en: 'The distance around, the circumference, is two pi r.', ml: 'ചുറ്റിലുമുള്ള നീളം, ചുറ്റളവ്, രണ്ട് പൈ r ആണ്.' },
  },
  rectangle: {
    shape: { en: 'This is a rectangle.', ml: 'ഇതൊരു ദീർഘചതുരമാണ്.' },
    label: { en: 'Call its length l and its width w.', ml: 'ഇതിന്റെ നീളം l എന്നും വീതി w എന്നും വിളിക്കാം.' },
    area: { en: 'The area is length times width.', ml: 'വിസ്തീർണം നീളം ഗുണം വീതി ആണ്.' },
    perimeter: { en: 'The perimeter is twice the sum of the length and the width.', ml: 'ചുറ്റളവ് നീളത്തിന്റെയും വീതിയുടെയും തുകയുടെ ഇരട്ടിയാണ്.' },
  },
  square: {
    shape: { en: 'This is a square: all four sides are equal.', ml: 'ഇതൊരു സമചതുരമാണ്: നാല് വശങ്ങളും തുല്യമാണ്.' },
    label: { en: 'Call the side s.', ml: 'വശത്തെ s എന്ന് വിളിക്കാം.' },
    area: { en: 'The area is s times s.', ml: 'വിസ്തീർണം s ഗുണം s ആണ്.' },
    perimeter: { en: 'The perimeter is four times s.', ml: 'ചുറ്റളവ് s-ന്റെ നാലിരട്ടിയാണ്.' },
  },
  triangle: {
    shape: { en: 'This is a triangle.', ml: 'ഇതൊരു ത്രികോണമാണ്.' },
    label: { en: 'Call the bottom side the base, b.', ml: 'താഴത്തെ വശത്തെ പാദം, b, എന്ന് വിളിക്കാം.' },
    height: { en: 'The height h is the straight line down from the top corner, at a right angle to the base.', ml: 'മുകളിലെ മൂലയിൽ നിന്ന് പാദത്തിലേക്ക് മട്ടകോണിൽ വരയ്ക്കുന്ന വരയാണ് ഉയരം, h.' },
    area: { en: 'The area is half of base times height.', ml: 'വിസ്തീർണം പാദം ഗുണം ഉയരത്തിന്റെ പകുതിയാണ്.' },
  },
  'right-triangle': {
    shape: { en: 'This is a right triangle: one corner is a right angle.', ml: 'ഇതൊരു മട്ടത്രികോണമാണ്: ഒരു മൂല മട്ടകോണാണ്.' },
    label: { en: 'The longest side, opposite the right angle, is c. The other two are a and b.', ml: 'മട്ടകോണിന് എതിരെയുള്ള ഏറ്റവും നീളമുള്ള വശം c ആണ്. മറ്റ് രണ്ടെണ്ണം a, b.' },
    pythagoras: { en: 'Pythagoras: a squared plus b squared equals c squared.', ml: 'പൈതഗോറസ്: a വർഗം കൂട്ടണം b വർഗം തുല്യം c വർഗം.' },
    area: { en: 'The area is half of a times b.', ml: 'വിസ്തീർണം a ഗുണം b-യുടെ പകുതിയാണ്.' },
  },
  'special-30-60-90': {
    shape: { en: 'Here is a special right triangle, with angles 30, 60 and 90 degrees.', ml: 'ഇതൊരു പ്രത്യേക മട്ടത്രികോണമാണ്, കോണുകൾ 30, 60, 90 ഡിഗ്രി.' },
    label: { en: 'Its sides are a, a root 3 and 2a.', ml: 'ഇതിന്റെ വശങ്ങൾ a, a റൂട്ട് 3, 2a ആണ്.' },
    angles: { en: 'The short side is opposite the 30 degree angle.', ml: 'ചെറിയ വശം 30 ഡിഗ്രി കോണിന് എതിരെയാണ്.' },
    ratio: { en: 'The sides are always in the ratio a to a root 3 to 2a.', ml: 'വശങ്ങളുടെ അനുപാതം എപ്പോഴും a : a റൂട്ട് 3 : 2a ആണ്.' },
  },
  'special-45-45-90': {
    shape: { en: 'Here is another special right triangle, with angles 45, 45 and 90 degrees.', ml: 'ഇത് മറ്റൊരു പ്രത്യേക മട്ടത്രികോണമാണ്, കോണുകൾ 45, 45, 90 ഡിഗ്രി.' },
    label: { en: 'Two sides are equal, a, and the longest side is a root 2.', ml: 'രണ്ട് വശങ്ങൾ തുല്യമാണ്, a; ഏറ്റവും നീളമുള്ള വശം a റൂട്ട് 2.' },
    angles: { en: 'The two acute angles are both 45 degrees.', ml: 'രണ്ട് ന്യൂനകോണുകളും 45 ഡിഗ്രിയാണ്.' },
    ratio: { en: 'The sides are in the ratio a to a to a root 2.', ml: 'വശങ്ങളുടെ അനുപാതം a : a : a റൂട്ട് 2 ആണ്.' },
  },
} as const;

/** Shapes named in the text, in the order they appear (at most 3). Sizes stay as letters. */
export function offlineShape(text: string): ShapePlan | null {
  const found: Array<{ at: number; kind: ShapeKind }> = [];
  const add = (re: RegExp, kind: ShapeKind) => {
    const m = re.exec(text);
    if (m) found.push({ at: m.index, kind });
  };
  add(/30\s*°?\s*[-–]\s*60/i, 'special-30-60-90');
  add(/45\s*°?\s*[-–]\s*45/i, 'special-45-45-90');
  if (!found.length) {
    add(/\b(hypotenuse|pythagoras|pythagorean|right[- ]angled? triangles?)\b|a²\s*\+\s*b²/i, 'right-triangle');
    if (!found.length) add(/\btriangles?\b/i, 'triangle');
  }
  add(/\b(circles?|radius|circumference)\b/i, 'circle');
  add(/\brectangles?\b/i, 'rectangle');
  add(/\bsquares?\b/i, 'square');
  found.sort((a, b) => a.at - b.at);
  const kinds = found.map((f) => f.kind).slice(0, 3);
  if (!kinds.length) return null;
  const steps: ShapeStep[] = [];
  for (const k of kinds) {
    const say = SHAPE_SAY[k] as Record<string, { en: string; ml: string }>;
    steps.push({ op: 'shape', kind: k, say: say.shape });
    steps.push({ op: 'label', say: say.label });
    if (k === 'triangle') steps.push({ op: 'height', say: say.height });
    if (k === 'special-30-60-90' || k === 'special-45-45-90') steps.push({ op: 'angles', say: say.angles });
    const whats = k === 'circle' ? (['area', 'circumference'] as const) : k === 'rectangle' || k === 'square' ? (['area', 'perimeter'] as const) : k === 'triangle' ? (['area'] as const) : k === 'right-triangle' ? (['pythagoras', 'area'] as const) : (['ratio'] as const);
    for (const w of whats) steps.push({ op: 'formula', what: w, say: say[w] });
    steps.push({ op: 'name', say: { en: `This is a ${k.startsWith('special') ? 'special right triangle' : k.replace('-', ' ')}.`, ml: SHAPE_NAME_ML[k] } });
  }
  return { steps };
}

const SHAPE_NAME_ML: Record<string, string> = {
  circle: 'ഇതൊരു വൃത്തമാണ്.',
  rectangle: 'ഇതൊരു ദീർഘചതുരമാണ്.',
  square: 'ഇതൊരു സമചതുരമാണ്.',
  triangle: 'ഇതൊരു ത്രികോണമാണ്.',
  'right-triangle': 'ഇതൊരു മട്ടത്രികോണമാണ്.',
  'special-30-60-90': 'ഇതൊരു പ്രത്യേക മട്ടത്രികോണമാണ്.',
  'special-45-45-90': 'ഇതൊരു പ്രത്യേക മട്ടത്രികോണമാണ്.',
};

const VENN_SAY: Record<string, { en: string; ml: string }> = {
  show2: { en: 'The rectangle is the universal set. A and B are two sets inside it.', ml: 'ചതുരം സാർവിക ഗണമാണ്. അതിനുള്ളിലെ രണ്ട് ഗണങ്ങളാണ് A-യും B-യും.' },
  show3: { en: 'The rectangle is the universal set. A, B and C are three sets inside it.', ml: 'ചതുരം സാർവിക ഗണമാണ്. അതിനുള്ളിലെ മൂന്ന് ഗണങ്ങളാണ് A, B, C എന്നിവ.' },
  'A∩B': { en: 'What lies in both A and B is the intersection, A intersection B.', ml: 'A-യിലും B-യിലും ഉള്ളത് ഛേദം, A ഛേദം B.' },
  'A∪B': { en: 'What lies in A or B or both is the union, A union B.', ml: 'A-യിലോ B-യിലോ രണ്ടിലുമോ ഉള്ളത് യോഗം, A യോഗം B.' },
  "A'": { en: 'Everything in the universal set outside A is the complement of A.', ml: 'സാർവിക ഗണത്തിൽ A-യ്ക്ക് പുറത്തുള്ളതെല്ലാം A-യുടെ പൂരകമാണ്.' },
  'A−B': { en: 'The part of A that is not in B is A minus B.', ml: 'A-യിൽ ഉള്ളതും B-യിൽ ഇല്ലാത്തതുമായ ഭാഗം A − B.' },
  identity: { en: "De Morgan's law: the complement of an intersection is the union of the complements. Both pictures are the same region.", ml: 'ഡി മോർഗൻ നിയമം: ഛേദത്തിന്റെ പൂരകം പൂരകങ്ങളുടെ യോഗമാണ്. രണ്ട് ചിത്രങ്ങളും ഒരേ ഭാഗമാണ്.' },
  'A∩B∩C': { en: 'What lies in all three sets is A intersection B intersection C.', ml: 'മൂന്ന് ഗണങ്ങളിലും ഉള്ളത് A ഛേദം B ഛേദം C.' },
  'A∪B∪C': { en: 'What lies in at least one of the three sets is the union.', ml: 'മൂന്നിൽ ഏതെങ്കിലും ഒന്നിലെങ്കിലും ഉള്ളത് യോഗം.' },
  '(A∩B)−C': { en: 'In A and B but not in C.', ml: 'A-യിലും B-യിലും ഉള്ളതും C-യിൽ ഇല്ലാത്തതും.' },
};

/** Venn diagram of the sets in the text: the standard operations with fixed captions (two or three sets). */
export function offlineVenn(text: string): VennPlan {
  const three = /\b(three sets|A\s*[∪∩]\s*B\s*[∪∩]\s*C)\b/i.test(text) || /\bC\b/.test(text) && /\bA\b/.test(text) && /\bB\b/.test(text);
  const steps: VennStep[] = [{ op: 'show', say: VENN_SAY[three ? 'show3' : 'show2'] }];
  const exprs = three ? ['A∩B∩C', 'A∪B∪C', '(A∩B)−C'] : ['A∩B', 'A∪B', "A'", 'A−B'];
  for (const e of exprs) steps.push({ op: 'shade', expr: e, say: VENN_SAY[e] });
  if (!three && /de morgan/i.test(text)) steps.push({ op: 'identity', left: "A'∪B'", right: "(A∩B)'", say: VENN_SAY.identity });
  return { sets: three ? 3 : 2, steps };
}

const TRIG_SAY: Record<string, { en: string; ml: string }> = {
  show: { en: 'Here is a circle of radius 1 with its two axes.', ml: 'ആരം 1 ആയ ഒരു വൃത്തവും അതിന്റെ രണ്ട് അക്ഷങ്ങളും.' },
  point: { en: 'Take a point on the circle at angle theta. Call its coordinates x and y.', ml: 'വൃത്തത്തിൽ θ കോണിൽ ഒരു ബിന്ദു എടുക്കുക. അതിന്റെ നിർദേശാങ്കങ്ങൾ x, y എന്ന് വിളിക്കാം.' },
  legs: { en: 'Drop a line down to the x-axis. We get a right triangle whose hypotenuse is 1.', ml: 'x-അക്ഷത്തിലേക്ക് ഒരു വര താഴ്ത്തുക. കർണം 1 ആയ ഒരു മട്ടത്രികോണം കിട്ടും.' },
  cos: { en: 'Cosine of theta is the horizontal side, x.', ml: 'θ-യുടെ കോസ് തിരശ്ചീന വശമായ x ആണ്.' },
  sin: { en: 'Sine of theta is the vertical side, y.', ml: 'θ-യുടെ സൈൻ ലംബ വശമായ y ആണ്.' },
  tan: { en: 'Draw the tangent line at the point. The piece down to the x-axis has length tangent of theta: sine over cosine.', ml: 'ബിന്ദുവിലെ സ്പർശരേഖ വരയ്ക്കുക. x-അക്ഷം വരെയുള്ള ഭാഗത്തിന്റെ നീളം θ-യുടെ ടാൻ ആണ്: സൈൻ ഹരണം കോസ്.' },
  cot: { en: 'The piece up to the y-axis is cotangent: cosine over sine.', ml: 'y-അക്ഷം വരെയുള്ള ഭാഗം കോട്ടാൻ ആണ്: കോസ് ഹരണം സൈൻ.' },
  sec: { en: 'Where the tangent meets the x-axis, the distance from the centre is secant: one over cosine.', ml: 'സ്പർശരേഖ x-അക്ഷത്തെ കണ്ടുമുട്ടുന്നിടത്തേക്ക് കേന്ദ്രത്തിൽ നിന്നുള്ള ദൂരം സെക്കന്റ് ആണ്: ഒന്ന് ഹരണം കോസ്.' },
  csc: { en: 'Where it meets the y-axis, the distance is cosecant: one over sine.', ml: 'y-അക്ഷത്തെ കണ്ടുമുട്ടുന്നിടത്തേക്കുള്ള ദൂരം കോസെക്കന്റ് ആണ്: ഒന്ന് ഹരണം സൈൻ.' },
  sweep: { en: 'Slide the point along the circle and watch every length change.', ml: 'ബിന്ദുവിനെ വൃത്തത്തിലൂടെ നീക്കി ഓരോ നീളവും മാറുന്നത് നോക്കൂ.' },
  values: { en: 'At this angle the ratios have these values.', ml: 'ഈ കോണിൽ അനുപാതങ്ങളുടെ വിലകൾ ഇവയാണ്.' },
  identity: { en: 'Pythagoras in the triangle gives sine squared plus cosine squared equals one.', ml: 'ത്രികോണത്തിലെ പൈതഗോറസ് സിദ്ധാന്തം: സൈൻ സ്ക്വയർ കൂട്ടണം കോസ് സ്ക്വയർ തുല്യം ഒന്ന്.' },
  box: { en: 'These ratios are the whole family.', ml: 'ഈ അനുപാതങ്ങളാണ് മുഴുവൻ കുടുംബം.' },
};

/** Unit-circle lesson for a trigonometry text: cos, sin, tan (and cot, sec, csc when the text names them). */
export function offlineTrig(text: string): TrigPlan {
  const m = /\b(30|45|60)\s*°/.exec(text);
  const angle = m ? Number(m[1]) : 30;
  const more = /\b(cot|cotangent|sec|secant|cosec|cosecant|csc)\b/i.test(text);
  const steps: TrigStep[] = [
    { op: 'show', say: TRIG_SAY.show },
    { op: 'point', say: TRIG_SAY.point },
    { op: 'legs', say: TRIG_SAY.legs },
    { op: 'ratio', which: 'cos', say: TRIG_SAY.cos },
    { op: 'ratio', which: 'sin', say: TRIG_SAY.sin },
    { op: 'ratio', which: 'tan', say: TRIG_SAY.tan },
  ];
  if (more) for (const r of ['cot', 'sec', 'csc'] as const) steps.push({ op: 'ratio', which: r, say: TRIG_SAY[r] });
  steps.push({ op: 'values', say: TRIG_SAY.values }, { op: 'identity', which: 'pythagorean', say: TRIG_SAY.identity });
  return { angle, steps };
}

const LIN_SAY: Record<string, Bi> = {
  show: { en: 'Here are two equations with the same two unknowns, x and y.', ml: 'x, y എന്നീ ഒരേ രണ്ട് അജ്ഞാതങ്ങളുള്ള രണ്ട് സമവാക്യങ്ങൾ.' },
  graph: { en: 'Each equation is a straight line. A solution must lie on both lines.', ml: 'ഓരോ സമവാക്യവും ഒരു നേർരേഖയാണ്. ഉത്തരം രണ്ട് രേഖയിലും ആയിരിക്കണം.' },
  meet: { en: 'The lines meet at one point. Its coordinates are the solution.', ml: 'രേഖകൾ ഒരു ബിന്ദുവിൽ കൂടിമുട്ടുന്നു. അതിന്റെ നിർദേശാങ്കങ്ങളാണ് ഉത്തരം.' },
  eliminate: { en: 'Now algebra. Make the coefficients of one unknown equal, then add or subtract to remove it.', ml: 'ഇനി ബീജഗണിതം. ഒരു അജ്ഞാതത്തിന്റെ ഗുണകങ്ങൾ തുല്യമാക്കി കൂട്ടുകയോ കുറയ്ക്കുകയോ ചെയ്ത് അതിനെ ഒഴിവാക്കുക.' },
  substitute: { en: 'Put this value into the first equation to find the other unknown.', ml: 'ഈ വില ആദ്യ സമവാക്യത്തിൽ ആദേശം ചെയ്ത് മറ്റേ അജ്ഞാതം കണ്ടെത്തുക.' },
  check: { en: 'Check: the solution makes both equations true.', ml: 'പരിശോധന: ഉത്തരം രണ്ട് സമവാക്യങ്ങളെയും ശരിയാക്കുന്നു.' },
  matrix: { en: 'The same system in matrix form: A times x equals b.', ml: 'ഇതേ സമവാക്യങ്ങൾ മാട്രിക്സ് രൂപത്തിൽ: A ഗുണം x തുല്യം b.' },
};

/** Pair of linear equations written as "2x + y = 7" twice in the text; null when the numbers cannot be read or do not give one whole-number solution. */
export function offlineLinear(text: string): LinPlan | null {
  const re = /([+−-]?)\s*(\d*)\s*x\s*([+−-])\s*(\d*)\s*y\s*=\s*([+−-]?)\s*(\d+)/g;
  const found: Array<{ a: number; b: number; c: number }> = [];
  for (const m of text.matchAll(re)) {
    const sgn = (z: string) => (z === '-' || z === '−' ? -1 : 1);
    found.push({ a: sgn(m[1]) * (m[2] === '' ? 1 : Number(m[2])), b: sgn(m[3]) * (m[4] === '' ? 1 : Number(m[4])), c: sgn(m[5]) * Number(m[6]) });
  }
  if (found.length < 2) return null;
  const plan0 = { e1: found[0], e2: found[1] };
  if (eqProblem(plan0.e1, 'e1') || eqProblem(plan0.e2, 'e2') || 'error' in solve(plan0)) return null;
  const cost = (v: 'x' | 'y') => {
    const el = eliminate(plan0, v);
    return el.m1 + el.m2;
  };
  const v: 'x' | 'y' = cost('y') <= cost('x') ? 'y' : 'x';
  const steps: LinStep[] = [
    { op: 'show', say: LIN_SAY.show },
    { op: 'graph', say: LIN_SAY.graph },
    { op: 'meet', say: LIN_SAY.meet },
    { op: 'eliminate', var: v, say: LIN_SAY.eliminate },
    { op: 'substitute', into: 1, say: LIN_SAY.substitute },
    { op: 'check', say: LIN_SAY.check },
    { op: 'matrix', say: LIN_SAY.matrix },
  ];
  return { ...plan0, steps };
}

const SEQ_SAY: Record<string, Bi> = {
  show: { en: 'Here is a list of numbers, one after another.', ml: 'ഇതാ ഒന്നിനു പിറകേ ഒന്നായി കുറേ സംഖ്യകൾ.' },
  diff: { en: 'Each term is the one before it plus the same number. That number is the common difference.', ml: 'ഓരോ പദവും തൊട്ടു മുമ്പത്തേതിനോട് ഒരേ സംഖ്യ കൂട്ടിയതാണ്. ആ സംഖ്യയാണ് പൊതുവ്യത്യാസം.' },
  formula: { en: 'So the n-th term is the first term plus n minus 1 times the common difference.', ml: 'അതിനാൽ n-ാം പദം ആദ്യപദത്തോട് n − 1 തവണ പൊതുവ്യത്യാസം കൂട്ടിയതാണ്.' },
  term: { en: 'Put the number of the term into the formula.', ml: 'പദത്തിന്റെ സ്ഥാനസംഖ്യ സൂത്രവാക്യത്തിൽ ചേർക്കുക.' },
  sum: { en: 'The sum of the first terms is half the number of terms times the first plus the last.', ml: 'ആദ്യ പദങ്ങളുടെ തുക പദങ്ങളുടെ എണ്ണത്തിന്റെ പകുതി ഗുണം ആദ്യവും അവസാനവും കൂട്ടിയതാണ്.' },
  graph: { en: 'Plot each term against its number. The points lie on a straight line.', ml: 'ഓരോ പദവും അതിന്റെ സ്ഥാനസംഖ്യയ്ക്കെതിരെ അടയാളപ്പെടുത്തുക. ബിന്ദുക്കൾ ഒരു നേർരേഖയിൽ.' },
};

/** Arithmetic-sequence lesson from a list like "3, 7, 11, 15" or "first term 3 … common difference 4"; null when no usable numbers. */
export function offlineSeq(text: string): SeqPlan | null {
  let a: number;
  let d: number;
  let count = 0;
  const list = listIn(text);
  if (list) {
    ({ a, d, count } = list);
  } else {
    const fa = /first term\s*(?:is|=|:)?\s*([−-]?\d+)/i.exec(text);
    const fd = /common difference\s*(?:is|=|:)?\s*([−-]?\d+)/i.exec(text);
    if (!fa || !fd) return null;
    a = Number(fa[1].replace('−', '-'));
    d = Number(fd[1].replace('−', '-'));
  }
  if (!Number.isInteger(a) || !Number.isInteger(d) || d === 0 || Math.abs(a) > A_MAX || Math.abs(d) > D_MAX) return null;
  const terms = count >= 6 || count === 5 ? 6 : 4;
  const nm = /(\d+)(?:st|nd|rd|th) term/i.exec(text);
  const n = nm && Number(nm[1]) > terms && Number(nm[1]) <= 100 ? Number(nm[1]) : 20;
  const steps: SeqStep[] = [
    { op: 'show', say: SEQ_SAY.show },
    { op: 'diff', say: SEQ_SAY.diff },
    { op: 'formula', say: SEQ_SAY.formula },
    { op: 'term', n, say: SEQ_SAY.term },
  ];
  if (/\bsum\b/i.test(text)) steps.push({ op: 'sum', n, say: SEQ_SAY.sum });
  steps.push({ op: 'graph', say: SEQ_SAY.graph });
  return { a, d, terms, steps };
}

const QUAD_SAY: Record<string, Bi> = {
  show: { en: 'Here is a quadratic equation.', ml: 'ഇതാ ഒരു ദ്വിമാന സമവാക്യം.' },
  graph: { en: 'Its graph is a parabola. The solutions are where it meets the x-axis.', ml: 'ഇതിന്റെ ഗ്രാഫ് ഒരു പരാബോളയാണ്. x-അക്ഷത്തെ തൊടുന്നിടങ്ങളാണ് ഉത്തരങ്ങൾ.' },
  discriminant: { en: 'The discriminant b squared minus 4ac tells how many real roots there are.', ml: 'b² − 4ac എന്ന വിവേചകം എത്ര മൂലങ്ങളുണ്ടെന്ന് പറയുന്നു.' },
  factorise: { en: 'Split the middle term and group. The equation becomes a product equal to zero, so one factor is zero.', ml: 'മധ്യപദത്തെ വിഭജിച്ച് ഗ്രൂപ്പ് ചെയ്യുക. ഗുണനഫലം പൂജ്യമാകുന്ന സമവാക്യം കിട്ടും, അതിനാൽ ഒരു ഘടകം പൂജ്യമാണ്.' },
  formula: { en: 'Put the numbers into the quadratic formula.', ml: 'സംഖ്യകൾ ദ്വിമാന സൂത്രവാക്യത്തിൽ ചേർക്കുക.' },
  roots: { en: 'The roots are the points where the curve meets the x-axis.', ml: 'വക്രം x-അക്ഷത്തെ തൊടുന്ന ബിന്ദുക്കളാണ് മൂലങ്ങൾ.' },
  check: { en: 'Check: each root makes the equation true.', ml: 'പരിശോധന: ഓരോ മൂലവും സമവാക്യത്തെ ശരിയാക്കുന്നു.' },
};

/** Quadratic lesson from an equation like "x² − 5x + 6 = 0" in the text; null when none is found or the numbers are outside what the DNA accepts. */
export function offlineQuad(text: string): QuadPlan | null {
  const q = parseQuad(text);
  if (!q || quadProblem(q, 'q')) return null;
  const rational = rationalRoots(q);
  const steps: QuadStep[] = [
    { op: 'show', say: QUAD_SAY.show },
    { op: 'graph', say: QUAD_SAY.graph },
    { op: 'discriminant', say: QUAD_SAY.discriminant },
  ];
  if (rational && !(q.b === 0 && q.c === 0)) steps.push({ op: 'factorise', say: QUAD_SAY.factorise });
  else steps.push({ op: 'formula', say: QUAD_SAY.formula });
  if (rational) steps.push({ op: 'roots', say: QUAD_SAY.roots });
  if (rational && quadRoots(q).every((r) => r.d === 1)) steps.push({ op: 'check', say: QUAD_SAY.check });
  void quadDisc;
  return { ...q, steps };
}

const POLY_SAY: Record<string, Bi> = {
  show: { en: 'Here is a polynomial. Its degree is the highest power of x.', ml: 'ഇതാ ഒരു ബഹുപദം. x-ന്റെ ഏറ്റവും വലിയ കൃതിയാണ് അതിന്റെ കൃതി.' },
  divide: { en: 'Divide term by term: take the first term, multiply back, subtract, and repeat.', ml: 'പദം പദമായി ഹരിക്കുക: ആദ്യപദം എടുത്ത് ഗുണിച്ച് കുറച്ച് ആവർത്തിക്കുക.' },
  remainder: { en: 'Put the value of x that makes the divisor zero. The result is the remainder.', ml: 'ഹാരകത്തെ പൂജ്യമാക്കുന്ന x-ന്റെ വില ചേർക്കുക. കിട്ടുന്നത് ശിഷ്ടമാണ്.' },
  factor: { en: 'The value is zero, so the divisor is a factor. Divide it out and factorise the rest.', ml: 'വില പൂജ്യമാണ്, അതിനാൽ ഹാരകം ഒരു ഘടകമാണ്. അത് ഹരിച്ച് ബാക്കി ഘടകങ്ങളാക്കുക.' },
  identity: { en: 'This polynomial is a square identity. Check it by multiplying the factors back.', ml: 'ഇത് ഒരു വർഗ ഐഡന്റിറ്റിയാണ്. ഘടകങ്ങൾ ഗുണിച്ച് പരിശോധിക്കുക.' },
  graph: { en: 'Here is the curve y equals the polynomial.', ml: 'ഇതാ ബഹുപദത്തിന്റെ വക്രം.' },
  roots: { en: 'The curve crosses the x-axis at the roots.', ml: 'വക്രം മൂലങ്ങളിൽ x-അക്ഷത്തെ മുറിച്ചു കടക്കുന്നു.' },
};

/** Polynomial lesson from an expression like "x³ − 4x² + x + 6" in the text; null when none fits what the DNA accepts. */
export function offlinePoly(text: string): PolyPlan | null {
  const p = parsePoly(text);
  if (!p) return null;
  const steps: PolyStep[] = [{ op: 'show', say: POLY_SAY.show }];
  let r: number | undefined;
  const dm = text.replace(/[−–—]/g, '-').match(/(?:divided by|dividing by|divisor|\bby)\s*\(?\s*x\s*([+-])\s*(\d)\b/i);
  if (dm && /remainder|divid|division/i.test(text)) {
    const v = (dm[1] === '-' ? 1 : -1) * Number(dm[2]);
    if (v !== 0 && Math.abs(v) <= R_MAX) r = v;
  }
  if (r !== undefined && p.length - 1 <= DIV_DEG_MAX && /divid|division/i.test(text)) steps.push({ op: 'divide', say: POLY_SAY.divide });
  if (r !== undefined) steps.push({ op: 'remainder', say: POLY_SAY.remainder });
  const rs = fullyFactorable(p);
  if (rs && /factor/i.test(text)) steps.push({ op: 'factor', at: r !== undefined && rs.includes(r) ? r : rs[0], say: POLY_SAY.factor });
  if (identityOf(p) && /identit|square/i.test(text)) steps.push({ op: 'identity', say: POLY_SAY.identity });
  steps.push({ op: 'graph', say: POLY_SAY.graph });
  if (integerRoots(p).roots.length) steps.push({ op: 'roots', say: POLY_SAY.roots });
  return { p, ...(r !== undefined ? { r } : {}), steps };
}

const ANGLE_SAY: Record<string, Bi> = {
  pShow: { en: 'Two parallel lines are cut by a third line, a transversal.', ml: 'രണ്ട് സമാന്തര രേഖകളെ മൂന്നാമതൊരു രേഖ, ഛേദകരേഖ, മുറിക്കുന്നു.' },
  given: { en: 'One of the eight angles is known.', ml: 'എട്ട് കോണുകളിൽ ഒന്ന് അറിയാം.' },
  vertical: { en: 'The vertically opposite angle is equal.', ml: 'ശീർഷാഭിമുഖ കോൺ തുല്യമാണ്.' },
  linear: { en: 'Angles next to each other on a straight line add up to 180 degrees.', ml: 'ഒരു നേർരേഖയിലെ അടുത്തടുത്ത കോണുകളുടെ തുക 180° ആണ്.' },
  corresponding: { en: 'The corresponding angle at the other line is equal.', ml: 'മറ്റേ രേഖയിലെ സംഗത കോൺ തുല്യമാണ്.' },
  alternate: { en: 'The alternate angle is equal.', ml: 'ഏകാന്തര കോൺ തുല്യമാണ്.' },
  cointerior: { en: 'Co-interior angles add up to 180 degrees.', ml: 'ഒരേ വശത്തെ അന്തർകോണുകളുടെ തുക 180° ആണ്.' },
  tShow: { en: 'Here is a triangle.', ml: 'ഇതാ ഒരു ത്രികോണം.' },
  angles: { en: 'Two of its angles are known.', ml: 'അതിന്റെ രണ്ട് കോണുകൾ അറിയാം.' },
  find: { en: 'The third angle is 180 degrees minus the other two.', ml: 'മൂന്നാമത്തെ കോൺ 180°-ൽ നിന്ന് മറ്റ് രണ്ടും കുറച്ചതാണ്.' },
  sum: { en: 'The three angles of a triangle add up to 180 degrees.', ml: 'ഒരു ത്രികോണത്തിന്റെ മൂന്ന് കോണുകളുടെ തുക 180° ആണ്.' },
  exterior: { en: 'An exterior angle equals the sum of the two interior opposite angles.', ml: 'ബാഹ്യകോൺ ഉള്ളിലെ എതിർകോണുകളുടെ തുകയ്ക്ക് തുല്യമാണ്.' },
  cShow: { en: 'Here is a circle with a chord AB.', ml: 'ഇതാ ഒരു വൃത്തവും AB എന്ന ഞാണും.' },
  centre: { en: 'This is the angle the arc AB makes at the centre.', ml: 'AB ചാപം കേന്ദ്രത്തിൽ ഉണ്ടാക്കുന്ന കോൺ ഇതാണ്.' },
  circumference: { en: 'This is the angle the same arc makes at a point on the circle.', ml: 'അതേ ചാപം വൃത്തത്തിലെ ഒരു ബിന്ദുവിൽ ഉണ്ടാക്കുന്ന കോൺ ഇതാണ്.' },
  double: { en: 'The angle at the centre is twice the angle at the circle.', ml: 'കേന്ദ്രത്തിലെ കോൺ വൃത്തത്തിലെ കോണിന്റെ ഇരട്ടിയാണ്.' },
  sameArc: { en: 'Any other point on the same arc sees AB at the same angle.', ml: 'അതേ ചാപത്തിലെ മറ്റൊരു ബിന്ദുവും AB-യെ അതേ കോണിൽ കാണുന്നു.' },
  cyclic: { en: 'A point on the other arc gives an angle that adds up to 180 degrees with it.', ml: 'മറുവശത്തെ ചാപത്തിലെ ബിന്ദുവിൽ കിട്ടുന്ന കോണും ഇതും ചേർന്ന് 180° ആകും.' },
};

/** Angle lesson from the words and the whole-degree numbers in the text; null when the numbers do not fit what the DNA accepts. */
export function offlineAngle(text: string): AnglePlan | null {
  const ds = degreesIn(text);
  const step = (op: AngleStep['op'], say: Bi) => ({ op, say }) as AngleStep;
  if (/\b(transversal|parallel lines?|corresponding angles?|alternate (?:interior |exterior )?angles?|co-?interior|allied|vertically opposite|linear pair)/i.test(text)) {
    const a = ds.find((d) => d >= PAR_MIN && d <= PAR_MAX && d !== 90);
    if (a === undefined) return null;
    const steps: AngleStep[] = [step('show', ANGLE_SAY.pShow), step('given', ANGLE_SAY.given)];
    const named = (re: RegExp) => re.test(text);
    const wanted: Array<[RegExp, AngleStep['op']]> = [[/vertically opposite/i, 'vertical'], [/linear pair/i, 'linear'], [/corresponding/i, 'corresponding'], [/alternate/i, 'alternate'], [/co-?interior|allied/i, 'cointerior']];
    for (const [re, op] of wanted) if (named(re)) steps.push(step(op, ANGLE_SAY[op === 'cointerior' ? 'cointerior' : op]));
    if (steps.length === 2) for (const op of ['vertical', 'corresponding', 'alternate', 'cointerior'] as const) steps.push(step(op, ANGLE_SAY[op]));
    return { figure: 'parallel', a, steps };
  }
  if (/\b(triangle)\b/i.test(text) && /(angle sum|sum of (?:the )?(?:interior )?angles|angles? of a triangle|exterior angle)/i.test(text)) {
    const ok = ds.filter((d) => d >= TRI_MIN && d <= TRI_MAX);
    for (let i = 0; i + 1 < ok.length; i++) {
      const A = ok[i];
      const B = ok[i + 1];
      if (A + B >= 60 && A + B <= 160) {
        const steps: AngleStep[] = [step('show', ANGLE_SAY.tShow), step('angles', ANGLE_SAY.angles), step('find', ANGLE_SAY.find), step('sum', ANGLE_SAY.sum)];
        if (/exterior/i.test(text)) steps.push(step('exterior', ANGLE_SAY.exterior));
        return { figure: 'triangle', A, B, steps };
      }
    }
    return null;
  }
  if (/\b(semi-?circle|angle at the centre|angles? (?:at|in) the (?:centre|circumference)|same segment|cyclic quadrilateral|inscribed angle)/i.test(text)) {
    let beta: number | undefined = /semi-?circle/i.test(text) ? 90 : undefined;
    if (beta === undefined) {
      const centre = text.match(/centre[^.]*?(\d{1,3})\s*(?:°|º|degrees?)/i);
      const circ = text.match(/circumference[^.]*?(\d{1,3})\s*(?:°|º|degrees?)/i);
      if (circ) beta = parseInt(circ[1], 10);
      else if (centre && parseInt(centre[1], 10) % 2 === 0) beta = parseInt(centre[1], 10) / 2;
      else beta = ds.find((d) => d >= BETA_MIN && d <= BETA_MAX);
    }
    if (beta === undefined || beta < BETA_MIN || beta > BETA_MAX) return null;
    const steps: AngleStep[] = [step('show', ANGLE_SAY.cShow), step('centre', ANGLE_SAY.centre), step('circumference', ANGLE_SAY.circumference), step('double', ANGLE_SAY.double), step('same-arc', ANGLE_SAY.sameArc)];
    if (/cyclic/i.test(text)) steps.push(step('cyclic', ANGLE_SAY.cyclic));
    return { figure: 'circle', beta, steps };
  }
  return null;
}


const SOLID_SAY = {
  cuboid: { en: 'This is a cuboid, with a length, a width and a height.', ml: 'നീളം, വീതി, ഉയരം എന്നിവയുള്ള ഒരു ചതുരക്കട്ടയാണിത്.' },
  prism: { en: 'This is a triangular prism.', ml: 'ഇതൊരു ത്രികോണ പ്രിസമാണ്.' },
  cylinder: { en: 'This is a cylinder, with a radius and a height.', ml: 'ആരവും ഉയരവുമുള്ള ഒരു സിലിണ്ടറാണിത്.' },
  cone: { en: 'This is a cone, with a radius and a height.', ml: 'ആരവും ഉയരവുമുള്ള ഒരു വൃത്തസ്തൂപികയാണിത്.' },
  sphere: { en: 'This is a sphere, with a radius.', ml: 'ആരമുള്ള ഒരു ഗോളമാണിത്.' },
  base: { en: 'The area of the base is shaded and worked out.', ml: 'പാദത്തിന്റെ പരപ്പളവ് അടയാളപ്പെടുത്തി കണക്കാക്കുന്നു.' },
  slantCone: { en: 'The slant height comes from Pythagoras.', ml: 'ചരിവുയരം പൈതഗോറസ് ഉപയോഗിച്ച് കിട്ടും.' },
  slantPrism: { en: 'The third side of the triangle comes from Pythagoras.', ml: 'ത്രികോണത്തിന്റെ മൂന്നാം വശം പൈതഗോറസ് ഉപയോഗിച്ച് കിട്ടും.' },
  volume: { en: 'The volume comes from the formula.', ml: 'സൂത്രവാക്യത്തിൽ നിന്ന് വ്യാപ്തം കിട്ടും.' },
  net: { en: 'Open the surface out flat: this is its net.', ml: 'പ്രതലം നിവർത്തി പരത്തുക: ഇതാണ് അതിന്റെ നെറ്റ്.' },
  surface: { en: 'Add the areas of all the pieces to get the surface area.', ml: 'എല്ലാ ഭാഗങ്ങളുടെയും പരപ്പളവ് കൂട്ടിയാൽ പ്രതലപരപ്പളവ് കിട്ടും.' },
  sphereSurface: { en: 'The surface area of a sphere is four times the area of its great circle.', ml: 'ഗോളത്തിന്റെ പ്രതലപരപ്പളവ് അതിന്റെ വലിയ വൃത്തത്തിന്റെ പരപ്പളവിന്റെ നാലിരട്ടിയാണ്.' },
};

/** Solid lesson from the words and sizes in the text; null when the sizes do not fit what the DNA accepts. */
export function offlineSolid(text: string): SolidPlan | null {
  const num = (re: RegExp): number | undefined => { const m = text.match(re); return m ? Number(m[1]) : undefined; };
  const kind = /\b(sphere|spherical|ball)\b/i.test(text) ? 'sphere' : /\b(cone|conical)\b/i.test(text) ? 'cone' : /\b(cylinder|cylindrical)\b/i.test(text) ? 'cylinder' : /\bprism\b/i.test(text) ? 'prism' : /\b(cuboid|box|cube)\b/i.test(text) ? 'cuboid' : null;
  if (!kind) return null;
  const r = num(/\bradius\b[^0-9]{0,24}(\d+)/i) ?? num(/\br\s*=\s*(\d+)/i);
  const h = num(/\bheight\b[^0-9]{0,24}(\d+)/i) ?? num(/\bh\s*=\s*(\d+)/i);
  const unit = /\b(\d+)\s*mm\b/.test(text) ? 'mm' : /\b(\d+)\s*m\b/.test(text) && !/\bcm\b/.test(text) ? 'm' : 'cm';
  let plan: SolidPlan | null = null;
  if (kind === 'sphere' && r) plan = { solid: 'sphere', r, unit, steps: [] };
  if (kind === 'cylinder' && r && h) plan = { solid: 'cylinder', r, h, unit, steps: [] };
  if (kind === 'cone' && r && h) plan = { solid: 'cone', r, h, unit, steps: [] };
  if (kind === 'cuboid') {
    const l = num(/\blength\b[^0-9]{0,24}(\d+)/i);
    const w = num(/\b(?:width|breadth)\b[^0-9]{0,24}(\d+)/i);
    if (l && w && h) plan = { solid: 'cuboid', a: l, b: w, h, unit, steps: [] };
  }
  if (kind === 'prism') {
    const t = text.match(/\b(\d+)\s*(?:cm|m|mm)?\s*,\s*(\d+)\s*(?:cm|m|mm)?\s*(?:,\s*)?and\s*(\d+)/i);
    const len = num(/\b(?:length|long)\b[^0-9]{0,24}(\d+)/i) ?? num(/\b(\d+)\s*(?:cm|mm|m)\s+long\b/i) ?? h;
    if (t && len) {
      const [x, y, z] = [Number(t[1]), Number(t[2]), Number(t[3])].sort((p, q) => p - q);
      if (x * x + y * y === z * z) plan = { solid: 'prism', a: x, b: y, h: len, unit, steps: [] };
    }
  }
  if (!plan) return null;
  if (solidProblem(plan, 'offline')) return null;
  const st = (op: SolidStep['op'], say: Bi) => ({ op, say }) as SolidStep;
  const wantsVolume = /\b(volume|capacity)\b/i.test(text);
  const wantsSurface = /\b(surface|area|net|paint|cover)/i.test(text);
  const both = !wantsVolume && !wantsSurface;
  const steps: SolidStep[] = [st('show', SOLID_SAY[kind])];
  if (kind !== 'sphere') steps.push(st('base', SOLID_SAY.base));
  if (kind === 'cone') steps.push(st('slant', SOLID_SAY.slantCone));
  if (kind === 'prism') steps.push(st('slant', SOLID_SAY.slantPrism));
  if (wantsVolume || both) steps.push(st('volume', SOLID_SAY.volume));
  if (wantsSurface || both) {
    if (kind !== 'sphere') steps.push(st('net', SOLID_SAY.net));
    steps.push(st('surface', kind === 'sphere' ? SOLID_SAY.sphereSurface : SOLID_SAY.surface));
  }
  return { ...plan, steps };
}

const RATIO_SAY = {
  share: { en: 'The amount is shared in a ratio: the bar has one block for every part.', ml: 'തുക ഒരു അംശബന്ധത്തിൽ പങ്കിടുന്നു: ഓരോ ഭാഗത്തിനും ഒരു കട്ട.' },
  unit: { en: 'The total divided by the number of parts gives the value of one block.', ml: 'ആകെ തുകയെ ഭാഗങ്ങളുടെ എണ്ണം കൊണ്ട് ഹരിച്ചാൽ ഒരു കട്ടയുടെ വില കിട്ടും.' },
  parts: { en: 'Each share is its number of blocks times the value of one block.', ml: 'ഓരോ പങ്കും അതിന്റെ കട്ടകളുടെ എണ്ണം × ഒരു കട്ടയുടെ വില ആണ്.' },
  check: { en: 'The shares add up to the total again.', ml: 'പങ്കുകൾ കൂട്ടിയാൽ വീണ്ടും ആകെ തുക കിട്ടും.' },
  percent: { en: 'The whole is 100 percent. We want a part of it.', ml: 'മുഴുവനും 100 ശതമാനമാണ്. അതിന്റെ ഒരു ഭാഗമാണ് വേണ്ടത്.' },
  tenth: { en: 'Ten equal blocks: each one is ten percent of the whole.', ml: 'പത്ത് തുല്യ കട്ടകൾ: ഓരോന്നും മുഴുവന്റെ 10% ആണ്.' },
  part: { en: 'Shade that percentage of the bar and work out its value.', ml: 'ബാറിന്റെ ആ ശതമാനം അടയാളപ്പെടുത്തി അതിന്റെ വില കണ്ടെത്തുക.' },
  result: { en: 'This is the answer.', ml: 'ഇതാണ് ഉത്തരം.' },
  up: { en: 'The amount goes up: the extra piece is that percentage of the original.', ml: 'തുക കൂടുന്നു: അധിക ഭാഗം ആദ്യത്തെ തുകയുടെ ആ ശതമാനമാണ്.' },
  down: { en: 'The amount goes down: the piece taken off is that percentage of the original.', ml: 'തുക കുറയുന്നു: കുറയ്ക്കുന്ന ഭാഗം ആദ്യത്തെ തുകയുടെ ആ ശതമാനമാണ്.' },
  change: { en: 'The new amount is the original plus or minus that piece.', ml: 'പുതിയ തുക ആദ്യത്തെ തുകയോട് ആ ഭാഗം കൂട്ടിയതോ കുറച്ചതോ ആണ്.' },
};

/** Ratio / percent lesson from the numbers in the text; null when they do not give whole answers. */
export function offlineRatio(text: string): RatioPlan | null {
  const unit: RatioPlan['unit'] = /\b(rs\.?|rupees?)\b|₹/i.test(text) ? 'Rs' : /\bkg\b/i.test(text) ? 'kg' : /\bkm\b/i.test(text) ? 'km' : /\bcm\b/i.test(text) ? 'cm' : /\blit(?:re|er)s?\b/i.test(text) ? 'l' : undefined;
  const st = (op: RatioStep['op'], say: Bi) => ({ op, say }) as RatioStep;
  const withUnit = <T extends RatioPlan>(p: T): T => (unit ? { ...p, unit } : p);
  const r = text.match(/(?<![\d:.])(\d{1,3})\s*:\s*(\d{1,3})(?:\s*:\s*(\d{1,3}))?(?![\d:])/);
  if (r) {
    const parts = [Number(r[1]), Number(r[2]), ...(r[3] ? [Number(r[3])] : [])];
    const rest = (text.replace(r[0], ' ').match(/\d+(?:,\d{3})*/g) ?? []).map((x) => Number(x.replace(/,/g, '')));
    const sum = parts.reduce((a, b) => a + b, 0);
    const total = rest.find((n) => n >= sum && n % sum === 0 && n <= 5000);
    if (total) {
      const plan = withUnit({ kind: 'share', parts, total, steps: [st('show', RATIO_SAY.share), st('unit', RATIO_SAY.unit), st('parts', RATIO_SAY.parts), st('check', RATIO_SAY.check)] } as RatioPlan);
      return ratioProblem(plan, 'offline') ? null : plan;
    }
    return null;
  }
  const m = text.match(/(\d+)\s*(?:%|per ?cent)\s*(?:of\s*)?(?:Rs\.?\s*|₹\s*)?(\d+(?:,\d{3})*)?/i);
  if (!m) return null;
  const pct = Number(m[1]);
  const whole = m[2] ? Number(m[2].replace(/,/g, '')) : Number((text.replace(m[0], ' ').match(/\d+/) ?? [])[0]);
  if (!whole) return null;
  const down = /\b(decrease\w*|discount\w*|reduc\w*|fall\w*|drop\w*|lower\w*|loss)\b/i.test(text);
  const up = /\b(increase\w*|rise\w*|raise\w*|grow\w*|profit)\b/i.test(text);
  const plan: RatioPlan = down || up
    ? withUnit({ kind: 'change', whole, pct, dir: down ? 'down' : 'up', steps: [st('show', RATIO_SAY.percent), st('change', down ? RATIO_SAY.down : RATIO_SAY.up), st('result', RATIO_SAY.change)] } as RatioPlan)
    : withUnit({ kind: 'percent', whole, pct, steps: [st('show', RATIO_SAY.percent), st('tenth', RATIO_SAY.tenth), st('part', RATIO_SAY.part), st('result', RATIO_SAY.result)] } as RatioPlan);
  return ratioProblem(plan, 'offline') ? null : plan;
}

const PIE_SAY = {
  show: { en: 'Here is the data we want to show in a pie chart.', ml: 'പൈ ചാർട്ടിൽ കാണിക്കാനുള്ള വിവരങ്ങൾ ഇതാ.' },
  total: { en: 'First add the values to get the total.', ml: 'ആദ്യം മൂല്യങ്ങൾ കൂട്ടി ആകെ കണ്ടെത്തുക.' },
  angle: { en: 'Each sector is its share of the full circle, 360 degrees.', ml: 'ഓരോ സെക്ടറും മുഴുവൻ വൃത്തത്തിന്റെ, 360° യുടെ, അതിന്റെ പങ്കാണ്.' },
  percent: { en: 'The same shares as percentages.', ml: 'അതേ പങ്കുകൾ ശതമാനമായി.' },
  check: { en: 'The angles add up to 360 degrees.', ml: 'കോണുകൾ കൂട്ടിയാൽ 360° കിട്ടും.' },
};
const PIE_STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'is', 'are', 'has', 'have', 'total', 'pie', 'chart', 'diagram', 'graph', 'class', 'students', 'and', 'by', 'for', 'with', 'there', 'were', 'was', 'out', 'draw', 'data', 'table']);

/** Pie chart from "Name value" pairs in the text; null when they do not give whole-degree sectors. */
export function offlinePie(text: string): PiePlan | null {
  const pairs: Array<[string, number]> = [];
  for (const m of text.matchAll(/\b([A-Z][A-Za-z]{0,9})\s*(?:[:=\-–]|is|has|have|got|chose|scored)?\s*(\d+)(?!\d|%|\.\d)/g)) {
    if (!PIE_STOP.has(m[1].toLowerCase())) pairs.push([m[1], Number(m[2])]);
  }
  if (pairs.length < 2 || pairs.length > 6) return null;
  const st = (op: PieStep['op']) => ({ op, say: PIE_SAY[op] }) as PieStep;
  const plan: PiePlan = { labels: pairs.map((p) => p[0]), values: pairs.map((p) => p[1]), steps: [st('show'), st('total'), st('angle'), ...(/percent|%/i.test(text) ? [st('percent')] : []), st('check')] };
  return pieProblem(plan, 'offline') ? null : plan;
}

const CG_SAY = {
  axes: { en: 'Here is a coordinate plane with its two axes.', ml: 'രണ്ട് അക്ഷങ്ങളുള്ള ഒരു കോ-ഓർഡിനേറ്റ് തലം ഇതാ.' },
  plot: { en: 'Go along the x-axis, then up or down for y, and put a point.', ml: 'x-അക്ഷത്തിലൂടെ പോയി, y-ക്കായി മുകളിലേക്കോ താഴേക്കോ പോയി ബിന്ദു അടയാളപ്പെടുത്തുക.' },
  plotBoth: { en: 'Plot the two points.', ml: 'രണ്ട് ബിന്ദുക്കൾ അടയാളപ്പെടുത്തുക.' },
  quadrant: { en: 'The axes divide the plane into four quadrants. Each point lies in one of them, or on an axis.', ml: 'അക്ഷങ്ങൾ തലത്തെ നാല് ചതുർഥാംശങ്ങളായി വിഭജിക്കുന്നു. ഓരോ ബിന്ദുവും ഒന്നിലോ ഒരു അക്ഷത്തിലോ ആണ്.' },
  segment: { en: 'Join the two points with a line segment.', ml: 'രണ്ട് ബിന്ദുക്കളെ ഒരു രേഖാഖണ്ഡം കൊണ്ട് യോജിപ്പിക്കുക.' },
  legs: { en: 'Draw a horizontal and a vertical line to make a right triangle. Its legs are the differences of the coordinates.', ml: 'തിരശ്ചീനവും ലംബവുമായ വരകൾ വരച്ച് ഒരു മട്ടത്രികോണം ഉണ്ടാക്കുക. അതിന്റെ വശങ്ങൾ നിർദ്ദേശാങ്കങ്ങളുടെ വ്യത്യാസങ്ങളാണ്.' },
  formula: { en: 'The distance is the hypotenuse, by Pythagoras: d squared is dx squared plus dy squared.', ml: 'ദൂരം കർണമാണ്, പൈതഗോറസ് പ്രകാരം: d² = dx² + dy².' },
  midpoint: { en: 'The midpoint has the average of the x coordinates and the average of the y coordinates.', ml: 'മധ്യബിന്ദുവിന് x-കളുടെ ശരാശരിയും y-കളുടെ ശരാശരിയും ആണ്.' },
};

/** Points written like A(3, 2) or (−2, 5) in the text; distance, midpoint or plain plotting from the words. */
export function offlineCoord(text: string): CoordPlan | null {
  const pts: Array<[number, number]> = [];
  const letters: string[] = [];
  for (const mm of text.matchAll(/(?:\b([A-Z])\s*)?\(\s*([−-]?\d+)\s*,\s*([−-]?\d+)\s*\)/g)) {
    const p: [number, number] = [Number(mm[2].replace('−', '-')), Number(mm[3].replace('−', '-'))];
    if (pts.some((q) => q[0] === p[0] && q[1] === p[1])) continue;
    pts.push(p);
    letters.push(mm[1] ?? '');
  }
  if (!pts.length) return null;
  const st = (op: CoordStep['op'], say: { en: string; ml: string }, extra: object = {}) => ({ op, say, ...extra }) as CoordStep;
  const named = letters.every((l) => /^[A-Z]$/.test(l)) && new Set(letters).size === letters.length;
  const tryPlan = (p: CoordPlan) => (cgProblem(p, 'offline') ? null : p);
  const isMid = /\bmid-?point\b/i.test(text);
  const isDist = /\bdistance\b/i.test(text);
  if ((isMid || isDist) && pts.length >= 2) {
    const two = pts.slice(0, 2);
    const names = named && letters.slice(0, 2).every((l) => !(isMid && l === 'M')) ? letters.slice(0, 2) : undefined;
    const steps = isMid
      ? [st('axes', CG_SAY.axes), st('plot', CG_SAY.plotBoth), st('segment', CG_SAY.segment), st('midpoint', CG_SAY.midpoint)]
      : [st('axes', CG_SAY.axes), st('plot', CG_SAY.plotBoth), st('segment', CG_SAY.segment), st('legs', CG_SAY.legs), st('formula', CG_SAY.formula)];
    return tryPlan({ kind: isMid ? 'midpoint' : 'distance', points: two, ...(names ? { names } : {}), steps });
  }
  if (pts.length > 4) return null;
  const names = named ? letters : undefined;
  const steps = [st('axes', CG_SAY.axes), ...pts.map((_, i) => st('plot', CG_SAY.plot, { i })), ...(/\bquadrants?\b/i.test(text) ? [st('quadrant', CG_SAY.quadrant)] : [])];
  return tryPlan({ kind: 'points', points: pts, ...(names ? { names } : {}), steps });
}

const SQ_SAY = {
  sumSquare: { en: 'Draw a square whose side is a plus b. Its area is a plus b, squared.', ml: 'a + b വശമുള്ള ഒരു സമചതുരം വരയ്ക്കുക. അതിന്റെ പരപ്പളവ് (a + b)² ആണ്.' },
  tileA: { en: 'In one corner put a square with side a. Its area is a squared.', ml: 'ഒരു മൂലയിൽ a വശമുള്ള ഒരു സമചതുരം വയ്ക്കുക. അതിന്റെ പരപ്പളവ് a² ആണ്.' },
  sumStrips: { en: 'Along it fit two rectangles, a by b. Each has area a times b.', ml: 'അതിനോട് ചേർന്ന് a × b അളവുള്ള രണ്ട് ചതുരങ്ങൾ വയ്ക്കുക. ഓരോന്നിന്റെയും പരപ്പളവ് a × b ആണ്.' },
  tileB: { en: 'What is left is a square with side b. Its area is b squared.', ml: 'ബാക്കിയുള്ളത് b വശമുള്ള സമചതുരം. അതിന്റെ പരപ്പളവ് b² ആണ്.' },
  sumName: { en: 'Here are the four pieces: a squared, ab, ab and b squared.', ml: 'ഇതാ നാല് കഷണങ്ങൾ: a², ab, ab, b².' },
  sumBuild: { en: 'The big square is made of the four pieces, so its area is a squared plus 2ab plus b squared.', ml: 'വലിയ സമചതുരം ഈ നാല് കഷണങ്ങൾ ചേർന്നതാണ്; അതിനാൽ പരപ്പളവ് a² + 2ab + b² ആണ്.' },
  diffSquare: { en: 'Start with a square of side a. Its area is a squared. We want the square of side a minus b inside it.', ml: 'a വശമുള്ള ഒരു സമചതുരത്തിൽ തുടങ്ങാം. അതിന്റെ പരപ്പളവ് a² ആണ്. അതിനകത്തെ (a − b) വശമുള്ള സമചതുരമാണ് വേണ്ടത്.' },
  diffStrips: { en: 'Take away two strips of width b, one along the right and one along the bottom. Each has area a times b.', ml: 'b വീതിയുള്ള രണ്ട് പട്ടകൾ മാറ്റുക, ഒന്ന് വലത്തും ഒന്ന് താഴെയും. ഓരോന്നിന്റെയും പരപ്പളവ് a × b ആണ്.' },
  corner: { en: 'The small corner square, b by b, was taken away twice, so we must put it back once.', ml: 'മൂലയിലെ b × b ചെറിയ സമചതുരം രണ്ടുതവണ മാറ്റപ്പെട്ടു; അതിനാൽ ഒരു തവണ തിരികെ ചേർക്കണം.' },
  diffName: { en: 'Name the pieces: what is left is the square of side a minus b.', ml: 'കഷണങ്ങൾക്ക് പേര് നൽകാം: ബാക്കിയാകുന്നത് (a − b) വശമുള്ള സമചതുരം.' },
  diffBuild: { en: 'So a minus b, squared, is a squared, minus ab, minus ab, plus b squared.', ml: 'അതിനാൽ (a − b)² = a² − ab − ab + b².' },
  prodSquare: { en: 'Take a square of side a. Its area is a squared.', ml: 'a വശമുള്ള ഒരു സമചതുരം എടുക്കുക. അതിന്റെ പരപ്പളവ് a² ആണ്.' },
  remove: { en: 'Cut out a small square of side b from one corner. The area left is a squared minus b squared.', ml: 'ഒരു മൂലയിൽനിന്ന് b വശമുള്ള ചെറിയ സമചതുരം മുറിച്ചുമാറ്റുക. ബാക്കിയുള്ള പരപ്പളവ് a² − b² ആണ്.' },
  cut: { en: 'Cut the L-shape into two rectangles.', ml: 'L ആകൃതിയെ രണ്ട് ചതുരങ്ങളായി മുറിക്കുക.' },
  move: { en: 'Turn the lower piece and slide it beside the upper one. The pieces now make one rectangle.', ml: 'താഴത്തെ കഷണം തിരിച്ച് മുകളിലത്തേതിനടുത്ത് നീക്കിവയ്ക്കുക. ഇപ്പോൾ ഒരു ചതുരമായി.' },
  prodName: { en: 'Its length is a plus b and its width is a minus b.', ml: 'അതിന്റെ നീളം a + b ഉം വീതി a − b ഉം ആണ്.' },
  prodBuild: { en: 'So a squared minus b squared equals a plus b, times a minus b.', ml: 'അതിനാൽ a² − b² = (a + b)(a − b).' },
  check: { en: 'Check with numbers: both ways give the same answer.', ml: 'സംഖ്യകൾ വച്ച് പരിശോധിക്കാം: രണ്ട് വഴിയും ഒരേ ഉത്തരം കിട്ടും.' },
};

/** The three identities, recognised by their written form; sides are the usual example numbers (a = 3, b = 2 or a = 5, b = 2). */
export function offlineSquareIdentity(text: string): SqPlan | null {
  const reSum = /\(\s*[a-z]\s*\+\s*[a-z]\s*\)\s*(?:²|\^\s*2)|square of (?:the |a )?sum/i;
  const reDiff = /\(\s*[a-z]\s*[−–-]\s*[a-z]\s*\)\s*(?:²|\^\s*2)|square of (?:the |a )?difference/i;
  const reProd = /\(\s*[a-z]\s*\+\s*[a-z]\s*\)\s*\(\s*[a-z]\s*[−–-]\s*[a-z]\s*\)|difference of (?:two )?squares/i;
  const hits = ([['product', reProd], ['sum', reSum], ['difference', reDiff]] as const).map(([k, re]) => ({ k, i: text.search(re) })).filter((x) => x.i >= 0).sort((p, q) => p.i - q.i);
  if (!hits.length) return null;
  const st = (op: SqStep['op'], say: { en: string; ml: string }) => ({ op, say }) as SqStep;
  const kind = hits[0].k;
  const tryPlan = (p: SqPlan) => (sqProblem(p, 'offline') ? null : p);
  if (kind === 'sum') return tryPlan({ kind, a: 3, b: 2, steps: [st('square', SQ_SAY.sumSquare), st('tileA', SQ_SAY.tileA), st('strips', SQ_SAY.sumStrips), st('tileB', SQ_SAY.tileB), st('name', SQ_SAY.sumName), st('build', SQ_SAY.sumBuild), st('check', SQ_SAY.check)] });
  if (kind === 'difference') return tryPlan({ kind, a: 5, b: 2, steps: [st('square', SQ_SAY.diffSquare), st('strips', SQ_SAY.diffStrips), st('corner', SQ_SAY.corner), st('name', SQ_SAY.diffName), st('build', SQ_SAY.diffBuild), st('check', SQ_SAY.check)] });
  return tryPlan({ kind, a: 5, b: 2, steps: [st('square', SQ_SAY.prodSquare), st('remove', SQ_SAY.remove), st('cut', SQ_SAY.cut), st('move', SQ_SAY.move), st('name', SQ_SAY.prodName), st('build', SQ_SAY.prodBuild), st('check', SQ_SAY.check)] });
}

/** Captions for the balance scale; the numbers are filled in from the equation. */
function balSay(a: number, b: number, c: number, letter: string) {
  // V51.9.65: short captions in the reel style: one idea, the numbers, no filler.
  const n = c - b;
  const x = n / a;
  const ab = Math.abs(b);
  const takes = b > 0;
  const sg = takes ? '+' : '−';
  const opp = takes ? '−' : '+';
  const ax = a === 1 ? letter : `${a}${letter}`;
  // V51.9.125: the main caption says the PRINCIPLE of the step (why it is allowed); the arithmetic itself is the
  // small note written beside the line on the board.
  const verbEn = takes ? `take away ${ab} from` : `add ${ab} to`;
  const verbMl = takes ? `ഇരുവശത്തുനിന്നും ${ab} കുറയ്ക്കുക` : `ഇരുവശത്തും ${ab} കൂട്ടുക`;
  return {
    show: { en: `An equation is a balance: both sides weigh the same. We want ${letter} alone.`, ml: `സമവാക്യം ഒരു ത്രാസ് പോലെയാണ്: ഇരുവശത്തിനും ഒരേ ഭാരം. ${letter} തനിച്ച് കിട്ടണം.` },
    move: { en: `To keep the balance, ${verbEn} both sides. So ${sg}${ab} crosses over as ${opp}${ab}.`, ml: `ത്രാസ് തുല്യമായി നിർത്താൻ ${verbMl}. അങ്ങനെ ${sg}${ab} മറുവശത്ത് ${opp}${ab} ആകുന്നു.` },
    simplify: { en: `Work out the numbers on the right. The balance does not change: ${ax} = ${n}.`, ml: `വലതുവശത്തെ സംഖ്യകൾ കണക്കാക്കുക. തുല്യത മാറുന്നില്ല: ${ax} = ${n}.` },
    divide: { en: `${a} is multiplying ${letter}. Do the opposite: divide both sides by ${a}.`, ml: `${a}, ${letter}-നെ ഗുണിക്കുന്നു. വിപരീത ക്രിയ ചെയ്യുക: ഇരുവശത്തെയും ${a} കൊണ്ട് ഹരിക്കുക.` },
    answer: { en: `${n} shared equally by ${a} ${letter}'s gives ${x} each. So ${letter} = ${x}.`, ml: `${n}-നെ ${a} ${letter}-കൾക്ക് തുല്യമായി പങ്കിട്ടാൽ ഓരോന്നിനും ${x}. അതിനാൽ ${letter} = ${x}.` },
    check: { en: `Check: put ${letter} = ${x} back. ${a === 1 ? '' : `${a} × `}${x}${b === 0 ? '' : ` ${sg} ${ab}`} = ${c}. Both sides are equal.`, ml: `പരിശോധിക്കാം: ${letter} = ${x} തിരികെ വയ്ക്കുക. ${a === 1 ? '' : `${a} × `}${x}${b === 0 ? '' : ` ${sg} ${ab}`} = ${c}. ഇരുവശവും തുല്യം.` },
  };
}

/** The first equation a x + b = c (or a x = c) in the text, as a balance-scale lesson; null when none has a whole answer 1–100. */
export function offlineBalance(text: string): BalPlan | null {
  const eq = findBalEquations(text)[0];
  if (!eq) return null;
  const { a: a0, b, c, letter } = eq;
  const d = eq.d ?? 0;
  const a = a0 - d;
  const say = balSay(a, b, c, letter);
  const st = (op: Exclude<BalStep['op'], 'cancel'>) => ({ op, say: say[op] }) as BalStep;
  const steps: BalStep[] = [st('show')];
  if (d > 0) {
    say.show = { en: `Here is the scale. The left pan has ${a0} ${letter} tiles${b ? ` and ${Math.abs(b)}` : ''}; the right pan has ${d} ${letter} tile${d > 1 ? 's' : ''} and ${c}. The pans weigh the same.`, ml: `ഇതാ ത്രാസ്. ഇടത് തട്ടിൽ ${a0} ${letter}-ഉം${b ? ` ${Math.abs(b)}-ഉം` : ''}; വലത് തട്ടിൽ ${d} ${letter}-ഉം ${c}-ഉം. രണ്ട് തട്ടിനും ഒരേ ഭാരം.` };
    steps[0] = st('show');
    steps.push({ op: 'cancel', say: { en: `Take ${d} ${letter} off each pan. The same is taken from both sides, so the scale stays level.`, ml: `ഓരോ തട്ടിൽനിന്നും ${d} ${letter} എടുക്കുക. ഇരുവശത്തുനിന്നും ഒരേപോലെ എടുക്കുന്നതിനാൽ ത്രാസ് തുല്യമായി നിൽക്കും.` } });
  }
  if (b !== 0) steps.push(st('move'), st('simplify'));
  if (a >= 2) steps.push(st('divide'), st('answer'));
  steps.push(st('check'));
  return { a: a0, b, c, ...(d ? { d } : {}), ...(letter !== 'x' ? { letter } : {}), steps };
}

/** Captions for the pair on two scales; every number comes from the equations. */
function pairSay(plan: Omit<PairPlan, 'steps'>) {
  const f = pairFacts({ ...plan, steps: [] });
  const t = (e: { a: number; b: number }) => `${e.a > 1 ? `${e.a} ` : ''}${f.lx}${e.b < 0 ? ' with' : ' and'} ${Math.abs(e.b) > 1 ? `${Math.abs(e.b)} ` : ''}${f.ly}${e.b < 0 ? ' taken away' : ''}`;
  const tml = (e: { a: number; b: number }) => `${e.a > 1 ? `${e.a} ` : ''}${f.lx}${e.b < 0 ? '-ഉം' : '-ഉം'} ${Math.abs(e.b) > 1 ? `${Math.abs(e.b)} ` : ''}${f.ly}${e.b < 0 ? ' കുറച്ചതും' : ''}`;
  const c = f.comb;
  const K = f.kLetter;
  const U = f.uLetter;
  const dropL = c.drop === 'x' ? f.lx : f.ly;
  const b = f.back;
  return {
    show: { en: `Each equation is a scale that balances. The first has ${t(f.e1)} against ${f.e1.c}. The second has ${t(f.e2)} against ${f.e2.c}.`, ml: `ഓരോ സമവാക്യവും തുല്യമായി നിൽക്കുന്ന ഓരോ ത്രാസ്. ആദ്യത്തേതിൽ ${tml(f.e1)} ${f.e1.c}-നൊപ്പം. രണ്ടാമത്തേതിൽ ${tml(f.e2)} ${f.e2.c}-നൊപ്പം.` },
    combine: c.kind === 'add'
      ? { en: `Put the two scales together. The ${dropL} and the minus ${dropL} cancel. What is left is ${c.coef > 1 ? c.coef + ' ' : ''}${K} against ${c.rhs}.`, ml: `രണ്ട് ത്രാസുകളും ചേർക്കുക. ${dropL}-ഉം −${dropL}-ഉം ഇല്ലാതാകും. ബാക്കി ${c.coef > 1 ? c.coef + ' ' : ''}${K}, ${c.rhs}-നൊപ്പം.` }
      : { en: `Take the ${c.first === 1 ? 'second' : 'first'} scale off the ${c.first === 1 ? 'first' : 'second'}. The ${dropL} tiles cancel. What is left is ${c.coef > 1 ? c.coef + ' ' : ''}${K} against ${c.rhs}.`, ml: `${c.first === 1 ? 'ആദ്യ' : 'രണ്ടാമത്തെ'} ത്രാസിൽനിന്ന് ${c.first === 1 ? 'രണ്ടാമത്തേത്' : 'ആദ്യത്തേത്'} മാറ്റുക. ${dropL} ടൈലുകൾ ഇല്ലാതാകും. ബാക്കി ${c.coef > 1 ? c.coef + ' ' : ''}${K}, ${c.rhs}-നൊപ്പം.` },
    solve: c.coef > 1
      ? { en: `Share ${c.rhs} between the ${c.coef} ${K} tiles. One ${K} is ${f.kv}.`, ml: `${c.rhs} ${c.coef} ${K}-കൾക്കായി പങ്കിടുക. ഒരു ${K} = ${f.kv}.` }
      : { en: `One ${K} balances ${f.kv}. So ${K} is ${f.kv}.`, ml: `ഒരു ${K}-ന് ${f.kv}-ന്റെ ഭാരം. അതിനാൽ ${K} = ${f.kv}.` },
    back: { en: `Put ${f.kv} for ${K} in the ${b.eq === 1 ? 'first' : 'second'} scale. Take ${b.num} off both pans${b.coefU > 1 ? `, then share ${b.n} between the ${b.coefU} ${U} tiles` : ''}. ${U} is ${f.uv}.`, ml: `${b.eq === 1 ? 'ആദ്യ' : 'രണ്ടാമത്തെ'} ത്രാസിൽ ${K}-ന് പകരം ${f.kv} വയ്ക്കുക. രണ്ട് തട്ടിൽനിന്നും ${b.num} എടുക്കുക${b.coefU > 1 ? `, പിന്നെ ${b.n} ${b.coefU} ${U}-കൾക്കായി പങ്കിടുക` : ''}. ${U} = ${f.uv}.` },
    check: { en: `Check both scales with ${f.x} and ${f.y}. Both balance.`, ml: `${f.x}, ${f.y} എന്നിവ ഉപയോഗിച്ച് രണ്ട് ത്രാസും പരിശോധിക്കാം. രണ്ടും തുല്യം.` },
  };
}

/** The first pair of equations a x ± b y = c in the text that one add or subtract solves with whole answers, as two balance scales; null when there is none. */
export function offlinePair(text: string): PairPlan | null {
  const eq = findPairEquations(text)[0];
  if (!eq) return null;
  const say = pairSay(eq);
  const st = (op: PairStep['op']) => ({ op, say: say[op] }) as PairStep;
  void pairCombineNote;
  return { e1: eq.e1, e2: eq.e2, steps: [st('show'), st('combine'), st('solve'), st('back'), st('check')] };
}

const TS_SAY = {
  show: { en: 'Here is the formula.', ml: 'ഇതാ സൂത്രവാക്യം.' },
  add: { en: 'And here is the next line.', ml: 'ഇതാ അടുത്ത വരി.' },
  box: { en: 'This is the result to remember.', ml: 'ഓർമ്മിക്കേണ്ട ഫലം ഇതാണ്.' },
};

/** The formulas with a root, \frac or matrix written in the text, as typeset lines (one written, the rest added underneath, the last boxed); null when there are none. */
export function offlineTypeset(text: string): TsPlan | null {
  const fs = findTsFormulas(text);
  if (!fs.length) return null;
  const steps: TsStep[] = fs.map((tex, i) => (i === 0 ? { op: 'show', tex, say: TS_SAY.show } : { op: 'add', tex, say: TS_SAY.add }) as TsStep);
  steps.push({ op: 'box', say: TS_SAY.box });
  return { steps };
}

const QD_SAY: Record<QdStep['op'], { en: string; ml: string }> = {
  show: { en: 'Here is x squared, a square of side x, and a strip of area b times x.', ml: 'x² എന്ന x വശമുള്ള സമചതുരവും b·x പരപ്പളവുള്ള ഒരു പട്ടയും.' },
  split: { en: 'Cut the strip in half. Each half is b over 2 wide.', ml: 'പട്ടയെ പകുതിയാക്കി മുറിക്കുക. ഓരോ പകുതിയുടെയും വീതി b/2.' },
  bend: { en: 'Wrap the two halves round two sides of the square.', ml: 'രണ്ട് പകുതികളും സമചതുരത്തിന്റെ രണ്ട് വശങ്ങളിൽ ചേർക്കുക.' },
  corner: { en: 'One corner is missing: a small square of area b over 2, squared. Add it to both sides.', ml: 'ഒരു മൂല ഒഴിഞ്ഞുകിടക്കുന്നു: (b/2)² പരപ്പളവുള്ള ചെറിയ സമചതുരം. ഇരുവശത്തും കൂട്ടുക.' },
  square: { en: 'Now the figure is one big square of side x plus b over 2.', ml: 'ഇപ്പോൾ x + b/2 വശമുള്ള വലിയ സമചതുരം.' },
  root: { en: 'Take the square root of both sides. Remember the plus and the minus.', ml: 'ഇരുവശത്തിന്റെയും വർഗമൂലം എടുക്കുക. + ഉം − ഉം ഓർക്കുക.' },
  answer: { en: 'Move b over 2 across. With the numbers, we get the two roots.', ml: 'b/2 മറുവശത്തേക്ക് മാറ്റുക. സംഖ്യകൾ ഇട്ടാൽ രണ്ട് മൂലങ്ങൾ കിട്ടും.' },
  formula: { en: 'Put everything over 2: that is the quadratic formula, for any a.', ml: 'എല്ലാം 2 കൊണ്ട് ഹരിച്ച് എഴുതിയാൽ ഏത് a-യ്ക്കും ദ്വിമാന സൂത്രവാക്യം കിട്ടും.' },
};

/**
 * The derivation of the quadratic formula. When the text writes a monic equation like x² + 8x + 12 = 0 with two
 * whole roots, that is the example; otherwise x² + 6x + 5 = 0.
 */
export function offlineQuadraticDerivation(text: string): QdPlan {
  let b = 6;
  let c = 5;
  const re = /x\s*(?:\^\s*2|²)\s*([+−-])\s*(\d+)\s*x\s*(?:([+−-])\s*(\d+))?\s*=\s*0/gi;
  for (const mm of text.matchAll(re)) {
    const bb = (mm[1] === '+' ? 1 : -1) * Number(mm[2]);
    const cc = mm[4] ? (mm[3] === '+' ? 1 : -1) * Number(mm[4]) : 0;
    if (bb > 0 && qdR(bb, cc) >= 1 && qdR(bb, cc) <= 12 && bb % 2 === 0 && bb <= 16 && Math.abs(cc) <= 80) { b = bb; c = cc; break; }
  }
  const ops: QdStep['op'][] = ['show', 'split', 'bend', 'corner', 'square', 'root', 'answer', 'formula'];
  return { b, c, steps: ops.map((op) => ({ op, say: QD_SAY[op] }) as QdStep) };
}

const HL_SAY: Record<HlStep['op'], { en: string; ml: string }> = {
  show: { en: 'Here are the two numbers.', ml: 'ഇതാ രണ്ട് സംഖ്യകൾ.' },
  factorise: { en: 'Split each number into prime tiles.', ml: 'ഓരോ സംഖ്യയെയും അഭാജ്യ സംഖ്യകളായി പിരിക്കുക.' },
  common: { en: 'Slide the tiles so the same primes sit above each other. The shared ones are green.', ml: 'ഒരേ അഭാജ്യ സംഖ്യകൾ മുകളിലും താഴെയുമായി വരുംവിധം നീക്കുക. പൊതുവായവ പച്ച.' },
  hcf: { en: 'The HCF is the product of the shared tiles.', ml: 'പൊതു അഭാജ്യങ്ങളുടെ ഗുണനഫലമാണ് ഉസാഘ.' },
  lcm: { en: 'The LCM is the product of every column.', ml: 'എല്ലാ നിരകളുടെയും ഗുണനഫലമാണ് ലസാഗു.' },
  check: { en: 'HCF times LCM equals the two numbers multiplied.', ml: 'ഉസാഘ × ലസാഗു = സംഖ്യകളുടെ ഗുണനഫലം.' },
};

/** The first two different whole numbers from 2 to 120 in the text (smaller first); 12 and 18 when there are none. */
export function offlineHclm(text: string): HlPlan {
  const nums: number[] = [];
  for (const mm of text.matchAll(/\b\d{1,3}\b/g)) {
    const v = Number(mm[0]);
    if (v >= HL_MIN && v <= HL_MAX && !nums.includes(v)) nums.push(v);
    if (nums.length === 2) break;
  }
  const [a, b] = nums.length === 2 ? [Math.min(...nums), Math.max(...nums)] : [12, 18];
  const ops: HlStep['op'][] = ['show', 'factorise', 'common', 'hcf', 'lcm', 'check'];
  return { a, b, steps: ops.map((op) => ({ op, say: HL_SAY[op] }) as HlStep) };
}

const AF_SAY = {
  show: { en: 'Here is the figure with its sizes.', ml: 'ഇതാ അളവുകളുള്ള ചിത്രം.' },
  height: { en: 'The height is the perpendicular distance between the parallel sides.', ml: 'സമാന്തര വശങ്ങൾ തമ്മിലുള്ള ലംബ ദൂരമാണ് ഉയരം.' },
  cut: { en: 'Cut a right triangle off one end.', ml: 'ഒരറ്റത്തുനിന്ന് ഒരു മട്ടത്രികോണം മുറിച്ചെടുക്കുക.' },
  move: { en: 'Slide it to the other end. The parallelogram becomes a rectangle with the same base and height.', ml: 'അതിനെ മറ്റേ അറ്റത്തേക്ക് നീക്കുക. സമാന്തരീകം അതേ അടിവശവും ഉയരവുമുള്ള ചതുരമാകുന്നു.' },
  copy: { en: 'Turn a second copy upside down and join it. Together they make a parallelogram with base a plus b.', ml: 'രണ്ടാമത്തെ പകർപ്പ് തലകീഴായി ചേർത്തുവയ്ക്കുക. രണ്ടും ചേർന്ന് a + b അടിവശമുള്ള സമാന്തരീകമാകുന്നു.' },
  parFormula: { en: 'The area is base times height.', ml: 'പരപ്പളവ് അടിവശം × ഉയരം ആണ്.' },
  trapFormula: { en: 'One trapezium is half of that parallelogram: half of a plus b, times the height.', ml: 'ഒരു ട്രപ്പീസിയം ആ സമാന്തരീകത്തിന്റെ പകുതിയാണ്: a + b-യുടെ പകുതി × ഉയരം.' },
};

/** Parallelogram or trapezium from "base 8 cm, height 5 cm" or "parallel sides 4 cm and 10 cm, height 6 cm". */
export function offlineAreaFig(text: string): AreaFigPlan | null {
  const unit = (text.match(/\d\s*(cm|mm|m)\b/i) ?? [])[1]?.toLowerCase() as AreaFigPlan['unit'] | undefined;
  const hm = /\b(?:height|altitude)\b[^\d]{0,25}(\d+)|(\d+)\s*(?:cm|mm|m)?\s*high\b/i.exec(text);
  const h = hm ? Number(hm[1] ?? hm[2]) : NaN;
  const st = (op: AreaFigStep['op'], say: { en: string; ml: string }) => ({ op, say }) as AreaFigStep;
  const tryPlan = (p: AreaFigPlan) => (afProblem(p, 'offline') ? null : p);
  if (/\btrapezi\w*|\btrapezoid/i.test(text)) {
    const pm = /parallel sides?[^\d]{0,30}(\d+)[^\d]{1,30}(\d+)/i.exec(text);
    if (!pm || Number.isNaN(h)) return null;
    const x = Number(pm[1]);
    const y = Number(pm[2]);
    return tryPlan({ kind: 'trapezium', b: Math.max(x, y), a: Math.min(x, y), h, ...(unit ? { unit } : {}), steps: [st('show', AF_SAY.show), st('height', AF_SAY.height), st('copy', AF_SAY.copy), st('formula', AF_SAY.trapFormula)] });
  }
  if (/\bparallelograms?\b/i.test(text)) {
    const bm = /\bbase\b[^\d]{0,25}(\d+)/i.exec(text);
    if (!bm || Number.isNaN(h)) return null;
    return tryPlan({ kind: 'parallelogram', b: Number(bm[1]), h, ...(unit ? { unit } : {}), steps: [st('show', AF_SAY.show), st('height', AF_SAY.height), st('cut', AF_SAY.cut), st('move', AF_SAY.move), st('formula', AF_SAY.parFormula)] });
  }
  return null;
}

const MO_SAY = {
  mulShow: { en: 'Here are the two matrices A and B that we want to multiply.', ml: 'ഗുണിക്കാനുള്ള A, B എന്നീ രണ്ട് മാട്രിക്സുകൾ ഇതാ.' },
  check: { en: 'The columns of A must equal the rows of B. Then the product has the rows of A and the columns of B.', ml: 'A-യുടെ നിരകളും B-യുടെ വരികളും തുല്യമായിരിക്കണം. അപ്പോൾ ഗുണനഫലത്തിന് A-യുടെ വരികളും B-യുടെ നിരകളും ഉണ്ടാകും.' },
  entry: { en: 'Take a row of A and a column of B, multiply them in pairs and add.', ml: 'A-യിലെ ഒരു വരിയും B-യിലെ ഒരു നിരയും എടുത്ത് ജോടികളായി ഗുണിച്ച് കൂട്ടുക.' },
  all: { en: 'Do the same for every row and column to fill the product.', ml: 'ഓരോ വരിക്കും നിരയ്ക്കും ഇതേ രീതി ചെയ്ത് ഗുണനഫലം പൂർത്തിയാക്കുക.' },
  trShow: { en: 'Here is the matrix A.', ml: 'ഇതാ A എന്ന മാട്രിക്സ്.' },
  rows: { en: 'Each row of A becomes a column of the transpose.', ml: 'A-യുടെ ഓരോ വരിയും ട്രാൻസ്പോസിലെ ഒരു നിരയാകുന്നു.' },
  size: { en: 'If A has r rows and c columns, its transpose has c rows and r columns.', ml: 'A-ക്ക് r വരിയും c നിരയുമുണ്ടെങ്കിൽ ട്രാൻസ്പോസിന് c വരിയും r നിരയും ഉണ്ടായിരിക്കും.' },
};

/** Matrices written [[1,2],[3,4]] or [1 2; 3 4] in the text. */
export function parseMatrices(text: string): number[][][] {
  const out: number[][][] = [];
  const nums = (s: string) => (s.replace(/−/g, '-').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  for (const mm of text.matchAll(/\[\s*(?:\[[^\[\]]*\]\s*,?\s*)+\]|\[[-−\d\s,]*;[-−\d\s,;]+\]/g)) {
    const s = mm[0];
    const rows = s.startsWith('[[') || /^\[\s*\[/.test(s) ? [...s.matchAll(/\[([^\[\]]*)\]/g)].map((r) => nums(r[1])) : s.slice(1, -1).split(';').map(nums);
    if (rows.length && rows.every((r) => r.length === rows[0].length && r.length > 0)) out.push(rows);
  }
  return out;
}

/** Product or transpose of the matrices written in the text; null when they do not fit. */
export function offlineMatrixOps(text: string): MatrixOpsPlan | null {
  const ms = parseMatrices(text);
  const st = (op: MatrixOpsStep['op'], say: { en: string; ml: string }, extra: object = {}) => ({ op, say, ...extra }) as MatrixOpsStep;
  const tryPlan = (p: MatrixOpsPlan) => (moProblem(p, 'offline') ? null : p);
  if (/\btranspos\w*/i.test(text) && ms.length >= 1) {
    return tryPlan({ kind: 'transpose', a: ms[0], steps: [st('show', MO_SAY.trShow), st('rows', MO_SAY.rows), st('size', MO_SAY.size)] });
  }
  if (ms.length >= 2 && /\b(multipl\w*|product)\b|×/i.test(text)) {
    const p = ms[1][0].length;
    const m = ms[0].length;
    const steps = [st('show', MO_SAY.mulShow), st('check', MO_SAY.check), st('entry', MO_SAY.entry, { i: 0, j: 0 }), ...(m * p > 1 ? [st('all', MO_SAY.all)] : [])];
    return tryPlan({ kind: 'multiply', a: ms[0], b: ms[1], steps });
  }
  return null;
}

const FL_SAY = {
  markShow: { en: 'Here is the number line, with the whole numbers marked.', ml: 'ഇതാ സംഖ്യാരേഖ, പൂർണ്ണസംഖ്യകൾ അടയാളപ്പെടുത്തിയിരിക്കുന്നു.' },
  divide: { en: 'Cut each whole into equal parts. One part is one over the number of parts.', ml: 'ഓരോ പൂർണ്ണസംഖ്യയെയും തുല്യ ഭാഗങ്ങളാക്കുക. ഒരു ഭാഗം എന്നത് ഭാഗങ്ങളുടെ എണ്ണത്തിൽ ഒന്നാണ്.' },
  mark: { en: 'Count the parts from zero and put a dot.', ml: 'പൂജ്യത്തിൽ നിന്ന് ഭാഗങ്ങൾ എണ്ണി ഒരു ബിന്ദു ഇടുക.' },
  mixed: { en: 'A fraction bigger than one is also a mixed number: whole numbers and a fraction.', ml: 'ഒന്നിൽ കൂടുതലുള്ള ഭിന്നസംഖ്യയെ മിശ്രസംഖ്യയായും എഴുതാം: പൂർണ്ണസംഖ്യയും ഭിന്നസംഖ്യയും.' },
  eqShow: { en: 'Mark the fraction on the number line.', ml: 'ഭിന്നസംഖ്യ സംഖ്യാരേഖയിൽ അടയാളപ്പെടുത്തുക.' },
  scale: { en: 'Cut every part into more equal parts. The dot stays at the same place, so the fraction has another name.', ml: 'ഓരോ ഭാഗത്തെയും കൂടുതൽ തുല്യ ഭാഗങ്ങളാക്കുക. ബിന്ദു അതേ സ്ഥാനത്ത് തന്നെ, അതിനാൽ ഭിന്നസംഖ്യയ്ക്ക് മറ്റൊരു പേര്.' },
  eqResult: { en: 'Multiply the top and bottom by the same number to get an equivalent fraction.', ml: 'അംശവും ഛേദവും ഒരേ സംഖ്യ കൊണ്ട് ഗുണിച്ചാൽ സമാന ഭിന്നസംഖ്യ കിട്ടും.' },
  cmpShow: { en: 'Mark both fractions on the number line.', ml: 'രണ്ട് ഭിന്നസംഖ്യകളും സംഖ്യാരേഖയിൽ അടയാളപ്പെടുത്തുക.' },
  common: { en: 'Write both fractions with the same denominator.', ml: 'രണ്ട് ഭിന്നസംഖ്യകളും ഒരേ ഛേദത്തിൽ എഴുതുക.' },
  cmpResult: { en: 'The fraction farther from zero is the greater one.', ml: 'പൂജ്യത്തിൽ നിന്ന് കൂടുതൽ അകലെയുള്ള ഭിന്നസംഖ്യയാണ് വലുത്.' },
  addShow: { en: 'Start at the first fraction on the number line.', ml: 'സംഖ്യാരേഖയിൽ ആദ്യത്തെ ഭിന്നസംഖ്യയിൽ തുടങ്ങുക.' },
  jump: { en: 'Jump the length of the second fraction.', ml: 'രണ്ടാമത്തെ ഭിന്നസംഖ്യയുടെ നീളം ചാടുക.' },
  addResult: { en: 'Where we land is the answer.', ml: 'എത്തിച്ചേരുന്ന സ്ഥാനമാണ് ഉത്തരം.' },
};

/** Number-line fractions from the text: fractions written a/b, "equivalent", "compare/greater", "add/subtract". */
export function offlineFracLine(text: string): FracLinePlan | null {
  const fr: Array<[number, number]> = [];
  for (const m of text.matchAll(/\{(\d+)\/(\d+)\}|(?<![\d/.])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/g)) {
    const n = Number(m[1] ?? m[3]);
    const d = Number(m[2] ?? m[4]);
    if (!fr.some((f) => f[0] === n && f[1] === d)) fr.push([n, d]);
  }
  const st = (op: FracLineStep['op'], say: { en: string; ml: string }) => ({ op, say }) as FracLineStep;
  const tryPlan = (p: FracLinePlan) => (flProblem(p, 'offline') ? null : p);
  if (fr.length < 1) return null;
  if (/\bequivalent\b/i.test(text)) {
    const [n, d] = fr[0];
    const k = (text.match(/\b(?:by|times|multipl\w*)\s+(\d)\b/i) ?? [])[1];
    return tryPlan({ kind: 'equivalent', frac: [n, d], k: k ? Number(k) : 2, steps: [st('show', FL_SAY.eqShow), st('scale', FL_SAY.scale), st('result', FL_SAY.eqResult)] });
  }
  if (fr.length >= 2 && /\b(?:add|plus|sum|total|subtract|minus|take away|difference)\b|[+−]/i.test(text)) {
    const sub = /\b(?:subtract|minus|take away|difference)\b|−/i.test(text) && !/\b(?:add|plus|sum)\b|\+/i.test(text);
    const fracs = fr.slice(0, 2) as Array<[number, number]>;
    if (sub && fracs[0][0] * fracs[1][1] < fracs[1][0] * fracs[0][1]) fracs.reverse();
    const steps = [st('show', FL_SAY.addShow), st('jump', FL_SAY.jump), ...(fracs[0][1] !== fracs[1][1] ? [st('common', FL_SAY.common)] : []), st('result', FL_SAY.addResult)];
    return tryPlan({ kind: 'add', fracs, op: sub ? 'sub' : 'add', steps });
  }
  if (fr.length >= 2 && /\b(?:compare|greater|bigger|larger|smaller|less|more|order)\b|[<>]/i.test(text)) {
    const fracs = fr.slice(0, 2) as Array<[number, number]>;
    const steps = [st('show', FL_SAY.cmpShow), ...(fracs[0][1] !== fracs[1][1] ? [st('common', FL_SAY.common)] : []), st('result', FL_SAY.cmpResult)];
    return tryPlan({ kind: 'compare', fracs, steps });
  }
  const fracs = fr.slice(0, 4);
  const improper = fracs.some((f) => f[0] > f[1]);
  return tryPlan({ kind: 'mark', fracs, steps: [st('show', FL_SAY.markShow), st('divide', FL_SAY.divide), st('mark', FL_SAY.mark), ...(improper ? [st('mixed', FL_SAY.mixed)] : [])] });
}

export function offlinePlan(block: BookBlock, chapterTitle: string, sectionTitle: string, selection?: DnaSelection): BlockPlan {
  const sel = selection ?? selectDna(block, chapterTitle);
  const f = blockFeatures(block, chapterTitle);
  let dna: DnaId = sel.needsAi ? offlineFallbackDna(f) : sel.dna;
  if (dna.startsWith('learned:')) dna = offlineFallbackDna(f);
  const warnings: string[] = [];
  if (sel.needsAi) warnings.push(`AI planner needed: ${sel.reason}. Using ${dna} until it runs.`);
  const read = { en: block.kind === 'math' ? block.lines.map((l) => (l.label ? `${l.label}: ${l.text}` : l.text)).join('\n') : block.text };
  let teach: unknown = null;

  const mathLines = block.lines.filter((l) => l.math || block.kind === 'math').map((l) => l.text);
  switch (dna) {
    case 'bridge':
      break;
    case 'section-intro':
      teach = { heading: { en: block.text }, points: [] } satisfies BoardPlan;
      break;
    case 'equation-chain':
    case 'equation-pair':
    case 'identity-formula': {
      const eqs =
        mathLines.length > 0
          ? mathLines
          : (block.text.match(/[0-9a-z(][^,;:?]*?=[^,;:?]*?(?=[,;:?]|\s+(?:and|so|then|this)\b|$)/gi) ?? []).map((s) => s.trim());
      if (!eqs.length) {
        dna = 'concept-board';
        break;
      }
      if (dna === 'equation-pair' && eqs.length === 2) {
        const sol = planTemplateSolution(`${eqs[0]} and ${eqs[1]}`);
        const rows = sol?.rows.filter((r) => r.kind === 'original') ?? [];
        teach = {
          lines: eqs.map((e, i) => ({
            tokens: [...tokenize(e), `(${i + 1})`],
            caption: { en: rows[i]?.captionEn ?? `Equation (${i + 1}): ${e}`, ml: rows[i]?.captionMl ?? `സമവാക്യം (${i + 1}): ${e}` },
            fresh: i > 0,
            check: false,
          })),
        } satisfies ChainPlan;
      } else teach = captionChain(eqs);
      break;
    }
    case 'function-graph': {
      const g = offlineGraph(block.text);
      if (g) teach = g;
      else {
        warnings.push('AI planner needed to build the graph (no "y = …" formula in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'plane-transform':
      warnings.push('AI planner needed to build the plane and matrix transformation.');
      dna = 'concept-board';
      break;
    case 'fraction-bars': {
      const fr = offlineFractions(block.text);
      if (fr) teach = fr;
      else {
        warnings.push('AI planner needed to build the fraction bars (no fraction like 3/4 in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'matrix-grid':
      teach = offlineMatrix(block.text);
      break;
    case 'venn-sets':
      teach = offlineVenn(block.text);
      break;
    case 'unit-circle':
      teach = offlineTrig(block.text);
      break;
    case 'quadratic-equation': {
      const qp = offlineQuad(block.text);
      if (qp) teach = qp;
      else {
        warnings.push('AI planner needed to build the quadratic (no equation like x² − 5x + 6 = 0 with small whole-number coefficients was found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'coordinate-geometry': {
      const cp = offlineCoord(block.text);
      if (cp) teach = cp;
      else {
        warnings.push('AI planner needed to build the coordinate plane (no points written like A(3, 2) with coordinates from −6 to 6, and for distance or midpoint no two such points differing in x and y, was found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'typeset-chain': {
      const tp = offlineTypeset(block.text);
      if (tp) teach = tp;
      else {
        warnings.push('AI planner needed to typeset the formula (no formula with a square root, \\frac or matrix and an "=" was found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'hcf-lcm':
      teach = offlineHclm(block.text);
      break;
    case 'quadratic-derivation':
      teach = offlineQuadraticDerivation(block.text);
      break;
    case 'balance-pair': {
      const pp = offlinePair(block.text);
      if (pp) teach = pp;
      else {
        warnings.push('AI planner needed to build the two scales (no pair like x + y = 100 and x − y = 10 that one add or subtract solves with whole answers was found in the text).');
        dna = 'equation-pair';
      }
      break;
    }
    case 'balance-scale': {
      const bp = offlineBalance(block.text);
      if (bp) teach = bp;
      else {
        warnings.push('AI planner needed to build the balance scale (no equation like 2x + 5 = 25 with a whole answer from 1 to 100 was found in the text).');
        dna = 'equation-chain';
      }
      break;
    }
    case 'square-identity': {
      const qp = offlineSquareIdentity(block.text);
      if (qp) teach = qp;
      else {
        warnings.push('AI planner needed to build the square picture (no (a + b)², (a − b)² or (a + b)(a − b) was found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'area-figure': {
      const ap = offlineAreaFig(block.text);
      if (ap) teach = ap;
      else {
        warnings.push('AI planner needed to build the figure (no "base 8 cm, height 5 cm" for a parallelogram, or "parallel sides 4 cm and 10 cm, height 6 cm" for a trapezium, with whole numbers 2 to 20 and a whole area, was found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'matrix-ops': {
      const mp = offlineMatrixOps(block.text);
      if (mp) teach = mp;
      else {
        warnings.push('AI planner needed to build the matrix picture (no two matrices written like [[1,2],[3,4]] that can be multiplied, or no matrix to transpose, with small whole numbers was found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'fraction-line': {
      const fp = offlineFracLine(block.text);
      if (fp) teach = fp;
      else {
        warnings.push('AI planner needed to build the number line (no fractions such as 3/4 that fit one line and are in lowest terms were found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'pie-chart': {
      const pp = offlinePie(block.text);
      if (pp) teach = pp;
      else {
        warnings.push('AI planner needed to build the pie chart (no list of two to six "Name value" pairs whose angles are whole degrees was found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'ratio-percent': {
      const rp = offlineRatio(block.text);
      if (rp) teach = rp;
      else {
        warnings.push('AI planner needed to build the bar model (no ratio like 3 : 5 with a total that divides evenly, and no whole-number percentage of a whole number, was found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'solid-figure': {
      const sp = offlineSolid(block.text);
      if (sp) teach = sp;
      else {
        warnings.push('AI planner needed to build the solid (no cuboid, prism, cylinder, cone or sphere with whole-number sizes that can be drawn was found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'angle-geometry': {
      const ap = offlineAngle(block.text);
      if (ap) teach = ap;
      else {
        warnings.push('AI planner needed to build the angle figure (no whole-degree angles that fit parallel lines, a triangle or a circle were found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'polynomial': {
      const pp = offlinePoly(block.text);
      if (pp) teach = pp;
      else {
        warnings.push('AI planner needed to build the polynomial (no polynomial of degree 2 to 4 with small whole-number coefficients, like x³ − 4x² + x + 6, was found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'arithmetic-sequence': {
      const sp = offlineSeq(block.text);
      if (sp) teach = sp;
      else {
        warnings.push('AI planner needed to build the sequence (no list of numbers with a common difference, or first term and common difference, in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'linear-system': {
      const lp = offlineLinear(block.text);
      if (lp) teach = lp;
      else {
        warnings.push('AI planner needed to build the pair of equations (two equations like 2x + y = 7 with a whole-number solution were not found in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'shape-formula': {
      const sp = offlineShape(block.text);
      if (sp) teach = sp;
      else {
        warnings.push('AI planner needed to build the figure (no shape named in the text).');
        dna = 'concept-board';
      }
      break;
    }
    case 'histogram':
      warnings.push('AI planner needed to build the bar chart (the data are not in a form the offline planner reads).');
      dna = 'concept-board';
      break;
    case 'probability-tree':
      warnings.push('AI planner needed to build the probability tree.');
      dna = 'concept-board';
      break;
    case 'translate-table':
      teach = { rows: block.lines.filter((l) => l.label).map((l) => ({ words: { en: l.label! }, tokens: tokenize(l.text), say: { en: `${l.label}: ${l.text}` } })) } satisfies TranslatePlan;
      break;
    case 'number-table': {
      const rows = block.lines.map((l) => l.text.trim().split(/\s+/));
      const headers = rows.find((r) => r.every((c) => /^[A-Za-z]+$/.test(c))) ?? [];
      const nums = rows.filter((r) => r.every((c) => /^\d+$/.test(c))).map((r) => r.map(Number));
      teach = { headers: headers.map((h) => ({ en: h })), rows: nums, ops: nums.map((_, i) => ({ op: 'focus' as const, row: i, say: { en: rows[i + 1]?.join(', ') ?? '' } })) } satisfies TablePlan;
      break;
    }
    case 'key-result':
      teach = { statement: { en: block.text }, say: { en: block.text } } satisfies KeyResultPlan;
      break;
    case 'word-problem': {
      const wp = offlineWordProblem(block.text);
      if (wp) teach = wp;
      else {
        warnings.push('AI planner needed to name the unknowns and write the equations.');
        teach = {
          statement: { en: block.text },
          highlights: numberPhrases(block.text),
          unknowns: [],
          equations: [],
          solution: {},
          answer: { en: block.text.split(/(?<=\.)\s/).pop() ?? '' },
        } satisfies WordProblemPlan;
      }
      break;
    }
    default:
      dna = 'concept-board';
  }
  if (dna === 'concept-board') {
    teach = offlineConceptBoard(block.text, sectionTitle) satisfies BoardPlan;
  }
  const plan: BlockPlan = { blockId: block.id, dna, read, teach, source: 'offline', warnings: warnings.length ? warnings : undefined };
  const textOnly = textOnlyWarning(plan);
  if (textOnly) plan.warnings = [...(plan.warnings ?? []), textOnly];
  return plan;
}

/** Word problems the offline planner knows (the textbook's own): unknowns, equations, the verified solver and the answer, in English and Malayalam. */
export function offlineWordProblem(text: string): WordProblemPlan | null {
  const shortcut = candidateSystem(text);
  const chain = shortcut ? solverChain(shortcut) : null;
  if (!shortcut || !chain) return null;
  const vars = chain.solutions?.[0];
  if (!vars) return null;
  const eqs = shortcut.split(' and ').map((e) => tokenize(e));
  const n = (k: string) => String(vars[k]);
  const table = /price of (?:a\s+)?table and (?:a\s+)?chair/i.test(text);
  const beads = /beads/i.test(text);
  if (table) {
    const [a, b] = [shortcut.match(/= (\d+) and/)?.[1] ?? '', shortcut.match(/and .*= (\d+)$/)?.[1] ?? ''];
    return {
      statement: { en: text },
      unknowns: [
        { symbol: 'x', meaning: { en: 'price of a chair (in rupees)', ml: 'ഒരു കസേരയുടെ വില (രൂപയിൽ)' } },
        { symbol: 'y', meaning: { en: 'price of the table (in rupees)', ml: 'മേശയുടെ വില (രൂപയിൽ)' } },
      ],
      equations: [
        { phrase: { en: `The table and a chair cost ${a} rupees: x + y = ${a}.`, ml: `മേശയും ഒരു കസേരയും കൂടി ${a} രൂപ: x + y = ${a}.` }, tokens: eqs[0] },
        { phrase: { en: `The table and four chairs cost ${b} rupees: four chairs are 4x, so 4x + y = ${b}.`, ml: `മേശയും നാല് കസേരയും കൂടി ${b} രൂപ: നാല് കസേര 4x, അതിനാൽ 4x + y = ${b}.` }, tokens: eqs[1] },
      ],
      solution: { solver: shortcut },
      solutions: [vars],
      answer: { en: `A chair costs ${n('x')} rupees and the table costs ${n('y')} rupees.`, ml: `ഒരു കസേരയുടെ വില ${n('x')} രൂപ, മേശയുടെ വില ${n('y')} രൂപ.` },
    };
  }
  if (beads) {
    return {
      statement: { en: text },
      unknowns: [
        { symbol: 'b', meaning: { en: 'number of black beads', ml: 'കറുത്ത മുത്തുകളുടെ എണ്ണം' } },
        { symbol: 'w', meaning: { en: 'number of white beads', ml: 'വെളുത്ത മുത്തുകളുടെ എണ്ണം' } },
      ],
      equations: [
        { phrase: { en: 'Black and white together make up the box.', ml: 'കറുപ്പും വെളുപ്പും ചേർന്നാണ് പെട്ടിയിലെ മുത്തുകൾ.' }, tokens: eqs[0] },
        { phrase: { en: 'There are 10 more black than white.', ml: 'വെളുത്തതിനേക്കാൾ 10 കറുത്തത് കൂടുതലാണ്.' }, tokens: eqs[1] },
      ],
      solution: { solver: shortcut },
      solutions: [vars],
      answer: { en: `There are ${n('b')} black and ${n('w')} white beads.`, ml: `${n('b')} കറുത്തതും ${n('w')} വെളുത്തതും മുത്തുകളുണ്ട്.` },
    };
  }
  return {
    statement: { en: text },
    unknowns: [
      { symbol: 'x', meaning: { en: 'first number', ml: 'ആദ്യത്തെ സംഖ്യ' } },
      { symbol: 'y', meaning: { en: 'second number', ml: 'രണ്ടാമത്തെ സംഖ്യ' } },
    ],
    equations: [
      { phrase: { en: 'Their sum is given.', ml: 'അവയുടെ തുക തന്നിട്ടുണ്ട്.' }, tokens: eqs[0] },
      { phrase: { en: 'Their difference is given.', ml: 'അവയുടെ വ്യത്യാസം തന്നിട്ടുണ്ട്.' }, tokens: eqs[1] },
    ],
    solution: { solver: shortcut },
    solutions: [vars],
    answer: { en: `The numbers are ${n('x')} and ${n('y')}.`, ml: `സംഖ്യകൾ ${n('x')}, ${n('y')} ആണ്.` },
  };
}

/** Word-problem patterns the existing AI Guru solver recognises (kept in sync with template-selector). */
export function candidateSystem(source: string): string | null {
  const beadsTotal = /there are\s+(\d+)\s+beads.*?(?:black and white|black,?\s*white)/i.exec(source);
  const beadsMore = /(\d+)\s+more\s+black\s+(?:than|then)\s+white/i.exec(source);
  if (beadsTotal && beadsMore) return `b + w = ${beadsTotal[1]} and b = w + ${beadsMore[1]}`;
  const table1 = /price of (?:a\s+)?table and (?:a\s+)?chair is\s+(\d+(?:\.\d+)?)/i.exec(source);
  const table2 = /price of (?:a\s+)?(?:the\s+)?table and (?:four|4)\s+chairs?\s+is\s+(\d+(?:\.\d+)?)/i.exec(source);
  // As the textbook does: x is the price of a chair and y the price of the table.
  if (table1 && table2) return `x + y = ${table1[1]} and 4x + y = ${table2[1]}`;
  const sumDiff = /sum of two numbers is\s+(\d+)\s+and their difference is\s+(\d+)/i.exec(source);
  if (sumDiff) return `x + y = ${sumDiff[1]} and x - y = ${sumDiff[2]}`;
  return null;
}
