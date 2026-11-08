/**
 * Maths and geometry for the parallelogram and trapezium area DNA (V51.9.38): the figure drawn to
 * scale, the right triangle cut off and moved, the turned copy that makes a parallelogram, the two
 * triangles, and the formula with its numbers. Every number written and every point comes from here.
 */

import type { AreaFigKind, AreaFigPlan } from './types';

export type Pt = [number, number];
export type RoleA = 'a' | 'b' | 'c' | 'carry' | 'result' | 'ink';
/** A line of text: words, each optionally coloured with "word@role". */
export type Line = [string, RoleA];

export const AF_KINDS: AreaFigKind[] = ['parallelogram', 'trapezium'];
export const AF_OPS: Record<AreaFigKind, string[]> = {
  parallelogram: ['show', 'height', 'cut', 'move', 'formula'],
  trapezium: ['show', 'height', 'copy', 'triangles', 'formula'],
};
export const SIDE_MIN = 2;
export const SIDE_MAX = 20;
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function afProblem(plan: AreaFigPlan, path: string): string | null {
  if (!AF_KINDS.includes(plan?.kind)) return `${path}.kind must be one of ${AF_KINDS.join(', ')}.`;
  for (const [k, v] of [['b', plan.b], ['h', plan.h]] as const) if (!isInt(v) || v < SIDE_MIN || v > SIDE_MAX) return `${path}.${k} must be a whole number from ${SIDE_MIN} to ${SIDE_MAX}.`;
  if (plan.unit !== undefined && !['cm', 'm', 'mm'].includes(plan.unit)) return `${path}.unit must be cm, m or mm.`;
  if (plan.kind === 'parallelogram') {
    if (plan.lean !== undefined && plan.lean !== 'left' && plan.lean !== 'right') return `${path}.lean must be "left" or "right" for a parallelogram.`;
    return null;
  }
  if (plan.lean !== undefined && !['left', 'right', 'centre'].includes(plan.lean)) return `${path}.lean must be "left", "right" or "centre".`;
  if (!isInt(plan.a) || plan.a < 1 || plan.a >= plan.b) return `${path}.a must be a whole number from 1 to b − 1 (the shorter parallel side, ${plan.b} is the longer).`;
  if ((plan.a + plan.b) * plan.h % 2) return `${path}: (a + b) × h = ${(plan.a + plan.b) * plan.h} is odd, so the area would not be a whole number; change a side or the height.`;
  if (plan.steps?.some((s) => s?.op === 'triangles') && (plan.b * plan.h % 2 || plan.a * plan.h % 2)) return `${path}: "triangles" needs b × h and a × h even so both triangle areas are whole numbers.`;
  return null;
}

export const area = (plan: AreaFigPlan): number => (plan.kind === 'parallelogram' ? plan.b * plan.h : ((plan.a! + plan.b) * plan.h) / 2);
const withUnit = (plan: AreaFigPlan, n: string | number, sq = false): string => (plan.unit ? `${n} ${plan.unit}${sq ? '^2' : ''}` : String(n));
/** The offset of the shorter side (trapezium) in units. */
export const offset = (plan: AreaFigPlan): number => (plan.lean === 'left' ? 0 : plan.lean === 'right' ? plan.b - plan.a! : (plan.b - plan.a!) / 2);
/** The slant of the parallelogram in units: a whole number, at most b − 1. */
export const slant = (plan: AreaFigPlan): number => Math.min(plan.b - 1, Math.max(1, Math.round(plan.h / 2)));

/* ---------------- the lines written on the board ---------------- */

