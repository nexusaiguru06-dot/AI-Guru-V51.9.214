/**
 * DNA builder for sets and Venn diagrams (V51.9.26): the universe rectangle and two or three
 * circles are drawn by pen; the regions of an expression (A ∩ B, A ∪ B, Aᶜ, A − B, De Morgan …)
 * fill in colour with the expression written beneath; with elements, the regions hold numbers or
 * words and the app writes the lists and counts.
 *
 * The planner chooses the expressions and the order. The app decides which regions they are
 * (set algebra over the 2^n basic regions, see venn-math.ts), rejects a false identity, and
 * writes every list and count. The picture and every symbol are identical in English and
 * Malayalam; only the captions and the optional circle words change language.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { DUR, type Role } from '../../reels/motion/grammar';
import { circlePts } from '../../reels/motion/shapes';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, VennPlan } from './types';
import { SET_NAMES, elementCodes, elementsOf, exprText, inclusion, placeInRegion, regionOf, vennGeometry, type ElementSets } from './venn-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
const CX = 360;
const LINE1_Y = 362;
const LINE2_Y = 398;
export const SET_COLORS = ['#2f7fd6', '#e0583a', '#2e9e5b'];
export const SHADE = '#8a5cd6';

export const fmtSet = (items: string[]) => (items.length ? `{${items.join(', ')}}` : '∅');

export function elementSetsOf(plan: VennPlan): ElementSets | null {
  if (!plan.elements) return null;
  return { sets: plan.elements, outside: plan.outside ?? [] };
}

export function buildVenn(plan: VennPlan, lang: Lang, title: string): MotionScene[] {
  const n = plan.sets;
  const g = vennGeometry(n);
  const es = elementSetsOf(plan);
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let shaded: string[] = [];
  let line: string[] = [];
  let lit: string[] = [];
  const elemIds = new Map<string, string>();
  const fade = (ids: string[], at: number, dur = 300) => {
    for (const i of ids) m.get(i).alpha.to(at, dur, 0);
  };

  const drawShow = () => {
    const [rx, ry, rw, rh] = g.rect;
    let end = m.poly('univ', [[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]], t, { color: 'ink', closed: true, width: 2.5, dur: 800, silent: true, z: 2 });
    m.text('univ-u', 'U', rx + 18, ry + 20, { size: 22, color: 'ink', z: 4 });
    m.appear('univ-u', t + 200, 0, false);
    g.circles.forEach(([cx, cy, r], i) => {
      end = Math.max(end, m.poly(`circ${i}`, circlePts(cx, cy, r), t + 300 + i * 250, { color: SET_COLORS[i], closed: true, width: 3.5, dur: 900, silent: true, z: 2 }));
      m.text(`let${i}`, SET_NAMES[i], g.labels[i][0], g.labels[i][1] - (plan.labels?.[i] ? 8 : 0), { size: 30, color: SET_COLORS[i], z: 4 });
      m.appear(`let${i}`, t + 500 + i * 250, 0, false);
      if (plan.labels?.[i]) {
        m.text(`word${i}`, pick(plan.labels[i], lang), g.labels[i][0], g.labels[i][1] + 16, { size: 15, color: SET_COLORS[i], z: 4 });
        m.appear(`word${i}`, t + 600 + i * 250, 0, false);
      }
    });
    m.sound(t, 'scribble', { dur: 900 });
    if (es) {
      const codes = elementCodes(es);
      const byCode = new Map<number, string[]>();
      for (const [e, c] of codes) byCode.set(c, [...(byCode.get(c) ?? []), e]);
      let k = 0;
      for (const [code, items] of byCode) {
        const pos = placeInRegion(g, code, items.length);
        if (!pos) throw new Error(`region "${code}" is too small for ${items.length} elements; use fewer.`);
        items.forEach((e, j) => {
          const id = `el${uid++}`;
          m.text(id, e, pos[j][0], pos[j][1], { size: 22, color: 'ink', z: 4 });
          m.appear(id, t + 900 + k * 70, 0, false);
          elemIds.set(e, id);
          k++;
        });
      }
      end = Math.max(end, t + 900 + k * 70 + 300);
    }
    t = Math.max(end, t + 1400) + 200;
  };

  const shadeRegion = (expr: string): string => {
    const r = regionOf(expr, n);
    if (!r.codes) throw new Error(`bad expression "${expr}": ${r.error}`);
    fade(shaded, t, 300);
    const id = `reg${uid++}`;
    m.region(id, { rect: g.rect, circles: g.circles, codes: r.codes }, t + 250, { color: SHADE, alpha: 0.55, dur: 700 });
    shaded = [id];
    return id;
  };
  const write = (s: string, y: number, size: number, color: Role | string, at: number) => {
    const id = `ln${uid++}`;
    m.text(id, s, CX, y, { size, color, z: 4 });
    line.push(id);
    return m.appear(id, at, 250);
  };
  const resetLine = () => {
    fade(line, t, 250);
    line = [];
    for (const id of lit) m.recolor(id, 'ink', t, 300);
    lit = [];
  };
  const highlight = (items: string[]) => {
    for (const e of items) {
      const id = elemIds.get(e);
      if (id) {
        m.recolor(id, SHADE, t + 300, 300);
        lit.push(id);
      }
    }
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const s of plan.steps) {
    t = m.step(pick(s.say, lang), t, 2400);
    switch (s.op) {
      case 'show':
        drawShow();
        break;
      case 'clear':
        fade(shaded, t, 400);
        shaded = [];
        resetLine();
        t += 450;
        break;
      case 'shade': {
        resetLine();
        shadeRegion(s.expr);
        const e = regionOf(s.expr, n).expr!;
        t = write(exprText(e), LINE1_Y, 34, 'ink', t + 500) + DUR.beat;
        break;
      }
      case 'identity': {
        resetLine();
        shadeRegion(s.left);
        const l = exprText(regionOf(s.left, n).expr!);
        const r = exprText(regionOf(s.right, n).expr!);
        const first = write(l, LINE1_Y, 34, 'ink', t + 500) + DUR.beat + 500;
        // The picture stays: the same shaded region now carries both names.
        fade(line, first, 250);
        line = [];
        t = write(`${l} = ${r}`, LINE1_Y, 32, 'c', first + 100) + DUR.beat;
        break;
      }
      case 'list': {
        resetLine();
        shadeRegion(s.expr);
        const items = elementsOf(s.expr, es!).items!;
        highlight(items);
        const e = exprText(regionOf(s.expr, n).expr!);
        t = write(`${e} = ${fmtSet(items)}`, LINE1_Y, 30, 'ink', t + 500) + DUR.beat;
        break;
      }
      case 'inclusion': {
        resetLine();
        shadeRegion('A∪B');
        const k = inclusion(es!);
        const a = write('n(A ∪ B) = n(A) + n(B) − n(A ∩ B)', LINE1_Y, 24, 'ink', t + 500) + DUR.beat;
        t = write(`= ${k.a} + ${k.b} − ${k.both} = ${k.union}`, LINE2_Y, 28, 'c', a) + DUR.beat;
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
