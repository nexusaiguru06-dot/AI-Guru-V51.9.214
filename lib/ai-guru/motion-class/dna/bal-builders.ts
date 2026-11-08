/**
 * DNA builder for the balance scale (V51.9.43, rebuilt in V51.9.47): a x + b = c on a real scale.
 * The beam TIPS toward the heavier pan (the tilt is computed from the weights of the tiles), the
 * pans hang from it by strings, and whatever is done to one pan is done to the other: a tile lifts
 * off the left (the beam tips right), the same amount lifts off the right (it swings back level).
 * The right pan is split into a equal groups, one for every x, and the groups are removed in pairs.
 * The check puts the number back in and the scale balances. The equation is written line by line
 * under the scale, in the same colours.
 *
 * The planner gives the numbers and the order. The app computes every value, every tile and every
 * angle (bal-math.ts); English and Malayalam classes have identical pictures.
 */

import { ease, Motion, type MotionScene } from '../../reels/motion/engine';
import type { Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, BalPlan } from './types';
import { BALMAX, BALX, BAL_H, DISH, PAN_INNER, PANEL_DY, PANEL_ROWS, PANEL_Y0, SC, TW, balFacts, beamPoint, beamShape, cancelNote, divideNote, lineAnswer, lineCancel, lineCheck, lineDivide, lineMove, lineShow, lineSimplify, moveNote, panTop, rowLayout, stringsOf, sv, tiltFor, type Pt, type Tok } from './bal-math';

export { BALMAX, BALX, BAL_H } from './bal-math';
export const BALPANEL_Y = (k: number) => PANEL_Y0 + PANEL_DY * k;

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
type Side = 'L' | 'R';

interface Member {
  kind: 'poly' | 'text';
  side: Side;
  /** Relative to the middle of the pan's top surface. */
  local: Pt[];
}
interface Tile {
  side: Side;
  w: number;
  weight: number;
  cx: number;
  poly: string;
  label: string;
}

