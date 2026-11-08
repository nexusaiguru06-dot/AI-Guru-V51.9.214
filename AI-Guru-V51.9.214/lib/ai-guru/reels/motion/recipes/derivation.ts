/**
 * DERIVATION — the universal recipe for every branch written as a chain of lines
 * (algebra, fractions, percentages, exponents, quadratics, calculus, geometry
 * formulas, statistics, trigonometry, simultaneous equations…).
 *
 * Each new line is built FROM the previous one, so the viewer always sees where
 * every piece came from:
 *
 *  same token .......... flies down to its new place (keeps its colour)
 *  changed token ....... flies down, then rolls into its new value (swap) → indigo
 *  several → one ....... pieces fly together and MERGE into the result → indigo
 *  one → several ....... the piece splits, a copy flies to each place (fan-out)
 *  new token ........... pops in after the moves (green for numbers, ink for symbols)
 *  cancelled token ..... struck through in red on the old line
 *  old lines ........... fade to "done" but stay on the board as the written record
 *
 * Links between lines are found automatically (longest common subsequence of
 * tokens) and can be overridden with explicit `links` for merges, splits and
 * changes, so the same motion grammar works for any topic.
 */

import { DUR, roleColor, type Role } from '../grammar';
import { Motion, type MotionScene } from '../engine';
import { parseFrac, tokenWidth } from '../metrics';

/** [fromIdx, toIdx] from the previous line, or [lineIdx, fromIdx, toIdx] from any earlier line. */
export type Link = [number, number] | [number, number, number];

export interface DerivLine {
  /** Tokens, e.g. ['2', 'x', '+', '5', '=', '25']; "{a/b}" is a fraction, "x^2" a power. */
  tokens: string[];
  caption: string;
  /** Spoken version of the caption (default: the caption with maths read as words). */
  say?: string;
  /** Small green side note, e.g. "−5 on both sides". */
  note?: string;
  links?: Link[];
  /** Tokens (of earlier lines) that cancel out: [lineIdx, tokenIdx]. */
  cancel?: [number, number][];
  /** Write this line fresh (a given fact, a second equation) instead of deriving it. */
  fresh?: boolean;
  /** Role colours for tokens of this line. */
  roles?: Record<number, Role>;
  /** Exclude this line from automatic maths verification (word tokens, d/dx, …). */
  check?: boolean;
}

export interface DerivationInput {
  title: string;
  lines: DerivLine[];
  /** Token indices of the last line to box as the answer (default: whole line). */
  answer?: number[];
}

const OPS = new Set(['+', '−', '-', '×', '÷', '=', '(', ')', '±', ',', 'or', 'of', '<', '>', '≤', '≥', '≈']);
const isOp = (s: string) => OPS.has(s);
const isValue = (s: string) => /^[0-9.]/.test(s) || /^−[0-9]/.test(s) || !!parseFrac(s) || /^[0-9.]+\^/.test(s) || /%$/.test(s);
const isSymbol = (s: string) => /^[a-zA-Zα-ωπθ]/.test(s) && !isOp(s);

/** Space between two tokens: tight for 2x, x(…), wide around operators. */
function gap(a: string, b: string, px: number): number {
  if (a === '(' || b === ')') return px * 0.04;
  if (b === '(' && !isOp(a)) return px * 0.04;
  if (a === ')' && b === '(') return px * 0.04;
  if (a === ',' ) return px * 0.3;
  if (isOp(a) || isOp(b)) return px * 0.28;
  if ((isValue(a) || isSymbol(a)) && isSymbol(b) && a.length <= 3) return px * 0.04;
  return px * 0.2;
}

interface LineLayout {
  xs: number[];
  y: number;
  size: number;
  height: number;
  right: number;
}

const EQ_X = 300;

function layoutLine(tokens: string[], y: number, base: number): LineLayout {
  let size = base;
  const measureAll = (px: number) => {
    const ws = tokens.map((tk) => tokenWidth(tk, px));
    const gaps = tokens.map((tk, i) => (i ? gap(tokens[i - 1], tk, px) : 0));
    return { ws, gaps, total: ws.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0) };
  };
  let mm = measureAll(size);
  while (mm.total > 660 && size > 28) {
    size -= 2;
    mm = measureAll(size);
  }
  const lefts: number[] = [];
  let x = 0;
  tokens.forEach((_, i) => {
    x += mm.gaps[i];
    lefts.push(x);
    x += mm.ws[i];
  });
  const eq = tokens.indexOf('=');
  let shift = 360 - mm.total / 2;
  if (eq >= 0) {
    const eqCentre = lefts[eq] + mm.ws[eq] / 2;
    const s = EQ_X - eqCentre;
    if (s >= 30 && s + mm.total <= 700) shift = s;
  }
  const xs = tokens.map((_, i) => shift + lefts[i] + mm.ws[i] / 2);
  const height = tokens.some((tk) => parseFrac(tk)) ? size * 2 : size * 1.15;
  return { xs, y, size, height, right: shift + mm.total };
}

