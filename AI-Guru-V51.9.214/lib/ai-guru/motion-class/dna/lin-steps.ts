/**
 * V51.9.136 — the pair of linear equations, worked SLOWLY: every small move of elimination, substitution and the check
 * is its own step, with two captions:
 *
 *   - the SIDE note, written on the board right of the line: only WHAT to do ("(1) × 3", "÷ 7 both sides");
 *   - the MAIN caption (spoken, at the bottom): WHY this move is allowed and HOW the numbers come out.
 *
 * V51.9.137 — and every line is MADE from the line before it, as a teacher would show it: the digits a step works on
 * get a ring and turn orange, then fly (on an arc) to where they land in the new line and become the new value
 * (3 × 2x flies together into 6x; 12 and 2 fly together into 14; +6 jumps across the "=" and turns into −6). What does
 * not change glides down quietly in its own colour. A line is a list of tokens, and each step says which tokens of
 * which earlier line make which token of the new line (`flows`).
 *
 * Pure: every line, number, motion and sentence comes from the six numbers of the plan (lin-math.ts), so the board is
 * true whatever the planner says, and English and Malayalam classes write identical maths.
 */
import type { Bi } from './types';
import { eliminate, eqText, fmt, scaleEq, type Eq, type LinPlanNumbers, type Var } from './lin-math';

/** Where a token comes from: a line already on the board (or the given equations at the top), by token index or by role. */
export type RowRef = 'prev' | 'e1' | 'e2' | 'sum' | 'h1' | 'h2' | 'self';
export interface Ref {
  /** prev = the line just above; e1 / e2 = the latest line of that equation; sum = the added line; h1 / h2 = the given equations; self = this line. */
  row: RowRef;
  /** Token indices in that line. */
  idx?: number[];
  /** Or the term of x, of y, or the number on the right (c) — used for the given equations. */
  role?: 'x' | 'y' | 'c';
}
/** Tokens `from` fly to token `to` of the new line. A glide is a quiet move (no ring, own colour); otherwise ring + orange. */
export interface Flow {
  from: Ref;
  to: number;
  glide?: boolean;
}

/** What a step writes on the board. */
export interface LinRow {
  /** Small tag in the left column: "(1) × 3", "(2)". */
  tag?: string;
  /** The line, token by token (written with a space between them). */
  tokens: string[];
  /** The whole line (the tokens joined): for tests and the step notes. */
  text: string;
  /** e1 / e2 = the colour of that equation; result = the answer colour. */
  color: 'e1' | 'e2' | 'ink' | 'result';
  big?: boolean;
  /** A tick after the line (the check). */
  tick?: boolean;
  /** This line is the latest form of equation (1) / (2), or the added line. */
  label?: 'e1' | 'e2' | 'sum';
  /** How the line is made from earlier lines. */
  flows?: Flow[];
  /** New tokens that appear orange (a new multiplier, a sign that turned round) and then take the line's colour. */
  hot?: number[];
  /** Tokens that will cancel (struck out by the next step). */
  cancel?: number[];
}

export interface LinSub {
  key: string;
  /** Main caption: why and how (spoken). */
  why: Bi;
  /** Side caption: what to do (short). */
  note: Bi;
  /** A new line on the board. */
  write?: LinRow;
  /** A rule under the last lines, with + or − in the tag column, before `write`. */
  rule?: '+' | '−';
  /** Strike the `cancel` tokens of the added line, then write. */
  strike?: boolean;
  /** Ring these (orange) at the start of the step, before anything is written. */
  ring?: Ref[];
}

/* ---------------- formatting ---------------- */

/** "3x", "−x", "x". */
export const term = (c: number, v: string) => `${c === 1 ? '' : c === -1 ? '−' : fmt(c)}${v}`;
/** A number in brackets when negative: "(−3)". */
export const br = (n: number) => (n < 0 ? `(${fmt(n)})` : fmt(n));
/** A term in brackets when negative: "(−2y)". */
const brTerm = (c: number, v: string) => (c < 0 ? `(${term(c, v)})` : term(c, v));
/** " + 3y", " − 3y" (a following term with its sign). */
const signed = (c: number, v: string) => ` ${c < 0 ? '−' : '+'} ${Math.abs(c) === 1 && v ? '' : Math.abs(c)}${v}`;
const sgn = (c: number) => (c < 0 ? '−' : '+');
const coef = (e: Eq, v: Var) => (v === 'x' ? e.a : e.b);
const eqName = (k: 1 | 2): Bi => ({ en: `equation (${k})`, ml: `സമവാക്യം (${k})` });
const row = (r: Omit<LinRow, 'text'>): LinRow => ({ ...r, text: r.tokens.join(' ') });

