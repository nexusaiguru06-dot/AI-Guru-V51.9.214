/**
 * DNA builder for polynomials (V51.9.31): P(x) with its degree and coefficients; addition and
 * subtraction in aligned columns; multiplication in an area table where like terms share a colour;
 * long division by x − r; the remainder theorem P(r); the factor theorem with every factor; the three
 * square identities with an area picture and a check; the curve with the roots marked.
 *
 * The planner gives the numbers and the order. The app computes every line (p-math.ts), so the board
 * is true whatever the plan says. English and Malayalam classes have identical pictures; only the
 * captions change language.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import type { Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import { Plane } from '../../reels/motion/plane';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, PolyPlan } from './types';
import { addPoly, degree, divide, divisorText, evalPoly, factorLines, fmt, graphWindow, identityOf, integerRoots, mulPoly, negPoly, norm, polyText, remainderLines, subPoly, termText, termsOf, type Poly } from './p-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
export const LX = 24;
export const LMAX = 340;
export const EQ_Y = 54;
export const WORK_Y = (k: number) => 106 + 36 * k;
export const GRAPH = { left: 392, top: 100, width: 296, height: 276 };
/** Colours for powers of x in the multiplication table (like terms share one). */
export const POWER_ROLES: Role[] = ['a', 'b', 'c', 'carry', 'result', 'a'];

