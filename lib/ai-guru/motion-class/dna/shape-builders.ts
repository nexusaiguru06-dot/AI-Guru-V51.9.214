/**
 * DNA builder for "a shape with its formula" (V51.9.25): a figure is drawn by pen (circle,
 * rectangle, square, triangle, right triangle, the special 30-60-90 and 45-45-90 triangles), its
 * sides get labels, angles get arcs with degrees, a dotted height appears, and the formula is
 * written underneath, first as the rule and then with the numbers worked out.
 *
 * The planner chooses which shape and which steps. The app draws it to the right proportions,
 * writes every label and every formula (see shape-math.ts) and rejects plans whose steps do not
 * fit the shape. English and Malayalam classes have identical pictures; only the shape names and
 * the spoken captions change language.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { DUR, type Role } from '../../reels/motion/grammar';
import { angleArc, circlePts, rightAnglePts, type Pt } from '../../reels/motion/shapes';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, ShapeKind, ShapePlan } from './types';
import { SHAPE_WORDS, formulaLines, sideLabels, specialAngles } from './shape-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
const CX = 360;
const BASE_Y = 262;
const FORMULA_Y = 340;
const NAME_Y = 430;
export const FIGURE_COLOR = '#e0583a';

export interface Figure {
  kind: ShapeKind;
  /** Corner points in drawing order (closed polygon); empty for a circle. */
  pts: Pt[];
  center?: Pt;
  radius?: number;
  /** Right-angle corner index into pts, or -1. */
  right: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The figure's geometry in board coordinates, to scale when sizes are given. */
export function figureOf(kind: ShapeKind, a?: number, b?: number): Figure {
  const both = a !== undefined && b !== undefined;
  switch (kind) {
    case 'circle':
      return { kind, pts: [], center: [CX, 170], radius: 95, right: -1 };
    case 'rectangle': {
      const ratio = both ? clamp(a! / b!, 1, 3) : 2.4;
      let H = 120;
      let W = H * ratio;
      if (W > 300) {
        W = 300;
        H = W / ratio;
      }
      const x0 = CX - W / 2;
      const y0 = 170 - H / 2;
      return { kind, pts: [[x0, y0], [x0 + W, y0], [x0 + W, y0 + H], [x0, y0 + H]], right: -1 };
    }
    case 'square': {
      const S = 150;
      const x0 = CX - S / 2;
      const y0 = 170 - S / 2;
      return { kind, pts: [[x0, y0], [x0 + S, y0], [x0 + S, y0 + S], [x0, y0 + S]], right: -1 };
    }
    case 'triangle': {
      const base = 300;
      const h = both ? clamp(base * (b! / a!), 90, 180) : 170;
      const x0 = CX - base / 2;
      return { kind, pts: [[x0, BASE_Y], [x0 + base, BASE_Y], [x0 + base * 0.4, BASE_Y - h]], right: -1 };
    }
    default: {
      // Right triangles: right angle at the bottom right; pts = [bottom-left, right-angle corner, top].
      let Lx = 270;
      let Ly = 170;
      if (kind === 'right-triangle' && both) {
        const s = Math.min(300 / b!, 190 / a!);
        Lx = clamp(b! * s, 70, 300);
        Ly = clamp(a! * s, 70, 190);
      } else if (kind === 'special-30-60-90') {
        Lx = 290;
        Ly = 290 / Math.sqrt(3);
      } else if (kind === 'special-45-45-90') {
        Lx = 190;
        Ly = 190;
      }
      const rx = CX + Lx / 2;
      return { kind, pts: [[rx - Lx, BASE_Y], [rx, BASE_Y], [rx, BASE_Y - Ly]], right: 1 };
    }
  }
}

const unit = (p: Pt, q: Pt): Pt => {
  const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  return [(q[0] - p[0]) / d, (q[1] - p[1]) / d];
};
const centroid = (pts: Pt[]): Pt => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