/** "6x + 9y = 24" as tokens: [x-term, sign, y-term, "=", c] (always five). */
export const eqTokens5 = (e: Eq): string[] => [term(e.a, 'x'), sgn(e.b), term(Math.abs(e.b), 'y'), '=', fmt(e.c)];

/** "3 × 2x + 3 × 3y = 3 × 8" as tokens. Indices: x 0–2, sign 3, y 4–6, "=" 7, c 8–10. */
export function mulTokens(e: Eq, m: number): string[] {
  return [`${e.a < 0 ? '−' : ''}${m}`, '×', term(Math.abs(e.a), 'x'), sgn(e.b), String(m), '×', term(Math.abs(e.b), 'y'), '=', String(m), '×', br(e.c)];
}
export const mulText = (e: Eq, m: number) => mulTokens(e, m).join(' ');

/** The given equation's three terms (x, y, c) come down into a five-token line. */
const fromHead = (h: 'h1' | 'h2', glide = false): Flow[] => [
  { from: { row: h, role: 'x' }, to: 0, glide },
  { from: { row: h, role: 'y' }, to: 2, glide },
  { from: { row: h, role: 'c' }, to: 4, glide },
];

/* ---------------- dividing at the end (shared) ---------------- */

/** The line above is three tokens: [term, "=", number]. */
function divideAndAnswer(left: Var, r: number, d: number, value: number): LinSub[] {
  const out: LinSub[] = [];
  if (r !== 1) {
    out.push({
      key: 'divide',
      ring: [{ row: 'prev', idx: [0] }],
      why: r === -1
        ? { en: `−${left} means −1 times ${left}. To get ${left} alone, divide both sides by −1. Doing the same to both sides keeps them equal.`, ml: `−${left} എന്നാൽ −1 × ${left}. ${left} മാത്രം കിട്ടാൻ ഇരുവശത്തെയും −1 കൊണ്ട് ഹരിക്കുക. ഇരുവശത്തും ഒരേ കാര്യം ചെയ്താൽ അവ തുല്യമായി തുടരും.` }
        : { en: `${term(r, left)} means ${fmt(r)} times ${left}. To get ${left} alone, do the opposite of multiplying by ${fmt(r)}: divide both sides by ${fmt(r)}. Dividing both sides by the same number keeps them equal.`, ml: `${term(r, left)} എന്നാൽ ${fmt(r)} × ${left}. ${left} മാത്രം കിട്ടാൻ ${fmt(r)} കൊണ്ടുള്ള ഗുണനത്തിന്റെ വിപരീതം ചെയ്യുക: ഇരുവശത്തെയും ${fmt(r)} കൊണ്ട് ഹരിക്കുക. ഇരുവശത്തെയും ഒരേ സംഖ്യ കൊണ്ട് ഹരിച്ചാൽ അവ തുല്യമായി തുടരും.` },
      note: { en: `÷ ${br(r)} both sides`, ml: `ഇരുവശത്തും ÷ ${br(r)}` },
      // the number in front of the unknown leaves it and flies across the "=" to divide the other side
      write: row({
        tokens: [left, '=', fmt(d), '÷', br(r)],
        color: 'ink',
        hot: [3],
        flows: [
          { from: { row: 'prev', idx: [1] }, to: 1, glide: true },
          { from: { row: 'prev', idx: [2] }, to: 2, glide: true },
          { from: { row: 'prev', idx: [0] }, to: 0, glide: true },
          { from: { row: 'prev', idx: [0] }, to: 4 },
        ],
      }),
    });
  }
  out.push({
    key: 'answer',
    why: r !== 1
      ? { en: `${fmt(d)} divided by ${br(r)} is ${fmt(value)}. So ${left} = ${fmt(value)}.`, ml: `${fmt(d)} ÷ ${br(r)} = ${fmt(value)}. അതിനാൽ ${left} = ${fmt(value)}.` }
      : { en: `So ${left} = ${fmt(value)}. We have found ${left}.`, ml: `അതിനാൽ ${left} = ${fmt(value)}. ${left} കണ്ടെത്തി.` },
    note: r !== 1 ? { en: `${fmt(d)} ÷ ${br(r)} = ${fmt(value)}`, ml: `${fmt(d)} ÷ ${br(r)} = ${fmt(value)}` } : { en: `${left} found`, ml: `${left} കിട്ടി` },
    write: row({
      tokens: [left, '=', fmt(value)],
      color: 'result',
      big: true,
      flows: [
        { from: { row: 'prev', idx: [0] }, to: 0, glide: true },
        { from: { row: 'prev', idx: [1] }, to: 1, glide: true },
        { from: { row: 'prev', idx: [2, 3, 4] }, to: 2 },
      ],
    }),
  });
  return out;
}

