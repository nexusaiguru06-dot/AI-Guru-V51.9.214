/**
 * Deterministic worked solutions in the board template grammar (see template-types.ts).
 *
 * Why this exists: steps written by a language model are often too coarse (three rows for a quadratic that
 * needs eight), out of order, or wrong. For the problem families a school paper is full of, we compute the
 * solution ourselves with exact arithmetic, show EVERY transformation, and independently CHECK the answer
 * by substituting it back. `planTemplateSolution` returns null whenever it is not certain
 * (unsupported problem, degenerate case, or a failed self-check) so the model's own steps are used instead.
 */
import { Fr, F } from './rational';
import {
  type Terms, parseTerms, combine, formatTerms, evaluate, coefficientOf, constantOf, degreeIn, variablesOf,
  normalizeMathText, fmtFr, negTerms,
} from './terms';
import { computeFocus } from './template-focus';
import type { MathTeachingStep } from '../material-studio/types';
import type { RowKind, TemplateRow, TemplateSolution, SolutionFamily } from './template-types';

const MINUS = '\u2212';

/* ------------------------------------------------------------------ */
/* Malayalam phrases for the fixed vocabulary of a worked solution.     */
/* (Please have a Malayalam-speaking teacher review the wording.)       */
/* ------------------------------------------------------------------ */
const ML = {
  subtract: (k: string) => `ഇരുവശത്തുനിന്നും ${k} കുറയ്ക്കുക`,
  add: (k: string) => `ഇരുവശത്തും ${k} കൂട്ടുക`,
  divide: (k: string) => `ഇരുവശത്തെയും ${k} കൊണ്ട് ഹരിക്കുക`,
  multiply: (k: string) => `ഇരുവശത്തെയും ${k} കൊണ്ട് ഗുണിക്കുക`,
  simplifies: 'ലഘൂകരിക്കുമ്പോൾ',
  therefore: 'അതിനാൽ',
  expand: 'ബ്രാക്കറ്റുകൾ വിപുലീകരിക്കുക',
  combine: 'സമാന പദങ്ങൾ ചേർക്കുക',
  swap: 'ചരം ഇടതുവശത്താക്കി എഴുതുക',
  identify: 'a, b, c എന്നിവ കണ്ടെത്തുക',
  standard: 'എല്ലാ പദങ്ങളും ഒരു വശത്താക്കി എഴുതുക',
  formula: 'ദ്വിഘാത സമവാക്യത്തിന്റെ സൂത്രവാക്യം',
  substitute: 'വിലകൾ നൽകുക',
  workOut: 'b², 4ac എന്നിവ കണക്കാക്കുക',
  discriminant: 'വർഗമൂലത്തിനുള്ളിലെ സംഖ്യ ലഘൂകരിക്കുക',
  root: 'വർഗമൂലം കണ്ടെത്തുക',
  twoCases: 'രണ്ട് സാധ്യതകൾ: + ഉം − ഉം',
  decimal: 'ദശാംശ രൂപത്തിൽ',
  check: 'ഉത്തരം ശരിയാണോ എന്ന് പരിശോധിക്കാം',
  solutionIs: 'ഉത്തരം',
  identity: 'സർവ്വസമവാക്യം ഉപയോഗിക്കുക',
  useAB: 'a, b എന്നിവയുടെ വില എഴുതുക',
  standardForm: 'സാധാരണ രൂപത്തിൽ എഴുതുക',
  multiplyEq: (n: string, k: string) => `സമവാക്യം (${n}) നെ ${k} കൊണ്ട് ഗുണിക്കുക`,
  eliminate: (v: string, sub: boolean) => `${v} ഒഴിവാക്കാൻ ${sub ? 'കുറയ്ക്കുക' : 'കൂട്ടുക'}`,
  subIn: (val: string, n: string) => `${val} എന്നത് (${n}) ൽ നൽകുക`,
  start: 'ചോദ്യത്തിലെ സമവാക്യം',
  signs: 'ബ്രാക്കറ്റ് ഒഴിവാക്കി ചിഹ്നങ്ങൾ ശരിയാക്കുക',
  leftToRight: 'ഇടത്തുനിന്ന് വലത്തോട്ട് കൂട്ടുകയും കുറയ്ക്കുകയും ചെയ്യുക',
  perfectSquares: 'ഓരോ വർഗമൂലവും പൂർണവർഗ ഘടകം ഉപയോഗിച്ച് എഴുതുക',
  takeOut: 'പൂർണവർഗങ്ങളുടെ മൂലം പുറത്തെടുക്കുക',
  likeSurds: 'സമാന സർഡുകൾ ചേർക്കുക',
  approx: 'ഏകദേശ വിലകൾ',
};

/* ------------------------------------------------------------------ */
/* Row builder                                                          */
/* ------------------------------------------------------------------ */
class Rows {
  rows: TemplateRow[] = [];
  private ordinal = 0;
  private prevMath: string | undefined;

