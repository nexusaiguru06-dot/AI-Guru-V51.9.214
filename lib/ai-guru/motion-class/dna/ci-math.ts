/**
 * V51.9.58 — chapter introduction: the numbers behind the small worked examples, and the checks.
 * The planner chooses topics and numbers; every line written on the board is computed here.
 */

import type { ChapterIntroPlan, IntroExample } from './types';

export const CI_MIN_TOPICS = 2;
export const CI_MAX_TOPICS = 6;
export const CI_MAX_FORMULAS = 8;
/** Maths symbols only: the formulas drift in the background and are identical in both languages. */
export const CI_FORMULA_RE = /^[0-9a-zA-Z+\-−×÷=()<>²³.,/ ]{1,26}$/;

const int = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const coef = (a: number, v: string) => (a === 1 ? v : a === -1 ? `−${v}` : `${a}${v}`);
const sign = (n: number) => (n < 0 ? '−' : '+');

export interface SolveFacts {
  letter: string;
  x: number;
  /** "2x − 10 = 100" */
  first: string;
  /** "2x = 110" (null when b is 0: nothing to move) */
  moved: string | null;
  /** "x = 55" */
  answer: string;
  /** "2 × 55 − 10 = 100" */
  check: string;
}

export function solveFacts(e: { a: number; b: number; c: number; letter?: string }): SolveFacts | null {
  const { a, b, c } = e;
  const letter = e.letter && /^[a-z]$/.test(e.letter) ? e.letter : 'x';
  if (![a, b, c].every(int) || a < 1 || a > 9 || Math.abs(b) > 99 || c < 1 || c > 999) return null;
  if ((c - b) % a !== 0) return null;
  const x = (c - b) / a;
  if (x < 1 || x > 100) return null;
  const bPart = b === 0 ? '' : ` ${sign(b)} ${Math.abs(b)}`;
  return {
    letter,
    x,
    first: `${coef(a, letter)}${bPart} = ${c}`,
    moved: b === 0 ? null : `${coef(a, letter)} = ${c - b}`,
    answer: `${letter} = ${x}`,
    check: `${a === 1 ? '' : `${a} × `}${x}${bPart} = ${c}`,
  };
}

export interface PairFacts {
  x: number;
  y: number;
  l1: string;
  l2: string;
  answer: string;
  check: string;
}

const pairLine = (e: { a: number; b: number; c: number }) =>
  `${coef(e.a, 'x')} ${sign(e.b)} ${coef(Math.abs(e.b), 'y')} = ${e.c}`;

export function pairFacts(e1: { a: number; b: number; c: number }, e2: { a: number; b: number; c: number }): PairFacts | null {
  const all = [e1.a, e1.b, e1.c, e2.a, e2.b, e2.c];
  if (!all.every(int)) return null;
  if ([e1, e2].some((e) => e.a < 1 || e.a > 9 || e.b === 0 || Math.abs(e.b) > 9 || e.c < 1 || e.c > 9999)) return null;
  const det = e1.a * e2.b - e2.a * e1.b;
  if (det === 0) return null;
  const nx = e1.c * e2.b - e2.c * e1.b;
  const ny = e1.a * e2.c - e2.a * e1.c;
  if (nx % det !== 0 || ny % det !== 0) return null;
  const x = nx / det;
  const y = ny / det;
  if (x < 1 || y < 1 || x > 999 || y > 999) return null;
  return {
    x,
    y,
    l1: pairLine(e1),
    l2: pairLine(e2),
    answer: `x = ${x},  y = ${y}`,
    check: `${e1.a === 1 ? '' : `${e1.a} × `}${x} ${sign(e1.b)} ${Math.abs(e1.b) === 1 ? '' : `${Math.abs(e1.b)} × `}${y} = ${e1.c}`,
  };
}

export function exampleProblem(ex: IntroExample, path: string): string | null {
  if (ex.kind === 'solve') return solveFacts(ex) ? null : `${path}: a x + b = c needs whole numbers with a whole answer from 1 to 100 (a 1–9, |b| ≤ 99, c 1–999).`;
  if (ex.kind === 'pair') return pairFacts(ex.e1, ex.e2) ? null : `${path}: the two equations need a whole-number solution (x and y from 1 to 999; a 1–9, b non-zero |b| ≤ 9, c 1–9999).`;
  return `${path}: unknown example kind.`;
}

export function introProblems(plan: ChapterIntroPlan, path = 'teach'): string[] {
  const errs: string[] = [];
  if (!plan?.title?.en?.trim()) errs.push(`${path}.title is missing.`);
  if (!plan?.welcome?.en?.trim()) errs.push(`${path}.welcome is missing.`);
  if (!plan?.closing?.en?.trim()) errs.push(`${path}.closing is missing.`);
  const topics = plan?.topics ?? [];
  if (topics.length < CI_MIN_TOPICS || topics.length > CI_MAX_TOPICS) errs.push(`${path}.topics needs ${CI_MIN_TOPICS} to ${CI_MAX_TOPICS} topics (found ${topics.length}).`);
  topics.forEach((t, i) => {
    if (!t.name?.en?.trim()) errs.push(`${path}.topics[${i}].name is missing.`);
    else if (t.name.en.length > 40) errs.push(`${path}.topics[${i}].name is too long for the board (40 characters at most).`);
    if (!t.say?.en?.trim()) errs.push(`${path}.topics[${i}].say is missing.`);
    if (t.example) {
      const p = exampleProblem(t.example, `${path}.topics[${i}].example`);
      if (p) errs.push(p);
    }
  });
  const fs = plan?.formulas ?? [];
  if (fs.length > CI_MAX_FORMULAS) errs.push(`${path}.formulas has more than ${CI_MAX_FORMULAS}.`);
  fs.forEach((f, i) => {
    if (!CI_FORMULA_RE.test(f)) errs.push(`${path}.formulas[${i}] ("${f}") must be maths symbols only, at most 26 characters.`);
  });
  return errs;
}
