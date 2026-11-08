/**
 * Maths and geometry for the matrix multiplication and transpose DNA (V51.9.37): the orders, the
 * product entry by entry (row of A times column of B), the transpose, and where every bracket,
 * entry and box sits. Every number written and every box drawn comes from here.
 */

import type { MatrixOpsKind, MatrixOpsPlan } from './types';

export type Pt = [number, number];
export type RoleM = 'a' | 'b' | 'c' | 'carry' | 'result' | 'ink';
export type Line = [string, RoleM];
export type Mat = number[][];

export const MO_KINDS: MatrixOpsKind[] = ['multiply', 'transpose'];
export const MO_OPS: Record<MatrixOpsKind, string[]> = {
  multiply: ['show', 'check', 'entry', 'all'],
  transpose: ['show', 'rows', 'entry', 'size'],
};
export const DIM_MUL = 3;
export const DIM_T = 4;
export const ENTRY_ABS = 9;
export const RESULT_ABS = 99;
export const ROW_COLORS: RoleM[] = ['a', 'b', 'c', 'carry'];

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const neg = (n: number): string => (n < 0 ? `−${-n}` : String(n));
/** A number as a factor: negatives in brackets. */
const fac = (n: number): string => (n < 0 ? `(−${-n})` : String(n));

export const multiply = (a: Mat, b: Mat): Mat => a.map((row) => b[0].map((_, j) => row.reduce((s, x, k) => s + x * b[k][j], 0)));
export const transpose = (a: Mat): Mat => a[0].map((_, j) => a.map((row) => row[j]));
export const cEntry = (a: Mat, b: Mat, i: number, j: number): number => a[i].reduce((s, x, k) => s + x * b[k][j], 0);

function matProblem(m: unknown, path: string, max: number): string | null {
  if (!Array.isArray(m) || !m.length || m.length > max) return `${path} must have 1 to ${max} rows.`;
  const w = Array.isArray(m[0]) ? m[0].length : 0;
  if (w < 1 || w > max) return `${path} must have 1 to ${max} columns.`;
  for (let i = 0; i < m.length; i++) {
    if (!Array.isArray(m[i]) || m[i].length !== w) return `${path}: every row must have the same number of entries (${w}).`;
    for (const x of m[i]) if (!isInt(x) || Math.abs(x) > ENTRY_ABS) return `${path}: entries must be whole numbers from −${ENTRY_ABS} to ${ENTRY_ABS}.`;
  }
  return null;
}

export function moProblem(plan: MatrixOpsPlan, path: string): string | null {
  if (!MO_KINDS.includes(plan?.kind)) return `${path}.kind must be one of ${MO_KINDS.join(', ')}.`;
  if (plan.kind === 'transpose') return matProblem(plan.a, `${path}.a`, DIM_T);
  const e = matProblem(plan.a, `${path}.a`, DIM_MUL) ?? matProblem(plan.b, `${path}.b`, DIM_MUL);
  if (e) return e;
  const a = plan.a;
  const b = plan.b!;
  if (a[0].length !== b.length) return `${path}: A has ${a[0].length} columns but B has ${b.length} rows; they must be equal to multiply.`;
  const c = multiply(a, b);
  if (c.some((r) => r.some((x) => Math.abs(x) > RESULT_ABS))) return `${path}: an entry of the product is beyond ±${RESULT_ABS}; use smaller numbers.`;
  return null;
}

/* ---------------- the lines written on the board ---------------- */

export function checkLines(plan: MatrixOpsPlan): Line[] {
  const m = plan.a.length;
  const n = plan.a[0].length;
  const p = plan.b![0].length;
  return [[`A : ${m} × ${n}`, 'a'], [`B : ${n} × ${p}`, 'b'], [`${n} = ${n}`, 'carry'], [`AB : ${m} × ${p}`, 'result']];
}
export function termsLines(plan: MatrixOpsPlan, i: number, j: number): Line[] {
  const a = plan.a;
  const b = plan.b!;
  const terms = a[i].map((x, k) => `${fac(x)} × ${fac(b[k][j])}`).join(' + ');
  return [[terms, 'ink'], [`= ${neg(cEntry(a, b, i, j))}`, 'result']];
}
export function sizeLines(plan: MatrixOpsPlan): Line[] {
  const r = plan.a.length;
  const c = plan.a[0].length;
  return [[`A : ${r} × ${c}`, 'a'], [`A^T : ${c} × ${r}`, 'result']];
}
export function moveLines(i: number, j: number): Line[] {
  return [[`(${i + 1}, ${j + 1}) → (${j + 1}, ${i + 1})`, 'carry']];
}
export const entryText = neg;

/* ---------------- geometry ---------------- */

export const CW = 32;
export const CH = 32;
export const BR = 8;
export const OPW = 22;
export const CY = 240;

export interface MatBox { x: number; top: number; w: number; h: number; rows: number; cols: number }
export const boxW = (cols: number): number => cols * CW + 2 * BR;
export const boxH = (rows: number): number => rows * CH + 12;
export const cell = (b: MatBox, i: number, j: number): Pt => [b.x + BR + (j + 0.5) * CW, b.top + 6 + (i + 0.5) * CH];
const place = (x: number, rows: number, cols: number): MatBox => ({ x, rows, cols, w: boxW(cols), h: boxH(rows), top: CY - boxH(rows) / 2 });

export interface MoGeom {
  A: MatBox;
  /** multiply: B and the product; transpose: the transposed matrix. */
  B: MatBox;
  C?: MatBox;
  /** x of the symbols (×, =) or the labels. */
  marks: number[];
}
export function moGeometry(plan: MatrixOpsPlan): MoGeom {
  const a = plan.a;
  if (plan.kind === 'transpose') {
    const LA = 40;
    const LB = 52;
    const GAP = 26;
    const wA = boxW(a[0].length);
    const wT = boxW(a.length);
    const total = LA + wA + GAP + LB + wT;
    const x0 = 220 - total / 2;
    const A = place(x0 + LA, a.length, a[0].length);
    const B = place(x0 + LA + wA + GAP + LB, a[0].length, a.length);
    return { A, B, marks: [x0 + LA / 2, x0 + LA + wA + GAP / 2, x0 + LA + wA + GAP + LB / 2] };
  }
  const b = plan.b!;
  const wA = boxW(a[0].length);
  const wB = boxW(b[0].length);
  const wC = boxW(b[0].length);
  const total = wA + OPW + wB + OPW + wC;
  const x0 = 220 - total / 2;
  const A = place(x0, a.length, a[0].length);
  const B = place(x0 + wA + OPW, b.length, b[0].length);
  const C = place(x0 + wA + OPW + wB + OPW, a.length, b[0].length);
  return { A, B, C, marks: [x0 + wA + OPW / 2, x0 + wA + OPW + wB + OPW / 2] };
}
