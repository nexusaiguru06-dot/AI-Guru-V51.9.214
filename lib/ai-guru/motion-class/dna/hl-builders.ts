/**
 * DNA builder for HCF and LCM (V51.9.49). Two numbers split into prime tiles; the primes they share slide
 * into the same columns and are joined; the HCF is the product of the shared tiles (boxed) and the LCM the
 * product of every column (boxed larger); the check shows HCF × LCM = a × b. English and Malayalam
 * classes have identical pictures; only the captions change language.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { STAGGER_TEXT, staggerOffsets } from '../../reels/motion/curves';
import type { Lang } from '../../reels/motion/captions';
import { becomeMath, mathBox, mathIds, placeMath, type MathHandle } from '../../reels/motion/typeset';
import type { Bi, HlPlan } from './types';
import { HL_LABEL_X, HL_LINE_Y, HL_PITCH, HL_RA, HL_RB, HL_TILE, hlColumns, hlLines, hlTilePts, hlX } from './hl-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;

interface Tile { poly: string; text: string; p: number; row: 'a' | 'b'; i: number }

export function buildHclm(plan: HlPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const { a, b } = plan;
  const L = hlLines(a, b);
  const C = hlColumns(a, b);
  let t = 300;
  let uid = 0;
  const tiles: Tile[] = [];
  const lineIds: string[][] = [];
  const o = { size: 30, maxWidth: 640, colors: {} as Record<string, never> };
  let hcfBox = '';
  let lcmBox = '';

  const rowY = (r: 'a' | 'b') => (r === 'a' ? HL_RA : HL_RB);
  const line = (tex: string, slot: number, at: number, countTo?: number): { h: MathHandle; end: number } => {
    const h = placeMath(m, `hl${uid++}`, tex, SCENE_W / 2, HL_LINE_Y[slot], at, o);
    let end = Math.max(m.write(h.glyphs.map((g) => g.id), at, STAGGER_TEXT), at + (h.strokes.length ? 450 : 0));
    // V51.9.52: the result ticks up to its value as it is written (lands exactly on it).
    const last = h.glyphs[h.glyphs.length - 1];
    if (countTo !== undefined && countTo >= 3 && last && last.text === String(countTo)) {
      const onset = at + staggerOffsets(h.glyphs.length, STAGGER_TEXT)[h.glyphs.length - 1];
      end = Math.max(end, m.count(last.id, 1, countTo, onset, { dur: Math.min(900, 300 + countTo * 12) }));
    }
    lineIds.push(mathIds(h));
    return { h, end };
  };
  void becomeMath; void mathBox;

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);
  else t = m.step(lang === 'ml' ? `${a}, ${b} എന്നിവയുടെ ഉസാഘ-യും ലസാഗു-വും` : `HCF and LCM of ${a} and ${b}`, t, 1400);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show': {
        const la = `hn${uid++}`;
        const lb = `hn${uid++}`;
        m.text(la, String(a), HL_LABEL_X, HL_RA, { size: 44, color: 'a', z: 5 });
        m.text(lb, String(b), HL_LABEL_X, HL_RB, { size: 44, color: 'b', z: 5 });
        t = m.appear([la, lb], t, 400, true) + 600;
        break;
      }
      case 'factorise': {
        const eq = [`he${uid++}`, `he${uid++}`];
        m.text(eq[0], '=', HL_LABEL_X + 52, HL_RA, { size: 34, color: 'carry', z: 5 });
        m.text(eq[1], '=', HL_LABEL_X + 52, HL_RB, { size: 34, color: 'carry', z: 5 });
        t = m.appear(eq, t, 150, false) + 200;
        for (const row of ['a', 'b'] as const) {
          const fs = row === 'a' ? L.fa : L.fb;
          fs.forEach((p, i) => {
            const poly = `ht${uid++}`;
            const text = `ht${uid++}`;
            m.poly(poly, hlTilePts(i, rowY(row)), t + i * 330, { color: row, fill: row, fillAlpha: 0.5, width: 3, dur: 260, z: 2, silent: true });
            m.text(text, String(p), hlX(i), rowY(row), { size: 30, color: 'ink', z: 5 });
            m.appear([text], t + i * 330 + 150, 0, i === 0);
            tiles.push({ poly, text, p, row, i });
          });
        }
        t += Math.max(L.fa.length, L.fb.length) * 330 + 500;
        const la = line(L.texA, 0, t);
        const lb = line(L.texB, 1, la.end + 150);
        t = lb.end + 400;
        break;
      }
      case 'common': {
        let end = t;
        for (const tl of tiles) {
          const col = (tl.row === 'a' ? C.alignA : C.alignB)[tl.i];
          const from = tl.row === 'a' ? C.natA[tl.i] : C.natB[tl.i];
          if (col !== from) {
            end = Math.max(end, m.morph(tl.poly, hlTilePts(col, rowY(tl.row)), t, { dur: 1100 }));
            m.move([tl.text], hlX(col), rowY(tl.row), t, { dur: 1100, sound: false });
          }
        }
        t = end + 300;
        const shared: string[] = [];
        for (let c = 0; c < C.k; c++) {
          const id = `hj${uid++}`;
          t = m.rule(id, hlX(c), HL_RA + HL_TILE / 2, hlX(c), HL_RB - HL_TILE / 2, t, { color: 'c', width: 5 }) - 250;
          shared.push(id);
        }
        t += 250;
        const sharedTiles = tiles.filter((tl) => (tl.row === 'a' ? C.alignA : C.alignB)[tl.i] < C.k);
        if (sharedTiles.length) {
          m.fillTo(sharedTiles.map((x) => x.poly), 'c', t, 0.65);
          t = m.focus(sharedTiles.map((x) => x.text), t) + 300;
        }
        break;
      }
      case 'hcf': {
        for (const ids of lineIds) m.fadeOut(ids, t, 300);
        lineIds.length = 0;
        t += 350;
        if (C.k > 0) {
          const cx = hlX((C.k - 1) / 2);
          hcfBox = `hb${uid++}`;
          t = m.box(hcfBox, cx, (HL_RA + HL_RB) / 2, C.k * HL_PITCH + 6, HL_RB - HL_RA + HL_TILE + 22, t, 'result') + 200;
        }
        const r = line(L.texHcf, 0, t, L.hcf);
        t = r.end + 400;
        break;
      }
      case 'lcm': {
        if (hcfBox) m.fadeOut([hcfBox], t, 300);
        const cx = hlX((C.ncols - 1) / 2);
        lcmBox = `hb${uid++}`;
        t = m.box(lcmBox, cx, (HL_RA + HL_RB) / 2, C.ncols * HL_PITCH + 6, HL_RB - HL_RA + HL_TILE + 22, t + 200, 'accent') + 200;
        const r = line(L.texLcm, 1, t, L.lcm);
        t = r.end + 400;
        break;
      }
      case 'check': {
        const r = line(L.texCheck, 2, t);
        t = m.tick(`hk${uid++}`, Math.min(690, r.h.cx + r.h.w / 2 + 34), r.h.cy, r.end) + 300;
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  void lcmBox; void HL_PITCH;
  m.hold(t + 1600);
  return [m.build()];
}
