/**
 * DNA builder for the quadratic formula, derived (V51.9.48). On the left a square of side x and a strip of
 * area b·x: the strip is cut in half, the halves wrap two sides of the square, and the missing corner
 * square (b/2)² completes it. On the right the same steps are typeset in letters, and below them with the
 * numbers of one example. English and Malayalam classes have identical pictures; only the captions and the
 * two small row tags change language.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { STAGGER_TEXT } from '../../reels/motion/curves';
import type { Lang } from '../../reels/motion/captions';
import { becomeMath, mathBox, mathIds, placeMath, type MathHandle } from '../../reels/motion/typeset';
import type { Bi, QdPlan } from './types';
import { QD_PIECES as P, QD_S, qdBendPts, qdBraces, qdLines, qdRect, qdTitle, type QdBrace } from './qd-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
/** Where the typeset rows sit, how big, and how wide they may be. */
export const QD_PX = 534;
export const QD_PW = 330;
export const QD_SIZE = 30;
export const QD_SYM_Y = 172;
export const QD_NUM_Y = 330;
const TAG = { sym: { en: 'In letters', ml: 'അക്ഷരങ്ങളിൽ' }, num: { en: 'With numbers', ml: 'സംഖ്യകളിൽ' } };

export function buildQuadraticDerivation(plan: QdPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const { b, c } = plan;
  const L = qdLines(b, c);
  const B = qdBraces();
  let t = 300;
  let uid = 0;
  const pic: string[] = [];
  const o = { size: QD_SIZE, maxWidth: QD_PW, colors: { x: 'a' as const } };
  let sym!: MathHandle;
  let num!: MathHandle;

  const shape = (pts: Array<[number, number]>, color: string, f: { fill?: boolean; dashed?: boolean; closed?: boolean; dur?: number; alpha?: number; width?: number; z?: number } = {}): string => {
    const id = `qd${uid++}`;
    m.poly(id, pts, t, { color, closed: f.closed ?? true, fill: f.fill ? color : undefined, fillAlpha: f.alpha ?? 0.45, dashed: f.dashed, width: f.width ?? 3, dur: f.dur ?? 700, z: f.z ?? (f.fill ? 1 : 2) });
    pic.push(id);
    return id;
  };
  const label = (text: string, x: number, y: number, color: string, size: number): string => {
    const id = `qd${uid++}`;
    m.text(id, text, x, y, { size, color, z: 6 });
    pic.push(id);
    return id;
  };
  const brace = (br: QdBrace, color: string): string[] => {
    const a = shape(br.pts, color, { closed: false, width: 2.5, dur: 450, z: 3 });
    const l = label(br.text, br.at[0], br.at[1], color, br.size);
    m.appear([l], t + 300, 0, false);
    return [a, l];
  };
  const gone = (ids: string[], at = t) => {
    if (ids.length) m.fadeOut(ids, at, 350);
    for (const id of ids) {
      const i = pic.indexOf(id);
      if (i >= 0) pic.splice(i, 1);
    }
  };
  const mid = (r: { x0: number; x1: number; y0: number; y1: number }): [number, number] => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];

  const place = (which: 'sym' | 'num', tex: string) => {
    const cy = which === 'sym' ? QD_SYM_Y : QD_NUM_Y;
    const h = placeMath(m, `${which}${uid++}`, tex, QD_PX, cy, t, o);
    const end = Math.max(m.write(h.glyphs.map((g) => g.id), t, STAGGER_TEXT), t + (h.strokes.length ? 450 : 0));
    if (which === 'sym') sym = h; else num = h;
    return end;
  };
  /** Both rows turn into their next line together; returns when the slower one has settled. */
  const turn = (symTex: string | null, numTex: string | null): number => {
    let end = t;
    if (symTex) { const r = becomeMath(m, sym, `sym${uid++}`, symTex, t, { ...o, cx: QD_PX, cy: QD_SYM_Y }); sym = r.h; end = Math.max(end, r.end); }
    if (numTex) { const r = becomeMath(m, num, `num${uid++}`, numTex, t + 150, { ...o, cx: QD_PX, cy: QD_NUM_Y }); num = r.h; end = Math.max(end, r.end + 150); }
    return end + 250;
  };
  const boxRow = (h: MathHandle, at: number) => {
    const bx = mathBox(h);
    const id = `qb${uid++}`;
    boxes.push(id);
    return m.box(id, (bx.x0 + bx.x1) / 2, (bx.y0 + bx.y1) / 2, bx.x1 - bx.x0 + 26, bx.y1 - bx.y0 + 18, at, 'result');
  };

  const boxes: string[] = [];
  let tickId = '';
  let squareLab = '';
  let stripLab = '';
  let stripPoly = '';
  let halfA = '';
  let halfB = '';
  let halfLabs: string[] = [];
  let cornerPoly = '';
  let cornerLab = '';
  let seam = '';
  let bracesNow: Record<string, string[]> = {};
  let wholeLab = '';
  let rowTags: string[] = [];

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);
  else t = m.step(lang === 'ml' ? `${qdTitle(b, c)} — സൂത്രവാക്യം എവിടെനിന്ന്?` : `${qdTitle(b, c)}: where does the formula come from?`, t, 1400);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show': {
        shape(qdRect(P.square), 'a', { fill: true });
        squareLab = label('x²', ...mid(P.square), 'ink', 40);
        m.appear([squareLab], t + 400, 0, false);
        t += 800;
        stripPoly = shape(qdRect(P.strip), 'b', { fill: true });
        stripLab = label('bx', ...mid(P.strip), 'ink', 30);
        m.appear([stripLab], t + 400, 0, false);
        t += 800;
        bracesNow.side = brace(B.side, 'a');
        bracesNow.top = brace(B.top, 'a');
        bracesNow.stripW = brace(B.stripW, 'b');
        t += 700;
        const tagS = `qdt${uid++}`;
        const tagN = `qdt${uid++}`;
        m.text(tagS, pick(TAG.sym, lang), QD_PX, QD_SYM_Y - 86, { size: 18, color: 'carry', z: 5 });
        m.text(tagN, pick(TAG.num, lang), QD_PX, QD_NUM_Y - 86, { size: 18, color: 'carry', z: 5 });
        rowTags = [tagS, tagN];
        m.appear(rowTags, t, 0, false);
        let end = place('sym', L.sym.start);
        end = Math.max(end, (() => { const h = placeMath(m, `num${uid++}`, L.num.start, QD_PX, QD_NUM_Y, t + 200, o); num = h; return m.write(h.glyphs.map((g) => g.id), t + 200, STAGGER_TEXT); })());
        t = end + 500;
        t = turn(L.sym.moved, L.num.moved);
        break;
      }
      case 'split': {
        gone([stripPoly, stripLab, ...bracesNow.stripW]);
        t += 250;
        halfA = shape(qdRect(P.halfStay), 'b', { fill: true, dur: 300 });
        halfB = shape(qdRect(P.halfFrom), 'b', { fill: true, dur: 300 });
        t += 400;
        const la = label('½bx', ...mid(P.halfStay), 'ink', 18);
        const lb = label('½bx', ...mid(P.halfFrom), 'ink', 18);
        m.appear([la, lb], t, 0, false);
        halfLabs = [la, lb];
        bracesNow.stay = brace(B.stayW, 'b');
        bracesNow.half = brace(B.halfW, 'b');
        t += 800;
        t = turn(L.sym.split, L.num.split);
        break;
      }
      case 'bend': {
        const { to } = qdBendPts();
        gone(bracesNow.half);
        const tEnd = m.morph(halfB, to, t, { dur: 1300 });
        const g = P.halfTo;
        m.move([halfLabs[1]], (g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, t, { dur: 1300, sound: false });
        t = tEnd + 200;
        bracesNow.bottom = brace(B.bottomH, 'b');
        t += 700;
        break;
      }
      case 'corner': {
        cornerPoly = shape(qdRect(P.corner), 'result', { dashed: true, dur: 700, width: 3 });
        t += 800;
        cornerLab = label('(b/2)²', P.corner.x1 + 42, (P.corner.y0 + P.corner.y1) / 2, 'result', 18);
        m.appear([cornerLab], t, 0, false);
        t = m.focus([cornerPoly], t) + 400;
        t = turn(L.sym.corner, L.num.corner);
        break;
      }
      case 'square': {
        seam = cornerPoly;
        const fillId = shape(qdRect(P.corner), 'result', { fill: true, dur: 500 });
        void fillId;
        gone([seam]);
        t += 600;
        gone([...bracesNow.top, ...bracesNow.stay, ...bracesNow.side]);
        gone(bracesNow.bottom);
        t += 300;
        bracesNow.wholeTop = brace(B.wholeTop, 'ink');
        bracesNow.wholeSide = brace(B.wholeSide, 'ink');
        t += 800;
        wholeLab = label('(x + b/2)²', ...[(P.whole.x0 + P.whole.x1) / 2, P.whole.y1 + 30] as [number, number], 'ink', 22);
        m.appear([wholeLab], t, 0, false);
        t += 500;
        t = turn(L.sym.square, L.num.square);
        break;
      }
      case 'root': {
        t = m.focus([...bracesNow.wholeTop, ...bracesNow.wholeSide], t) + 300;
        t = turn(L.sym.root, L.num.root);
        break;
      }
      case 'answer': {
        t = turn(L.sym.answer, L.num.answer);
        t = turn(null, L.num.roots);
        boxRow(sym, t);
        t = boxRow(num, t + 200) + 300;
        const bx = mathBox(num);
        tickId = `qk${uid++}`;
        t = m.tick(tickId, bx.x1 + 34, (bx.y0 + bx.y1) / 2, t) + 300;
        break;
      }
      case 'formula': {
        m.dim(pic, t);
        m.fadeOut([...boxes, tickId].filter(Boolean), t, 300);
        boxes.length = 0;
        t += 350;
        t = turn(L.sym.formula, L.num.formula);
        t = turn(null, L.num.formula2);
        t = turn(L.sym.general, null);
        t = boxRow(sym, t) + 300;
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  void SCENE_H; void QD_S; void mathIds;
  m.hold(t + 1600);
  return [m.build()];
}