/* ---------------- elimination ---------------- */

export function eliminationSteps(s: LinPlanNumbers, v: Var): LinSub[] {
  const el = eliminate(s, v);
  const left = el.left;
  const p1 = coef(s.e1, v), p2 = coef(s.e2, v);
  const L = Math.abs(p1 * el.m1);
  const out: LinSub[] = [];
  out.push({
    key: 'aim',
    ring: [{ row: 'h1', role: v }, { row: 'h2', role: v }],
    why: { en: `First we make one unknown disappear, so that only ${left} is left to find. Look at the ${v} terms: ${term(p1, v)} in equation (1) and ${term(p2, v)} in equation (2).`, ml: `ആദ്യം ഒരു അജ്ഞാതത്തെ ഇല്ലാതാക്കാം; അപ്പോൾ കണ്ടെത്താൻ ${left} മാത്രം ബാക്കിയാകും. ${v} പദങ്ങൾ നോക്കൂ: സമവാക്യം (1)-ൽ ${term(p1, v)}, സമവാക്യം (2)-ൽ ${term(p2, v)}.` },
    note: { en: `remove ${v}`, ml: `${v} ഒഴിവാക്കുക` },
  });
  ([[1, s.e1, el.m1, el.s1, p1], [2, s.e2, el.m2, el.s2, p2]] as Array<[1 | 2, Eq, number, Eq, number]>).forEach(([k, e, m, se, pk]) => {
    const color = k === 1 ? 'e1' : 'e2';
    const label = k === 1 ? 'e1' : 'e2';
    const h = k === 1 ? 'h1' : 'h2';
    if (m > 1) {
      const both = el.m1 > 1 && el.m2 > 1 && k === 2;
      out.push({
        key: `mul${k}`,
        why: both
          ? { en: `Now multiply equation (2) by ${m}, every term on both sides, so that its ${v} term also becomes ${L}${v} in size.`, ml: `ഇനി സമവാക്യം (2)-ലെ ഓരോ പദത്തെയും, ഇരുവശത്തും, ${m} കൊണ്ട് ഗുണിക്കുക; അപ്പോൾ അതിലെ ${v} പദവും ${L}${v} വലുപ്പമാകും.` }
          : { en: `We want the ${v} terms to be the same size. ${L} is the smallest number that both ${Math.abs(p1)} and ${Math.abs(p2)} divide exactly (their LCM). So multiply equation (${k}) by ${m}: every term, on both sides. Doing the same to both sides keeps the equation true.`, ml: `${v} പദങ്ങൾ ഒരേ വലുപ്പമാക്കണം. ${Math.abs(p1)}, ${Math.abs(p2)} എന്നിവയുടെ ല.സാ.ഗു. ${L} ആണ് (രണ്ടും കൃത്യമായി ഹരിക്കുന്ന ഏറ്റവും ചെറിയ സംഖ്യ). അതിനാൽ സമവാക്യം (${k})-ലെ ഓരോ പദത്തെയും, ഇരുവശത്തും, ${m} കൊണ്ട് ഗുണിക്കുക. ഇരുവശത്തും ഒരേ കാര്യം ചെയ്താൽ സമവാക്യം ശരിയായി തുടരും.` },
        note: { en: `multiply (${k}) by ${m}`, ml: `(${k}) × ${m}` },
        // each term of the given equation comes down; a new orange multiplier pops in front of every term
        write: row({
          tag: `(${k}) × ${m}`,
          tokens: mulTokens(e, m),
          color,
          hot: [0, 4, 8],
          flows: [
            { from: { row: h, role: 'x' }, to: 2 },
            { from: { row: h, role: 'y' }, to: 6 },
            { from: { row: h, role: 'c' }, to: 10 },
          ],
        }),
      });
      const pieces = `${m} × ${brTerm(e.a, 'x')} = ${term(se.a, 'x')}, ${m} × ${brTerm(e.b, 'y')} = ${term(se.b, 'y')}, ${m} × ${br(e.c)} = ${fmt(se.c)}`;
      out.push({
        key: `mul${k}b`,
        why: { en: `Multiply each term: ${pieces}. So equation (${k}) becomes ${eqText(se)}.`, ml: `ഓരോ പദവും ഗുണിക്കുക: ${pieces}. അതിനാൽ സമവാക്യം (${k}) ഇങ്ങനെയാകും: ${eqText(se)}.` },
        note: { en: `${m} × each term`, ml: `ഓരോ പദവും × ${m}` },
        // "3 × 2x" flies together and becomes "6x", and so on
        write: row({
          tokens: eqTokens5(se),
          color,
          label,
          flows: [
            { from: { row: 'prev', idx: [3] }, to: 1, glide: true },
            { from: { row: 'prev', idx: [7] }, to: 3, glide: true },
            { from: { row: 'prev', idx: [0, 1, 2] }, to: 0 },
            { from: { row: 'prev', idx: [4, 5, 6] }, to: 2 },
            { from: { row: 'prev', idx: [8, 9, 10] }, to: 4 },
          ],
        }),
      });
    } else {
      out.push({
        key: `keep${k}`,
        why: { en: `Equation (${k}) already has ${term(pk, v)}, the size we need, so we keep it as it is.`, ml: `സമവാക്യം (${k})-ൽ ഇപ്പോൾ തന്നെ ${term(pk, v)} ഉണ്ട്; ആവശ്യമുള്ള വലുപ്പം അതാണ്. അതിനാൽ അത് അതേപടി എടുക്കുന്നു.` },
        note: { en: `keep (${k}) as it is`, ml: `(${k}) അതേപടി` },
        write: row({ tag: `(${k})`, tokens: eqTokens5(se), color, label, flows: fromHead(h, true) }),
      });
    }
  });
  // put the two together: add when the v terms have opposite signs, subtract when they have the same sign
  const q1 = coef(el.s1, v), q2 = coef(el.s2, v);
  const w = el.op === '+' ? el.s2 : scaleEq(el.s2, -1); // what is added to equation (1), term by term
  // [x1, ±, x2, ±, y1, ±, y2, =, c1, ±, c2]; for a subtraction the signs of (2) turn round (orange)
  const tokens = [term(el.s1.a, 'x'), sgn(w.a), term(Math.abs(w.a), 'x'), sgn(el.s1.b), term(Math.abs(el.s1.b), 'y'), sgn(w.b), term(Math.abs(w.b), 'y'), '=', fmt(el.s1.c), sgn(w.c), String(Math.abs(w.c))];
  out.push({
    key: 'combine',
    rule: el.op,
    ring: [{ row: 'e1', idx: [v === 'x' ? 0 : 2] }, { row: 'e2', idx: [v === 'x' ? 0 : 2] }],
    why: el.op === '+'
      ? { en: `Now the ${v} terms are ${term(q1, v)} and ${term(q2, v)}: the same size, opposite signs. Add the two equations, because ${term(q1, v)} + ${brTerm(q2, v)} = 0. We may add them: equal amounts added to equal amounts give equal results.`, ml: `ഇപ്പോൾ ${v} പദങ്ങൾ ${term(q1, v)}, ${term(q2, v)}: വലുപ്പം ഒന്ന്, ചിഹ്നം വിപരീതം. രണ്ടു സമവാക്യങ്ങളും കൂട്ടുക, കാരണം ${term(q1, v)} + ${brTerm(q2, v)} = 0. തുല്യമായവയോട് തുല്യമായവ കൂട്ടിയാൽ ഫലവും തുല്യമാണ്.` }
      : { en: `Now both equations have ${term(q1, v)}. Subtract equation (2) from equation (1), because ${term(q1, v)} − ${brTerm(q2, v)} = 0. When we take away a whole equation, every one of its terms changes sign.`, ml: `ഇപ്പോൾ രണ്ടു സമവാക്യത്തിലും ${term(q1, v)} ഉണ്ട്. സമവാക്യം (1)-ൽ നിന്ന് സമവാക്യം (2) കുറയ്ക്കുക, കാരണം ${term(q1, v)} − ${brTerm(q2, v)} = 0. ഒരു സമവാക്യം മുഴുവനായി കുറയ്ക്കുമ്പോൾ അതിലെ ഓരോ പദത്തിന്റെയും ചിഹ്നം മാറും.` },
    note: el.op === '+' ? { en: 'add (1) and (2)', ml: '(1) + (2) കൂട്ടുക' } : { en: 'subtract: (1) − (2)', ml: '(1) − (2) കുറയ്ക്കുക' },
    write: row({
      tokens,
      color: 'ink',
      label: 'sum',
      cancel: v === 'x' ? [0, 1, 2] : [3, 4, 5, 6],
      hot: el.op === '−' ? [1, 5, 9] : [],
      flows: [
        { from: { row: 'e1', idx: [3] }, to: 7, glide: true },
        { from: { row: 'e1', idx: [1] }, to: 3, glide: true },
        { from: { row: 'e1', idx: [0] }, to: 0 },
        { from: { row: 'e2', idx: [0] }, to: 2 },
        { from: { row: 'e1', idx: [2] }, to: 4 },
        { from: { row: 'e2', idx: [2] }, to: 6 },
        { from: { row: 'e1', idx: [4] }, to: 8 },
        { from: { row: 'e2', idx: [4] }, to: 10 },
      ],
    }),
  });
  const l1 = coef(el.s1, left), l2 = coef(w, left);
  const opw = (n: number) => (n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`);
  const leftIdx = v === 'x' ? [3, 4, 5, 6] : [0, 1, 2];
  out.push({
    key: 'collect',
    strike: true,
    why: { en: `The ${v} terms cancel: they make 0. Collect the ${left} terms: ${term(l1, left)}${signed(l2, left)} = ${term(el.r, left)}. Collect the numbers: ${fmt(el.s1.c)} ${opw(w.c)} = ${fmt(el.d)}. So ${el.text}.`, ml: `${v} പദങ്ങൾ ചേർന്ന് 0 ആകുന്നു. ${left} പദങ്ങൾ ചേർക്കുക: ${term(l1, left)}${signed(l2, left)} = ${term(el.r, left)}. സംഖ്യകൾ ചേർക്കുക: ${fmt(el.s1.c)} ${opw(w.c)} = ${fmt(el.d)}. അതിനാൽ ${el.text}.` },
    note: { en: `${v} cancels`, ml: `${v} ഇല്ലാതായി` },
    // the left terms fly together into one; the numbers fly together into one
    write: row({
      tokens: [term(el.r, left), '=', fmt(el.d)],
      color: el.r === 1 ? 'result' : 'ink',
      big: el.r === 1,
      flows: [
        { from: { row: 'sum', idx: [7] }, to: 1, glide: true },
        { from: { row: 'sum', idx: leftIdx }, to: 0 },
        { from: { row: 'sum', idx: [8, 9, 10] }, to: 2 },
      ],
    }),
  });
  if (el.r !== 1) out.push(...divideAndAnswer(left, el.r, el.d, el.value)); // with 1·left the collected line IS the answer
  return out;
}

/* ---------------- substitution ---------------- */

export function substitutionSteps(s: LinPlanNumbers, known: Var, kv: number, into: 1 | 2): LinSub[] {
  const e = into === 1 ? s.e1 : s.e2;
  const left: Var = known === 'x' ? 'y' : 'x';
  const ck = coef(e, known), cl = coef(e, left);
  const k = ck * kv;
  const rhs = e.c - k;
  const value = rhs / cl + 0;
  const color = into === 1 ? 'e1' : 'e2';
  const kI = known === 'x' ? 0 : 2; // where the known term sits in a five-token line
  const same = (except: number[]): Flow[] => [0, 1, 2, 3, 4].filter((i) => !except.includes(i)).map((i) => ({ from: { row: 'prev', idx: [i] }, to: i, glide: true }));
  const out: LinSub[] = [];
  out.push({
    key: 'sub-take',
    why: { en: `Now we know ${known} = ${fmt(kv)}. Put it back into ${eqName(into).en} to find ${left}. Either equation works, because the answer must make both of them true.`, ml: `ഇപ്പോൾ ${known} = ${fmt(kv)} എന്നറിയാം. ${left} കണ്ടെത്താൻ ഇത് ${eqName(into).ml}-ൽ ചേർക്കുക. ഏതു സമവാക്യം എടുത്താലും മതി, കാരണം ഉത്തരം രണ്ടിനെയും ശരിയാക്കണം.` },
    note: { en: `take (${into})`, ml: `(${into}) എടുക്കുക` },
    write: row({ tag: `(${into})`, tokens: eqTokens5(e), color, flows: fromHead(into === 1 ? 'h1' : 'h2', true) }),
  });
  // the known term with the value in brackets: "2(3)", "−(−3)"
  const knownPut = Math.abs(ck) === 1 ? br(kv) : `${Math.abs(ck)}(${fmt(kv)})`;
  const putTokens = known === 'y' ? [term(e.a, 'x'), sgn(ck), knownPut, '=', fmt(e.c)] : [`${ck < 0 ? '−' : ''}${knownPut}`, sgn(e.b), term(Math.abs(e.b), 'y'), '=', fmt(e.c)];
  out.push({
    key: 'sub-put',
    ring: [{ row: 'prev', idx: [kI] }],
    why: Math.abs(ck) === 1
      ? { en: `Write ${fmt(kv)} in place of ${known}.`, ml: `${known}-ന്റെ സ്ഥാനത്ത് ${fmt(kv)} എഴുതുക.` }
      : { en: `Write ${fmt(kv)} in place of ${known}. ${term(Math.abs(ck), known)} means ${Math.abs(ck)} times ${known}, so it becomes ${Math.abs(ck)} × ${br(kv)}.`, ml: `${known}-ന്റെ സ്ഥാനത്ത് ${fmt(kv)} എഴുതുക. ${term(Math.abs(ck), known)} എന്നാൽ ${Math.abs(ck)} × ${known}; അതിനാൽ അത് ${Math.abs(ck)} × ${br(kv)} ആകും.` },
    note: { en: `put ${known} = ${fmt(kv)}`, ml: `${known} = ${fmt(kv)} ചേർക്കുക` },
    write: row({ tokens: putTokens, color, flows: [...same([kI]), { from: { row: 'prev', idx: [kI] }, to: kI }] }),
  });
  const kAbs = Math.abs(k);
  if (!(Math.abs(ck) === 1 && kv >= 0)) {
    const rule = ck < 0 && kv < 0 ? { en: ' A minus times a minus gives a plus.', ml: ' ന്യൂനം × ന്യൂനം = അധിസംഖ്യ.' } : ck * kv < 0 ? { en: ' A minus times a plus gives a minus.', ml: ' ന്യൂനം × അധിസംഖ്യ = ന്യൂനം.' } : { en: '', ml: '' };
    const mulT = known === 'y' ? [term(e.a, 'x'), sgn(k), String(kAbs), '=', fmt(e.c)] : [fmt(k), sgn(e.b), term(Math.abs(e.b), 'y'), '=', fmt(e.c)];
    out.push({
      key: 'sub-mul',
      why: { en: `Multiply: ${fmt(ck)} × ${br(kv)} = ${fmt(k)}.${rule.en}`, ml: `ഗുണിക്കുക: ${fmt(ck)} × ${br(kv)} = ${fmt(k)}.${rule.ml}` },
      note: { en: `${fmt(ck)} × ${br(kv)} = ${fmt(k)}`, ml: `${fmt(ck)} × ${br(kv)} = ${fmt(k)}` },
      write: row({
        tokens: mulT,
        color,
        flows: known === 'y'
          ? [...same([1, 2]), { from: { row: 'prev', idx: [1] }, to: 1 }, { from: { row: 'prev', idx: [1, 2] }, to: 2 }]
          : [...same([0]), { from: { row: 'prev', idx: [0] }, to: 0 }],
      }),
    });
  }
  const lt = term(cl, left);
  // in the line above (five tokens): the left term, and the known number with its sign
  const ltFrom = known === 'y' ? [0] : [1, 2];
  const kFrom = known === 'y' ? [1, 2] : [0];
  if (k !== 0) {
    out.push({
      key: 'sub-move',
      ring: [{ row: 'prev', idx: kFrom }],
      why: k > 0
        ? { en: `To get ${lt} alone, take ${k} away from the left side. Take ${k} away from the right side too, so both sides stay equal. That is why + ${k} on the left becomes − ${k} on the right.`, ml: `${lt} മാത്രം ഇടതുവശത്ത് കിട്ടാൻ ഇടതുവശത്തു നിന്ന് ${k} കുറയ്ക്കുക. ഇരുവശവും തുല്യമായിരിക്കാൻ വലതുവശത്തു നിന്നും ${k} കുറയ്ക്കുക. അതുകൊണ്ടാണ് ഇടതുവശത്തെ + ${k} വലതുവശത്ത് − ${k} ആകുന്നത്.` }
        : { en: `To get ${lt} alone, add ${kAbs} to the left side: − ${kAbs} + ${kAbs} = 0. Add ${kAbs} to the right side too, so both sides stay equal. That is why − ${kAbs} on the left becomes + ${kAbs} on the right.`, ml: `${lt} മാത്രം കിട്ടാൻ ഇടതുവശത്ത് ${kAbs} കൂട്ടുക: − ${kAbs} + ${kAbs} = 0. ഇരുവശവും തുല്യമായിരിക്കാൻ വലതുവശത്തും ${kAbs} കൂട്ടുക. അതുകൊണ്ടാണ് ഇടതുവശത്തെ − ${kAbs} വലതുവശത്ത് + ${kAbs} ആകുന്നത്.` },
      note: k > 0 ? { en: `− ${k} both sides`, ml: `ഇരുവശത്തും − ${k}` } : { en: `+ ${kAbs} both sides`, ml: `ഇരുവശത്തും + ${kAbs}` },
      // the number jumps across the "=" and its sign turns round (orange)
      write: row({
        tokens: [lt, '=', fmt(e.c), k > 0 ? '−' : '+', String(kAbs)],
        color,
        hot: [3],
        flows: [
          { from: { row: 'prev', idx: ltFrom }, to: 0, glide: true },
          { from: { row: 'prev', idx: [3] }, to: 1, glide: true },
          { from: { row: 'prev', idx: [4] }, to: 2, glide: true },
          { from: { row: 'prev', idx: kFrom }, to: 4 },
        ],
      }),
    });
  }
  out.push({
    key: 'sub-simplify',
    why: k !== 0
      ? { en: `${fmt(e.c)} ${k > 0 ? '−' : '+'} ${kAbs} = ${fmt(rhs)}. So ${lt} = ${fmt(rhs)}.`, ml: `${fmt(e.c)} ${k > 0 ? '−' : '+'} ${kAbs} = ${fmt(rhs)}. അതിനാൽ ${lt} = ${fmt(rhs)}.` }
      : { en: `Adding 0 changes nothing. So ${lt} = ${fmt(rhs)}.`, ml: `0 കൂട്ടിയാൽ ഒന്നും മാറില്ല. അതിനാൽ ${lt} = ${fmt(rhs)}.` },
    note: k !== 0 ? { en: `${fmt(e.c)} ${k > 0 ? '−' : '+'} ${kAbs} = ${fmt(rhs)}`, ml: `${fmt(e.c)} ${k > 0 ? '−' : '+'} ${kAbs} = ${fmt(rhs)}` } : { en: '+ 0 changes nothing', ml: '+ 0 മാറ്റമില്ല' },
    write: row({
      tokens: [lt, '=', fmt(rhs)],
      color: cl === 1 ? 'result' : color,
      big: cl === 1,
      flows: k !== 0
        ? [{ from: { row: 'prev', idx: [0] }, to: 0, glide: true }, { from: { row: 'prev', idx: [1] }, to: 1, glide: true }, { from: { row: 'prev', idx: [2, 3, 4] }, to: 2 }]
        : [{ from: { row: 'prev', idx: ltFrom }, to: 0, glide: true }, { from: { row: 'prev', idx: [3] }, to: 1, glide: true }, { from: { row: 'prev', idx: [4] }, to: 2, glide: true }],
    }),
  });
  if (cl !== 1) out.push(...divideAndAnswer(left, cl, rhs, value));
  return out;
}

/* ---------------- the check ---------------- */

export function checkSteps(s: LinPlanNumbers, x: number, y: number): LinSub[] {
  const out: LinSub[] = [];
  ([[1, s.e1], [2, s.e2]] as Array<[1 | 2, Eq]>).forEach(([k, e]) => {
    const p1 = e.a * x, p2 = e.b * y;
    const put = (c: number, val: number) => `${c < 0 ? '−' : ''}${Math.abs(c) === 1 ? br(val) : `${Math.abs(c)}(${fmt(val)})`}`;
    const sum = `${fmt(p1)} ${p2 < 0 ? '−' : '+'} ${Math.abs(p2)}`;
    const h = k === 1 ? 'h1' : 'h2';
    out.push({
      key: `check${k}`,
      why: { en: `Check in equation (${k}): put x = ${fmt(x)} and y = ${fmt(y)}. ${fmt(e.a)} × ${br(x)} = ${fmt(p1)} and ${fmt(e.b)} × ${br(y)} = ${fmt(p2)}. ${sum} = ${fmt(e.c)}, the same as the right side.`, ml: `സമവാക്യം (${k})-ൽ പരിശോധിക്കുക: x = ${fmt(x)}, y = ${fmt(y)} ചേർക്കുക. ${fmt(e.a)} × ${br(x)} = ${fmt(p1)}, ${fmt(e.b)} × ${br(y)} = ${fmt(p2)}. ${sum} = ${fmt(e.c)}, വലതുവശത്തുള്ളതു തന്നെ.` },
      note: { en: 'left side = right side', ml: 'ഇടതുവശം = വലതുവശം' },
      // the terms of the given equation come down with the values in, each product comes out of its term,
      // and c comes down to close the line: [x-put, ±, y-put, =, p1, ±, |p2|, =, c]
      write: row({
        tag: `(${k})`,
        tokens: [put(e.a, x), e.b < 0 ? '−' : '+', put(Math.abs(e.b), y), '=', fmt(p1), p2 < 0 ? '−' : '+', String(Math.abs(p2)), '=', fmt(e.c)],
        color: k === 1 ? 'e1' : 'e2',
        tick: true,
        flows: [
          { from: { row: h, role: 'x' }, to: 0 },
          { from: { row: h, role: 'y' }, to: 2 },
          { from: { row: 'self', idx: [0] }, to: 4 },
          { from: { row: 'self', idx: [2] }, to: 6 },
          { from: { row: h, role: 'c' }, to: 8 },
        ],
      }),
    });
  });
  out.push({
    key: 'check-done',
    why: { en: `Both equations are true, so the solution is x = ${fmt(x)} and y = ${fmt(y)}.`, ml: `രണ്ടു സമവാക്യങ്ങളും ശരിയാണ്; അതിനാൽ ഉത്തരം x = ${fmt(x)}, y = ${fmt(y)}.` },
    note: { en: `x = ${fmt(x)}, y = ${fmt(y)}`, ml: `x = ${fmt(x)}, y = ${fmt(y)}` },
    write: row({ tokens: ['x', '=', `${fmt(x)},`, 'y', '=', fmt(y)], color: 'result', big: true }),
  });
  return out;
}

/** True when the arithmetic on a check line holds (used by tests). */
export const lhsHolds = (e: Eq, x: number, y: number) => e.a * x + e.b * y === e.c;
