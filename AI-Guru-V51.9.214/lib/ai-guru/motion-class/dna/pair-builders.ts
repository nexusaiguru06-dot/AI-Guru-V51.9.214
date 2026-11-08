/**
 * DNA builder for a pair of equations on two balance scales (V51.9.55).
 *
 * Each equation a x + b y = c is a scale that balances: the x tiles and the y tiles on the left pan,
 * the total on the right. A minus sign is a hollow tile. The two scales are put together (added or
 * subtracted) so the tiles of one unknown cancel and one scale is left; that scale is solved (shared
 * between the tiles), the value is put back into an equation (the number tile comes off both pans) to
 * find the other unknown, and both scales are checked with the answers.
 *
 * The planner gives the four-and-two numbers and the spoken captions. The app computes every value,
 * every tile and every angle (pair-math.ts), so English and Malayalam classes have identical pictures.
 */

import { ease, Motion, type MotionScene } from '../../reels/motion/engine';
import type { Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, PairPlan } from './types';
import {
  DISH_P, PAIR_H, PAIR_PAN_INNER, PBALMAX, PBALX, PPANEL_DY, PPANEL_ROWS, PPANEL_Y0, PS, PW, PY,
  beamPoly, combineNote, divideNote, lineCheck, lineCombine, lineDivide, lineDivideU, lineEq, lineKnown, lineReduced, lineSubst, lineUnknown,
  pairFacts, panTopPt, reducedNote, rowAt, stringsAt, tilt, type Pt, type Tok,
} from './pair-math';

export { PAIR_H, PBALMAX, PBALX } from './pair-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
type Side = 'L' | 'R';
type Kind = 'x' | 'y' | 'v';

interface Member {
  kind: 'poly' | 'text';
  side: Side;
  local: Pt[];
}
interface Tile {
  side: Side;
  kind: Kind;
  w: number;
  weight: number;
  cx: number;
  poly: string;
  label: string;
}