export function showLines(plan: AreaFigPlan): Line[] {
  if (plan.kind === 'parallelogram') return [[`b@a = ${withUnit(plan, plan.b)}`, 'ink'], [`h@c = ${withUnit(plan, plan.h)}`, 'ink']];
  return [[`a@a = ${withUnit(plan, plan.a!)}`, 'ink'], [`b@b = ${withUnit(plan, plan.b)}`, 'ink'], [`h@c = ${withUnit(plan, plan.h)}`, 'ink']];
}
export function copyLines(): Line[] {
  return [['2 × A = (a@a + b@b) × h@c', 'ink']];
}
export function trianglesLines(plan: AreaFigPlan): Line[] {
  const a = plan.a!;
  const { b, h } = plan;
  return [
    [`{1/2} × ${b}@b × ${h}@c = ${(b * h) / 2}`, 'ink'],
    [`{1/2} × ${a}@a × ${h}@c = ${(a * h) / 2}`, 'ink'],
    [`${(b * h) / 2} + ${(a * h) / 2} = ${area(plan)}`, 'result'],
  ];
}
export function formulaLines(plan: AreaFigPlan): Line[] {
  const { b, h } = plan;
  if (plan.kind === 'parallelogram') return [['A = b@a × h@c', 'ink'], [`= ${b}@a × ${h}@c`, 'ink'], [`= ${withUnit(plan, b * h, true)}`, 'result']];
  const a = plan.a!;
  return [
    ['A = {1/2} × (a@a + b@b) × h@c', 'ink'],
    [`= {1/2} × (${a}@a + ${b}@b) × ${h}@c`, 'ink'],
    [`= {1/2} × ${a + b} × ${h}@c`, 'ink'],
    [`= ${withUnit(plan, area(plan), true)}`, 'result'],
  ];
}

/* ---------------- geometry (design px) ---------------- */

export const YB = 330;
export const XC = 220;
export const WMAX = 340;
export const HMAX = 200;
export const UMAX = 36;

export interface AfGeom {
  u: number;
  /** Unit coordinates (x right, y up) to design pixels. */
  px: (x: number, y: number) => Pt;
  /** The figure's corners in order, bottom-left first (anticlockwise on screen: BL, BR, TR, TL). */
  fig: Pt[];
  /** The foot of the height on the base and the top end (where the dashed height is drawn). */
  heightFrom: Pt;
  heightTo: Pt;
  /** Which way the right-angle mark opens (+1 right, −1 left). */
  markDir: 1 | -1;
  /** parallelogram: the triangle cut off, and where it lands. */
  tri?: Pt[];
  moved?: Pt[];
  /** trapezium: the turned copy, and the two triangles (on b and on a). */
  copy?: Pt[];
  triB?: Pt[];
  triA?: Pt[];
  /** Overall width in units. */
  W: number;
  /** Label anchors. */
  lab: Record<string, Pt>;
}

export function afGeometry(plan: AreaFigPlan): AfGeom {
  const { b, h } = plan;
  if (plan.kind === 'parallelogram') {
    const d = slant(plan);
    const W = b + d;
    const u = Math.min(WMAX / W, HMAX / h, UMAX);
    const left = plan.lean === 'left';
    const mx = (x: number) => (left ? W - x : x);
    const px = (x: number, y: number): Pt => [XC - (u * W) / 2 + u * mx(x), YB - u * y];
    const P = (pts: Array<[number, number]>) => pts.map(([x, y]) => px(x, y));
    const fig = P([[0, 0], [b, 0], [b + d, h], [d, h]]);
    const topLeftFoot = px(d, 0);
    return {
      u, px, fig, W,
      heightFrom: px(d, h), heightTo: topLeftFoot, markDir: left ? -1 : 1,
      tri: P([[0, 0], [d, 0], [d, h]]),
      moved: P([[b, 0], [b + d, 0], [b + d, h]]),
      lab: { b: px(b / 2 + d / 2 - d / 2, 0), h: px(d, h / 2), top: px((b + 2 * d) / 2, h) },
    };
  }
  const a = plan.a!;
  const o = offset(plan);
  const hasCopy = plan.steps.some((s) => s?.op === 'copy');
  const W = hasCopy ? o + a + b : b;
  const u = Math.min(WMAX / W, HMAX / h, UMAX);
  const px = (x: number, y: number): Pt => [XC - (u * W) / 2 + u * x, YB - u * y];
  const P = (pts: Array<[number, number]>) => pts.map(([x, y]) => px(x, y));
  const fig = P([[0, 0], [b, 0], [o + a, h], [o, h]]);
  return {
    u, px, fig, W,
    heightFrom: px(o, h), heightTo: px(o, 0), markDir: 1,
    copy: P([[b + o + a, h], [o + a, h], [b, 0], [a + b, 0]]),
    triB: P([[0, 0], [b, 0], [o + a, h]]),
    triA: P([[0, 0], [o + a, h], [o, h]]),
    lab: { a: px(o + a / 2, h), b: px(b / 2, 0), h: px(o, h / 2), ab: px((a + b) / 2, 0) },
  };
}
