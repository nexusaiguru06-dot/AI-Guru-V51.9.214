/**
 * DNA builder for a pair of linear equations (V51.9.28): the two equations are written in two
 * colours, drawn as two lines on a plane that meet at the solution, solved by elimination (the
 * equations are multiplied to equal coefficients, then added or subtracted) or by substitution, checked
 * in both equations, and finally written in matrix form A · x = b with the coefficients flying out of
 * the equations into the matrix.
 *
 * The planner gives the six numbers and chooses the order. The app computes every line it writes
 * (lin-math.ts), so the board is true whatever the plan says. English and Malayalam classes have
 * identical pictures; only the captions change language.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { DUR, ROLE, type Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import { Plane } from '../../reels/motion/plane';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, LinPlan } from './types';
import { COLOR1, COLOR2, WIN, clipLine, fmt, solve, type Eq, type Pt, type Var } from './lin-math';
import { checkSteps, eliminationSteps, substitutionSteps, type LinRow, type LinSub, type Ref } from './lin-steps';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;

/** The plane (graph window) and the panel on its right. */
export const PLANE = { left: 24, top: 32, size: 380 };
export const TAG_X = 448;
export const EQ_X0 = 492;
const EQ_SIZE = 22;
const TAG_SIZE = 16;
export const SLOT = { e1: 64, e2: 104, w1: 156, w2: 196, rule: 218, res: 252, ax: 332, ay: 372 };
const MAT = { r1: 190, r2: 234, top: 166, bot: 258 };
/**
 * V51.9.136 — the WORKING page: the algebra gets the whole board. The two equations glide to the top as a reference,
 * every small move is its own line (tag on the left, the line, a short green note on the right saying what was done),
 * and the graph comes back when the lesson returns to it.
 */
export const WORK = { headY: 30, head: [40, 380] as const, row0: 84, gap: 44, rows: 8, tagL: 22, eqL: 120, size: 26, big: 30, noteSize: 20, right: 712, noteCol: 420, camMin: 300 };
/** How long a sub-step's caption stays without a voice: long enough to read it. */
export const readMs = (text: string) => Math.max(2600, Math.min(8000, 1000 + 220 * text.split(/\s+/).filter(Boolean).length));

/** The tokens an equation is written with (so the coefficients can fly into a matrix). */
export interface EqToken {
  text: string;
  /** Which number of the equation this token is, if any. */
  of?: 'a' | 'b' | 'c';
  gapBefore: number;
}

export function eqTokens(e: Eq): EqToken[] {
  const out: EqToken[] = [];
  const coef = (v: number, of: 'a' | 'b', first: boolean, name: string) => {
    if (first) {
      if (Math.abs(v) === 1) {
        if (v < 0) out.push({ text: '−', gapBefore: 0 });
      } else out.push({ text: fmt(v), of, gapBefore: 0 });
    } else {
      out.push({ text: v < 0 ? '−' : '+', gapBefore: 8 });
      if (Math.abs(v) !== 1) out.push({ text: String(Math.abs(v)), of, gapBefore: 8 });
    }
    out.push({ text: name, gapBefore: !first && Math.abs(v) === 1 ? 8 : 0 });
  };
  coef(e.a, 'a', true, 'x');
  coef(e.b, 'b', false, 'y');
  out.push({ text: '=', gapBefore: 8 }, { text: fmt(e.c), of: 'c', gapBefore: 8 });
  return out;
}

/** Window → board pixels. */
export const planeSpec = () => ({ left: PLANE.left, top: PLANE.top, width: PLANE.size, height: PLANE.size, xMin: -WIN, xMax: WIN, yMin: -WIN, yMax: WIN });

