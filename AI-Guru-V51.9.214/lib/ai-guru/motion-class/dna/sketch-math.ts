/**
 * The `ai-sketch` DNA (V51.9.50): the gap-filler for blocks that no built-in DNA, and no composite of
 * built-in DNAs, can draw. The AI writes a small declarative board — shapes, labels and maths at fixed
 * positions — and a list of steps that show, move, colour, morph and box them. It is NOT code: the app
 * checks every name, position, size, colour and order, then draws it with the same motion verbs as every
 * other DNA, so English and Malayalam get identical pictures.
 *
 * What the app cannot check here is the mathematics of the picture (a free sketch has no maths engine),
 * so every sketch is marked for review, and a sketch only becomes a reusable template when a teacher
 * promotes it (see sketch-library.ts).
 */

import type { Bi } from './types';
import type { Role } from '../../reels/motion/grammar';

export const SKETCH_DNA = 'ai-sketch' as const;

export const SKETCH_W = 720;
export const SKETCH_H_MIN = 240;
export const SKETCH_H_MAX = 600;
export const SKETCH_H_DEFAULT = 440;
export const SKETCH_MAX_OBJECTS = 40;
export const SKETCH_MAX_STEPS = 12;
export const SKETCH_MAX_ACTIONS = 6;
export const SKETCH_MAX_POINTS = 64;
export const SKETCH_ROLES: Role[] = ['a', 'b', 'c', 'carry', 'result', 'done', 'ink', 'accent'];
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,23}$/;

export type SketchColor = 'a' | 'b' | 'c' | 'carry' | 'result' | 'done' | 'ink' | 'accent';
export type Pt = [number, number];

export type SketchObject =
  | { id: string; kind: 'text'; x: number; y: number; text: Bi | string; size?: number; color?: SketchColor }
  | { id: string; kind: 'math'; x: number; y: number; tex: string; size?: number; color?: SketchColor }
  | { id: string; kind: 'line'; x1: number; y1: number; x2: number; y2: number; color?: SketchColor; width?: number }
  | { id: string; kind: 'arrow'; x1: number; y1: number; x2: number; y2: number; color?: SketchColor }
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number; color?: SketchColor; fill?: SketchColor }
  | { id: string; kind: 'circle'; x: number; y: number; r: number; color?: SketchColor; fill?: SketchColor }
  | { id: string; kind: 'polygon'; points: Pt[]; closed?: boolean; dashed?: boolean; color?: SketchColor; fill?: SketchColor }
  | { id: string; kind: 'dot'; x: number; y: number; r?: number; color?: SketchColor };

export type SketchAction =
  /** Draw / write / pop in these objects (each object is shown once, before anything else is done to it). */
  | { show: string[] }
  | { hide: string[] }
  /** Glide a text or dot to a new place. */
  | { move: string; to: Pt }
  /** Yellow halo and a small pulse on these objects (the eye goes there). */
  | { focus: string[] }
  /** Change colour (outline / ink; shapes with a fill get the new fill). */
  | { color: string[]; to: SketchColor }
  /** Finished work fades back. */
  | { dim: string[] }
  /** A polygon's corners glide to new places (same number of corners). */
  | { morph: string; points: Pt[] }
  /** Change what a text says (a value rolls over to its new value). */
  | { swap: string; text: Bi | string }
  /** Pen-drawn box: centre x, centre y, width, height. */
  | { box: [number, number, number, number]; color?: SketchColor }
  /** Green tick at x, y. */
  | { tick: Pt };

export interface SketchStep {
  say: Bi;
  do: SketchAction[];
}

export interface SketchPlan {
  title?: Bi;
  /** Board height in design px (the board is 720 wide). */
  height?: number;
  objects: SketchObject[];
  steps: SketchStep[];
}

export const sketchHeight = (p: SketchPlan) => (Number.isFinite(p.height) ? Math.round(p.height!) : SKETCH_H_DEFAULT);

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBi = (v: unknown): v is Bi => !!v && typeof v === 'object' && typeof (v as Bi).en === 'string';

/** The single action key of an action object. */
export function actionKind(a: SketchAction): string {
  const keys = Object.keys(a ?? {}).filter((k) => k !== 'color' || !('box' in (a as object)));
  const verbs = ['show', 'hide', 'move', 'focus', 'color', 'dim', 'morph', 'swap', 'box', 'tick'];
  return keys.find((k) => verbs.includes(k)) ?? '?';
}