/** Longest common subsequence of equal tokens → pairs [i, j]. */
function lcs(a: string[], b: string[], okA: (i: number) => boolean, okB: (j: number) => boolean): [number, number][] {
  const n = a.length;
  const m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] && okA(i) && okB(j) ? 1 + L[i + 1][j + 1] : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j] && okA(i) && okB(j) && L[i][j] === 1 + L[i + 1][j + 1]) {
      out.push([i, j]);
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return out;
}

function autoRole(tokens: string[]): Role[] {
  const cycle: Role[] = ['a', 'b', 'c'];
  let k = 0;
  return tokens.map((tk) => (isOp(tk) || isSymbol(tk) ? 'ink' : cycle[k++ % 3]));
}

export function buildDerivation(input: DerivationInput): MotionScene {
  const base = 60;
  // Layout every line first (scene height + camera).
  const layouts: LineLayout[] = [];
  let y = 70;
  input.lines.forEach((ln, k) => {
    const probe = layoutLine(ln.tokens, 0, base);
    if (k > 0) y += layouts[k - 1].height / 2 + probe.height / 2 + 30;
    layouts.push({ ...probe, y });
  });
  const height = y + layouts[layouts.length - 1].height / 2 + 60;
  // V51.9.125: the whole working stays on the board (up to about seven lines); the camera only moves for longer ones
  const view = Math.min(height, 700);
  const m = new Motion(input.title, 720, height);
  m.camH.set(0, view);
  m.camY.set(0, view / 2);
  /** Keep the current line in view, and the lines it is built from too when they fit. */
  const follow = (k: number, t: number, fromY?: number) => {
    if (height <= view) return;
    const y = layouts[k].y;
    let top = y - view * 0.68;
    if (fromY !== undefined && y - fromY < view - 140) top = Math.min(top, fromY - 60);
    m.look(t, top + view / 2);
  };

  const ids: string[][] = [];
  let t = 300;

  input.lines.forEach((ln, k) => {
    const L = layouts[k];
    const row: string[] = [];
    ids.push(row);
    const roles = ln.roles ?? {};

    if (k === 0 || ln.fresh) {
      const auto = autoRole(ln.tokens);
      t = m.step(ln.caption, t, 2400, ln.say);
      follow(k, t);
      ln.tokens.forEach((tk, j) => {
        row[j] = m.text(`L${k}_${j}`, tk, L.xs[j], L.y, { size: L.size, color: roles[j] ?? auto[j] });
      });
      t = m.appear(row, t, 120) + DUR.beat;
      if (k > 0) m.dim(ids[k - 1], t - 400);
      t = sideNote(m, ln, L, k, t);
      t += 900;
      m.hold(t);
      return;
    }

    // ---- derive line k from earlier lines ----
    const sources: { line: number; idx: number }[][] = ln.tokens.map(() => []);
    const usedPrev = new Set<number>();
    const explicit = new Set<string>();
    for (const lk of ln.links ?? []) {
      const [line, from, to] = lk.length === 3 ? lk : [k - 1, lk[0], lk[1]];
      if (!ids[line]?.[from] || to < 0 || to >= ln.tokens.length) throw new Error(`derivation: bad link ${JSON.stringify(lk)} on line ${k}`);
      sources[to].push({ line, idx: from });
      explicit.add(`${line}:${from}`);
      if (line === k - 1) usedPrev.add(from);
    }
    const prev = input.lines[k - 1].tokens;
    for (const [i, j] of lcs(prev, ln.tokens, (i) => !usedPrev.has(i), (j) => sources[j].length === 0)) {
      sources[j].push({ line: k - 1, idx: i });
    }

    t = m.step(ln.caption, t, 2400, ln.say);
    const fromY = Math.min(...sources.flat().map((s) => layouts[s.line].y), L.y);
    follow(k, t, fromY);

    // Focus whatever is about to change (changed, merged, split, cancelled).
    const fanCount = new Map<string, number>();
    sources.forEach((src) => src.forEach((s) => fanCount.set(`${s.line}:${s.idx}`, (fanCount.get(`${s.line}:${s.idx}`) ?? 0) + 1)));
    const focusIds = new Set<string>();
    sources.forEach((src, j) => {
      const changes = src.length > 1 || (src.length === 1 && input.lines[src[0].line].tokens[src[0].idx] !== ln.tokens[j]);
      for (const s of src) if (changes || explicit.has(`${s.line}:${s.idx}`) || (fanCount.get(`${s.line}:${s.idx}`) ?? 0) > 1 || s.line !== k - 1) focusIds.add(ids[s.line][s.idx]);
    });
    for (const [line, idx] of ln.cancel ?? []) focusIds.add(ids[line][idx]);
    // V51.9.125: the ringed tokens turn orange and fly in orange; the new line takes their own colour
    const own = new Map<string, string>();
    if (focusIds.size) {
      m.undim([...focusIds], t);
      for (const id of focusIds) {
        if (m.get(id).kind !== 'text') continue;
        own.set(id, m.get(id).color.at(t));
        m.get(id).color.to(t + 150, 300, roleColor('carry'));
      }
      t = m.focus([...focusIds], t) + DUR.beat;
    }
    for (const [line, idx] of ln.cancel ?? []) m.strike(ids[line][idx], t);
    if (ln.cancel?.length) t += DUR.strike + DUR.beat;

    // Moves, swaps, merges.
    const t0 = t;
    let end = t;
    const pops: string[] = [];
    ln.tokens.forEach((tk, j) => {
      const src = sources[j];
      const at = t0 + j * 50;
      const id = `L${k}_${j}`;
      if (src.length === 0) {
        row[j] = m.text(id, tk, L.xs[j], L.y, { size: L.size, color: roles[j] ?? (isOp(tk) || isSymbol(tk) ? 'ink' : 'c') });
        pops.push(row[j]);
        return;
      }
      const srcIds = src.map((s) => ids[s.line][s.idx]);
      const baseColor = own.get(srcIds[0]) ?? m.get(srcIds[0]).color.at(at);
      if (src.length === 1) {
        const srcTok = input.lines[src[0].line].tokens[src[0].idx];
        const flyer = m.clone(srcIds[0], m.uid('fly'), at);
        const arrive = m.move(flyer, L.xs[j], L.y, at, { arc: src[0].line === k - 1 ? 18 : 60, sound: j === 0 });
        // The token keeps its look while flying, then the real item takes over.
        const same = srcTok === tk;
        row[j] = m.text(id, srcTok, L.xs[j], L.y, { size: L.size, color: baseColor });
        m.get(row[j]).alpha.set(arrive, 1);
        m.get(flyer).alpha.set(arrive, 0);
        let e = arrive;
        if (!same) e = m.swap(row[j], tk, arrive, roles[j] ?? 'result');
        else if (roles[j]) e = m.recolor(row[j], roles[j], arrive);
        end = Math.max(end, e);
      } else {
        row[j] = m.text(id, tk, L.xs[j], L.y, { size: L.size, color: roles[j] ?? 'result' });
        const flyers = srcIds.map((sid) => m.clone(sid, m.uid('fly'), at, { color: m.get(sid).color.at(at) }));
        end = Math.max(end, m.merge(flyers, row[j], L.xs[j], L.y, at, DUR.merge + 100));
      }
    });
    if (pops.length) end = m.appear(pops, end + 50, 90);
    m.unfocus([...focusIds], end);
    for (const [id, c] of own) m.get(id).color.to(end, 300, c);
    m.dim(ids.slice(0, k).flat(), end);
    t = sideNote(m, ln, L, k, end + DUR.beat, k === input.lines.length - 1 ? 64 : 0);
    t += 900;
    m.hold(t);
  });

  // Answer.
  const k = input.lines.length - 1;
  const last = ids[k];
  const L = layouts[k];
  const pick = (input.answer ?? last.map((_, i) => i)).map((i) => last[i]);
  const xs = pick.map((id) => m.pos(id, t).x);
  const ws = (input.answer ?? last.map((_, i) => i)).map((i) => tokenWidth(input.lines[k].tokens[i], L.size));
  const x0 = Math.min(...xs.map((x, i) => x - ws[i] / 2)) - 18;
  const x1 = Math.max(...xs.map((x, i) => x + ws[i] / 2)) + 18;
  // Pull back to show the whole written solution, if it still reads well.
  if (height > view && height <= view * 1.6) t = m.look(t, height / 2, height, 900);
  m.recolor(pick, 'result', t);
  m.rings = false; // V51.9.113: the answer gets its box, not a ring as well
  m.focus(pick, t);
  m.rings = true;
  let e = m.box('ansbox', (x0 + x1) / 2, L.y, x1 - x0, L.height + 16, t + 200);
  e = x1 + 44 <= 712
    ? m.tick('anstick', x1 + 30, L.y, e - 200)
    : m.tick('anstick', x1 - 6, L.y - L.height / 2 - 26, e - 200, 30);
  m.unfocus(pick, e + 300);
  m.hold(e + 1600);
  return m.build();
}

/** `after` = room left for the answer box and its tick on the last line. */
function sideNote(m: Motion, ln: DerivLine, L: LineLayout, k: number, t: number, after = 0): number {
  if (!ln.note) return t;
  const x0 = L.right + 24 + after;
  let size = 26;
  while (size > 16 && x0 + tokenWidth(ln.note, size) > 712) size -= 1;
  const w = tokenWidth(ln.note, size);
  if (x0 + w > 712) return t;
  const id = m.text(`note${k}`, ln.note, x0 + w / 2, L.y, { size, color: 'c' });
  return m.write(id, t);
}
