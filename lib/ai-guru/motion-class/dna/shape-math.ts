/**
 * The numbers and words behind the shape-formula DNA (V51.9.25). Pure functions, shared by the
 * builder (what is written on the board) and the validator (what a plan may ask for), so the board
 * can never show a side or a formula the maths does not support.
 *
 * The planner chooses the shape and, optionally, whole-number sizes. The app writes every label,
 * every formula and every worked line. Square roots are exact: √13 stays √13, √50 becomes 5√2.
 */

import type { Bi, ShapeKind } from './types';

export type FormulaKind = 'area' | 'perimeter' | 'circumference' | 'pythagoras' | 'ratio';

export const SHAPE_KINDS: ShapeKind[] = ['circle', 'rectangle', 'square', 'triangle', 'right-triangle', 'special-30-60-90', 'special-45-45-90'];

/** Which formulas the app knows for each shape. */
export const FORMULAS_OK: Record<ShapeKind, FormulaKind[]> = {
  circle: ['area', 'circumference'],
  rectangle: ['area', 'perimeter'],
  square: ['area', 'perimeter'],
  triangle: ['area'],
  'right-triangle': ['pythagoras', 'area'],
  'special-30-60-90': ['ratio'],
  'special-45-45-90': ['ratio'],
};

/** Shapes that need two sizes when numbers are given. */
export const needsB = (k: ShapeKind) => k === 'rectangle' || k === 'triangle' || k === 'right-triangle';
export const isSpecial = (k: ShapeKind) => k === 'special-30-60-90' || k === 'special-45-45-90';

/** Names written under a figure, in both languages. The Malayalam is a draft for a teacher to check. */
export const SHAPE_WORDS: Record<ShapeKind, Bi> = {
  circle: { en: 'Circle', ml: 'വൃത്തം' },
  rectangle: { en: 'Rectangle', ml: 'ദീർഘചതുരം' },
  square: { en: 'Square', ml: 'സമചതുരം' },
  triangle: { en: 'Triangle', ml: 'ത്രികോണം' },
  'right-triangle': { en: 'Right Triangle', ml: 'മട്ടത്രികോണം' },
  'special-30-60-90': { en: 'Special Right Triangle', ml: 'പ്രത്യേക മട്ടത്രികോണം' },
  'special-45-45-90': { en: 'Special Right Triangle', ml: 'പ്രത്യേക മട്ടത്രികോണം' },
};

const num = (v: number) => String(+v.toFixed(2)).replace('-', '−');

/** √n in simplest exact form as board text: 25 → "5", 13 → "√13", 50 → "5√2", 12 → "2√3". */
export function sqrtText(n: number): string {
  if (!Number.isInteger(n) || n < 0) return `√{${num(n)}}`;
  let k = 1;
  let m = n;
  for (let f = Math.floor(Math.sqrt(n)); f >= 2; f--) {
    if (m % (f * f) === 0) {
      k = f;
      m /= f * f;
      break;
    }
  }
  if (m === 1) return String(k);
  return `${k > 1 ? k : ''}√${m}`;
}

export interface SideLabels {
  /** Text of each named side; keys depend on the shape (see below). */
  r?: string;
  l?: string;
  w?: string;
  s?: string;
  /** Triangle base and height. */
  base?: string;
  h?: string;
  /** Right triangle: vertical leg, horizontal leg, hypotenuse. */
  va?: string;
  hb?: string;
  hyp?: string;
}

/** Labels for a shape: letters when no sizes are given, the actual numbers when they are. */
export function sideLabels(kind: ShapeKind, a?: number, b?: number): SideLabels {
  const has = a !== undefined;
  switch (kind) {
    case 'circle':
      return { r: has ? num(a!) : 'r' };
    case 'rectangle':
      return { l: has ? num(a!) : 'l', w: has && b !== undefined ? num(b) : 'w' };
    case 'square':
      return { s: has ? num(a!) : 's' };
    case 'triangle':
      return { base: has ? num(a!) : 'b', h: has && b !== undefined ? num(b) : 'h' };
    case 'right-triangle':
      return has && b !== undefined
        ? { va: num(a!), hb: num(b), hyp: sqrtText(a! * a! + b * b) }
        : { va: 'a', hb: 'b', hyp: 'c' };
    case 'special-30-60-90':
      return has ? { va: num(a!), hb: `${num(a!)}√3`, hyp: num(2 * a!) } : { va: 'a', hb: 'a√3', hyp: '2a' };
    case 'special-45-45-90':
      return has ? { va: num(a!), hb: num(a!), hyp: `${num(a!)}√2` } : { va: 'a', hb: 'a', hyp: 'a√2' };
  }
}

