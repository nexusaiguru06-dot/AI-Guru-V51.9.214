/**
 * Checks for the concept board's visual layouts (V51.9.46): cards, pyramid and two columns.
 * The planner chooses the layout and writes the words; the app decides every position.
 */

import type { BoardLayout, BoardPlan } from './types';
import { ICON_NAMES, isIcon } from './concept-icons';

export const BOARD_LAYOUTS: BoardLayout[] = ['cards', 'pyramid', 'columns', 'flow', 'cycle', 'timeline', 'scale', 'bars', 'tree'];
export const BOARD_MAX_POINTS: Record<BoardLayout, number> = { cards: 5, pyramid: 5, columns: 6, flow: 6, cycle: 5, timeline: 6, scale: 4, bars: 6, tree: 9 };
/** Longest board text per layout (a pyramid band is narrow at the top). */
export const BOARD_MAX_CHARS: Record<BoardLayout, number> = { cards: 80, pyramid: 34, columns: 60, flow: 70, cycle: 60, timeline: 70, scale: 30, bars: 28, tree: 30 };

export const layoutOf = (plan: BoardPlan): BoardLayout => (plan.layout && BOARD_LAYOUTS.includes(plan.layout) ? plan.layout : 'cards');

/** *key* terms → plain text. */
export const plain = (s: string): string => s.replace(/\*/g, '');
/** The first *key term* of a line, if any. */
export const firstKey = (s: string): string | undefined => /\*([^*]+)\*/.exec(s)?.[1];

export function boardProblems(plan: BoardPlan, path: string): string[] {
  const errors: string[] = [];
  if (plan.layout !== undefined && !BOARD_LAYOUTS.includes(plan.layout)) errors.push(`${path}.layout must be one of ${BOARD_LAYOUTS.join(', ')}.`);
  const layout = layoutOf(plan);
  if (!Array.isArray(plan.points) || !plan.points.length) return [...errors, `${path}.points must list the ideas.`];
  if (plan.points.length > BOARD_MAX_POINTS[layout]) errors.push(`${path}.points: at most ${BOARD_MAX_POINTS[layout]} for a ${layout} layout.`);
  if (layout === 'cycle' && plan.points.length < 3) errors.push(`${path}.points: a cycle needs 3–5 stages (the last leads back to the first).`);
  if ((layout === 'flow' || layout === 'timeline') && plan.points.length < 2) errors.push(`${path}.points: a ${layout} needs at least 2 steps.`);
  if (layout === 'pyramid' && plan.points.length < 3) errors.push(`${path}.points: a pyramid needs 3–5 levels (the first point is the base).`);
  plan.points.forEach((p, i) => {
    const at = `${path}.points[${i}]`;
    if (!p?.say?.en) errors.push(`${at}.say is required.`);
    if (!p?.board?.en && !p?.math?.length) errors.push(`${at} needs "board" text or "math" tokens.`);
    if (p?.board?.en && plain(p.board.en).length > BOARD_MAX_CHARS[layout]) errors.push(`${at}.board is too long for a ${layout} (max ${BOARD_MAX_CHARS[layout]} characters).`);
    if (p?.board?.ml && plain(p.board.ml).length > BOARD_MAX_CHARS[layout] * 1.6) errors.push(`${at}.board.ml is too long for a ${layout}.`);
    if (layout === 'columns' && p?.col !== 0 && p?.col !== 1) errors.push(`${at}.col must be 0 (left) or 1 (right) in a columns layout.`);
  });
  plan.points.forEach((p, i) => {
    const at = `${path}.points[${i}]`;
    if (p?.icon !== undefined && !isIcon(p.icon)) errors.push(`${at}.icon must be one of ${ICON_NAMES.join(', ')} (or leave it out).`);
  });
  if (layout === 'scale') {
    if (!Array.isArray(plan.heads) || plan.heads.length !== 2 || !plan.heads[0]?.en || !plan.heads[1]?.en) errors.push(`${path}.heads must be the two pan titles ({"en","ml"} each).`);
    else if (plan.heads.some((h) => plain(h.en).length > 22)) errors.push(`${path}.heads: keep each pan title under 22 characters.`);
    for (const c of [0, 1]) {
      const n = plan.points.filter((p) => p.col === c).length;
      if (n === 0) errors.push(`${path}.points: pan ${c} has no idea; a scale compares two sides.`);
      if (n > 2) errors.push(`${path}.points: at most 2 ideas on a pan.`);
    }
    plan.points.forEach((p, i) => {
      if (p?.col !== 0 && p?.col !== 1) errors.push(`${path}.points[${i}].col must be 0 (left pan) or 1 (right pan) in a scale layout.`);
      if (p?.weight !== undefined && !(Number.isInteger(p.weight) && p.weight >= 1 && p.weight <= 9)) errors.push(`${path}.points[${i}].weight must be a whole number 1–9.`);
    });
  }
  if (layout === 'bars') {
    if (plan.points.length < 2) errors.push(`${path}.points: bars compare at least 2 values.`);
    plan.points.forEach((p, i) => {
      if (typeof p?.value !== 'number' || !Number.isFinite(p.value) || p.value < 0) errors.push(`${path}.points[${i}].value must be a number, 0 or more.`);
    });
    if (plan.points.every((p) => !(p?.value && p.value > 0))) errors.push(`${path}.points: at least one value must be above 0.`);
  }
  if (layout === 'tree') {
    const firsts: number[] = [];
    plan.points.forEach((p, i) => {
      if (p?.parent === undefined) {
        firsts.push(i);
        return;
      }
      if (!Number.isInteger(p.parent) || p.parent < 0 || p.parent >= i || plan.points[p.parent]?.parent !== undefined) errors.push(`${path}.points[${i}].parent must be the index of an earlier first-level branch.`);
    });
    if (firsts.length < 2 || firsts.length > 4) errors.push(`${path}.points: a tree has 2–4 first-level branches (points without "parent").`);
    for (const f of firsts) if (plan.points.filter((p) => p.parent === f).length > 3) errors.push(`${path}.points: at most 3 sub-branches under one branch.`);
  }
  if (layout === 'columns') {
    if (!Array.isArray(plan.heads) || plan.heads.length !== 2 || !plan.heads[0]?.en || !plan.heads[1]?.en) errors.push(`${path}.heads must be two column titles ({"en","ml"} each).`);
    else if (plan.heads.some((h) => plain(h.en).length > 22)) errors.push(`${path}.heads: keep each column title under 22 characters.`);
    for (const c of [0, 1]) if (!plan.points.some((p) => p.col === c)) errors.push(`${path}.points: column ${c} has no idea; use two columns that each hold something.`);
  }
  return errors;
}