export function buildPoly(plan: PolyPlan, lang: Lang, title: string): MotionScene[] {
  const p = norm(plan.p);
  const q = plan.q ? norm(plan.q) : undefined;
  const r = plan.r;
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  let work: string[] = [];
  let plane: Plane | null = null;
  let picture: string[] = [];

  const clearWork = (at: number) => {
    if (work.length) m.fadeOut(work, at, 300);
    work = [];
  };
  const clearPicture = (at: number) => {
    if (picture.length) m.fadeOut(picture, at, 300);
    picture = [];
  };
  const fit = (text: string, size: number, max: number) => {
    const w = tokenWidth(text, size);
    return w > max ? Math.max(13, Math.floor((size * max) / w)) : size;
  };
  /** One piece of text centred at x; returns its id. */
  const put = (text: string, x: number, y: number, color: Role | string, size = 22): string => {
    const id = `tx${uid++}`;
    m.text(id, text, x, y, { size, color, z: 4 });
    return id;
  };
  /** Text starting at LX, shrunk to the left column. */
  const line = (text: string, y: number, color: Role | string = 'ink', size = 22, max = LMAX): string => {
    const px = fit(text, size, max);
    return put(text, LX + tokenWidth(text, px) / 2, y, color, px);
  };
  const reveal = (ids: string[], gap = 330) => {
    t = m.appear(ids, t, 80, false) + gap;
    work = work.concat(ids);
  };
  const rule = (x0: number, y0: number, x1: number, y1: number, color: Role | string = 'ink') => {
    const id = `ru${uid++}`;
    t = m.rule(id, x0, y0, x1, y1, t, { color, width: 2.5 }) + 80;
    work.push(id);
  };

  const drawShow = () => {
    const text = `P(x) = ${polyText(p)}`;
    const px = fit(text, 28, SCENE_W - 2 * LX);
    const id = 'eq';
    m.text(id, text, LX + tokenWidth(text, px) / 2, EQ_Y, { size: px, color: 'result', z: 4 });
    t = m.appear(id, t, 0, false) + 450;
    const ts = termsOf(p);
    const items = [
      line(`degree = ${degree(p)}`, WORK_Y(0), 'b', 24),
      line(`coefficients: ${p.map(fmt).join(', ')}`, WORK_Y(1), 'a'),
      line(`leading ${fmt(p[0])}`, WORK_Y(2), 'c'),
      line(`constant ${fmt(p[p.length - 1])}`, WORK_Y(3), 'carry'),
    ];
    void ts;
    reveal(items);
  };

  /** Aligned columns: header powers, P, Q (or −Q), a rule, and the sum. */
  const drawColumns = (sub: boolean) => {
    if (!q) return;
    clearWork(t);
    const n = Math.max(p.length, q.length);
    const pad = (c: Poly) => [...Array(n - c.length).fill(0), ...c];
    const row2 = sub ? pad(negPoly(q)) : pad(q);
    const row1 = pad(p);
    const sums = row1.map((c, i) => c + row2[i] + 0);
    const labelW = 70;
    const cw = Math.min(62, (LMAX - labelW) / n);
    const cx = (i: number) => LX + labelW + cw * i + cw / 2;
    const yQ = WORK_Y(0);
    const yH = 154;
    const yP = 190;
    const yS = 226;
    const yR = 262;
    reveal([line(`Q(x) = ${polyText(q)}`, yQ, 'b', 22)]);
    const hdr: string[] = [];
    for (let i = 0; i < n; i++) {
      const k = n - 1 - i;
      hdr.push(put(k === 0 ? '1' : k === 1 ? 'x' : `x^${k}`, cx(i), yH, 'ink', 18));
    }
    reveal(hdr, 200);
    const rowOf = (label: string, vals: number[], y: number, color: Role | string) => {
      const ids = [put(label, LX + 22, y, color, 22)];
      vals.forEach((v, i) => ids.push(put(fmt(v), cx(i), y, color, 24)));
      return ids;
    };
    reveal(rowOf('P', row1, yP, 'a'));
    reveal(rowOf(sub ? '−Q' : 'Q', row2, yS, 'b'));
    rule(LX, yS + 20, LX + labelW + cw * n, yS + 20);
    reveal(rowOf(sub ? 'P − Q' : 'P + Q', sums, yS + 40, 'result'));
    void yR;
    const resText = `${sub ? 'P − Q' : 'P + Q'} = ${polyText(sub ? subPoly(p, q) : addPoly(p, q))}`;
    reveal([line(resText, yS + 86, 'result', 22)]);
  };

  /** The area table: p's terms down the side, q's across the top, each cell a product; like powers share a colour. */
  const drawMultiply = () => {
    if (!q) return;
    clearWork(t);
    const pt = termsOf(p);
    const qt = termsOf(q);
    const labelW = 64;
    const cw = Math.min(88, (LMAX - labelW) / qt.length);
    const cx = (j: number) => LX + labelW + cw * j + cw / 2;
    const yH = 154;
    const yRow = (i: number) => 196 + 40 * i;
    reveal([line(`Q(x) = ${polyText(q)}`, WORK_Y(0), 'b', 22)]);
    const hdr = qt.map((tm, j) => put(termText(tm.c, tm.k), cx(j), yH, 'b', 22));
    const side = pt.map((tm, i) => put(termText(tm.c, tm.k), LX + labelW / 2, yRow(i), 'a', 22));
    reveal([...hdr, ...side], 250);
    const bottom = yRow(pt.length - 1) + 20;
    rule(LX + labelW - 4, yH - 20, LX + labelW - 4, bottom, 'ink');
    rule(LX, yH + 20, LX + labelW + cw * qt.length, yH + 20, 'ink');
    pt.forEach((a, i) => {
      const ids = qt.map((b, j) => {
        const c = a.c * b.c;
        const k = a.k + b.k;
        return put(termText(c, k), cx(j), yRow(i), POWER_ROLES[k % POWER_ROLES.length], 22);
      });
      reveal(ids, 260);
    });
    reveal([line(`P × Q = ${polyText(mulPoly(p, q))}`, bottom + 46, 'result', 22)]);
  };

  const drawDivide = () => {
    if (r === undefined) return;
    clearWork(t);
    const dv = divide(p, r);
    const dtxt = divisorText(r);
    reveal([line(`(${polyText(p)}) ÷ (${dtxt})`, WORK_Y(0), 'ink', 22)]);
    dv.steps.forEach((s, i) => {
      reveal([line(`${termText(s.c, s.pw)}(${dtxt}) = ${polyText(s.product)}`, WORK_Y(1 + 2 * i), 'a', 22)], 260);
      reveal([line(polyText(s.left), WORK_Y(2 + 2 * i), 'carry', 22)], 360);
    });
    reveal([line(`q = ${polyText(dv.q)},  R = ${fmt(dv.rem)}`, WORK_Y(1 + 2 * dv.steps.length), 'result', 24)]);
  };

  const drawRemainder = () => {
    if (r === undefined) return;
    clearWork(t);
    const rem = remainderLines(p, r);
    const ys = [WORK_Y(0), WORK_Y(1), WORK_Y(2)];
    rem.lines.forEach((l, i) => reveal([line(l, ys[i], i === 2 ? 'result' : 'ink', i === 2 ? 26 : 22)]));
    const w = tokenWidth(rem.lines[2], fit(rem.lines[2], 26, LMAX));
    const id = `bx${uid++}`;
    t = m.box(id, LX + w / 2, ys[2], w + 28, 40, t, 'carry') + 200;
    work.push(id);
    if (rem.value === 0) {
      const tk = `tk${uid++}`;
      t = m.tick(tk, LX + w + 44, ys[2], t) + 200;
      work.push(tk);
    }
  };

  const drawFactor = (at: number) => {
    const fw = factorLines(p, at);
    if (!fw) return;
    clearWork(t);
    fw.lines.forEach((l, i) => reveal([line(l, WORK_Y(i), i === fw.lines.length - 1 ? 'result' : 'ink', i === fw.lines.length - 1 ? 24 : 22)]));
    const w = tokenWidth(fw.lines[0], fit(fw.lines[0], 22, LMAX));
    const tk = `tk${uid++}`;
    t = m.tick(tk, LX + w + 30, WORK_Y(0), t) + 200;
    work.push(tk);
  };

  const drawIdentity = () => {
    const id = identityOf(p);
    if (!id) return;
    clearWork(t);
    id.lines.forEach((l, i) => reveal([line(l, WORK_Y(i), i === 2 ? 'result' : 'ink', i === 2 ? 26 : 22)]));
    // the area picture on the right
    const S = 220;
    const xu = Math.max(6, Math.round(id.k * 1.8));
    const ox = 440;
    const oy = 150;
    const rect = (x: number, y: number, w: number, h: number, color: Role | string, fill: Role | string | undefined, tag: string, at: number) => {
      const rid = `ar${uid++}`;
      const end = m.poly(rid, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], at, { color, fill, fillAlpha: 0.28, width: 3, dur: 700, z: 2 });
      picture.push(rid);
      void tag;
      return end;
    };
    const label = (text: string, x: number, y: number, color: Role | string, size = 22) => {
      const lid = put(text, x, y, color, size);
      picture.push(lid);
      return m.appear(lid, t, 0, false);
    };
    if (id.kind === 'square-sum') {
      const X = (S * xu) / (xu + id.k);
      const K = S - X;
      let e = rect(ox, oy, X, X, 'a', 'a', 'x2', t);
      e = Math.max(e, rect(ox + X, oy, K, X, 'b', 'b', 'kx1', t + 200));
      e = Math.max(e, rect(ox, oy + X, X, K, 'b', 'b', 'kx2', t + 400));
      e = Math.max(e, rect(ox + X, oy + X, K, K, 'c', 'c', 'k2', t + 600));
      e = Math.max(e, label('x^2', ox + X / 2, oy + X / 2, 'a', 26), label(`${id.k}x`, ox + X + K / 2, oy + X / 2, 'b', K < 48 ? 16 : 22), label(`${id.k}x`, ox + X / 2, oy + X + K / 2, 'b', K < 48 ? 16 : 22), label(`${id.k * id.k}`, ox + X + K / 2, oy + X + K / 2, 'c', K < 48 ? 16 : 22));
      e = Math.max(e, label('x', ox + X / 2, oy - 16, 'ink', 20), label(`${id.k}`, ox + X + K / 2, oy - 16, 'ink', 20), label('x', ox - 16, oy + X / 2, 'ink', 20), label(`${id.k}`, ox - 16, oy + X + K / 2, 'ink', 20));
      t = e + 400;
    } else if (id.kind === 'square-diff') {
      const K = (S * id.k) / xu;
      const X = S - K;
      let e = rect(ox, oy, X, X, 'c', 'c', 'inner', t);
      e = Math.max(e, rect(ox + X, oy, K, X, 'b', 'b', 's1', t + 200));
      e = Math.max(e, rect(ox, oy + X, X, K, 'b', 'b', 's2', t + 400));
      e = Math.max(e, rect(ox + X, oy + X, K, K, 'a', 'a', 'corner', t + 600));
      e = Math.max(e, label('(x − k)^2'.replace('k', String(id.k)), ox + X / 2, oy + X / 2, 'c', 22), label(`${id.k}x`, ox + X + K / 2, oy + X / 2, 'b', K < 48 ? 16 : 22), label(`${id.k}x`, ox + X / 2, oy + X + K / 2, 'b', K < 48 ? 16 : 22), label(`${id.k * id.k}`, ox + X + K / 2, oy + X + K / 2, 'a', K < 48 ? 16 : 22));
      e = Math.max(e, label('x', ox + S / 2, oy - 16, 'ink', 20), label('x', ox - 16, oy + S / 2, 'ink', 20));
      t = e + 400;
    } else {
      const K = (S * id.k) / xu;
      const X = S;
      let e = rect(ox, oy, X, X, 'ink', 'a', 'big', t);
      e = Math.max(e, rect(ox + X - K, oy + X - K, K, K, 'c', 'c', 'cut', t + 400));
      e = Math.max(e, label('x^2', ox + (X - K) / 2, oy + (X - K) / 2, 'a', 26), label(`${id.k}^2`, ox + X - K / 2, oy + X - K / 2, 'c', K < 48 ? 16 : 22));
      e = Math.max(e, label('x', ox + X / 2, oy - 16, 'ink', 20), label('x', ox - 16, oy + X / 2, 'ink', 20), label(`${id.k}`, ox + X - K / 2, oy + X + 16, 'ink', 20));
      t = e + 400;
    }
    // the check, written below the three lines
    id.check.forEach((l, i) => reveal([line(l, WORK_Y(3) + 8 + 36 * i, 'ink', 20)]));
    const lw = tokenWidth(id.check[1], fit(id.check[1], 20, LMAX));
    const tk = `tk${uid++}`;
    t = m.tick(tk, LX + lw + 30, WORK_Y(3) + 8 + 36, t) + 200;
    work.push(tk);
  };

  const drawGraph = () => {
    clearPicture(t);
    const win = graphWindow(p);
    const spec = { left: GRAPH.left, top: GRAPH.top, width: GRAPH.width, height: GRAPH.height, ...win };
    plane = new Plane(m, spec, 'g');
    t = plane.grid(t, { extend: 1, labels: true });
    const pts: Array<[number, number]> = [];
    const n = 200;
    for (let i = 0; i <= n; i++) {
      const x = win.xMin + ((win.xMax - win.xMin) * i) / n;
      pts.push(plane.px(x, evalPoly(p, x)));
    }
    const end = m.poly('curve', pts, t, { color: 'b', closed: false, width: 4, dur: 1800, z: 2, clip: plane.clipBox() });
    const capText = `y = ${polyText(p)}`;
    const px = fit(capText, 20, SCENE_W - 2 * LX);
    const capId = 'gcap';
    m.text(capId, capText, GRAPH.left + GRAPH.width / 2, GRAPH.top + GRAPH.height + 34, { size: px, color: 'b', z: 4 });
    t = Math.max(end, m.appear(capId, end - 600, 0, false)) + 400;
  };

  const drawRoots = () => {
    if (!plane) return;
    const win = graphWindow(p);
    const rs = [...new Set(integerRoots(p).roots)].filter((x) => x >= win.xMin && x <= win.xMax);
    let end = t;
    rs.forEach((rt, i) => {
      const d = plane!.dot(`rt${i}`, [rt, 0], t + i * 350, { color: 'result', r: 7 });
      const lb = plane!.label(`rl${i}`, fmt(rt), [rt, 0], d.end - 100, { dx: 0, dy: -20, color: 'result', size: 20 });
      end = Math.max(end, d.end, lb.end);
    });
    t = end + 500;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show':
        drawShow();
        break;
      case 'add':
        drawColumns(false);
        break;
      case 'subtract':
        drawColumns(true);
        break;
      case 'multiply':
        drawMultiply();
        break;
      case 'divide':
        drawDivide();
        break;
      case 'remainder':
        drawRemainder();
        break;
      case 'factor':
        drawFactor(st.at);
        break;
      case 'identity':
        drawIdentity();
        break;
      case 'graph':
        drawGraph();
        break;
      case 'roots':
        drawRoots();
        break;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