/** A point beside the middle of side p→q, on the side away from `inside`. */
function beside(p: Pt, q: Pt, inside: Pt, gap: number): Pt {
  const mx = (p[0] + q[0]) / 2;
  const my = (p[1] + q[1]) / 2;
  let nx = -(q[1] - p[1]);
  let ny = q[0] - p[0];
  const n = Math.hypot(nx, ny) || 1;
  nx /= n;
  ny /= n;
  if ((mx - inside[0]) * nx + (my - inside[1]) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return [mx + nx * gap, my + ny * gap];
}

export function buildShape(plan: ShapePlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let fig: Figure | null = null;
  let sizes: { a?: number; b?: number } = {};
  let group: string[] = [];
  let formulas: string[] = [];
  let tag = 'f0';
  const id = (s: string) => `${tag}${s}${uid++}`;
  const fade = (ids: string[], at: number, dur = 350) => {
    for (const i of ids) m.get(i).alpha.to(at, dur, 0);
  };
  const text = (s: string, x: number, y: number, size: number, color: Role | string) => {
    const i = id('t');
    m.text(i, s, x, y, { size, color, z: 4 });
    group.push(i);
    return i;
  };
  const line = (pts: Pt[], o: { color?: Role | string; closed?: boolean; width?: number; dur?: number; dashed?: boolean; at?: number }) => {
    const i = id('p');
    const end = m.poly(i, pts, o.at ?? t, { color: o.color ?? FIGURE_COLOR, closed: o.closed ?? false, width: o.width ?? 4, dur: o.dur ?? 900, dashed: o.dashed, silent: true, z: 2 });
    group.push(i);
    return end;
  };
  const marker = (v: Pt, p: Pt, q: Pt, at: number) => line(rightAnglePts(v, unit(v, p), unit(v, q), 15), { color: 'ink', width: 2.2, dur: 350, at });

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const s of plan.steps) {
    t = m.step(pick(s.say, lang), t, 2400);
    switch (s.op) {
      case 'shape': {
        fade([...group, ...formulas], t, 350);
        if (group.length || formulas.length) t += 450;
        group = [];
        formulas = [];
        tag = `f${uid++}`;
        sizes = { a: s.a, b: s.b };
        fig = figureOf(s.kind, s.a, s.b);
        let end: number;
        if (fig.kind === 'circle') {
          end = line(circlePts(fig.center![0], fig.center![1], fig.radius!), { closed: true, dur: 1100 });
        } else {
          end = line(fig.pts, { closed: true, dur: 1100 });
          if (fig.right >= 0) {
            const v = fig.pts[fig.right];
            const others = fig.pts.filter((_, k) => k !== fig!.right);
            end = Math.max(end, marker(v, others[0], others[1], t + 800));
          }
        }
        m.sound(t, 'scribble', { dur: 1000 });
        t = end + 250;
        break;
      }
      case 'label': {
        const f = fig!;
        const L = sideLabels(f.kind, sizes.a, sizes.b);
        const ids: string[] = [];
        if (f.kind === 'circle') {
          const [cx, cy] = f.center!;
          const end = line([[cx, cy], [cx + f.radius!, cy]], { color: 'ink', width: 3, dur: 700 });
          ids.push(text(L.r!, cx + f.radius! / 2, cy - 18, 26, 'ink'));
          t = end;
        } else if (f.kind === 'rectangle' || f.kind === 'square') {
          const [p0, p1, p2] = f.pts;
          const mid = centroid(f.pts);
          ids.push(text(L.l ?? L.s!, ...beside(p0, p1, mid, 22), 26, 'ink'));
          if (f.kind === 'rectangle') ids.push(text(L.w!, ...beside(p1, p2, mid, 24), 26, 'ink'));
        } else if (f.kind === 'triangle') {
          const [b0, b1] = f.pts;
          ids.push(text(L.base!, ...beside(b0, b1, centroid(f.pts), 24), 26, 'ink'));
        } else {
          const [bl, rc, top] = f.pts;
          const mid = centroid(f.pts);
          ids.push(text(L.hyp!, ...beside(bl, top, mid, 30), 26, 'ink'));
          ids.push(text(L.va!, ...beside(rc, top, mid, 20), 26, 'ink'));
          ids.push(text(L.hb!, ...beside(bl, rc, mid, 24), 26, 'ink'));
        }
        t = m.appear(ids, t, 250) + DUR.beat;
        break;
      }
      case 'height': {
        const f = fig!;
        const [b0, b1, apex] = f.pts;
        const foot: Pt = [apex[0], b0[1]];
        const end = line([apex, foot], { color: '#c8b400', width: 3, dur: 800, dashed: true });
        const e2 = marker(foot, b1, apex, t + 500);
        const h = text(sideLabels('triangle', sizes.a, sizes.b).h!, apex[0] + 22, (apex[1] + foot[1]) / 2, 26, 'ink');
        t = Math.max(end, e2, m.appear(h, end - 200, 250)) + DUR.beat;
        break;
      }
      case 'angles': {
        const f = fig!;
        const [bl, rc, top] = f.pts;
        const degs = specialAngles(f.kind)!;
        const ids: string[] = [];
        let end = t;
        const at1 = angleArc(bl, rc, top, 38);
        const at2 = angleArc(top, bl, rc, 38);
        end = Math.max(end, line(at1.arc, { color: 'carry', width: 2.5, dur: 600, at: t }));
        end = Math.max(end, line(at2.arc, { color: 'carry', width: 2.5, dur: 600, at: t + 150 }));
        ids.push(text(`${degs[0]}°`, at1.label[0], at1.label[1], 22, 'carry'));
        ids.push(text(`${degs[1]}°`, at2.label[0], at2.label[1], 22, 'carry'));
        t = m.appear(ids, end - 250, 250) + DUR.beat;
        break;
      }
      case 'formula': {
        fade(formulas, t, 300);
        if (formulas.length) t += 350;
        formulas = [];
        const lines = formulaLines(fig!.kind, s.what, sizes.a, sizes.b);
        const size = lines.length > 2 ? 26 : 30;
        const gap = lines.length > 2 ? 34 : 40;
        lines.forEach((ln, k) => {
          const last = k === lines.length - 1 && lines.length > 1;
          const i = id('f');
          m.text(i, ln, CX, FORMULA_Y + k * gap, { size, color: last ? 'c' : 'ink', z: 4 });
          formulas.push(i);
          t = m.appear(i, t, 250) + (k < lines.length - 1 ? DUR.beat : 0);
        });
        t += DUR.beat;
        break;
      }
      case 'name': {
        const i = text(pick(SHAPE_WORDS[fig!.kind], lang), CX, NAME_Y, 26, 'b');
        t = m.appear(i, t, 250) + DUR.beat;
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