export function buildLinear(plan: LinPlan, lang: Lang, title: string): MotionScene[] {
  const sol = solve(plan);
  if ('error' in sol) throw new Error(`linear-system: ${sol.error}`);
  const { e1, e2 } = plan;
  const eqs = [e1, e2];
  const colors: Role[] = [COLOR1 as Role, COLOR2 as Role];
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const P = new Plane(m, planeSpec());
  let t = 300;
  let uid = 0;
  let work: string[] = [];
  const solved: Partial<Record<Var, number>> = {};
  const answerIds: string[] = [];
  /** token item ids of each original equation, by number (for the matrix). */
  const tokenIds: Array<Array<{ id: string; of?: 'a' | 'b' | 'c'; x: number; y: number }>> = [[], []];
  let shown = false;
  let graphed = false;
  /** V51.9.136: which page is on the board, what belongs to the graph page, and the working page's lines. */
  let page: 'graph' | 'work' = 'graph';
  const graphLayer: string[] = [];
  const graphAlpha = new Map<string, number>();
  const tagIds: string[] = [];
  let pageItems: string[] = [];
  let row = 0;
  /** V51.9.137: the lines written on this sheet, token by token (what later lines are made from). */
  interface WRow { ids: string[]; y: number; size: number; label?: 'e1' | 'e2' | 'sum'; cancel: string[] }
  let rows: WRow[] = [];
  let last: WRow | null = null;
  /** Tokens ringed and turned orange now, with the colour they go back to. */
  let lit: Array<{ id: string; color: string }> = [];
  const panelAnswered = new Set<Var>();
  /** Everything a drawing function makes belongs to the graph page. */
  const onGraph = <T,>(fn: () => T): T => {
    const before = new Set(m.items.keys());
    const r = fn();
    for (const id of m.items.keys()) if (!before.has(id)) graphLayer.push(id);
    return r;
  };

  const clearWork = (at: number) => {
    if (work.length) m.fadeOut(work, at, 300);
    work = [];
  };
  /** A whole-string line, left-aligned at EQ_X0. */
  const line = (text: string, y: number, color: Role | string, size = EQ_SIZE): { id: string; right: number } => {
    const id = `ln${uid++}`;
    const w = tokenWidth(text, size);
    m.text(id, text, EQ_X0 + w / 2, y, { size, color, z: 4 });
    return { id, right: EQ_X0 + w };
  };
  const tag = (text: string, y: number, color: Role | string): string => {
    const id = `tg${uid++}`;
    m.text(id, text, TAG_X, y, { size: TAG_SIZE, color, z: 4 });
    return id;
  };
  const answer = (v: Var, value: number, at: number): number => {
    solved[v] = value;
    panelAnswered.add(v);
    const id = `ans${uid++}`;
    const text = `${v} = ${fmt(value)}`;
    const w = tokenWidth(text, 30);
    m.text(id, text, EQ_X0 + w / 2, v === 'x' ? SLOT.ax : SLOT.ay, { size: 30, color: 'result', z: 4 });
    answerIds.push(id);
    graphLayer.push(id);
    return m.appear(id, at, 0, true);
  };

  /* ---- show: the two equations, token by token ---- */
  const drawShow = () => {
    shown = true;
    eqs.forEach((e, k) => {
      const y = k === 0 ? SLOT.e1 : SLOT.e2;
      const tg = tag(`(${k + 1})`, y, colors[k]);
      tagIds[k] = tg;
      const toks = eqTokens(e);
      const widths = toks.map((tk) => tokenWidth(tk.text, EQ_SIZE));
      let x = EQ_X0;
      const ids: string[] = [tg];
      toks.forEach((tk, i) => {
        x += tk.gapBefore;
        const id = `e${k + 1}t${i}`;
        m.text(id, tk.text, x + widths[i] / 2, y, { size: EQ_SIZE, color: colors[k], z: 4 });
        tokenIds[k].push({ id, of: tk.of, x: x + widths[i] / 2, y });
        ids.push(id);
        x += widths[i];
      });
      t = m.appear(ids, t, 70, false) + 250;
    });
  };

  /* ---- graph: plane and two lines ---- */
  const drawGraph = () => {
    graphed = true;
    t = P.grid(t, { extend: 1, labels: true });
    const xr = P.px(WIN, 0);
    const yt = P.px(0, WIN);
    const lx = m.text('axname_x', 'x', xr[0] - 12, xr[1] - 18, { size: 24, color: 'ink', z: 2 });
    const ly = m.text('axname_y', 'y', yt[0] + 16, yt[1] + 10, { size: 24, color: 'ink', z: 2 });
    t = m.appear([lx, ly], t) + 200;
    eqs.forEach((e, k) => {
      const [a, b] = clipLine(e);
      const ln = P.shape(`line${k}`, [a, b], t, { color: colors[k], closed: false, width: 3.5, dur: 1000 });
      // the label (k+1) sits just beyond the right-hand end of the line
      const far: Pt = b; // right-hand end: the label never runs off the left of the board
      const near: Pt = a;
      const lb = P.label(`lab${k}`, `(${k + 1})`, far, ln.end - 300, { color: colors[k], size: 20, push: { from: near, dist: 20 } });
      t = Math.max(ln.end, lb.end) + 250;
    });
  };

  /* ---- meet ---- */
  const drawMeet = () => {
    const d = P.dot('meet', [sol.x, sol.y], t, { color: 'result', r: 7 });
    const text = `(${fmt(sol.x)}, ${fmt(sol.y)})`;
    const spot = labelSpot(sol.x, sol.y, eqs);
    const lb = P.label('meetl', text, [sol.x + spot[0], sol.y + spot[1]], d.end - 100, { dx: 0, dy: 0, color: 'result', size: 22 });
    t = Math.max(d.end, lb.end) + 400;
  };

  /* ---- V51.9.136: the working page ---- */
  const headOf = (k: number) => [tagIds[k], ...tokenIds[k].map((q) => q.id)].filter(Boolean);
  /** The equations glide to the top (work) or back to the panel (graph). */
  const moveHeads = (toWork: boolean, at: number): number => {
    let end = at;
    [0, 1].forEach((k) => {
      const y0 = k === 0 ? SLOT.e1 : SLOT.e2;
      const dx = toWork ? WORK.head[k] + 34 - EQ_X0 : 0;
      const y = toWork ? WORK.headY : y0;
      tokenIds[k].forEach((q) => { end = Math.max(end, m.move(q.id, q.x + dx, y, at, { dur: 600, sound: false })); });
      if (tagIds[k]) end = Math.max(end, m.move(tagIds[k], toWork ? WORK.head[k] + 14 : TAG_X, y, at, { dur: 600, sound: false }));
    });
    return end;
  };
  /** A page never changes while the step on it is still being read or spoken. */
  const settled = (at: number) => Math.max(at, m.captions[m.captions.length - 1]?.t1 ?? 0);
  /** When the page change that the next step waits for is over (the change itself runs under the new caption). */
  let pageReadyAt = 0;
  let frame = '';
  const toWork = (at: number): number => {
    if (page === 'work') return at;
    at = settled(at);
    clearWork(at);
    for (const id of graphLayer) {
      const a = m.get(id).alpha.at(at);
      if (a < 0.02) continue;
      graphAlpha.set(id, a);
      m.get(id).alpha.to(at, 350, 0);
    }
    page = 'work';
    row = 0;
    pageReadyAt = (shown ? moveHeads(true, at) : at + 350) + 150;
    // the two given equations sit in a frame at the top: what every line below works from
    frame = `wf${uid++}`;
    m.box(frame, 360, WORK.headY, 696, 44, pageReadyAt - 300, 'done');
    return at;
  };
  const toGraph = (at: number): number => {
    if (page === 'graph') return at;
    at = settled(at);
    if (pageItems.length) m.fadeOut(pageItems, at, 300);
    if (frame) m.fadeOut(frame, at, 300);
    frame = '';
    pageItems = [];
    rows = [];
    last = null;
    for (const [id, a] of graphAlpha) m.get(id).alpha.to(at + 200, 400, a);
    graphAlpha.clear();
    page = 'graph';
    m.look(at, SCENE_H / 2, SCENE_H, 900);
    let end = shown ? moveHeads(false, at) : at + 400;
    // the values found on the working page are written in the panel
    (['x', 'y'] as Var[]).forEach((v) => { if (solved[v] !== undefined && !panelAnswered.has(v)) end = answer(v, solved[v]!, end); });
    pageReadyAt = end + 200;
    return at; // the change runs under the next caption
  };
  /** A fresh sheet for a new piece of working (the reference equations stay at the top). */
  const newSheet = (at: number): number => {
    const end = settled(toWork(at));
    if (pageItems.length) pageReadyAt = Math.max(pageReadyAt, m.fadeOut(pageItems, end, 300) + 100);
    pageItems = [];
    row = 0;
    rows = [];
    last = null;
    return end;
  };
  const roleOf = (c: LinRow['color']): Role => (c === 'e1' ? colors[0] : c === 'e2' ? colors[1] : (c as Role));
  /** The short green note right of a line: what this step did. Smaller when the line is long; left out if it cannot fit. */
  const sideNote = (txt: string, xEnd: number, y: number, at: number): number => {
    const id = `nt${uid++}`; // taken even when the note is left out: both languages build the same ids
    if (!txt) return at;
    const x = Math.max(xEnd + 28, WORK.noteCol); // the notes stand in one column, unless a line is too long
    let npx = WORK.noteSize;
    while (npx > 14 && x + tokenWidth(txt, npx) > WORK.right) npx -= 1;
    if (x + tokenWidth(txt, npx) > WORK.right) return at;
    m.text(id, txt, x + tokenWidth(txt, npx) / 2, y, { size: npx, color: 'tick', z: 5 });
    pageItems.push(id);
    return m.appear(id, at, 0, false) + 100;
  };
  /* ---- V51.9.137: digits that move — ring, orange, fly, become ---- */
  const HOT = 'carry'; // the orange of a digit being worked on
  /** The ids a reference points at (an earlier line, a role in a given equation, or this line). */
  const resolve = (ref: Ref, self: string[]): string[] => {
    if (ref.row === 'h1' || ref.row === 'h2') {
      const toks = tokenIds[ref.row === 'h1' ? 0 : 1];
      const text = (i: number) => m.get(toks[i].id).text;
      if (ref.role === 'c') return toks.filter((q) => q.of === 'c').map((q) => q.id);
      const vi = toks.findIndex((_, i) => text(i) === ref.role);
      if (vi < 0) return [];
      if (ref.role === 'x') return toks.slice(0, vi + 1).map((q) => q.id);
      return toks.slice(vi > 0 && toks[vi - 1].of === 'b' ? vi - 1 : vi, vi + 1).map((q) => q.id);
    }
    const src = ref.row === 'self' ? self : ref.row === 'prev' ? last?.ids : [...rows].reverse().find((r) => r.label === ref.row)?.ids;
    if (!src) return [];
    return (ref.idx ?? []).map((i) => src[i]).filter(Boolean);
  };
  /** Ring the tokens and turn them orange (they go back to their colour when the step ends). */
  const light = (ids: string[], at: number): number => {
    const fresh = ids.filter((id) => m.has(id) && !lit.some((l) => l.id === id) && m.get(id).alpha.at(at) > 0.3);
    if (!fresh.length) return at;
    for (const id of fresh) lit.push({ id, color: m.get(id).color.at(at) });
    m.recolor(fresh, HOT, at, 250);
    return m.focus(fresh, at + 270); // the ring is drawn once the digits are orange, so it is orange too
  };
  /** These tokens go back to their own colour (a flow has landed). */
  const unlightSome = (ids: string[], at: number) => {
    const back = lit.filter((l) => ids.includes(l.id));
    if (!back.length) return;
    m.unfocus(back.map((l) => l.id), at);
    for (const l of back) m.recolor(l.id, l.color, at, 400);
    lit = lit.filter((l) => !ids.includes(l.id));
  };
  const unlight = (at: number) => {
    if (!lit.length) return;
    m.unfocus(lit.map((l) => l.id), at);
    for (const l of lit) m.recolor(l.id, l.color, at, 400);
    lit = [];
  };
  /** Copies of the source tokens fly (on an arc) to the target and become it. */
  const fly = (src: string[], target: string, at: number, o: { glide: boolean; color: string }): number => {
    const to = m.pos(target, at);
    let land = at;
    src.forEach((id, i) => {
      if (!m.has(id)) return;
      const cl = `fl${uid++}`;
      m.clone(id, cl, at + i * 60, { color: o.glide ? undefined : HOT });
      const end = m.move(cl, to.x, to.y, at + i * 60, { dur: o.glide ? 620 : 820, arc: o.glide ? 14 : 46, sound: !o.glide && i === 0 });
      m.fadeOut(cl, end, 160);
      land = Math.max(land, end);
    });
    const it = m.get(target);
    if (it.alpha.at(land) < 0.5) {
      it.alpha.to(land, 140, 1);
      if (!o.glide) {
        // the new value is born orange, with a short glow, then takes its own colour
        it.color.set(land, roleColorOf(HOT));
        m.focus(target, land + 140, true);
        m.recolor(target, o.color, land + 650, 450);
        m.unfocus(target, land + 900);
      }
    }
    return land;
  };
  const roleColorOf = (r: string) => (r.startsWith('#') ? r : (ROLE as Record<string, string>)[r] ?? r);
  /** A few sparks around a found answer. */
  const sparkle = (cx: number, cy: number, at: number) => {
    const cols: Role[] = ['a', 'c', 'carry', 'tick', 'b'];
    for (let i = 0; i < 10; i++) {
      const id = `sp${uid++}`;
      const ang = (i / 10) * Math.PI * 2;
      m.dot(id, cx, cy, at, { color: cols[i % cols.length], r: 4 });
      m.move(id, cx + Math.cos(ang) * 64, cy + Math.sin(ang) * 30, at + 60, { dur: 650, sound: false });
      m.fadeOut(id, at + 520, 380);
    }
  };
  const writeRow = (r: LinRow, note: string, at: number): number => {
    if (row >= WORK.rows) {
      at = m.fadeOut(pageItems, at, 300) + 100; // (this step's caption is new: the old lines were read in the steps before)
      pageItems = [];
      row = 0;
      rows = [];
      last = null;
    }
    const y = WORK.row0 + row * WORK.gap;
    row += 1;
    // the camera leans in on the working: the given equations and the lines so far, centred, a little closer
    const top = WORK.headY - 26, bottom = y + 34;
    const viewH = Math.max(WORK.camMin, bottom - top);
    if (viewH < SCENE_H) m.look(at, (top + bottom) / 2, viewH, 900);
    const color = roleOf(r.color);
    const colorHex = roleColorOf(color);
    let size = r.big ? WORK.big : WORK.size;
    const maxW = WORK.right - WORK.eqL - 150;
    while (size > 18 && tokenWidth(r.text, size) > maxW) size -= 1;
    let end = at;
    if (r.tag) {
      const tg = `wt${uid++}`;
      m.text(tg, r.tag, WORK.tagL + tokenWidth(r.tag, 17) / 2, y, { size: 17, color, z: 4 });
      pageItems.push(tg);
      end = m.appear(tg, end, 0, false);
    }
    // lay the tokens out (hidden until each is made)
    let right = WORK.eqL;
    const gap = tokenWidth(' ', size) * 1.5 + 2;
    const ids = r.tokens.map((tk, i) => {
      const id = `wk${uid++}`;
      const w = tokenWidth(tk, size);
      m.text(id, tk, right + (i ? gap : 0) + w / 2, y, { size, color, z: 4 });
      right += (i ? gap : 0) + w;
      return id;
    });
    pageItems.push(...ids);
    const flows = r.flows ?? [];
    const made = new Set(flows.map((f) => f.to));
    // 1. what does not change glides down quietly, all together
    let glideEnd = end;
    for (const f of flows.filter((x) => x.glide)) glideEnd = Math.max(glideEnd, fly(resolve(f.from, ids), ids[f.to], end, { glide: true, color: colorHex }));
    end = flows.some((x) => x.glide) ? glideEnd - 250 : end;
    // 2. the new pieces (signs, ×, =, a new multiplier) are written; a new multiplier or a turned sign is orange
    const fresh = ids.filter((_, i) => !made.has(i));
    if (fresh.length) {
      end = m.appear(fresh, end + 80, 110, true) + 120;
      const hot = (r.hot ?? []).map((i) => ids[i]).filter((id) => fresh.includes(id));
      if (hot.length) {
        for (const id of hot) m.get(id).color.set(end - 300, roleColorOf(HOT));
        m.focus(hot, end - 200);
        m.recolor(hot, colorHex, end + 1100, 450);
        m.unfocus(hot, end + 1300);
        end += 250;
      }
    }
    // 3. each changing piece: ring and orange in the line above, then it flies down and becomes the new value
    for (const f of flows.filter((x) => !x.glide)) {
      const src = resolve(f.from, ids);
      const lightEnd = light(src, end);
      const land = fly(src, ids[f.to], Math.max(end + 350, lightEnd - 150), { glide: false, color: colorHex });
      unlightSome(src, land + 200); // the source digits have done their job: back to their colours
      end = land + 260;
    }
    // anything still hidden (a flow without sources) is written now
    const hidden = ids.filter((id) => m.get(id).alpha.at(end + 1) < 0.5);
    if (hidden.length) end = m.appear(hidden, end, 80, false);
    end += 150;
    if (r.tick) {
      const tk = `tk${uid++}`;
      end = m.tick(tk, right + 30, y, end) + 100;
      pageItems.push(tk);
      right += 54;
    }
    const wr: WRow = { ids, y, size, label: r.label, cancel: (r.cancel ?? []).map((i) => ids[i]) };
    rows.push(wr);
    last = wr;
    end = sideNote(note, right, y, end);
    if (r.big && r.color === 'result') {
      // the answer: a soft box and a few sparks
      const bx = `ab${uid++}`;
      m.box(bx, (WORK.eqL + right) / 2, y, right - WORK.eqL + 30, size * 1.6, end, 'tick');
      sparkle((WORK.eqL + right) / 2, y, end + 300);
      pageItems.push(bx);
      end += 700;
    }
    return end;
  };
  /** One small step: the main caption (why, spoken) and the side note (what), then the board. */
  const runSubs = (subs: LinSub[]) => {
    for (const sub of subs) {
      const why = pick(sub.why, lang);
      const note = pick(sub.note, lang);
      // every small step keeps its caption long enough to be read (or spoken) before the next one starts
      t = m.step(why, settled(t), readMs(why), undefined, { note, boardNote: !!sub.write });
      t = Math.max(t, pageReadyAt);
      unlight(t); // the last step's orange digits go back to their colours
      if (sub.ring && shown) t = light(sub.ring.flatMap((rf) => resolve(rf, [])), t + 200) + 250;
      if (sub.rule && last) {
        const ruleY = WORK.row0 + row * WORK.gap - WORK.gap / 2 + 2;
        const rid = `rule${uid++}`;
        t = m.rule(rid, WORK.eqL - 6, ruleY, WORK.eqL + 330, ruleY, t + 150, { color: 'ink', width: 2.5 }) + 100;
        const sg = `sg${uid++}`;
        m.text(sg, sub.rule, WORK.tagL + 30, WORK.row0 + row * WORK.gap, { size: 28, color: 'ink', z: 4 });
        t = m.appear(sg, t, 0, false);
        pageItems.push(rid, sg);
      }
      if (sub.strike) {
        const sum = [...rows].reverse().find((r) => r.label === 'sum');
        if (sum?.cancel.length) {
          t = light(sum.cancel, t + 100);
          sum.cancel.forEach((id, i) => { pageItems.push(m.strike(id, t + 150 + i * 200, 'accent')); });
          t += 150 + sum.cancel.length * 200 + 250;
          m.dim(sum.cancel, t);
        }
      }
      if (sub.write) t = writeRow(sub.write, note, t + 150);
      if (sub.write?.big && sub.write.color === 'result') {
        const mm = /^([xy]) = (−?\d+)$/.exec(sub.write.text);
        if (mm) solved[mm[1] as Var] = Number(mm[2].replace('−', '-'));
      }
      t += 250;
      m.hold(t);
    }
    unlight(t);
  };

  /* ---- eliminate ---- */
  const drawEliminate = (v: Var) => {
    t = newSheet(t);
    runSubs(eliminationSteps(plan, v));
  };

  /* ---- substitute ---- */
  const drawSubstitute = (into: 1 | 2) => {
    t = newSheet(t);
    const known: Var = solved.x !== undefined ? 'x' : 'y';
    runSubs(substitutionSteps(plan, known, solved[known]!, into));
  };

  /* ---- check ---- */
  const drawCheck = () => {
    t = newSheet(t);
    runSubs(checkSteps(plan, sol.x, sol.y));
  };

  /* ---- matrix form ---- */
  const drawMatrix = () => {
    clearWork(t);
    const bracket = (x: number, dir: 1 | -1): string => {
      const id = `br${uid++}`;
      t = Math.max(t, 0);
      m.poly(id, [[x + 7 * dir, MAT.top], [x, MAT.top], [x, MAT.bot], [x + 7 * dir, MAT.bot]], t, { color: 'ink', closed: false, width: 2.5, dur: 600, silent: true, z: 3 });
      work.push(id);
      return id;
    };
    const colW = 34;
    const aL = EQ_X0 + 6;
    const cx = [aL + 6 + colW / 2, aL + 6 + colW * 1.5];
    const aR = aL + 6 + colW * 2 + 6;
    const xL = aR + 12;
    const xC = xL + 6 + 12;
    const xR = xL + 6 + 24 + 6;
    const eqX = xR + 18;
    const bL = eqX + 16;
    const bw = Math.max(30, tokenWidth(fmt(e1.c), EQ_SIZE), tokenWidth(fmt(e2.c), EQ_SIZE));
    const bC = bL + 6 + bw / 2;
    const bR = bL + 6 + bw + 6;
    bracket(aL, 1);
    bracket(aR, -1);
    bracket(xL, 1);
    bracket(xR, -1);
    bracket(bL, 1);
    bracket(bR, -1);
    t += 650;
    const fly: Array<{ src?: string; text: string; x: number; y: number; color: Role }> = [];
    const rowY = [MAT.r1, MAT.r2];
    eqs.forEach((e, k) => {
      const find = (of: 'a' | 'b' | 'c') => tokenIds[k].find((q) => q.of === of)?.id;
      fly.push({ src: find('a'), text: fmt(e.a), x: cx[0], y: rowY[k], color: colors[k] });
      fly.push({ src: find('b'), text: fmt(e.b), x: cx[1], y: rowY[k], color: colors[k] });
      fly.push({ src: find('c'), text: fmt(e.c), x: bC, y: rowY[k], color: colors[k] });
    });
    let end = t;
    fly.forEach((f, i) => {
      const id = `mx${uid++}`;
      if (f.src) {
        m.clone(f.src, id, t + i * 120, { color: f.color });
        end = Math.max(end, m.move(id, f.x, f.y, t + i * 120, { dur: 900, arc: 40 }));
      } else {
        m.text(id, f.text, f.x, f.y, { size: EQ_SIZE, color: f.color, z: 4 });
        end = Math.max(end, m.appear(id, t + i * 120 + 300, 0, false));
      }
      work.push(id);
    });
    const vx = m.text(`vx${uid++}`, 'x', xC, MAT.r1, { size: EQ_SIZE, color: 'ink', z: 4 });
    const vy = m.text(`vy${uid++}`, 'y', xC, MAT.r2, { size: EQ_SIZE, color: 'ink', z: 4 });
    const eq = m.text(`eqs${uid++}`, '=', eqX, (MAT.r1 + MAT.r2) / 2, { size: EQ_SIZE + 2, color: 'ink', z: 4 });
    work.push(vx, vy, eq);
    end = Math.max(end, m.appear([vx, vy, eq], t + 500, 100, false));
    t = end + 500;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const s of plan.steps) {
    // V51.9.136: the algebra is worked in small steps, each with its own caption (why) and side note (what);
    // the graph, the meeting point and the matrix keep the planner's caption on the graph page
    const working = s.op === 'eliminate' || s.op === 'substitute' || s.op === 'check';
    if (!working) {
      if (s.op !== 'show') t = toGraph(t);
      t = m.step(pick(s.say, lang), settled(t), 2400);
      t = Math.max(t, pageReadyAt);
    }
    switch (s.op) {
      case 'show':
        drawShow();
        break;
      case 'graph':
        onGraph(drawGraph);
        break;
      case 'eliminate':
        drawEliminate(s.var);
        break;
      case 'substitute':
        drawSubstitute(s.into);
        break;
      case 'meet':
        onGraph(drawMeet);
        break;
      case 'check':
        drawCheck();
        break;
      case 'matrix':
        drawMatrix();
        break;
    }
    t += 150;
    m.hold(t);
  }
  void shown;
  void graphed;
  void DUR;
  m.hold(t + 1400);
  return [m.build()];
}

/**
 * Where the solution label goes, as an offset in graph units: of eight directions, the one whose
 * point is furthest from both lines and the axes while staying inside the window.
 */
export function labelSpot(x: number, y: number, eqs: Eq[]): Pt {
  const dist = (e: Eq, px: number, py: number) => Math.abs(e.a * px + e.b * py - e.c) / Math.hypot(e.a, e.b);
  let best: Pt = [1.8, 1.8];
  let bestScore = -1;
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4;
    const dx = 2.6 * Math.cos(ang);
    const dy = 2.2 * Math.sin(ang);
    const px = x + dx;
    const py = y + dy;
    if (Math.abs(px) > WIN - 2.4 || Math.abs(py) > WIN - 1) continue;
    const score = Math.min(...eqs.map((e) => dist(e, px, py)), Math.abs(px) * 0.8, Math.abs(py) * 0.8);
    if (score > bestScore) {
      bestScore = score;
      best = [dx, dy];
    }
  }
  return best;
}