  private push(kind: RowKind, text: string, o: { label?: string; labelMl?: string; en: string; ml?: string; boxed?: boolean; focusFromPrev?: boolean }) {
    const row: TemplateRow = {
      id: `r${this.rows.length + 1}`, kind, text, label: o.label, labelMl: o.labelMl,
      ordinal: kind === 'step' || kind === 'result' ? this.ordinal : 0,
      boxed: o.boxed, captionEn: o.en, captionMl: o.ml,
    };
    if (o.focusFromPrev) row.focus = computeFocus(this.prevMath, text);
    if (kind === 'step' || kind === 'result') this.ordinal += 1;
    if (kind === 'original' || kind === 'step' || kind === 'result') this.prevMath = text;
    this.rows.push(row);
    return row;
  }
  original(text: string, o: { label?: string; labelMl?: string; en: string; ml?: string }) { return this.push('original', text, o); }
  /** `mark: true` = this row is a transformation of the previous one, so it gets the arc / circle. */
  step(text: string, o: { label?: string; labelMl?: string; en: string; ml?: string; boxed?: boolean; mark?: boolean }) { return this.push('step', text, { ...o, focusFromPrev: !!o.mark }); }
  result(text: string, o: { label?: string; labelMl?: string; en: string; ml?: string }) { return this.push('result', text, { ...o, boxed: true, focusFromPrev: false }); }
  checkTitle(text: string, en: string, ml?: string) { return this.push('check-title', text, { en, ml }); }
  check(text: string, en: string, ml?: string) { return this.push('check', text, { en, ml }); }
  checkOk(text: string, en: string, ml?: string) { return this.push('check-ok', text, { en, ml }); }
  answer(text: string, en: string, ml?: string) { return this.push('answer', text, { en, ml }); }
  note(text: string, en: string, ml?: string) { return this.push('note', text, { en, ml }); }
  /** Promote the most recent step row to the boxed result. */
  boxLast(label = 'Therefore', labelMl = ML.therefore) {
    const r = this.rows[this.rows.length - 1];
    r.kind = 'result'; r.boxed = true; r.label = label; r.labelMl = labelMl; r.focus = undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                      */
/* ------------------------------------------------------------------ */
/** User text -> board text: true minus, spaced operators, superscripts, roots. */
export function pretty(src: string): string {
  let s = normalizeMathText(src);
  s = s.replace(/sqrt\((\d+)\)/g, '\u221a$1').replace(/sqrt\(/g, '\u221a(').replace(/\^2/g, '\u00b2').replace(/\^3/g, '\u00b3').replace(/\*/g, '\u00d7');
  s = s.replace(/\s*=\s*/g, ' = ');
  s = s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  s = s.replace(/^\s*-\s+(?=[\dA-Za-z(\u221a])/, '-').replace(/\(-\s+/g, '(-');
  s = s.replace(/([0-9A-Za-z)\u00b2\u00b3])\s*([+\-])\s*(?=[0-9A-Za-z(\u221a.])/g, '$1 $2 ');
  return s.replace(/-/g, MINUS).replace(/\s+/g, ' ').trim();
}

const dec = (x: Fr) => x.decimal() ?? x.toString();
const fmt = (x: Fr) => fmtFr(x);

/** Replace a variable by a value inside display text: 2x -> 2(7.5), x -> 7.5, x² -> (7.5)², negatives always bracketed. */
export function substituteDisplay(text: string, variable: string, value: Fr, preferFraction = false): string {
  const shown = (preferFraction ? value.toString() : dec(value)).replace('-', MINUS);
  const re = new RegExp(`(?<![A-Za-z])${variable}(?![A-Za-z])`, 'g');
  return text.replace(re, (_m, offset: number, whole: string) => {
    const before = whole[offset - 1];
    const after = whole[offset + 1];
    const needsBrackets = value.isNeg() || (preferFraction && !value.isInt()) || !value.isInt() && !value.decimal() || /[0-9)]/.test(before ?? '') || /[\u00b2\u00b3]/.test(after ?? '');
    return needsBrackets ? `(${shown})` : shown;
  });
}

/* ------------------------------------------------------------------ */
/* Problem extraction                                                   */
/* ------------------------------------------------------------------ */
const looksLikeMath = (s: string) => /^[0-9A-Za-z+\-\u2212\u00d7\u00f7*/^=().,\u00b2\u00b3\u221a \u2013]+$/.test(s) && !/[A-Za-z]{3,}/.test(s.replace(/sqrt/g, '')) && /[0-9]/.test(s);

export function extractExpressions(question: string): string[] | null {
  let t = String(question || '').replace(/^\s*\d{1,3}\s*[.)]\s*/, '').replace(/\s+/g, ' ').trim();
  const candidates: string[] = [];
  const colon = t.lastIndexOf(':');
  if (colon >= 0) candidates.push(t.slice(colon + 1));
  candidates.push(t.replace(/^(solve|simplify|evaluate|expand|calculate)\b\s*(the\s+)?(equation\s+)?(completely\s+)?/i, ''));
  candidates.push(t);
  for (const raw of candidates) {
    const cleaned = raw.replace(/[.\s]+$/, '').trim();
    if (!cleaned) continue;
    const parts = cleaned.split(/\s+and\s+|;/i).map(x => x.trim()).filter(Boolean);
    if (parts.length && parts.every(looksLikeMath)) return parts;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Families                                                             */
/* ------------------------------------------------------------------ */
const show = (l: Terms, r: Terms) => `${formatTerms(l)} = ${formatTerms(r)}`;
const varTerm = (v: string, k: Fr): Terms => [{ c: k, v: { [v]: 1 } }];
const constTerm = (k: Fr): Terms => [{ c: k, v: {} }];
const coefText = (k: Fr, v: string) => `${k.abs().eq(F(1)) ? '' : fmt(k.abs())}${v}`;

function planLinear(ls: string, rs: string, v: string): TemplateSolution | null {
  const R = new Rows();
  const orig = pretty(`${ls} = ${rs}`);
  R.original(orig, { label: 'Equation', labelMl: ML.start, en: `We start with the equation ${orig}.`, ml: `സമവാക്യം ഇതാണ്: ${orig}.` });

  let L = parseTerms(ls);
  let Rt = parseTerms(rs);
  let prev = orig;
  const add = (text: string, label: string, labelMl: string, en: string, ml: string) => {
    if (text === prev) return false;
    R.step(text, { label, labelMl, en, ml, mark: true }); prev = text; return true;
  };

  if (/[()]/.test(ls + rs)) add(show(L, Rt), 'Expand the brackets', ML.expand, 'Multiply out the brackets first.', 'ആദ്യം ബ്രാക്കറ്റുകൾ വിപുലീകരിക്കുക.');
  L = combine(L); Rt = combine(Rt);
  add(show(L, Rt), 'Combine like terms', ML.combine, 'Combine the like terms on each side.', 'ഓരോ വശത്തെയും സമാന പദങ്ങൾ ചേർക്കുക.');

  if (coefficientOf(L, v).eq(coefficientOf(Rt, v))) return null; // no unique solution
  if (coefficientOf(L, v).isZero()) {
    [L, Rt] = [Rt, L];
    add(show(L, Rt), 'Write the variable on the left', ML.swap, 'Swap the sides so the unknown is on the left.', 'അജ്ഞാതം ഇടതുവശത്ത് വരുന്ന രീതിയിൽ വശങ്ങൾ മാറ്റി എഴുതുക.');
  }

  // unknown on both sides: remove it from the right
  const aR = coefficientOf(Rt, v);
  if (!aR.isZero()) {
    const t = coefText(aR, v);
    const addIt = aR.isNeg();
    const sign = addIt ? '+' : MINUS;
    const text = `${formatTerms(L)} ${sign} ${t} = ${formatTerms(Rt)} ${sign} ${t}`;
    add(text, `${addIt ? 'Add' : 'Subtract'} ${t} ${addIt ? 'to' : 'from'} both sides`, addIt ? ML.add(t) : ML.subtract(t),
      `${addIt ? 'Add' : 'Subtract'} ${t} ${addIt ? 'to' : 'from'} both sides to collect the unknown on the left.`,
      `${addIt ? ML.add(t) : ML.subtract(t)}, അജ്ഞാതത്തെ ഇടതുവശത്ത് ശേഖരിക്കാൻ.`);
    const delta = varTerm(v, aR.neg());
    L = combine([...L, ...delta]); Rt = combine([...Rt, ...delta]);
    add(show(L, Rt), 'Simplifies to', ML.simplifies, 'Simplify both sides.', 'ഇരുവശവും ലഘൂകരിക്കുക.');
  }

  // constant on the unknown's side
  const bL = constantOf(L);
  if (!bL.isZero()) {
    const k = fmt(bL.abs());
    const addIt = bL.isNeg();
    const sign = addIt ? '+' : MINUS;
    add(`${formatTerms(L)} ${sign} ${k} = ${formatTerms(Rt)} ${sign} ${k}`, `${addIt ? 'Add' : 'Subtract'} ${k} ${addIt ? 'to' : 'from'} both sides`, addIt ? ML.add(k) : ML.subtract(k),
      `${addIt ? 'Add' : 'Subtract'} ${k} ${addIt ? 'to' : 'from'} both sides to leave the unknown term alone.`,
      `${addIt ? ML.add(k) : ML.subtract(k)}, അജ്ഞാത പദം മാത്രം ശേഷിക്കാൻ.`);
    L = combine([...L, ...constTerm(bL.neg())]); Rt = combine([...Rt, ...constTerm(bL.neg())]);
    add(show(L, Rt), 'Simplifies to', ML.simplifies, 'Simplify both sides.', 'ഇരുവശവും ലഘൂകരിക്കുക.');
  }

  const a1 = coefficientOf(L, v);
  const rhs = constantOf(Rt);
  if (a1.isZero()) return null;
  const value = rhs.div(a1);
  const valueText = fmt(value);

  if (!a1.eq(F(1))) {
    const kd = a1.isNeg() ? `(${fmt(a1)})` : fmt(a1);
    add(`${formatTerms(L)} / ${kd} = ${formatTerms(Rt)} / ${kd}`, `Divide both sides by ${fmt(a1)}`, ML.divide(fmt(a1)),
      `Divide both sides by ${fmt(a1)} to find ${v}.`, `${ML.divide(fmt(a1))}, ${v} കണ്ടെത്താൻ.`);
    add(`${v} = ${valueText}`, 'Therefore', ML.therefore, `So ${v} equals ${valueText}.`, `അതിനാൽ ${v} = ${valueText}.`);
  } else if (prev !== `${v} = ${valueText}`) {
    add(`${v} = ${valueText}`, 'Therefore', ML.therefore, `So ${v} equals ${valueText}.`, `അതിനാൽ ${v} = ${valueText}.`);
  }
  const d = value.isInt() ? null : value.decimal();
  if (d) {
    add(`${v} = ${d}`, 'As a decimal', ML.decimal, `As a decimal, ${v} = ${d}.`, `ദശാംശ രൂപത്തിൽ ${v} = ${d}.`);
  }
  R.boxLast();
  const shownValue = d ?? valueText;

  // independent check: substitute into the ORIGINAL equation
  const lv = evaluate(parseTerms(ls), { [v]: value });
  const rv = evaluate(parseTerms(rs), { [v]: value });
  if (!lv.eq(rv)) return null;
  R.checkTitle(`Check:  ${orig}`, 'Now let us check the answer in the original equation.', `${ML.check}.`);
  R.check(substituteDisplay(orig, v, value), `Substitute ${v} = ${shownValue}.`, `${v} = ${shownValue} നൽകുക.`);
  R.checkOk(`Check:  ${fmt(lv)} = ${fmt(rv)}  \u2713`, `Both sides are ${fmt(lv)}, so the answer is correct.`, `ഇരുവശവും ${fmt(lv)} തന്നെ; ഉത്തരം ശരിയാണ്.`);
  const answerText = `The solution is  ${v} = ${shownValue}`;
  R.answer(answerText, `The solution is ${v} equals ${shownValue}.`, `${ML.solutionIs}: ${v} = ${shownValue}.`);
  return { family: 'linear', problem: orig, rows: R.rows, answerText, verified: true };
}

/* ---------------- quadratic (formula method) ---------------- */
const sup = (n: number) => (n === 2 ? '\u00b2' : n === 3 ? '\u00b3' : `^${n}`);
function simplifyRadical(n: number): { k: number; m: number } {
  let k = 1; let m = n;
  for (let s = Math.floor(Math.sqrt(n)); s > 1; s--) { if (n % (s * s) === 0) { k = s; m = n / (s * s); break; } }
  return { k, m };
}

function planQuadratic(ls: string, rs: string, v: string): TemplateSolution | null {
  const R = new Rows();
  const orig = pretty(`${ls} = ${rs}`);
  const L0 = parseTerms(ls); const R0 = parseTerms(rs);
  const P = combine([...L0, ...negTerms(R0)]);
  const a = coefficientOf(P, v, 2); const b = coefficientOf(P, v, 1); const c = constantOf(P);
  if (a.isZero() || ![a, b, c].every(x => x.isInt())) return null;
  const A = a.n, B = b.n, C = c.n;

  R.original(orig, { label: 'Equation', labelMl: ML.start, en: `We start with the equation ${orig}.`, ml: `സമവാക്യം ഇതാണ്: ${orig}.` });
  const std = `${formatTerms(P)} = 0`;
  if (std !== orig) R.step(std, { label: 'Write in standard form', labelMl: ML.standard, en: 'Bring every term to one side so the equation is in the form a x squared plus b x plus c equals zero.', ml: 'എല്ലാ പദങ്ങളും ഒരു വശത്താക്കി ax² + bx + c = 0 എന്ന രൂപത്തിലാക്കുക.' });
  const abc = `a = ${A},   b = ${fmt(b)},   c = ${fmt(c)}`;
  R.step(abc, { label: 'Identify a, b, c', labelMl: ML.identify, en: `Compare with a x squared plus b x plus c: a is ${A}, b is ${fmt(b)}, c is ${fmt(c)}.`, ml: `ax² + bx + c യുമായി താരതമ്യം ചെയ്യുക: a = ${A}, b = ${fmt(b)}, c = ${fmt(c)}.` });
  R.step(`${v} = (\u2212b \u00b1 \u221a(b\u00b2 \u2212 4ac)) / 2a`, { label: 'Quadratic formula', labelMl: ML.formula, en: 'Write the quadratic formula.', ml: `${ML.formula} എഴുതുക.` });
  const par = (x: Fr) => `(${fmt(x)})`;
  R.step(`${v} = (\u2212${par(b)} \u00b1 \u221a(${par(b)}\u00b2 \u2212 4${par(a)}${par(c)})) / (2${par(a)})`, { label: 'Substitute a, b, c', labelMl: ML.substitute, en: 'Substitute the values of a, b and c.', ml: 'a, b, c എന്നിവയുടെ വിലകൾ നൽകുക.' });

  const negB = -B; const b2 = B * B; const fourAC = 4 * A * C; const D = b2 - fourAC; const twoA = 2 * A;
  const dExpr = fourAC >= 0 ? `${b2} ${MINUS} ${fourAC}` : `${b2} + ${-fourAC}`;
  const sg = (n: number) => String(n).replace('-', MINUS);
  R.step(`${v} = (${sg(negB)} \u00b1 \u221a(${dExpr})) / ${sg(twoA)}`, { label: 'Work out b\u00b2 and 4ac', labelMl: ML.workOut, en: `Work out b squared, ${b2}, and 4 a c, ${sg(fourAC)}.`, ml: `${ML.workOut}.` });
  R.step(`${v} = (${sg(negB)} \u00b1 \u221a${sg(D)}) / ${sg(twoA)}`, { label: 'Simplify inside the root', labelMl: ML.discriminant, en: `The number under the root is ${sg(D)}.`, ml: `${ML.discriminant}: ${sg(D)}.` });

  if (D < 0) {
    R.note('The number under the root is negative, so there is no real solution.', 'A negative number has no real square root, so this equation has no real solution.', 'വർഗമൂലത്തിനുള്ളിലെ സംഖ്യ നെഗറ്റീവ് ആയതിനാൽ യഥാർത്ഥ പരിഹാരമില്ല.');
    return { family: 'quadratic', problem: orig, rows: R.rows, answerText: 'No real solution', verified: true };
  }

  const s = Math.round(Math.sqrt(D));
  const perfect = s * s === D;
  let answerText: string;
  if (perfect) {
    R.step(`${v} = (${sg(negB)} \u00b1 ${s}) / ${sg(twoA)}`, { label: 'Take the square root', labelMl: ML.root, en: `The square root of ${D} is ${s}.`, ml: `${D} ന്റെ വർഗമൂലം ${s}.` });
    const r1 = new Fr(negB + s, twoA); const r2 = new Fr(negB - s, twoA);
    const shownPM = `${v} = (${sg(negB)} + ${s}) / ${sg(twoA)}   or   ${v} = (${sg(negB)} ${MINUS} ${s}) / ${sg(twoA)}`;
    R.step(shownPM, { label: 'Two cases: + and \u2212', labelMl: ML.twoCases, en: 'Use plus for the first solution and minus for the second.', ml: `${ML.twoCases}.` });
    const roots = r1.eq(r2) ? [r1] : [r1, r2];
    answerText = roots.map(r => `${v} = ${fmt(r)}`).join('   or   ');
    R.step(answerText, { label: 'Simplifies to', labelMl: ML.simplifies, en: `That gives ${roots.map(r => `${v} equals ${fmt(r)}`).join(', or ')}.`, ml: `${roots.map(r => `${v} = ${fmt(r)}`).join(', അല്ലെങ്കിൽ ')}.` });
    R.boxLast();

    for (const r of roots) {
      const terms = [a.mul(r.pow(2)), b.mul(r), c].filter(x => !x.isZero());
      const rendered = terms.map((x, i) => (i === 0 ? fmt(x) : x.isNeg() ? `${MINUS} ${fmt(x.abs())}` : `+ ${fmt(x)}`)).join(' ');
      const sub = substituteDisplay(formatTerms(P), v, r, true);
      if (!evaluate(P, { [v]: r }).isZero()) return null;
      R.checkTitle(`Check ${v} = ${fmt(r)}:`, `Check ${v} equals ${fmt(r)} in the equation.`, `${v} = ${fmt(r)} പരിശോധിക്കാം.`);
      R.check(`${sub} = ${rendered} = 0  \u2713`, 'Substitute and add up; the total is zero.', 'വില നൽകി കൂട്ടുമ്പോൾ ആകെ പൂജ്യം കിട്ടുന്നു.');
    }
  } else {
    const { k, m } = simplifyRadical(D);
    const rad = k === 1 ? `\u221a${D}` : `${k}\u221a${m}`;
    if (k !== 1) R.step(`${v} = (${sg(negB)} \u00b1 ${rad}) / ${sg(twoA)}`, { label: 'Simplify the root', labelMl: ML.root, en: `The square root of ${D} simplifies to ${k} root ${m}.`, ml: `${ML.root}.` });
    const x1 = (negB + Math.sqrt(D)) / twoA; const x2 = (negB - Math.sqrt(D)) / twoA;
    if (Math.abs(A * x1 * x1 + B * x1 + C) > 1e-9 || Math.abs(A * x2 * x2 + B * x2 + C) > 1e-9) return null;
    answerText = `${v} = (${sg(negB)} + ${rad}) / ${sg(twoA)}   or   ${v} = (${sg(negB)} ${MINUS} ${rad}) / ${sg(twoA)}`;
    R.step(answerText, { label: 'Two cases: + and \u2212', labelMl: ML.twoCases, en: 'The two solutions use plus and minus.', ml: `${ML.twoCases}.` });
    R.boxLast();
    R.note(`${v} \u2248 ${x1.toFixed(3)}   or   ${v} \u2248 ${x2.toFixed(3)}`, `As decimals, ${v} is about ${x1.toFixed(3)} or ${x2.toFixed(3)}.`, `${ML.approx}: ${x1.toFixed(3)}, ${x2.toFixed(3)}.`);
  }
  R.answer(`The solution is  ${answerText}`, `The solution is ${answerText.replace(/=/g, 'equals')}.`, `${ML.solutionIs}: ${answerText}.`);
  return { family: 'quadratic', problem: orig, rows: R.rows, answerText, verified: true };
}

/* ---------------- pair of linear equations (elimination) ---------------- */
const lcm = (x: number, y: number) => { const g = (p: number, q: number): number => (q ? g(q, p % q) : Math.abs(p)); return Math.abs(x * y) / g(x, y); };

function planSimultaneous(parts: string[]): TemplateSolution | null {
  const eqs = parts.map(p => { const [l, r] = p.split('='); if (r === undefined || p.split('=').length !== 2) throw new Error('bad'); return { l, r, P: combine([...parseTerms(l), ...negTerms(parseTerms(r))]) }; });
  const vars = [...new Set(eqs.flatMap(e => variablesOf(e.P)))];
  if (vars.length !== 2) return null;
  const [X, Y] = vars;
  const co = eqs.map(e => ({ a: coefficientOf(e.P, X), b: coefficientOf(e.P, Y), c: constantOf(e.P).neg() }));
  if (co.some(k => ![k.a, k.b, k.c].every(x => x.isInt()))) return null;
  const n = co.map(k => ({ a: k.a.n, b: k.b.n, c: k.c.n }));
  const det = n[0].a * n[1].b - n[1].a * n[0].b;
  if (det === 0) return null;

  const R = new Rows();
  const sg = (x: number) => String(x).replace('-', MINUS);
  const disp = (a: number, b: number, c: number) => `${formatTerms([...(a ? varTerm(X, F(a)) : []), ...(b ? varTerm(Y, F(b)) : [])])} = ${sg(c)}`;
  const orig = parts.map(p => pretty(p));
  R.original(orig[0], { label: 'Equation (1)', labelMl: `${ML.start} (1)`, en: `Equation one is ${orig[0]}.`, ml: `ആദ്യ സമവാക്യം: ${orig[0]}.` });
  R.original(orig[1], { label: 'Equation (2)', labelMl: `${ML.start} (2)`, en: `Equation two is ${orig[1]}.`, ml: `രണ്ടാമത്തെ സമവാക്യം: ${orig[1]}.` });

  // choose the variable that needs the smaller multipliers
  const plan = (key: 'a' | 'b') => {
    const p = n[0][key], q = n[1][key];
    if (p === 0 || q === 0) return { L: 0, m1: 1, m2: 1, cost: p === 0 && q === 0 ? Infinity : 0 };
    const L = lcm(p, q);
    return { L, m1: L / Math.abs(p), m2: L / Math.abs(q), cost: L / Math.abs(p) + L / Math.abs(q) };
  };
  const elimY = plan('b'); const elimX = plan('a');
  const eliminateY = elimY.cost <= elimX.cost;
  const key: 'a' | 'b' = eliminateY ? 'b' : 'a';
  const other: 'a' | 'b' = eliminateY ? 'a' : 'b';
  const elimName = eliminateY ? Y : X; const keepName = eliminateY ? X : Y;
  const { m1, m2 } = eliminateY ? elimY : elimX;

  let e1 = { ...n[0] }; let e2 = { ...n[1] };
  const label1 = m1 !== 1 ? '(3)' : '(1)'; const label2 = m2 !== 1 ? (m1 !== 1 ? '(4)' : '(3)') : '(2)';
  if (m1 !== 1) {
    e1 = { a: n[0].a * m1, b: n[0].b * m1, c: n[0].c * m1 };
    R.step(disp(e1.a, e1.b, e1.c), { label: `Multiply (1) by ${m1}  \u2192  (3)`, labelMl: ML.multiplyEq('1', String(m1)), en: `Multiply equation one by ${m1}.`, ml: ML.multiplyEq('1', String(m1)) + '.', mark: true });
  }
  if (m2 !== 1) {
    e2 = { a: n[1].a * m2, b: n[1].b * m2, c: n[1].c * m2 };
    R.step(disp(e2.a, e2.b, e2.c), { label: `Multiply (2) by ${m2}  \u2192  ${m1 !== 1 ? '(4)' : '(3)'}`, labelMl: ML.multiplyEq('2', String(m2)), en: `Multiply equation two by ${m2}.`, ml: ML.multiplyEq('2', String(m2)) + '.', mark: true });
  }
  const subtract = Math.sign(e1[key]) === Math.sign(e2[key]);
  const r = subtract ? { a: e1.a - e2.a, b: e1.b - e2.b, c: e1.c - e2.c } : { a: e1.a + e2.a, b: e1.b + e2.b, c: e1.c + e2.c };
  if (r[other] === 0) return null;
  R.step(disp(r.a, r.b, r.c), {
    label: subtract ? `Subtract ${label2} from ${label1}` : `Add ${label1} and ${label2}`, labelMl: ML.eliminate(elimName, subtract),
    en: `${subtract ? 'Subtract' : 'Add'} the equations to eliminate ${elimName}.`, ml: `${ML.eliminate(elimName, subtract)}.`, mark: true,
  });
  const keepVal = new Fr(r.c, r[other]);
  if (r[other] !== 1) {
    R.step(`${keepName} = ${fmt(keepVal)}`, { label: `Divide both sides by ${sg(r[other])}`, labelMl: ML.divide(sg(r[other])), en: `Divide both sides by ${sg(r[other])} to get ${keepName}.`, ml: `${ML.divide(sg(r[other]))}.`, mark: true });
  }
  R.rows[R.rows.length - 1].label = R.rows[R.rows.length - 1].label ?? 'Therefore';

  // back-substitute into equation (1)
  const src = n[0];
  const substText = substituteDisplay(orig[0], keepName, keepVal);
  R.step(substText, { label: `Substitute ${keepName} = ${dec(keepVal)} in (1)`, labelMl: ML.subIn(`${keepName} = ${dec(keepVal)}`, '1'), en: `Put ${keepName} equals ${dec(keepVal)} into equation one.`, ml: `${ML.subIn(`${keepName} = ${dec(keepVal)}`, '1')}.` });
  const fixed = new Fr(src[other], 1).mul(keepVal);
  const remain = src[key];
  let keepLineText = '';
  if (!fixed.isZero()) {
    keepLineText = `${fmt(fixed)} ${remain < 0 ? MINUS : '+'} ${coefText(F(remain), elimName)} = ${sg(src.c)}`;
    R.step(keepLineText, { label: 'Simplifies to', labelMl: ML.simplifies, en: 'Multiply out.', ml: 'ഗുണിക്കുക.' });
  }
  const rhsAfter = new Fr(src.c, 1).sub(fixed);
  if (!fixed.isZero()) {
    const k = fmt(fixed.abs()); const addIt = fixed.isNeg();
    R.step(`${formatTerms(varTerm(elimName, F(remain)))} = ${fmt(rhsAfter)}`, { label: `${addIt ? 'Add' : 'Subtract'} ${k} ${addIt ? 'to' : 'from'} both sides`, labelMl: addIt ? ML.add(k) : ML.subtract(k), en: `${addIt ? 'Add' : 'Subtract'} ${k} ${addIt ? 'to' : 'from'} both sides.`, ml: `${addIt ? ML.add(k) : ML.subtract(k)}.`, mark: true });
  }
  const elimVal = rhsAfter.div(F(remain));
  const elimText = `${elimName} = ${fmt(elimVal)}`;
  if (remain !== 1) R.step(elimText, { label: `Divide both sides by ${sg(remain)}`, labelMl: ML.divide(sg(remain)), en: `Divide both sides by ${sg(remain)} to get ${elimName}.`, ml: `${ML.divide(sg(remain))}.`, mark: true });
  else if (R.rows[R.rows.length - 1].text !== elimText) R.step(elimText, { label: 'Therefore', labelMl: ML.therefore, en: `So ${elimName} equals ${fmt(elimVal)}.`, ml: `അതിനാൽ ${elimName} = ${fmt(elimVal)}.` });

  const values: Record<string, Fr> = { [keepName]: keepVal, [elimName]: elimVal };
  for (let i = 0; i < 2; i++) {
    const lv = evaluate(parseTerms(eqs[i].l), values);
    const rv = evaluate(parseTerms(eqs[i].r), values);
    if (!lv.eq(rv)) return null;
  }
  const order = [X, Y];
  const answerText = order.map(nm => `${nm} = ${fmt(values[nm])}`).join(',   ');
  R.result(answerText, { label: 'Therefore', labelMl: ML.therefore, en: `So ${order.map(nm => `${nm} equals ${fmt(values[nm])}`).join(' and ')}.`, ml: `അതിനാൽ ${order.map(nm => `${nm} = ${fmt(values[nm])}`).join(', ')}.` });

  R.checkTitle('Check both equations:', 'Now check both equations with these values.', `${ML.check}.`);
  for (let i = 0; i < 2; i++) {
    let text = orig[i]; for (const nm of order) text = substituteDisplay(text, nm, values[nm]);
    const lv = evaluate(parseTerms(eqs[i].l), values); const rv = evaluate(parseTerms(eqs[i].r), values);
    R.check(`(${i + 1})  ${text}  \u2192  ${fmt(lv)} = ${fmt(rv)}  \u2713`, `Equation ${i + 1}: both sides are ${fmt(lv)}.`, `സമവാക്യം ${i + 1}: ഇരുവശവും ${fmt(lv)}.`);
  }
  R.answer(`The solution is  ${answerText}`, `The solution is ${order.map(nm => `${nm} equals ${fmt(values[nm])}`).join(' and ')}.`, `${ML.solutionIs}: ${answerText}.`);
  return { family: 'simultaneous', problem: orig.join('  and  '), rows: R.rows, answerText, verified: true };
}

/* ---------------- expressions: identities, expansion ---------------- */
function spotCheck(exprA: Terms, exprB: Terms, v: string | undefined): { ok: boolean; at?: Fr; a?: Fr; b?: Fr } {
  const pts = [1, 2, -3].map(x => F(x));
  let last: { at: Fr; a: Fr; b: Fr } | undefined;
  for (const p of pts) {
    const values = v ? { [v]: p } : {};
    const a = evaluate(exprA, values); const b = evaluate(exprB, values);
    if (!a.eq(b)) return { ok: false };
    last ??= { at: p, a, b };
  }
  return { ok: true, ...last };
}

function planExpression(expr: string): TemplateSolution | null {
  const n = normalizeMathText(expr);
  const R = new Rows();
  const orig = pretty(n);
  const src = parseTerms(n);
  const vars = variablesOf(src);
  const v = vars[0];
  if (vars.length > 1) return null;
  const finalTerms = combine(src);
  const finalText = formatTerms(finalTerms);

  // (P + Q)^2  ->  (a + b)^2 = a^2 + 2ab + b^2
  const sq = /^\((.+)\)\s*\^\s*2$/.exec(n);
  if (sq) {
    const inner = parseTerms(sq[1]);
    if (inner.length !== 2) return null;
    const [A, B] = inner;
    const minusForm = B.c.isNeg();
    const aTxt = formatTerms([A]); const bTxt = formatTerms([{ c: B.c.abs(), v: B.v }]);
    const sgn = minusForm ? MINUS : '+';
    R.original(orig, { label: 'Expression', labelMl: ML.start, en: `We need to expand ${orig}.`, ml: `വികസിപ്പിക്കേണ്ട പദം: ${orig}.` });
    R.step(`(a ${sgn} b)\u00b2 = a\u00b2 ${sgn} 2ab + b\u00b2`, { label: 'Use the identity', labelMl: ML.identity, en: `Use the identity: a ${minusForm ? 'minus' : 'plus'} b, all squared, equals a squared ${minusForm ? 'minus' : 'plus'} 2 a b plus b squared.`, ml: `${ML.identity}.` });
    R.step(`a = ${aTxt},   b = ${bTxt}`, { label: 'Identify a and b', labelMl: ML.useAB, en: `Here a is ${aTxt} and b is ${bTxt}.`, ml: `${ML.useAB}: a = ${aTxt}, b = ${bTxt}.` });
    const wrap = (t: string) => (/^([A-Za-z]|\d+)$/.test(t) ? t : `(${t})`);
    const withSq = (t: string) => `${wrap(t)}\u00b2`;
    R.step(`${withSq(aTxt)} ${sgn} 2(${aTxt})(${bTxt}) + ${withSq(bTxt)}`, { label: 'Substitute a and b', labelMl: ML.substitute, en: 'Substitute a and b into the identity.', ml: 'a, b എന്നിവ സർവ്വസമവാക്യത്തിൽ നൽകുക.' });
    R.step(finalText, { label: 'Simplifies to', labelMl: ML.simplifies, en: 'Simplify each part.', ml: 'ഓരോ ഭാഗവും ലഘൂകരിക്കുക.' });
    R.boxLast();
    return finishExpression(R, 'identity', orig, n, finalTerms, finalText, v);
  }

  // (P + Q)(P - Q) [+ rest]  ->  P^2 - Q^2
  const conj = /^\(([^()]+)\)\s*\(([^()]+)\)(.*)$/.exec(n);
  if (conj) {
    const f1 = parseTerms(conj[1]); const f2 = parseTerms(conj[2]);
    const isConj = f1.length === 2 && f2.length === 2 && f1[0].c.eq(f2[0].c) && JSON.stringify(f1[0].v) === JSON.stringify(f2[0].v)
      && JSON.stringify(f1[1].v) === JSON.stringify(f2[1].v) && f1[1].c.eq(f2[1].c.neg());
    if (isConj) {
      const A = f1[0]; const B = { c: f1[1].c.abs(), v: f1[1].v };
      const aTxt = formatTerms([A]); const bTxt = formatTerms([B]);
      const rest = conj[3].trim();
      R.original(orig, { label: 'Expression', labelMl: ML.start, en: `We need to simplify ${orig}.`, ml: `ലഘൂകരിക്കേണ്ട പദം: ${orig}.` });
      R.step('(a + b)(a \u2212 b) = a\u00b2 \u2212 b\u00b2', { label: 'Use the identity', labelMl: ML.identity, en: 'Use the identity: a plus b times a minus b equals a squared minus b squared.', ml: `${ML.identity}.` });
      R.step(`a = ${aTxt},   b = ${bTxt}`, { label: 'Identify a and b', labelMl: ML.useAB, en: `Here a is ${aTxt} and b is ${bTxt}.`, ml: `${ML.useAB}: a = ${aTxt}, b = ${bTxt}.` });
      const restText = rest ? ` ${pretty(rest).replace(/^([+\u2212])\s*/, '$1 ')}` : '';
      const wrap = (t: string) => (/^([A-Za-z]|\d+)$/.test(t) ? t : `(${t})`);
      R.step(`${wrap(aTxt)}\u00b2 ${MINUS} ${wrap(bTxt)}\u00b2${restText}`, { label: 'Substitute a and b', labelMl: ML.substitute, en: 'Substitute a and b into the identity.', ml: 'a, b എന്നിവ സർവ്വസമവാക്യത്തിൽ നൽകുക.' });
      const evaluated = combine([...mulTermsSafe(A, A), ...negTerms(mulTermsSafe(B, B)), ...(rest ? parseTerms(rest) : [])]);
      const unsorted = `${formatTerms(combine(mulTermsSafe(A, A)))} ${MINUS} ${formatTerms(combine(mulTermsSafe(B, B)))}${restText}`;
      if (unsorted !== R.rows[R.rows.length - 1].text) R.step(unsorted, { label: 'Simplifies to', labelMl: ML.simplifies, en: 'Work out the squares.', ml: 'വർഗങ്ങൾ കണക്കാക്കുക.' });
      const std = formatTerms(evaluated);
      if (std !== unsorted) R.step(std, { label: 'Write in standard form', labelMl: ML.standardForm, en: 'Write the terms in order, highest power first.', ml: `${ML.standardForm}.` });
      R.boxLast();
      return finishExpression(R, 'identity', orig, n, finalTerms, finalText, v);
    }
  }

  // general expansion / simplification
  if (!v && !/[()]/.test(n)) return null;
  R.original(orig, { label: 'Expression', labelMl: ML.start, en: `We need to simplify ${orig}.`, ml: `ലഘൂകരിക്കേണ്ട പദം: ${orig}.` });
  const rawText = formatTerms(src);
  let prev = orig;
  if (/[()]/.test(n) && rawText !== prev) { R.step(rawText, { label: 'Expand the brackets', labelMl: ML.expand, en: 'Multiply out the brackets.', ml: 'ബ്രാക്കറ്റുകൾ വിപുലീകരിക്കുക.' }); prev = rawText; }
  if (finalText !== prev) { R.step(finalText, { label: 'Combine like terms', labelMl: ML.combine, en: 'Combine the like terms.', ml: 'സമാന പദങ്ങൾ ചേർക്കുക.' }); prev = finalText; }
  if (R.rows.length < 2) return null;
  R.boxLast();
  return finishExpression(R, 'expression', orig, n, finalTerms, finalText, v);
}

function mulTermsSafe(a: { c: Fr; v: Record<string, number> }, b: { c: Fr; v: Record<string, number> }): Terms {
  const v: Record<string, number> = { ...a.v };
  for (const [k, e] of Object.entries(b.v)) v[k] = (v[k] || 0) + e;
  return [{ c: a.c.mul(b.c), v }];
}

function finishExpression(R: Rows, family: SolutionFamily, orig: string, n: string, finalTerms: Terms, finalText: string, v: string | undefined): TemplateSolution | null {
  const original = parseTerms(n);
  const chk = spotCheck(original, finalTerms, v);
  if (!chk.ok) return null;
  const at = chk.at!;
  const sub = v ? substituteDisplay(orig, v, at) : orig;
  const subFinal = v ? substituteDisplay(finalText, v, at) : finalText;
  R.checkTitle(v ? `Check with ${v} = ${fmt(at)}:` : 'Check:', v ? `Check by putting ${v} equals ${fmt(at)} into both forms.` : 'Check the value.', `${ML.check}.`);
  R.check(`${sub} = ${fmt(chk.a!)}    and    ${subFinal} = ${fmt(chk.b!)}  \u2713`, `Both forms give ${fmt(chk.a!)}, so they are equal.`, `രണ്ട് രൂപങ്ങളും ${fmt(chk.a!)} തരുന്നു; അവ തുല്യമാണ്.`);
  R.answer(`The answer is  ${finalText}`, `The simplified form is ${finalText}.`, `ലഘൂകരിച്ച രൂപം: ${finalText}.`);
  return { family, problem: orig, rows: R.rows, answerText: finalText, verified: true };
}

/* ---------------- integer arithmetic chain ---------------- */
function planArithmetic(expr: string): TemplateSolution | null {
  const n = normalizeMathText(expr).replace(/\s+/g, '');
  if (!/^[+-]?\(?[+-]?\d+\)?([+-]\(?[+-]?\d+\)?)*$/.test(n)) return null;
  const tokens = [...n.matchAll(/([+-]?)(\(?)([+-]?)(\d+)\)?/g)];
  const nums: number[] = tokens.map((m, i) => {
    const outer = m[1] === '-' ? -1 : 1;
    const inner = m[3] === '-' ? -1 : 1;
    void i;
    return outer * inner * Number(m[4]);
  });
  if (nums.length < 3) return null;
  const R = new Rows();
  const orig = pretty(expr);
  const hasBrackets = /\(/.test(n);
  R.original(orig, { label: 'Expression', labelMl: ML.start, en: `We need to calculate ${orig}.`, ml: `കണക്കാക്കേണ്ടത്: ${orig}.` });
  const sg = (x: number) => String(x).replace('-', MINUS);
  const join = (xs: number[]) => xs.map((x, i) => (i === 0 ? sg(x) : x < 0 ? `${MINUS} ${Math.abs(x)}` : `+ ${x}`)).join(' ');
  let seq = nums.slice();
  if (hasBrackets) R.step(join(seq), { label: 'Remove the brackets: \u2212(\u2212a) = +a', labelMl: ML.signs, en: 'Remove the brackets and fix the signs: minus a negative becomes plus.', ml: `${ML.signs}.` });
  while (seq.length > 1) {
    const s = seq[0] + seq[1];
    const label = `${sg(seq[0])} ${seq[1] < 0 ? MINUS : '+'} ${Math.abs(seq[1])} = ${sg(s)}`;
    seq = [s, ...seq.slice(2)];
    R.step(join(seq), { label, labelMl: label, en: `Add from left to right: ${label}.`, ml: `${ML.leftToRight}: ${label}.` });
  }
  R.boxLast('Answer', 'ഉത്തരം');
  const total = nums.reduce((a, b) => a + b, 0);
  if (seq[0] !== total) return null;
  R.checkTitle('Check:', 'Check the result.', `${ML.check}.`);
  R.checkOk(`${orig} = ${sg(total)}  \u2713`, `The whole expression equals ${sg(total)}.`, `പദത്തിന്റെ വില ${sg(total)}.`);
  R.answer(`The answer is  ${sg(total)}`, `The answer is ${sg(total)}.`, `${ML.solutionIs}: ${sg(total)}.`);
  return { family: 'arithmetic', problem: orig, rows: R.rows, answerText: sg(total), verified: true };
}

/* ---------------- surds ---------------- */
function planSurds(expr: string): TemplateSolution | null {
  const n = normalizeMathText(expr).replace(/\s+/g, '');
  if (!/sqrt\(\d+\)/.test(n)) return null;
  const terms = [...n.matchAll(/([+-]?)(\d*)sqrt\((\d+)\)/g)];
  if (terms.map(t => t[0]).join('') !== n) return null;
  const items = terms.map(t => {
    const sign = t[1] === '-' ? -1 : 1; const k = t[2] ? Number(t[2]) : 1; const radicand = Number(t[3]);
    const { k: s, m } = simplifyRadical(radicand);
    return { sign, k, radicand, s, m };
  });
  const R = new Rows();
  const orig = pretty(expr);
  const lead = (i: number, sign: number) => (i === 0 ? (sign < 0 ? MINUS : '') : sign < 0 ? ` ${MINUS} ` : ' + ');
  const join = (f: (it: typeof items[number]) => string) => items.map((it, i) => `${lead(i, it.sign)}${f(it)}`).join('');
  R.original(orig, { label: 'Expression', labelMl: ML.start, en: `We need to simplify ${orig}.`, ml: `ലഘൂകരിക്കേണ്ട പദം: ${orig}.` });
  if (items.some(it => it.s > 1)) {
    const split = join(it => `${it.k === 1 ? '' : it.k}\u221a(${it.s * it.s}\u00d7${it.m})`);
    R.step(split, { label: 'Use a perfect square factor', labelMl: ML.perfectSquares, en: 'Write each number under the root as a perfect square times another number.', ml: `${ML.perfectSquares}.` });
  }
  const out = join(it => `${it.k * it.s === 1 ? '' : it.k * it.s}\u221a${it.m}`);
  R.step(out, { label: 'Take the square roots out', labelMl: ML.takeOut, en: 'Take the square root of each perfect square outside the root.', ml: `${ML.takeOut}.` });
  const groups = new Map<number, number>();
  for (const it of items) groups.set(it.m, (groups.get(it.m) || 0) + it.sign * it.k * it.s);
  const same = groups.size === 1;
  if (same) {
    const m = [...groups.keys()][0];
    const coefText = items.map((it, i) => `${i === 0 ? (it.sign < 0 ? MINUS : '') : it.sign < 0 ? ` ${MINUS} ` : ' + '}${it.k * it.s}`).join('');
    R.step(`(${coefText})\u221a${m}`, { label: 'Combine like surds', labelMl: ML.likeSurds, en: 'All the roots are the same, so add the numbers in front.', ml: `${ML.likeSurds}.` });
  }
  const finalParts = [...groups.entries()].filter(([, c]) => c !== 0).map(([m, c], i) => `${i === 0 ? (c < 0 ? MINUS : '') : c < 0 ? ` ${MINUS} ` : ' + '}${Math.abs(c) === 1 ? '' : Math.abs(c)}${m === 1 ? '' : `\u221a${m}`}`);
  const finalText = finalParts.join('') || '0';
  if (!same || R.rows[R.rows.length - 1].text !== finalText) R.step(finalText, { label: 'Simplifies to', labelMl: ML.simplifies, en: 'Add the numbers in front of the like roots.', ml: 'സമാന മൂലങ്ങളുടെ മുന്നിലെ സംഖ്യകൾ കൂട്ടുക.' });
  R.boxLast();
  const orig_v = items.reduce((s, it) => s + it.sign * it.k * Math.sqrt(it.radicand), 0);
  const fin_v = [...groups.entries()].reduce((s, [m, c]) => s + c * Math.sqrt(m), 0);
  if (Math.abs(orig_v - fin_v) > 1e-9) return null;
  R.checkTitle('Check with decimals:', 'Check with decimal values.', `${ML.check}.`);
  R.check(`${orig} \u2248 ${orig_v.toFixed(3)}    and    ${finalText} \u2248 ${fin_v.toFixed(3)}  \u2713`, `Both are about ${orig_v.toFixed(3)}, so they agree.`, `രണ്ടും ഏകദേശം ${orig_v.toFixed(3)}.`);
  R.answer(`The answer is  ${finalText}`, `The answer is ${finalText}.`, `${ML.solutionIs}: ${finalText}.`);
  return { family: 'surd', problem: orig, rows: R.rows, answerText: finalText, verified: true };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                          */
/* ------------------------------------------------------------------ */
export function planTemplateSolution(question: string): TemplateSolution | null {
  try {
    const parts = extractExpressions(question);
    if (!parts) return null;
    if (parts.length === 2 && parts.every(p => p.includes('='))) return planSimultaneous(parts);
    if (parts.length !== 1) return null;
    const e = parts[0];
    const eq = e.split('=');
    if (eq.length === 2) {
      const L = parseTerms(eq[0]); const Rt = parseTerms(eq[1]);
      const vars = variablesOf([...L, ...Rt]);
      if (vars.length !== 1) return null;
      const deg = Math.max(degreeIn(L, vars[0]), degreeIn(Rt, vars[0]));
      if (deg === 1) return planLinear(eq[0], eq[1], vars[0]);
      if (deg === 2 && /quadratic|formula/i.test(question)) return planQuadratic(eq[0], eq[1], vars[0]);
      return null;
    }
    if (eq.length > 2) return null;
    if (/sqrt|\u221a/.test(e)) return planSurds(e);
    const arithmetic = planArithmetic(e);
    if (arithmetic) return arithmetic;
    return planExpression(e);
  } catch {
    return null;
  }
}


/** Build a safe teaching sequence from equations already printed in a textbook passage.
 * This is for concept/derivation passages such as "forming equations" where the page
 * contains a chain of equivalent equations but is not a single "solve X" request.
 * It deliberately does not invent algebraic operations; it preserves the textbook
 * equations in order and labels the transitions as rewrites. Mathematical verification
 * remains false unless a dedicated solver produced the sequence.
 */
export function planEquationSequence(equations: string[]): TemplateSolution | null {
  const clean = equations.map(e => normalizeMathText(String(e || '').trim()))
    .filter(e => e && e.includes('='))
    .filter((e, i, a) => a.findIndex(x => x.replace(/\s+/g, '') === e.replace(/\s+/g, '')) === i)
    .slice(0, 8);
  if (clean.length < 2) return null;
  const R = new Rows();
  R.original(clean[0], {
    label: 'Starting equation',
    labelMl: 'ആരംഭ സമവാക്യം',
    en: `Start with ${clean[0]}.`,
    ml: `${clean[0]} ൽ നിന്ന് ആരംഭിക്കാം.`,
  });
  for (let i = 1; i < clean.length; i++) {
    R.step(clean[i], {
      label: `Rewrite ${i + 1}`,
      labelMl: `ഘട്ടം ${i + 1}`,
      en: `Rewrite the equation as shown in the textbook.`,
      ml: 'പാഠപുസ്തകത്തിൽ കാണിച്ചിരിക്കുന്ന അടുത്ത തുല്യരൂപത്തിലേക്ക് എഴുതാം.',
      mark: true,
    });
  }
  R.answer(`Equation sequence complete`, 'This is the equation sequence used in the textbook explanation.', 'പാഠപുസ്തകത്തിലെ സമവാക്യ രൂപീകരണ ഘട്ടങ്ങൾ പൂർത്തിയായി.');
  return { family: 'linear', problem: clean[0], rows: R.rows, answerText: clean[clean.length - 1], verified: false };
}

/** One board/voice step per row, in the shape the classroom's teaching loop already understands. */
export function stepsFromSolution(solution: TemplateSolution): MathTeachingStep[] {
  let prev = '';
  return solution.rows.map((row) => {
    const step: MathTeachingStep = {
      id: `tpl-${row.id}`, before: prev, operation: row.label ?? '', after: row.text,
      captionEnglish: row.captionEn, captionMalayalam: row.captionMl, visualIds: [], verified: solution.verified, source: 'mathjs',
    };
    if (row.kind !== 'check-title' && row.kind !== 'note') prev = row.text;
    return step;
  });
}