/** One compact scale: draws itself, tips like a real one and keeps its tiles on the pans. All times are given by the caller. */
function makeScale(m: Motion, key: string, py: number) {
  let uid = 0;
  let theta = 0;
  const ids = new Set<string>();
  const members = new Map<string, Member>();
  const tiles: Record<Side, Tile[]> = { L: [], R: [] };
  const nid = (p: string) => `${key}${p}${uid++}`;

  const worldPt = (side: Side, p: Pt, th = theta): Pt => {
    const o = panTopPt(side, th, py);
    return [o[0] + p[0], o[1] + p[1]];
  };
  const weight = (side: Side) => tiles[side].reduce((a, x) => a + x.weight, 0);
  const track = (id: string, kind: 'poly' | 'text', side: Side, local: Pt[]) => members.set(id, { kind, side, local });

  const animMember = (id: string, at: number, dur: number, e?: (p: number) => number) => {
    const mem = members.get(id)!;
    if (mem.kind === 'poly') m.morph(id, mem.local.map((p) => worldPt(mem.side, p)), at, { dur, e });
    else {
      const [x, y] = worldPt(mem.side, mem.local[0]);
      m.move(id, x, y, at, { dur, sound: false });
    }
  };

  const retilt = (at: number, dur = 800, e?: (p: number) => number): number => {
    const to = tilt(weight('L'), weight('R'));
    if (Math.abs(to - theta) < 1e-9) return at;
    m.morph(`${key}beam`, beamPoly(to, py), at, { dur, e });
    theta = to;
    for (const id of members.keys()) animMember(id, at, dur, e);
    (['L', 'R'] as Side[]).forEach((side) => stringsAt(side, to, py).forEach((s, i) => m.morph(`${key}str${side}${i}`, [s[0], s[1]], at, { dur, e })));
    m.sound(at, 'swoosh', { dur });
    return at + dur;
  };

  const shift = (side: Side, at: number, dur: number, except?: Tile) => {
    const cs = rowAt(tiles[side].map((x) => x.w));
    tiles[side].forEach((tl, i) => {
      if (tl === except) return;
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
  const relayout = (side: Side, at: number, dur = 450) => shift(side, at, dur);

  const labelSize = (label: string, w: number) => Math.min(30, Math.max(11, Math.floor(((w - 10) / Math.max(1, tokenWidth(label, 30))) * 30)));

  const draw = (at: number, tag?: string): number => {
    const cx = PS.px;
    const add = (id: string) => ids.add(id);
    const base = `${key}base`;
    const post = `${key}post`;
    const beam = `${key}beam`;
    const hub = `${key}hub`;
    [base, post, beam, hub].forEach(add);
    m.poly(base, [[cx - 92, py + PS.post], [cx + 92, py + PS.post], [cx + 80, py + PS.post + 24], [cx - 80, py + PS.post + 24]], at, { color: 'result', fill: 'result', fillAlpha: 0.75, closed: true, width: 3, dur: 450, z: 1, silent: true });
    m.poly(post, [[cx - 11, py], [cx + 11, py], [cx + 19, py + PS.post], [cx - 19, py + PS.post]], at + 120, { color: 'b', fill: 'b', fillAlpha: 0.55, closed: true, width: 3, dur: 500, z: 1, silent: true });
    m.poly(beam, beamPoly(0, py), at + 280, { color: 'ink', fill: 'carry', fillAlpha: 0.9, closed: true, width: 3, dur: 600, z: 2 });
    const circ = Array.from({ length: 14 }, (_, i) => [cx + 11 * Math.cos((i / 14) * Math.PI * 2), py + 11 * Math.sin((i / 14) * Math.PI * 2)] as Pt);
    m.poly(hub, circ, at + 700, { color: 'ink', fill: 'accent', fillAlpha: 1, closed: true, width: 3, dur: 350, z: 4, silent: true });
    (['L', 'R'] as Side[]).forEach((side, k) => {
      const a2 = at + 700 + k * 120;
      stringsAt(side, 0, py).forEach((s, i) => {
        const id = `${key}str${side}${i}`;
        add(id);
        m.poly(id, [s[0], s[1]], a2, { color: 'ink', closed: false, width: 2.5, dur: 350, z: 1, silent: true });
      });
      const dish = `${key}dish${side}`;
      add(dish);
      track(dish, 'poly', side, DISH_P);
      m.poly(dish, DISH_P.map((p) => worldPt(side, p)), a2 + 80, { color: 'ink', fill: 'carry', fillAlpha: 0.6, closed: true, width: 3, dur: 400, z: 2, silent: true });
    });
    if (tag) {
      const id = `${key}tag`;
      add(id);
      m.text(id, tag, 38, py + 6, { size: 28, color: 'ink', z: 5, weight: '700' });
      m.appear([id], at + 500, 0, false);
    }
    return at + 1400;
  };

  const addTile = (side: Side, kind: Kind, w: number, role: Role, label: string, wt: number, o: { hollow?: boolean; at: number }): Tile => {
    const at = o.at;
    const id = nid('pl');
    const lid = nid('tx');
    const tl: Tile = { side, kind, w, weight: wt, cx: 0, poly: id, label: lid };
    tiles[side].push(tl);
    ids.add(id);
    ids.add(lid);
    const cs = rowAt(tiles[side].map((x) => x.w));
    tl.cx = cs[cs.length - 1];
    const pts: Pt[] = [[tl.cx - w / 2, -PS.tileH], [tl.cx + w / 2, -PS.tileH], [tl.cx + w / 2, 0], [tl.cx - w / 2, 0]];
    track(id, 'poly', side, pts);
    track(lid, 'text', side, [[tl.cx, -PS.tileH / 2 + 1]]);
    m.poly(id, pts.map((p) => worldPt(side, p)), at, { color: role, fill: o.hollow ? undefined : role, fillAlpha: 0.5, closed: true, width: 3, dur: 420, z: 3, dashed: o.hollow, silent: true });
    const [lx, ly] = worldPt(side, [tl.cx, -PS.tileH / 2 + 1]);
    m.text(lid, label, lx, ly, { size: labelSize(label, w), color: role, z: 6, weight: '700' });
    m.appear([lid], at + 230, 0, false);
    shift(side, at, 380, tl);
    return tl;
  };

  const forget = (tl: Tile) => {
    tiles[tl.side] = tiles[tl.side].filter((x) => x !== tl);
    members.delete(tl.poly);
    members.delete(tl.label);
    ids.delete(tl.poly);
    ids.delete(tl.label);
  };
  /** Lift a tile off its pan and let it go. */
  const liftOff = (tl: Tile, at: number, up = 80): number => {
    const p = members.get(tl.poly)!;
    const ptsNow = p.local.map((q) => worldPt(tl.side, q));
    const { x: lx, y: ly } = m.pos(tl.label, at);
    forget(tl);
    m.morph(tl.poly, ptsNow.map(([x, y]) => [x, y - up] as Pt), at, { dur: 600, e: ease.inOut });
    m.move(tl.label, lx, ly - up, at, { dur: 600, sound: false });
    m.fadeOut([tl.poly, tl.label], at + 320, 320);
    return at + 650;
  };
  /** A tile disappears where it stands. */
  const dissolve = (tl: Tile, at: number): void => {
    forget(tl);
    m.fadeOut([tl.poly, tl.label], at, 320);
  };
  const find = (side: Side, kind: Kind) => tiles[side].find((x) => x.kind === kind);
  const fade = (at: number): void => {
    m.fadeOut([...ids], at, 450);
    ids.clear();
    members.clear();
    tiles.L = [];
    tiles.R = [];
  };
  const top = (side: Side): Pt => panTopPt(side, theta, py);
  return { draw, addTile, liftOff, dissolve, relayout, retilt, find, fade, top, tiles };
}

export function buildPair(plan: PairPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, 720, PAIR_H);
  m.camH.set(0, PAIR_H);
  m.camY.set(0, PAIR_H / 2);
  m.fixView(360, 720);
  const f = pairFacts(plan);
  let t = 300;
  let uid = 0;
  let panel: Array<{ ids: string[]; y: number }> = [];
  let lastLine: { x0: number; x1: number; y: number; px: number } | null = null;

  const xRole: Role = 'a';
  const yRole: Role = 'b';
  const keepRole = f.comb.keep === 'x' ? xRole : yRole;
  const otherRole = f.comb.keep === 'x' ? yRole : xRole;
  const tileLabel = (coef: number, letter: string, neg = false) => `${neg ? '−' : ''}${coef > 1 ? coef : ''}${letter}`;

  /* ---------------- the equations, written under the scales ---------------- */

  const line = (toks: Tok[], note?: string): void => {
    for (const l of panel) m.dim(l.ids, t);
    if (panel.length >= PPANEL_ROWS) {
      const old = panel.shift()!;
      m.fadeOut(old.ids, t, 300);
      for (const l of panel) {
        l.y -= PPANEL_DY;
        for (const id of l.ids) {
          const x = m.pos(id, t).x;
          m.move(id, x, l.y, t, { dur: 400, sound: false });
        }
      }
      t += 350;
    }
    const words = toks.map(([s]) => s);
    const total = (px: number) => words.reduce((w, s) => w + tokenWidth(s, px), 0) + Math.max(0, words.length - 1) * px * 0.3;
    let px = 30;
    if (total(px) > PBALMAX) px = Math.max(12, Math.floor((30 * PBALMAX) / total(30)));
    const y = PPANEL_Y0 + PPANEL_DY * panel.length;
    let x = PBALX;
    const ids: string[] = [];
    toks.forEach(([s, color]) => {
      const wd = tokenWidth(s, px);
      const id = `ln${uid++}`;
      m.text(id, s, x + wd / 2, y, { size: px, color, z: 5 });
      ids.push(id);
      x += wd + px * 0.3;
    });
    lastLine = { x0: PBALX, x1: x - px * 0.3, y, px };
    t = m.appear(ids, t, 0, false) + 220;
    if (note) {
      const npx = 18;
      const nw = tokenWidth(note, npx);
      const nid = `ln${uid++}`;
      m.text(nid, note, x + 16 + nw / 2, y, { size: npx, color: 'carry', z: 5 });
      ids.push(nid);
      t = m.appear([nid], t, 0, false) + 180;
    }
    panel.push({ ids, y });
  };

  const finish = () => {
    const ln = lastLine!;
    const bid = `bx${uid++}`;
    m.box(bid, (ln.x0 + ln.x1) / 2, ln.y, ln.x1 - ln.x0 + 22, ln.px + 6, t, 'result');
    panel[panel.length - 1].ids.push(bid);
    t += 600;
  };
  const sparkle = (cx: number, cy: number, at: number) => {
    const cols: Role[] = ['a', 'b', 'c', 'carry', 'tick'];
    for (let i = 0; i < 9; i++) {
      const id = `sp${uid++}`;
      const ang = (i / 9) * Math.PI * 2;
      m.dot(id, cx, cy, at, { color: cols[i % cols.length], r: 5 });
      m.move(id, cx + Math.cos(ang) * 60, cy + Math.sin(ang) * 45, at + 100, { dur: 650, sound: false });
      m.fadeOut(id, at + 550, 380);
    }
  };

  /** The tiles of one equation on its scale: the x tile and the y tile on the left, the total on the right. */
  const fillScale = (S: ReturnType<typeof makeScale>, e: { a: number; b: number; c: number }, at: number): number => {
    S.addTile('L', 'x', PW.t, xRole, tileLabel(e.a, f.lx), e.a * f.x, { at });
    S.addTile('L', 'y', PW.t, yRole, tileLabel(Math.abs(e.b), f.ly, e.b < 0), e.b * f.y, { at: at + 150, hollow: e.b < 0 });
    return at + 700;
  };

  let S0 = makeScale(m, 'p', PY[0]);
  let S1 = makeScale(m, 'q', PY[1]);
  let S2 = makeScale(m, 'r', PY[0]);
  let S3 = makeScale(m, 's', PY[0]);

  /* ---------------- the steps ---------------- */

  const doShow = () => {
    S0.draw(t, '(1)');
    t = S1.draw(t + 250, '(2)') + 400;
    const a = fillScale(S0, f.e1, t);
    fillScale(S1, f.e2, t + 100);
    t = Math.max(a, a + 100);
    const e = S0.retilt(t, 800);
    S1.retilt(t, 800);
    t = e + 200;
    S0.addTile('R', 'v', PW.v, 'c', String(f.e1.c), f.e1.c, { at: t });
    S1.addTile('R', 'v', PW.v, 'c', String(f.e2.c), f.e2.c, { at: t + 100 });
    t += 800;
    const e2 = S0.retilt(t, 1000, ease.back);
    S1.retilt(t, 1000, ease.back);
    t = e2 + 200;
    line(lineEq(f.e1, f.lx, f.ly));
    line(lineEq(f.e2, f.lx, f.ly));
  };

  const doCombine = () => {
    const drop = f.comb.drop;
    const d0 = S0.find('L', drop)!;
    const d1 = S1.find('L', drop)!;
    m.focus([d0.poly, d0.label, d1.poly, d1.label], t);
    t += 700;
    // the tiles of the unknown that cancels meet and vanish
    const p0 = S0.top('L');
    const p1 = S1.top('L');
    sparkle(p0[0], p0[1] - 40, t);
    sparkle(p1[0], p1[1] - 40, t + 100);
    S0.dissolve(d0, t);
    S1.dissolve(d1, t);
    t += 900;
    S0.fade(t);
    S1.fade(t);
    t += 600;
    S2.draw(t, '');
    t += 1300;
    S2.addTile('L', f.comb.keep === 'x' ? 'x' : 'y', PW.t, keepRole, tileLabel(f.comb.coef, f.kLetter), f.comb.coef * f.kv, { at: t });
    t += 500;
    S2.retilt(t, 700);
    t += 750;
    S2.addTile('R', 'v', PW.v, 'c', String(f.comb.rhs), f.comb.rhs, { at: t });
    t += 700;
    t = S2.retilt(t, 900, ease.back) + 150;
    line(lineCombine(f), combineNote(f));
  };

  const doSolve = () => {
    const l = S2.tiles.L[0];
    const r = S2.tiles.R[0];
    m.focus([l.poly, l.label, r.poly, r.label], t);
    t += 600;
    if (f.comb.coef > 1) {
      line(lineDivide(f), divideNote(f.comb.coef));
      S2.dissolve(l, t);
      S2.dissolve(r, t);
      t += 350;
      S2.addTile('L', f.comb.keep === 'x' ? 'x' : 'y', PW.t, keepRole, f.kLetter, f.kv, { at: t });
      S2.addTile('R', 'v', PW.v, 'result', String(f.kv), f.kv, { at: t + 150 });
      t += 900;
      t = S2.retilt(t, 500) + 100;
    }
    line(lineKnown(f));
    finish();
    const [sx, sy] = S2.top('R');
    sparkle(sx, sy - 70, t - 500);
  };

  const doBack = () => {
    S2.fade(t);
    t += 600;
    S3.draw(t, '');
    t += 1300;
    const b = f.back;
    const kx = f.comb.keep === 'x';
    const uTile = () => S3.addTile('L', kx ? 'y' : 'x', PW.t, otherRole, tileLabel(b.coefU, f.uLetter), b.coefU * f.uv, { at: t });
    const nTile = () => S3.addTile('L', 'v', PW.v, 'result', String(b.num), b.num, { at: t });
    if (kx) {
      nTile();
      t += 150;
      uTile();
    } else {
      uTile();
      t += 150;
      nTile();
    }
    t += 600;
    S3.retilt(t, 800);
    t += 850;
    const e = f.back.eq === 1 ? f.e1 : f.e2;
    S3.addTile('R', 'v', PW.v, 'c', String(e.c), e.c, { at: t });
    t += 700;
    t = S3.retilt(t, 900, ease.back) + 150;
    line(lineSubst(f));
    // take the number off both pans
    const num = S3.find('L', 'v')!;
    m.focus([num.poly, num.label], t);
    t += 500;
    S3.liftOff(num, t);
    S3.relayout('L', t - 450);
    t = S3.retilt(t - 250, 800) + 150; // the right pan is heavier now
    const cT = S3.find('R', 'v')!;
    S3.dissolve(cT, t);
    t += 300;
    S3.addTile('R', 'v', PW.v, 'result', String(b.n), b.n, { at: t });
    const piece = S3.addTile('R', 'v', PW.v - 6, 'carry', String(b.num), b.num, { at: t + 150 });
    t += 800;
    m.focus([piece.poly, piece.label], t);
    t += 450;
    t = S3.liftOff(piece, t);
    S3.relayout('R', t - 450);
    t = S3.retilt(t - 250, 900, ease.back) + 150;
    line(lineReduced(f), reducedNote(f));
    if (b.coefU > 1) {
      const uT = S3.find('L', kx ? 'y' : 'x')!;
      const nR = S3.find('R', 'v')!;
      m.focus([uT.poly, uT.label, nR.poly, nR.label], t);
      t += 500;
      line(lineDivideU(f), divideNote(b.coefU));
      S3.dissolve(uT, t);
      S3.dissolve(nR, t);
      t += 350;
      S3.addTile('L', kx ? 'y' : 'x', PW.t, otherRole, f.uLetter, f.uv, { at: t });
      S3.addTile('R', 'v', PW.v, 'result', String(f.uv), f.uv, { at: t + 150 });
      t += 900;
      t = S3.retilt(t, 500) + 100;
    }
    line(lineUnknown(f));
    finish();
    const [sx, sy] = S3.top('R');
    sparkle(sx, sy - 70, t - 500);
  };

  const doCheck = () => {
    // a fresh page for the two checks, so both lines and their ticks stay where they were written
    for (const l of panel) m.fadeOut(l.ids, t, 350);
    panel = [];
    S3.fade(t);
    t += 600;
    S0 = makeScale(m, 'u', PY[0]);
    S1 = makeScale(m, 'v', PY[1]);
    S0.draw(t, '(1)');
    t = S1.draw(t + 250, '(2)') + 400;
    const eqs = [f.e1, f.e2];
    [S0, S1].forEach((S, i) => {
      const e = eqs[i];
      S.addTile('L', 'x', PW.v, xRole, String(e.a * f.x), e.a * f.x, { at: t + i * 100 });
      S.addTile('L', 'y', PW.v, yRole, `${e.b < 0 ? '−' : ''}${Math.abs(e.b) * f.y}`, e.b * f.y, { at: t + 150 + i * 100, hollow: e.b < 0 });
    });
    t += 800;
    const e1 = S0.retilt(t, 700);
    S1.retilt(t, 700);
    t = e1 + 150;
    S0.addTile('R', 'v', PW.v, 'c', String(f.e1.c), f.e1.c, { at: t });
    S1.addTile('R', 'v', PW.v, 'c', String(f.e2.c), f.e2.c, { at: t + 100 });
    t += 800;
    const e2 = S0.retilt(t, 1000, ease.back);
    S1.retilt(t, 1000, ease.back);
    t = e2 + 150;
    [f.e1, f.e2].forEach((e, i) => {
      line(lineCheck(e, f));
      const ln = lastLine!;
      t = m.tick(`tk${uid++}`, Math.min(ln.x1 + 30, PBALX + PBALMAX + 36), ln.y, t, 32) + 100;
      const [sx, sy] = (i === 0 ? S0 : S1).top('R');
      sparkle(sx, sy - 70, t - 300);
    });
    t += 300;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show': doShow(); break;
      case 'combine': doCombine(); break;
      case 'solve': doSolve(); break;
      case 'back': doBack(); break;
      case 'check': doCheck(); break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  void PAIR_PAN_INNER;
  return [m.build()];
}