export function buildBalance(plan: BalPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, 720, BAL_H);
  m.camH.set(0, BAL_H);
  m.camY.set(0, BAL_H / 2);
  m.fixView(360, 720);
  const f = balFacts(plan);
  let t = 300;
  let uid = 0;
  let theta = 0;
  const members = new Map<string, Member>();
  const tiles: Record<Side, Tile[]> = { L: [], R: [] };
  let panel: Array<{ ids: string[]; y: number }> = [];
  let lastLine: { x0: number; x1: number; y: number; px: number } | null = null;

  const worldPt = (side: Side, p: Pt, th = theta): Pt => {
    const o = panTop(side, th);
    return [o[0] + p[0], o[1] + p[1]];
  };
  const weight = (side: Side) => tiles[side].reduce((a, x) => a + x.weight, 0);
  const lead = (side: Side, ids: string[]) => ids.filter((id) => members.get(id)?.side === side);

  /** Moves one pan member to where it belongs for the current tilt. */
  const animMember = (id: string, at: number, dur: number, e?: (p: number) => number) => {
    const mem = members.get(id)!;
    if (mem.kind === 'poly') m.morph(id, mem.local.map((p) => worldPt(mem.side, p)), at, { dur, e });
    else {
      const [x, y] = worldPt(mem.side, mem.local[0]);
      m.move(id, x, y, at, { dur, sound: false });
    }
  };
  const track = (id: string, kind: 'poly' | 'text', side: Side, local: Pt[]) => members.set(id, { kind, side, local });

  /** Tip the beam to what the weights say; the pans, strings and tiles hang from it. */
  const retilt = (at: number, dur = 850, e?: (p: number) => number): number => {
    const to = tiltFor(weight('L'), weight('R'));
    if (Math.abs(to - theta) < 1e-9) return at;
    m.morph('beam', beamShape(to), at, { dur, e });
    theta = to;
    for (const id of members.keys()) animMember(id, at, dur, e);
    (['L', 'R'] as Side[]).forEach((side) => stringsOf(side, to).forEach((s, i) => m.morph(`str${side}${i}`, [s[0], s[1]], at, { dur, e })));
    m.sound(at, 'swoosh', { dur });
    return at + dur;
  };

  /** The tiles of a pan stand side by side, centred; move the ones that have to shift. */
  const relayout = (side: Side, at: number, dur = 500) => {
    const cs = rowLayout(tiles[side].map((x) => x.w));
    tiles[side].forEach((tl, i) => {
      const dx = cs[i] - tl.cx;
      if (Math.abs(dx) < 1e-9) return;
      tl.cx = cs[i];
      for (const id of [tl.poly, tl.label]) {
        const mem = members.get(id)!;
        mem.local = mem.local.map((p) => [p[0] + dx, p[1]] as Pt);
        animMember(id, at, dur);
      }
    });
  };

  const labelSize = (label: string, w: number) => Math.min(36, Math.max(12, Math.floor(((w - 10) / Math.max(1, tokenWidth(label, 36))) * 36)));

  /** A tile in a pan: drawn (pen) now, label appears right after. */
  const addTile = (side: Side, w: number, role: Role, label: string, wt: number, o: { hollow?: boolean; at?: number } = {}): Tile => {
    const at = o.at ?? t;
    const id = `pl${uid++}`;
    const lid = `tx${uid++}`;
    const tl: Tile = { side, w, weight: wt, cx: 0, poly: id, label: lid };
    tiles[side].push(tl);
    const cs = rowLayout(tiles[side].map((x) => x.w));
    tl.cx = cs[cs.length - 1];
    const pts: Pt[] = [[tl.cx - w / 2, -SC.tileH], [tl.cx + w / 2, -SC.tileH], [tl.cx + w / 2, 0], [tl.cx - w / 2, 0]];
    track(id, 'poly', side, pts);
    track(lid, 'text', side, [[tl.cx, -SC.tileH / 2 + 1]]);
    const world = pts.map((p) => worldPt(side, p));
    m.poly(id, world, at, { color: role, fill: o.hollow ? undefined : role, fillAlpha: 0.5, closed: true, width: 3.2, dur: 450, z: 3, dashed: o.hollow, silent: true });
    const [lx, ly] = worldPt(side, [tl.cx, -SC.tileH / 2 + 1]);
    m.text(lid, label, lx, ly, { size: labelSize(label, w), color: role, z: 6, weight: '700' });
    m.appear([lid], at + 250, 0, false);
    // existing tiles make room
    const cs2 = rowLayout(tiles[side].map((x) => x.w));
    tiles[side].slice(0, -1).forEach((o2, i) => {
      const dx = cs2[i] - o2.cx;
      if (Math.abs(dx) < 1e-9) return;
      o2.cx = cs2[i];
      for (const k of [o2.poly, o2.label]) {
        const mem = members.get(k)!;
        mem.local = mem.local.map((p) => [p[0] + dx, p[1]] as Pt);
        animMember(k, at, 400);
      }
    });
    tl.cx = cs2[cs2.length - 1];
    return tl;
  };

  /** Lift a tile off its pan and let it go (it is no longer part of the scale). */
  const liftOff = (tl: Tile, at: number, up = 95): number => {
    tiles[tl.side] = tiles[tl.side].filter((x) => x !== tl);
    const p = members.get(tl.poly)!;
    members.delete(tl.poly);
    members.delete(tl.label);
    const ptsNow = p.local.map((q) => worldPt(tl.side, q));
    m.morph(tl.poly, ptsNow.map(([x, y]) => [x, y - up] as Pt), at, { dur: 650, e: ease.inOut });
    const { x: lx, y: ly } = m.pos(tl.label, at);
    m.move(tl.label, lx, ly - up, at, { dur: 650, sound: false });
    m.fadeOut([tl.poly, tl.label], at + 350, 350);
    return at + 700;
  };
  /** A tile disappears where it stands (it has been merged into another). */
  const dissolve = (tl: Tile, at: number): void => {
    tiles[tl.side] = tiles[tl.side].filter((x) => x !== tl);
    members.delete(tl.poly);
    members.delete(tl.label);
    m.fadeOut([tl.poly, tl.label], at, 350);
  };
  const find = (side: Side, pred: (x: Tile) => boolean) => tiles[side].find(pred);

  /* ---------------- the equation, written below the scale ---------------- */

  const line = (toks: Tok[], note?: string): string[] => {
    for (const l of panel) m.dim(l.ids, t);
    if (panel.length >= PANEL_ROWS) {
      const old = panel.shift()!;
      m.fadeOut(old.ids, t, 300);
      for (const l of panel) {
        l.y -= PANEL_DY;
        for (const id of l.ids) {
          const x = m.pos(id, t).x;
          m.move(id, x, l.y, t, { dur: 400, sound: false });
        }
      }
      t += 350;
    }
    const words = toks.map(([s]) => s);
    const total = (px: number) => words.reduce((w, s) => w + tokenWidth(s, px), 0) + Math.max(0, words.length - 1) * px * 0.3;
    let px = 34;
    if (total(px) > BALMAX) px = Math.max(12, Math.floor((34 * BALMAX) / total(34)));
    const y = PANEL_Y0 + PANEL_DY * panel.length;
    let x = BALX;
    const ids: string[] = [];
    toks.forEach(([s, color]) => {
      const wd = tokenWidth(s, px);
      const id = `tx${uid++}`;
      m.text(id, s, x + wd / 2, y, { size: px, color, z: 5 });
      ids.push(id);
      x += wd + px * 0.3;
    });
    lastLine = { x0: BALX, x1: x - px * 0.3, y, px };
    t = m.appear(ids, t, 0, false) + 250;
    if (note) {
      const npx = 20;
      const nw = tokenWidth(note, npx);
      const nid = `tx${uid++}`;
      m.text(nid, note, x + 18 + nw / 2, y, { size: npx, color: 'carry', z: 5 });
      ids.push(nid);
      t = m.appear([nid], t, 0, false) + 200;
    }
    panel.push({ ids, y });
    return ids;
  };

  /* ---------------- the scale itself ---------------- */

  const drawScale = () => {
    const cx = SC.px;
    m.poly('base', [[cx - 120, SC.py + 270], [cx + 120, SC.py + 270], [cx + 105, SC.py + 300], [cx - 105, SC.py + 300]], t, { color: 'result', fill: 'result', fillAlpha: 0.75, closed: true, width: 3, dur: 500, z: 1, silent: true });
    m.poly('post', [[cx - 15, SC.py], [cx + 15, SC.py], [cx + 26, SC.py + 270], [cx - 26, SC.py + 270]], t + 150, { color: 'b', fill: 'b', fillAlpha: 0.55, closed: true, width: 3, dur: 600, z: 1, silent: true });
    m.poly('beam', beamShape(0), t + 350, { color: 'ink', fill: 'carry', fillAlpha: 0.9, closed: true, width: 3, dur: 700, z: 2 });
    const hub = Array.from({ length: 16 }, (_, i) => [cx + 15 * Math.cos((i / 16) * Math.PI * 2), SC.py + 15 * Math.sin((i / 16) * Math.PI * 2)] as Pt);
    m.poly('hub', hub, t + 900, { color: 'ink', fill: 'accent', fillAlpha: 1, closed: true, width: 3, dur: 400, z: 4, silent: true });
    (['L', 'R'] as Side[]).forEach((side, k) => {
      const at = t + 900 + k * 150;
      stringsOf(side, 0).forEach((s, i) => m.poly(`str${side}${i}`, [s[0], s[1]], at, { color: 'ink', closed: false, width: 2.5, dur: 400, z: 1, silent: true }));
      track(`dish${side}`, 'poly', side, DISH);
      m.poly(`dish${side}`, DISH.map((p) => worldPt(side, p)), at + 100, { color: 'ink', fill: 'carry', fillAlpha: 0.6, closed: true, width: 3, dur: 500, z: 2, silent: true });
    });
    t += 1700;
  };

  const sparkle = (cx: number, cy: number, at: number) => {
    const cols: Role[] = ['a', 'b', 'c', 'carry', 'tick'];
    for (let i = 0; i < 10; i++) {
      const id = `sp${uid++}`;
      const ang = (i / 10) * Math.PI * 2;
      m.dot(id, cx, cy, at, { color: cols[i % cols.length], r: 6 });
      m.move(id, cx + Math.cos(ang) * 70, cy + Math.sin(ang) * 55, at + 100, { dur: 700, sound: false });
      m.fadeOut(id, at + 600, 400);
    }
  };

  /* ---------------- the steps ---------------- */

  const doShow = () => {
    drawScale();
    for (let i = 0; i < f.a0; i++) addTile('L', TW.x, 'a', f.letter, f.x, { at: t + i * 150 });
    if (f.b !== 0) addTile('L', TW.b, 'b', (f.b < 0 ? '−' : '') + sv(f, Math.abs(f.b)), f.b, { at: t + f.a0 * 150, hollow: f.b < 0 });
    t += (f.a0 + 1) * 150 + 500;
    t = retilt(t, 900); // the left pan is heavier for a moment…
    t += 200;
    for (let i = 0; i < f.d; i++) addTile('R', TW.x, 'a', f.letter, f.x, { at: t + i * 150 }); // x on the right pan too
    addTile('R', TW.c, 'c', sv(f, f.c), f.c, { at: t + f.d * 150 });
    t += f.d * 150 + 600;
    t = retilt(t, 1100, ease.back) + 200; // …then the right pan arrives and the scale swings level.
    line(lineShow(plan));
  };

  /** x on both sides: the same x tiles come off both pans, one pair at a time, so the scale stays level. */
  const doCancel = () => {
    for (let i = 0; i < f.d; i++) {
      const lx = tiles.L.filter((x) => x.w === TW.x)[0];
      const rx = tiles.R.filter((x) => x.w === TW.x)[0];
      m.focus([lx.poly, lx.label, rx.poly, rx.label], t);
      t += 450;
      liftOff(lx, t);
      t = liftOff(rx, t);
      relayout('L', t - 600);
      relayout('R', t - 600);
      t = retilt(t, 600) + 100; // equal weights leave, so the beam stays level
    }
    line(lineCancel(plan), cancelNote(plan, f.letter));
    if (f.a === 1 && f.b === 0) {
      finish();
      const [sx, sy] = panTop('R', theta);
      sparkle(sx, sy - 90, t - 600);
    }
  };

  const doMove = () => {
    const bTile = find('L', (x) => x.weight === f.b && x.w === TW.b)!;
    const cTile = find('R', (x) => x.w === TW.c)!;
    if (f.b > 0) {
      m.focus([bTile.poly, bTile.label], t);
      t += 500;
      t = liftOff(bTile, t);
      relayout('L', t - 600);
      t = retilt(t - 300, 900) + 200; // the right pan is heavier: the beam tips right
      // the right pan is 20 and 5 together…
      dissolve(cTile, t);
      t += 300;
      const n = addTile('R', TW.c, 'c', sv(f, f.n), f.n, { at: t });
      const piece = addTile('R', TW.b, 'b', sv(f, f.b), f.b, { at: t + 150 });
      t += 800;
      m.focus([piece.poly, piece.label], t);
      t += 500;
      t = liftOff(piece, t);
      relayout('R', t - 600);
      t = retilt(t - 300, 1100, ease.back) + 200; // …take the 5 away and the scale is level again
      void n;
    } else {
      const add = addTile('L', TW.b, 'b', `+${sv(f, Math.abs(f.b))}`, Math.abs(f.b), { at: t });
      t += 900;
      dissolve(bTile, t);
      dissolve(add, t);
      t += 400;
      relayout('L', t - 300);
      t = retilt(t, 900) + 200; // the left pan is heavier: tips left
      const extra = addTile('R', TW.b, 'b', `+${sv(f, Math.abs(f.b))}`, Math.abs(f.b), { at: t });
      t += 900;
      t = retilt(t, 1100, ease.back) + 100;
      dissolve(cTile, t);
      dissolve(extra, t);
      t += 400;
      addTile('R', TW.c, 'c', sv(f, f.n), f.n, { at: t });
      t += 700;
    }
    line(lineMove(plan), moveNote(plan));
  };

  const doSimplify = () => {
    const n = find('R', (x) => x.w === TW.c)!;
    m.focus([n.poly, n.label], t);
    t += 600;
    line(lineSimplify(plan));
    if (f.a === 1) finish();
  };

  const doDivide = () => {
    const src = find('R', (x) => x.w === TW.c)!;
    dissolve(src, t);
    t += 350;
    const vs: Tile[] = [];
    for (let i = 0; i < f.a; i++) vs.push(addTile('R', TW.v, 'result', sv(f, f.x), f.x, { at: t + i * 150 }));
    t += f.a * 150 + 600;
    line(lineDivide(plan), divideNote(f.a));
    // take one group: the extra x's and the extra pieces lift off, in pairs, so the scale stays level
    const xs = tiles.L.filter((x) => x.w === TW.x);
    for (let i = 1; i < f.a; i++) {
      m.focus([xs[i].poly, vs[i].poly], t);
      t += 350;
      liftOff(xs[i], t);
      t = liftOff(vs[i], t);
      relayout('L', t - 600);
      relayout('R', t - 600);
      t += 100;
    }
    t += 200;
  };

  const doAnswer = () => {
    const xT = find('L', (x) => x.w === TW.x)!;
    const vT = tiles.R[0];
    m.focus([xT.poly, xT.label, vT.poly, vT.label], t);
    m.swap(xT.label, sv(f, f.x), t + 300, 'result');
    t += 900;
    line(lineAnswer(plan));
    finish();
    const [sx, sy] = panTop('R', theta);
    sparkle(sx, sy - 90, t - 600);
  };

  const finish = () => {
    const ln = lastLine!;
    const bid = `bx${uid++}`;
    m.box(bid, (ln.x0 + ln.x1) / 2, ln.y, ln.x1 - ln.x0 + 24, ln.px + 6, t, 'result');
    panel[panel.length - 1].ids.push(bid);
    t += 700;
  };

  const doCheck = () => {
    for (const side of ['L', 'R'] as Side[]) for (const tl of [...tiles[side]]) dissolve(tl, t);
    t += 450;
    // the value tiles shrink a little when many of them share a pan, so they stay inside it
    const lw = Math.min(TW.v, Math.floor((PAN_INNER - (f.b !== 0 ? TW.b : 0) - SC.gap * f.a0) / f.a0));
    const rw = f.d > 0 ? Math.min(TW.v, Math.floor((PAN_INNER - TW.c - SC.gap * f.d) / f.d)) : TW.v;
    for (let i = 0; i < f.a0; i++) addTile('L', lw, 'result', sv(f, f.x), f.x, { at: t + i * 150 });
    if (f.b !== 0) addTile('L', TW.b, 'b', (f.b < 0 ? '−' : '') + sv(f, Math.abs(f.b)), f.b, { at: t + f.a0 * 150, hollow: f.b < 0 });
    t += (f.a0 + 1) * 150 + 400;
    t = retilt(t, 800) + 150;
    for (let i = 0; i < f.d; i++) addTile('R', rw, 'result', sv(f, f.x), f.x, { at: t + i * 150 });
    addTile('R', TW.c, 'c', sv(f, f.c), f.c, { at: t + f.d * 150 });
    t += f.d * 150 + 600;
    t = retilt(t, 1100, ease.back) + 150;
    line(lineCheck(plan));
    const ln = lastLine!;
    t = m.tick(`tk${uid++}`, Math.min(ln.x1 + 34, BALX + BALMAX + 40), ln.y, t, 36) + 100;
    const [sx, sy] = panTop('R', theta);
    sparkle(sx, sy - 90, t - 300);
    t += 400;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show': doShow(); break;
      case 'cancel': doCancel(); break;
      case 'move': doMove(); break;
      case 'simplify': doSimplify(); break;
      case 'divide': doDivide(); break;
      case 'answer': doAnswer(); break;
      case 'check': doCheck(); break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  void beamPoint;
  return [m.build()];
}
