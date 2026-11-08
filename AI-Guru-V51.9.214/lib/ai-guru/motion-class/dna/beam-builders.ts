/**
 * DNA builder for the balance scale in the "beam" look (V51.9.65): a flat beam on a triangle, the
 * tiles standing on it (x tiles and numbers), the equation written line by line underneath with the
 * "=" signs lined up. Digits that carry over fly from one line to the next, and a thin ring in the
 * digit's own colour marks whatever the step is working on. V51.9.125: every line stays on the board (the rows are
 * sized so the whole working fits), every line has a small note on its right, the ringed digits turn orange, and the
 * digits visibly make the next line: +5 flies across and turns into −5, 25 − 5 fly together into 20, 20 over 2 into 10. Same plan, same maths and same colours as the tipping-pan scale (bal-builders.ts);
 * only the picture is quieter and easier to read on a phone.
 *
 * Every number comes from bal-math.ts, so English and Malayalam classes draw identical pictures.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { roleColor, type Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, BalPlan } from './types';
import { balFacts, lineAnswer, lineCancel, lineCheck, lineDivide, lineMove, lineShow, lineSimplify, stepNote, sv, type Pt, type Tok } from './bal-math';

export const BEAM_H = 710;
const BEAM_Y = 110; // top of the beam; tiles stand on it
const TILE_H = 78;
const GAP = 8;
const GROUP_W = 310; // widest row of tiles on one side
const GX = { L: 190, R: 530 } as const;
const BASE = { x: 88, b: 88, c: 150, v: 100 };
const EQX = 290; // the "=" sign of every line is centred here
const ROW0 = 250;
const ROW_MAX = 82;

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
type Side = 'L' | 'R';
interface TokInfo {
  s: string;
  color: Role;
  x: number;
  y: number;
  w: number;
  px: number;
}
interface RowItem {
  id: string;
  x: number;
  y: number;
  bar?: [number, number];
}
interface Row {
  toks: string[];
  items: RowItem[];
}
interface Tile {
  side: Side;
  base: number;
  cx: number;
  w: number;
  role: Role;
  poly: string;
  label: string;
  kind: 'x' | 'b' | 'c' | 'v';
}

const rect = (cx: number, w: number): Pt[] => [[cx - w / 2, BEAM_Y - TILE_H], [cx + w / 2, BEAM_Y - TILE_H], [cx + w / 2, BEAM_Y - 1], [cx - w / 2, BEAM_Y - 1]];
const blob = (cx: number, cy: number, rx: number, ry: number): Pt[] => Array.from({ length: 24 }, (_, i) => [cx + rx * Math.cos((i / 24) * Math.PI * 2), cy + ry * Math.sin((i / 24) * Math.PI * 2)] as Pt);

export function buildBeam(plan: BalPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, 720, BEAM_H);
  m.camH.set(0, BEAM_H);
  m.camY.set(0, BEAM_H / 2);
  m.fixView(360, 720);
  const f = balFacts(plan);
  let t = 300;
  let uid = 0;
  const tiles: Record<Side, Tile[]> = { L: [], R: [] };
  const rows: Row[] = [];
  const info = new Map<string, TokInfo>();
  let rowY = ROW0;
  const nRows = Math.max(1, plan.steps.length);
  const ROW_BOTTOM = BEAM_H - 14;
  // V51.9.125: a fraction row is 44 taller; leave room for it so the working never has to scroll a line away
  const nFrac = plan.steps.filter((s) => s.op === 'divide').length;
  const ROW_DY = Math.min(ROW_MAX, Math.floor((ROW_BOTTOM - ROW0 - 44 - 44 * nFrac) / nRows));
  const L = lang === 'ml' ? 'ml' : 'en';
  const note = (op: string) => stepNote(plan, op, L);
  const PX = Math.min(54, Math.floor(ROW_DY * 0.76));
  const ghosts: Tile[] = [];
  let marks: string[] = [];
  /** V51.9.125: digits turned orange by a ring, with the colour they go back to. */
  let lit: Array<[string, Role]> = [];
  let last: { x0: number; x1: number; y: number; px: number } | null = null;

  /* ---------------- tiles on the beam ---------------- */

  const layout = (side: Side, at: number, dur = 450, newTile?: Tile) => {
    const ts = tiles[side];
    if (!ts.length) return;
    const raw = ts.reduce((a, x) => a + x.base, 0) + GAP * (ts.length - 1);
    const k = Math.min(1, GROUP_W / raw);
    let x = GX[side] - (raw * k) / 2;
    for (const tl of ts) {
      const w = tl.base * k;
      const cx = x + w / 2;
      x += w + GAP;
      if (tl === newTile) {
        tl.cx = cx;
        tl.w = w;
        continue;
      }
      if (Math.abs(cx - tl.cx) < 0.01 && Math.abs(w - tl.w) < 0.01) continue;
      tl.cx = cx;
      tl.w = w;
      m.morph(tl.poly, rect(cx, w), at, { dur });
      m.move(tl.label, cx, BEAM_Y - TILE_H / 2 + 1, at, { dur, sound: false });
    }
  };
  const labelSize = (label: string, base: number) => Math.min(38, Math.max(14, Math.floor(((base - 12) / Math.max(1, tokenWidth(label, 38))) * 38)));

  const addTile = (side: Side, kind: Tile['kind'], role: Role, label: string, o: { hollow?: boolean; at?: number } = {}): Tile => {
    const at = o.at ?? t;
    const base = BASE[kind];
    const tl: Tile = { side, base, cx: 0, w: base, role, poly: `pl${uid++}`, label: `tx${uid++}`, kind };
    tiles[side].push(tl);
    // position the new tile first, then make room for it
    const raw = tiles[side].reduce((a, x) => a + x.base, 0) + GAP * (tiles[side].length - 1);
    const k = Math.min(1, GROUP_W / raw);
    layout(side, at, 400, tl);
    m.poly(tl.poly, rect(tl.cx, tl.w), at, { color: role, fill: o.hollow ? undefined : role, fillAlpha: 0.28, closed: true, width: 3.2, dur: 400, z: 3, dashed: o.hollow, silent: true });
    m.text(tl.label, label, tl.cx, BEAM_Y - TILE_H / 2 + 1, { size: labelSize(label, base * k), color: role, z: 6, weight: '700' });
    m.appear([tl.label], at + 220, 0, false);
    // the older tiles (laid out above with the new one skipped) already moved
    return tl;
  };
  const drop = (tl: Tile, at: number, dur = 350) => {
    tiles[tl.side] = tiles[tl.side].filter((x) => x !== tl);
    m.fadeOut([tl.poly, tl.label], at, dur);
  };
  const ghost = (tl: Tile, at: number) => {
    tiles[tl.side] = tiles[tl.side].filter((x) => x !== tl);
    ghosts.push(tl);
    m.dim([tl.poly, tl.label], at, 500);
  };
  const first = (side: Side, kind: Tile['kind']) => tiles[side].find((x) => x.kind === kind);

  const drawBeam = () => {
    m.poly('beam', [[36, BEAM_Y], [684, BEAM_Y], [684, BEAM_Y + 13], [36, BEAM_Y + 13]], t, { color: 'ink', fill: 'ink', fillAlpha: 1, closed: true, width: 3, dur: 600, z: 2, silent: true });
    m.poly('tri', [[360, BEAM_Y + 13], [318, BEAM_Y + 92], [402, BEAM_Y + 92]], t + 250, { color: 'ink', fill: 'result', fillAlpha: 0.85, closed: true, width: 3, dur: 600, z: 2, silent: true });
    m.rule('ground', 300, BEAM_Y + 92, 420, BEAM_Y + 92, t + 500, { color: 'ink', width: 4 });
    t += 1300;
  };

  /* ---------------- focus: a thin ring in the colour of the digit ---------------- */

  const ring = (ids: string[], at: number) => {
    const ps = ids.map((id) => info.get(id)).filter((p): p is TokInfo => !!p);
    if (!ps.length) return;
    const x0 = Math.min(...ps.map((p) => p.x - p.w / 2));
    const x1 = Math.max(...ps.map((p) => p.x + p.w / 2));
    const px = Math.max(...ps.map((p) => p.px));
    const cy = ps.reduce((a, p) => a + p.y, 0) / ps.length;
    const col = ps[ps.length - 1].color;
    const rid = `rg${uid++}`;
    m.poly(rid, blob((x0 + x1) / 2, cy, (x1 - x0) / 2 + px * 0.34, px * 0.72), at, { color: col === 'ink' ? 'accent' : col, closed: true, width: 3.4, dur: 450, z: 7, silent: true });
    marks.push(rid);
    // V51.9.125: the ringed digits change colour too (orange), and keep it while they fly into the next line
    for (const id of ids) {
      const p = info.get(id);
      if (!p || lit.some(([x]) => x === id)) continue;
      m.get(id).color.to(at + 150, 300, roleColor('carry'));
      lit.push([id, p.color]);
    }
    m.sound(at, 'tick', { pitch: 1.2 });
  };
  const clearMarks = (at: number) => {
    if (marks.length) m.fadeOut(marks, at, 350);
    marks = [];
    for (const [id, c] of lit) m.get(id).color.to(at, 350, roleColor(c));
    lit = [];
  };

  /* ---------------- the equation, one line at a time ---------------- */

  /** Moves every row up by `by`; rows that leave the top of the working area fade away. */
  const scroll = (by: number, at: number) => {
    for (const r of rows) {
      for (const it of r.items) {
        it.y -= by;
        if (it.bar) m.morph(it.id, [[it.bar[0], it.y], [it.bar[1], it.y]], at, { dur: 450 });
        else m.move(it.id, it.x, it.y, at, { dur: 450, sound: false });
        const inf = info.get(it.id);
        if (inf) inf.y = it.y;
      }
    }
    // V51.9.125: no line is ever faded away (the rows are sized to fit; this is only a safety net)
    rowY -= by;
  };

  /**
   * Writes one line under the last. A token the previous line already had flies down from it. `links` (by index into
   * `toks`) name the earlier tokens a new token is MADE from: one → it flies and turns into the new text (+5 → −5);
   * several → they fly together and merge into it (25 − 5 → 20). The note is written small on the right.
   */
  const line = (toks: Tok[], o: { note?: string; fraction?: boolean; links?: Record<number, string[]>; boxed?: boolean } = {}): { ids: string[]; byTok: string[] } => {
    for (const r of rows) m.dim(r.items.map((i) => i.id), t);
    const eq = toks.findIndex(([s]) => s === '=');
    const left = toks.slice(0, eq);
    const right = toks.slice(eq + 1);
    const gap = (px: number) => px * 0.3;
    const tight = (ts: Tok[], i: number) => i < ts.length - 1 && ts[i][1] === 'a' && /^\d+$/.test(ts[i][0]) && ts[i + 1][0] === f.letter;
    const wOf = (ts: Tok[], px: number) => ts.reduce((a, [s]) => a + tokenWidth(s, px), 0) + ts.reduce((a, _t, i) => a + (i < ts.length - 1 ? (tight(ts, i) ? 2 : gap(px)) : 0), 0);
    let px = PX;
    const room = (p: number) => Math.min(EQX - 22 - tokenWidth('=', p) / 2 - wOf(left, p), 690 - (EQX + 22 + tokenWidth('=', p) / 2 + wOf(right, p)));
    while (px > 20 && room(px) < 0) px -= 2;
    const h = o.fraction ? ROW_DY + 44 : ROW_DY;
    if (rowY + h > ROW_BOTTOM) scroll(rowY + h - ROW_BOTTOM, t);
    const y = rowY + (o.fraction ? 22 : 0);
    rowY += h;
    const prevIds = rows.length ? rows[rows.length - 1].toks : [];
    const linked = new Set(Object.values(o.links ?? {}).flat());
    const used = new Set<string>(linked);
    const ids: string[] = [];
    const byTok: string[] = [];
    const items: RowItem[] = [];
    const late: string[] = [];
    const merges: Array<{ id: string; from: string[]; x: number; y: number }> = [];
    const turns: Array<{ id: string; to: string; color: Role }> = [];
    let flown = false;
    const fly = (id: string, x: number, yy: number) => {
      flown = true;
      m.appear([id], t, 0, false);
      m.move(id, x, yy, t + 300, { dur: 700, arc: 26, sound: false });
    };
    const put = (s: string, color: Role, x: number, k: number, yy = y, size = px): string => {
      const id = `tx${uid++}`;
      const link = (o.links?.[k] ?? []).filter((sid) => info.has(sid));
      info.set(id, { s, color, x, y: yy, w: tokenWidth(s, size), px: size });
      ids.push(id);
      items.push({ id, x, y: yy });
      if (link.length > 1) {
        m.text(id, s, x, yy, { size, color, z: 5 });
        merges.push({ id, from: link, x, y: yy });
      } else if (link.length === 1) {
        const from = info.get(link[0])!;
        m.text(id, from.s, from.x, from.y, { size, color, z: 5 });
        fly(id, x, yy);
        if (from.s !== s) turns.push({ id, to: s, color });
      } else {
        const fromId = s !== '=' ? prevIds.find((pid) => !used.has(pid) && info.get(pid)?.s === s) : undefined;
        if (fromId) {
          used.add(fromId);
          const from = info.get(fromId)!;
          m.text(id, s, from.x, from.y, { size, color, z: 5 });
          fly(id, x, yy);
        } else {
          m.text(id, s, x, yy, { size, color, z: 5 });
          late.push(id);
        }
      }
      return id;
    };
    let x = EQX - 22 - tokenWidth('=', px) / 2 - wOf(left, px);
    const x0 = x;
    left.forEach(([s, c], i) => {
      const w = tokenWidth(s, px);
      byTok.push(put(s, c, x + w / 2, i));
      x += w + (tight(left, i) ? 2 : gap(px));
    });
    byTok.push(put('=', 'ink', EQX, eq));
    x = EQX + 22 + tokenWidth('=', px) / 2;
    if (o.fraction) {
      const num = right[0];
      const den = right[right.length - 1];
      const fw = Math.max(tokenWidth(num[0], px), tokenWidth(den[0], px)) + 26;
      const cx = x + fw / 2;
      byTok.push(put(num[0], num[1], cx, eq + 1, y - 28));
      byTok.push(put(den[0], den[1], cx, toks.length - 1, y + 30));
      const rid = `ru${uid++}`;
      m.poly(rid, [[x, y], [x + fw, y]], t + 700, { color: 'ink', closed: false, width: 3, dur: 400, z: 5, silent: true });
      ids.push(rid);
      items.push({ id: rid, x: x, y, bar: [x, x + fw] });
      x += fw;
    } else {
      right.forEach(([s, c], i) => {
        const w = tokenWidth(s, px);
        byTok.push(put(s, c, x + w / 2, eq + 1 + i));
        x += w + (tight(right, i) ? 2 : gap(px));
      });
      x -= gap(px);
    }
    last = { x0, x1: x, y, px };
    // a digit that changes on the way (+ → −) turns as it lands; several digits fly together into one
    let base = flown ? t + 700 : t;
    for (const tn of turns) base = Math.max(base, m.swap(tn.id, tn.to, t + 1000, tn.color));
    for (const mg of merges) {
      const flyers = mg.from.map((sid) => m.clone(sid, `fl${uid++}`, t + 300));
      base = Math.max(base, m.merge(flyers, mg.id, mg.x, mg.y, t + 300, 1000));
    }
    m.appear(late, base, 0, false);
    t = base + 450;
    if (o.note) t = sideNote(o.note, x + (o.boxed ? 18 : 0), y, ids, items); // the answer box comes 15 wider
    rows.push({ toks: byTok, items });
    return { ids, byTok };
  };

  /** V51.9.125: a small green note right of a line, made smaller (or left out) when the line is long. */
  const sideNote = (txt: string, xEnd: number, y: number, ids?: string[], items?: RowItem[]): number => {
    let npx = 24;
    const x = xEnd + 18;
    while (npx > 15 && x + tokenWidth(txt, npx) > 712) npx -= 1;
    if (x + tokenWidth(txt, npx) > 712) return t;
    const nid = `tx${uid++}`;
    const cx = x + tokenWidth(txt, npx) / 2;
    m.text(nid, txt, cx, y, { size: npx, color: 'tick', z: 5 });
    ids?.push(nid);
    if (items) items.push({ id: nid, x: cx, y });
    else rows[rows.length - 1]?.items.push({ id: nid, x: cx, y });
    return m.appear([nid], t, 0, false) + 150;
  };

  /** The token ids of the last written line. */
  const lastRow = () => rows[rows.length - 1].toks;
  const colorOf = (id: string) => info.get(id)?.color;
  const sOf = (id: string) => info.get(id)?.s;

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

  const finish = () => {
    const ln = last!;
    const bid = `bx${uid++}`;
    const cx = (ln.x0 + ln.x1) / 2;
    m.box(bid, cx, ln.y, ln.x1 - ln.x0 + 30, ln.px + 22, t, 'accent');
    rows[rows.length - 1].items.push({ id: bid, x: cx, y: ln.y });
    t += 600;
  };

  /* ---------------- the steps ---------------- */

  const doShow = () => {
    drawBeam();
    for (let i = 0; i < f.a0; i++) addTile('L', 'x', 'a', f.letter, { at: t + i * 150 });
    if (f.b !== 0) addTile('L', 'b', 'b', (f.b < 0 ? '−' : '') + sv(f, Math.abs(f.b)), { at: t + f.a0 * 150, hollow: f.b < 0 });
    t += (f.a0 + 1) * 150 + 300;
    for (let i = 0; i < f.d; i++) addTile('R', 'x', 'a', f.letter, { at: t + i * 150 });
    addTile('R', 'c', 'c', sv(f, f.c), { at: t + f.d * 150 });
    t += f.d * 150 + 700;
    const { byTok } = line(lineShow(plan), { note: note('show') });
    if (f.a0 > 1) {
      ring([byTok[0]], t);
      t += 700;
      clearMarks(t);
    }
    t += 200;
  };

  const doCancel = () => {
    const prev = lastRow();
    const eq = prev.findIndex((id) => sOf(id) === '=');
    const rx = prev.slice(eq + 1).filter((id) => sOf(id) === f.letter || colorOf(id) === 'a');
    if (rx.length) ring(rx, t);
    for (let i = 0; i < f.d; i++) {
      const lx = tiles.L.find((x) => x.kind === 'x')!;
      const rt = tiles.R.find((x) => x.kind === 'x')!;
      m.focus([lx.poly, lx.label, rt.poly, rt.label], t);
      t += 450;
      drop(lx, t);
      drop(rt, t);
      layout('L', t, 450);
      layout('R', t, 450);
      t += 650;
    }
    line(lineCancel(plan), { note: note('cancel') });
    clearMarks(t);
    if (f.a === 1 && f.b === 0) {
      finish();
      sparkle(GX.R, BEAM_Y - 90, t - 500);
    }
  };

  const doMove = () => {
    const prev = lastRow();
    const eq = prev.findIndex((id) => sOf(id) === '=');
    const bi = prev.findIndex((id, i) => i < eq && colorOf(id) === 'b');
    if (bi > 0) ring([prev[bi - 1], prev[bi]], t);
    const bTile = first('L', 'b');
    if (bTile) m.focus([bTile.poly, bTile.label], t);
    t += 900;
    if (bTile) {
      drop(bTile, t);
      layout('L', t, 450);
    }
    const cTile = first('R', 'c')!;
    drop(cTile, t);
    t += 300;
    addTile('R', 'c', 'c', sv(f, f.n), { at: t });
    t += 600;
    // the sign flies across the "=" and turns: +5 becomes −5 (the 5 flies with it)
    const toks = lineMove(plan);
    const { byTok } = line(toks, { note: note('move'), links: bi > 0 ? { [toks.length - 2]: [prev[bi - 1]], [toks.length - 1]: [prev[bi]] } : undefined });
    clearMarks(t);
    const n = byTok.length;
    ring([byTok[n - 2], byTok[n - 1]], t);
    t += 800;
    clearMarks(t);
  };

  const doSimplify = () => {
    const prev = lastRow();
    const eq = prev.findIndex((id) => sOf(id) === '=');
    ring(prev.slice(eq + 1), t);
    t += 800;
    // 25 − 5 fly together and become 20
    const toks = lineSimplify(plan);
    const { byTok } = line(toks, { boxed: f.a === 1, note: note('simplify'), links: { [toks.length - 1]: prev.slice(eq + 1) } });
    clearMarks(t);
    if (f.a === 1) finish();
    else {
      ring([byTok[byTok.length - 1]], t);
      t += 600;
      clearMarks(t);
    }
  };

  const doDivide = () => {
    const prev = lastRow();
    ring([prev[0]], t);
    t += 600;
    const src = first('R', 'c')!;
    drop(src, t);
    t += 350;
    const vs: Tile[] = [];
    for (let i = 0; i < f.a; i++) vs.push(addTile('R', 'v', 'result', sv(f, f.n / f.a), { at: t + i * 150 }));
    t += f.a * 150 + 500;
    // the 2 that multiplied x flies down under 20
    const { byTok } = line(lineDivide(plan), { fraction: true, note: note('divide') });
    clearMarks(t);
    ring([byTok[byTok.length - 1]], t);
    t += 700;
    const xs = tiles.L.filter((x) => x.kind === 'x');
    for (let i = 1; i < f.a; i++) {
      ghost(xs[i], t);
      ghost(vs[i], t);
    }
    t += 700;
    clearMarks(t);
  };

  const doAnswer = () => {
    const prev = lastRow();
    const eq = prev.findIndex((id) => sOf(id) === '=');
    const frac = prev.slice(eq + 1);
    ring(frac, t);
    const xT = tiles.L.find((x) => x.kind === 'x');
    if (xT) m.focus([xT.poly, xT.label], t);
    t += 700;
    // 20 over 2 fly together and become 10
    const toks = lineAnswer(plan);
    const { byTok } = line(toks, { boxed: true, note: note('answer'), links: frac.length > 1 ? { [toks.length - 1]: frac } : undefined });
    clearMarks(t);
    ring([byTok[byTok.length - 1]], t);
    t += 700;
    clearMarks(t);
    finish();
    sparkle(GX.R, BEAM_Y - 90, t - 500);
  };

  const doCheck = () => {
    for (const side of ['L', 'R'] as Side[]) for (const tl of [...tiles[side]]) drop(tl, t);
    for (const g of ghosts) m.fadeOut([g.poly, g.label], t, 350);
    ghosts.length = 0;
    t += 500;
    for (let i = 0; i < f.a0; i++) addTile('L', 'v', 'result', sv(f, f.x), { at: t + i * 150 });
    if (f.b !== 0) addTile('L', 'b', 'b', (f.b < 0 ? '−' : '') + sv(f, Math.abs(f.b)), { at: t + f.a0 * 150, hollow: f.b < 0 });
    t += (f.a0 + 1) * 150 + 300;
    for (let i = 0; i < f.d; i++) addTile('R', 'v', 'result', sv(f, f.x), { at: t + i * 150 });
    addTile('R', 'c', 'c', sv(f, f.c), { at: t + f.d * 150 });
    t += f.d * 150 + 600;
    line(lineCheck(plan));
    const ln = last!;
    const tx = Math.min(ln.x1 + 34, 690);
    t = m.tick(`tk${uid++}`, tx, ln.y, t, 38) + 100;
    t = sideNote(note('check'), tx + 20, ln.y);
    sparkle(GX.R, BEAM_Y - 90, t - 300);
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
  return [m.build()];
}