/** Every problem with a sketch plan (empty = it can be drawn). Messages are written for the AI to act on. */
export function sketchProblems(plan: SketchPlan, path = 'teach'): string[] {
  const errs: string[] = [];
  if (!plan || typeof plan !== 'object') return [`${path} is not an object.`];
  const H = sketchHeight(plan);
  if (H < SKETCH_H_MIN || H > SKETCH_H_MAX) errs.push(`${path}.height must be ${SKETCH_H_MIN}–${SKETCH_H_MAX} (the board is ${SKETCH_W} wide).`);
  if (!Array.isArray(plan.objects) || !plan.objects.length) return [...errs, `${path}.objects must list the things on the board.`];
  if (plan.objects.length > SKETCH_MAX_OBJECTS) errs.push(`${path}.objects has ${plan.objects.length} objects; at most ${SKETCH_MAX_OBJECTS}.`);
  if (!Array.isArray(plan.steps) || !plan.steps.length) return [...errs, `${path}.steps must list the steps.`];
  if (plan.steps.length > SKETCH_MAX_STEPS) errs.push(`${path}.steps has ${plan.steps.length} steps; at most ${SKETCH_MAX_STEPS}.`);

  const inX = (v: unknown) => num(v) && v >= 0 && v <= SKETCH_W;
  const inY = (v: unknown) => num(v) && v >= 0 && v <= H;
  const colorOk = (c: unknown) => c === undefined || (SKETCH_ROLES as string[]).includes(c as string);
  const byId = new Map<string, SketchObject>();
  plan.objects.forEach((o, i) => {
    const at = `${path}.objects[${i}]`;
    if (!o || typeof o !== 'object') return void errs.push(`${at} is not an object.`);
    if (typeof o.id !== 'string' || !ID.test(o.id)) errs.push(`${at}.id must be a short name (letters, digits, - or _, starting with a letter).`);
    else if (byId.has(o.id)) errs.push(`${at}.id "${o.id}" is used twice.`);
    else byId.set(o.id, o);
    if (!colorOk((o as { color?: unknown }).color)) errs.push(`${at}.color must be one of ${SKETCH_ROLES.join(', ')}.`);
    if ('fill' in o && !colorOk(o.fill)) errs.push(`${at}.fill must be one of ${SKETCH_ROLES.join(', ')}.`);
    switch (o.kind) {
      case 'text':
        if (!inX(o.x) || !inY(o.y)) errs.push(`${at} must be inside the board (x 0–${SKETCH_W}, y 0–${H}).`);
        if (!(typeof o.text === 'string' ? o.text.trim() : isBi(o.text) && o.text.en.trim())) errs.push(`${at}.text is empty (a number/symbol as a string, words as {"en","ml"}).`);
        if (o.size !== undefined && (!num(o.size) || o.size < 16 || o.size > 64)) errs.push(`${at}.size must be 16–64.`);
        break;
      case 'math':
        if (!inX(o.x) || !inY(o.y)) errs.push(`${at} must be inside the board (x 0–${SKETCH_W}, y 0–${H}).`);
        if (typeof o.tex !== 'string' || !o.tex.trim()) errs.push(`${at}.tex is empty.`);
        if (o.size !== undefined && (!num(o.size) || o.size < 18 || o.size > 60)) errs.push(`${at}.size must be 18–60.`);
        break;
      case 'line':
      case 'arrow':
        if (![o.x1, o.x2].every(inX) || ![o.y1, o.y2].every(inY)) errs.push(`${at} must be inside the board.`);
        else if (Math.hypot(o.x2 - o.x1, o.y2 - o.y1) < 6) errs.push(`${at} is too short to see.`);
        break;
      case 'rect':
        if (!num(o.w) || !num(o.h) || o.w < 4 || o.h < 4) errs.push(`${at}.w and .h must be at least 4.`);
        else if (!inX(o.x - o.w / 2) || !inX(o.x + o.w / 2) || !inY(o.y - o.h / 2) || !inY(o.y + o.h / 2)) errs.push(`${at} (x, y = centre) must stay inside the board.`);
        break;
      case 'circle':
        if (!num(o.r) || o.r < 3) errs.push(`${at}.r must be at least 3.`);
        else if (!inX(o.x - o.r) || !inX(o.x + o.r) || !inY(o.y - o.r) || !inY(o.y + o.r)) errs.push(`${at} must stay inside the board.`);
        break;
      case 'polygon':
        if (!Array.isArray(o.points) || o.points.length < 2 || o.points.length > SKETCH_MAX_POINTS) errs.push(`${at}.points must list 2–${SKETCH_MAX_POINTS} [x, y] corners.`);
        else if (!o.points.every((p) => Array.isArray(p) && inX(p[0]) && inY(p[1]))) errs.push(`${at}.points must all be [x, y] inside the board.`);
        break;
      case 'dot':
        if (!inX(o.x) || !inY(o.y)) errs.push(`${at} must be inside the board.`);
        break;
      default:
        errs.push(`${at}.kind "${(o as { kind?: string }).kind}" is not one of text, math, line, arrow, rect, circle, polygon, dot.`);
    }
  });
  if (errs.length) return errs;

  const shown = new Set<string>();
  const used = new Set<string>();
  const need = (ids: unknown, at: string, mustBeShown = true): string[] => {
    if (!Array.isArray(ids) || !ids.length || !ids.every((x) => typeof x === 'string')) {
      errs.push(`${at} must be a list of object ids.`);
      return [];
    }
    for (const id of ids as string[]) {
      if (!byId.has(id)) errs.push(`${at}: there is no object "${id}".`);
      else if (mustBeShown && !shown.has(id)) errs.push(`${at}: "${id}" is not on the board yet (show it in an earlier action).`);
    }
    return ids as string[];
  };
  plan.steps.forEach((st, si) => {
    const at = `${path}.steps[${si}]`;
    if (!st || typeof st !== 'object') return void errs.push(`${at} is not an object.`);
    if (!isBi(st.say) || !st.say.en.trim()) errs.push(`${at}.say must be the spoken caption {"en","ml"}.`);
    if (!Array.isArray(st.do)) return void errs.push(`${at}.do must list the actions (may be empty for a pause).`);
    if (st.do.length > SKETCH_MAX_ACTIONS) errs.push(`${at}.do has ${st.do.length} actions; at most ${SKETCH_MAX_ACTIONS} (split the step).`);
    st.do.forEach((a, ai) => {
      const aat = `${at}.do[${ai}]`;
      const k = actionKind(a);
      const x = a as Record<string, unknown>;
      switch (k) {
        case 'show':
          for (const id of need(x.show, `${aat}.show`, false)) {
            if (shown.has(id)) errs.push(`${aat}.show: "${id}" is already shown.`);
            shown.add(id);
            used.add(id);
          }
          break;
        case 'hide':
          for (const id of need(x.hide, `${aat}.hide`)) shown.delete(id);
          break;
        case 'focus':
        case 'dim':
          need(x[k], `${aat}.${k}`);
          break;
        case 'color':
          need(x.color, `${aat}.color`);
          if (!(SKETCH_ROLES as string[]).includes(x.to as string)) errs.push(`${aat}.to must be one of ${SKETCH_ROLES.join(', ')}.`);
          break;
        case 'move': {
          const [id] = need([x.move], `${aat}.move`);
          const o = id ? byId.get(id) : undefined;
          if (o && o.kind !== 'text' && o.kind !== 'dot') errs.push(`${aat}.move: only a text or a dot can move ("${id}" is a ${o.kind}; use morph for shapes).`);
          const to = x.to as Pt;
          if (!Array.isArray(to) || !inX(to[0]) || !inY(to[1])) errs.push(`${aat}.to must be [x, y] inside the board.`);
          break;
        }
        case 'morph': {
          const [id] = need([x.morph], `${aat}.morph`);
          const o = id ? byId.get(id) : undefined;
          const pts = x.points as Pt[];
          if (o && o.kind !== 'polygon') errs.push(`${aat}.morph: only a polygon can morph ("${id}" is a ${o.kind}).`);
          else if (o && o.kind === 'polygon' && (!Array.isArray(pts) || pts.length !== o.points.length)) errs.push(`${aat}.points must have the same number of corners as "${id}" (${o.points.length}).`);
          else if (Array.isArray(pts) && !pts.every((p) => Array.isArray(p) && inX(p[0]) && inY(p[1]))) errs.push(`${aat}.points must all be inside the board.`);
          break;
        }
        case 'swap': {
          const [id] = need([x.swap], `${aat}.swap`);
          const o = id ? byId.get(id) : undefined;
          if (o && o.kind !== 'text') errs.push(`${aat}.swap: only a text can change ("${id}" is a ${o.kind}).`);
          const t = x.text;
          if (!(typeof t === 'string' ? t.trim() : isBi(t) && t.en.trim())) errs.push(`${aat}.text is empty.`);
          break;
        }
        case 'box': {
          const b = x.box as number[];
          if (!Array.isArray(b) || b.length !== 4 || !b.every(num) || b[2] < 8 || b[3] < 8) errs.push(`${aat}.box must be [centre x, centre y, width, height].`);
          else if (!inX(b[0] - b[2] / 2) || !inX(b[0] + b[2] / 2) || !inY(b[1] - b[3] / 2) || !inY(b[1] + b[3] / 2)) errs.push(`${aat}.box must stay inside the board.`);
          if (!colorOk(x.color)) errs.push(`${aat}.color must be one of ${SKETCH_ROLES.join(', ')}.`);
          break;
        }
        case 'tick': {
          const p = x.tick as Pt;
          if (!Array.isArray(p) || !inX(p[0]) || !inY(p[1])) errs.push(`${aat}.tick must be [x, y] inside the board.`);
          break;
        }
        default:
          errs.push(`${aat} is not one of show, hide, move, focus, color, dim, morph, swap, box, tick.`);
      }
    });
  });
  for (const id of byId.keys()) if (!used.has(id)) errs.push(`${path}: object "${id}" is never shown (show it in a step, or remove it).`);
  if (errs.length) return errs.slice(0, 12);
  const firstShow = plan.steps.findIndex((s) => Array.isArray(s.do) && s.do.some((a) => actionKind(a) === 'show'));
  if (firstShow > 1) errs.push(`${path}: nothing appears until step ${firstShow + 1}; show something in the first step.`);
  return errs;
}
