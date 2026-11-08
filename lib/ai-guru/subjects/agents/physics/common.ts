/**
 * V51.9.148 — shared checks for the physics templates: steps in a fixed order (each at most once), bilingual
 * captions, numbers in a range.
 */
import { isBi, type Bi } from '../../kit';

export function checkSteps<O extends string>(steps: unknown, order: readonly O[], required: readonly O[] = []): string[] {
  const e: string[] = [];
  if (!Array.isArray(steps) || !steps.length || steps.length > 10) return ['steps: 1 to 10'];
  let last = -1;
  (steps as Array<{ op?: O; say?: Bi }>).forEach((s, i) => {
    const k = order.indexOf(s?.op as O);
    if (k < 0) e.push(`steps[${i}].op must be one of ${order.join(', ')}`);
    else if (k <= last) e.push(`steps[${i}]: the order is ${order.join(', ')}, each at most once`);
    last = Math.max(last, k);
    if (!isBi(s?.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if ((steps as Array<{ op?: O }>)[0]?.op !== order[0]) e.push(`the first step is "${order[0]}"`);
  for (const r of required) if (!(steps as Array<{ op?: O }>).some((s) => s?.op === r)) e.push(`a "${r}" step is needed`);
  return e;
}

export const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
export const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
/** g as the plan gives it (9.8 or 10 m/s²; 10 when not given). */
export const gOf = (g: unknown) => (g === 9.8 || g === 9.81 ? (g as number) : 10);
/** Half-width of a ring round a line of board text of this length (size 24). */
export const ringW = (text: string) => Math.max(110, Math.min(340, text.length * 7.8 + 30));
/** A negative number in brackets: 1/(−15). */
export const par = (v: number, f: (x: number) => string) => (v < 0 ? `(${f(v)})` : f(v));