/** Lines written for a formula. The first line is the general rule; later lines are the worked numbers. */
export function formulaLines(kind: ShapeKind, what: FormulaKind, a?: number, b?: number): string[] {
  const has = a !== undefined;
  const A = a ?? 0;
  const B = b ?? 0;
  switch (kind) {
    case 'circle':
      if (what === 'area') return has ? ['A = πr²', `A = π(${num(A)})² = ${num(A * A)}π`] : ['A = πr²'];
      return has ? ['C = 2πr', `C = 2π(${num(A)}) = ${num(2 * A)}π`] : ['C = 2πr'];
    case 'rectangle':
      if (what === 'area') return has ? ['A = lw', `A = ${num(A)} × ${num(B)} = ${num(A * B)}`] : ['A = lw'];
      return has ? ['P = 2(l + w)', `P = 2(${num(A)} + ${num(B)}) = ${num(2 * (A + B))}`] : ['P = 2(l + w)'];
    case 'square':
      if (what === 'area') return has ? ['A = s²', `A = ${num(A)}² = ${num(A * A)}`] : ['A = s²'];
      return has ? ['P = 4s', `P = 4 × ${num(A)} = ${num(4 * A)}`] : ['P = 4s'];
    case 'triangle':
      return has ? ['A = ½bh', `A = ½ × ${num(A)} × ${num(B)} = ${num((A * B) / 2)}`] : ['A = ½bh'];
    case 'right-triangle':
      if (what === 'area') return has ? ['A = ½ab', `A = ½ × ${num(A)} × ${num(B)} = ${num((A * B) / 2)}`] : ['A = ½ab'];
      return has ? ['a² + b² = c²', `${num(A)}² + ${num(B)}² = ${num(A * A + B * B)}`, `c = ${sqrtText(A * A + B * B)}`] : ['a² + b² = c²'];
    case 'special-30-60-90':
      return has ? ['a : a√3 : 2a', `${num(A)} : ${num(A)}√3 : ${num(2 * A)}`] : ['a : a√3 : 2a'];
    case 'special-45-45-90':
      return has ? ['a : a : a√2', `${num(A)} : ${num(A)} : ${num(A)}√2`] : ['a : a : a√2'];
  }
}

/** Angles (degrees) at the three corners of a special triangle: [bottom-left, top, right angle]. */
export function specialAngles(kind: ShapeKind): [number, number, number] | null {
  if (kind === 'special-30-60-90') return [30, 60, 90];
  if (kind === 'special-45-45-90') return [45, 45, 90];
  return null;
}

/** Do three side lengths (as numbers) satisfy a² + b² = c² for this right triangle? Used by tests and the validator. */
export function isRightTriangle(a: number, b: number, c: number): boolean {
  return Math.abs(a * a + b * b - c * c) < 1e-9 * Math.max(1, c * c);
}

/** The exact side lengths (numbers) of a shape with sizes given: used to check the labels the board writes. */
export function sideLengths(kind: ShapeKind, a: number, b?: number): { va: number; hb: number; hyp: number } | null {
  switch (kind) {
    case 'right-triangle':
      return b === undefined ? null : { va: a, hb: b, hyp: Math.hypot(a, b) };
    case 'special-30-60-90':
      return { va: a, hb: a * Math.sqrt(3), hyp: 2 * a };
    case 'special-45-45-90':
      return { va: a, hb: a, hyp: a * Math.SQRT2 };
    default:
      return null;
  }
}
