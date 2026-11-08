/**
 * DNA builders for fractions (bars and tiles), statistics (bar chart / histogram) and
 * probability (tree diagram).
 *
 * As with the plane and graph DNAs, every number the viewer sees is COMPUTED here from the
 * plan's few inputs: fractions from the parts drawn, percent and decimal from the tiles,
 * mean and median from the bar values, probabilities of paths and events from the branch
 * probabilities (exact fractions). The planner chooses what to show, never what the answer is.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { DUR, type Role } from '../../reels/motion/grammar';
import { tokenWidth } from '../../reels/motion/metrics';
import { fmtNum, niceStep, Plane, type Pt } from '../../reels/motion/plane';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, FractionPlan, HistogramPlan, TreeNode, TreePlan } from './types';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
const COLORS: Role[] = ['a', 'b', 'c', 'carry'];

/* ---------------- exact fractions ---------------- */

export type Q = [number, number];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const qNorm = (q: Q): Q => {
  const g = gcd(q[0], q[1]) || 1;
  return [q[0] / g, q[1] / g];
};
export const qMul = (a: Q, b: Q): Q => qNorm([a[0] * b[0], a[1] * b[1]]);
export const qAdd = (a: Q, b: Q): Q => qNorm([a[0] * b[1] + b[0] * a[1], a[1] * b[1]]);
export const qTok = (q: Q): string => (q[1] === 1 ? String(q[0]) : `{${q[0]}/${q[1]}}`);

/** "1/2", "{1/2}", "3", "0" → exact fraction (null when it is not one). */
export function parseQ(s: string): Q | null {
  const m = /^\s*\{?\s*(\d{1,4})\s*(?:\/\s*(\d{1,4}))?\s*\}?\s*$/.exec(String(s));
  if (!m) return null;
  const n = Number(m[1]);
  const d = m[2] === undefined ? 1 : Number(m[2]);
  return d > 0 ? [n, d] : null;
}

/* ---------------- fractions: bars and tiles ---------------- */

interface Bar {
  n: number;
  k: number;
  y: number;
  color: Role;
  shade: string;
  label: string;
}

export function buildFractions(plan: FractionPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const X0 = 90;
  const W = 440;
  const H = 44;
  const GAP = 84;
  const Y0 = 66;
  const LX = 618;
  const rect = (x0: number, y: number, w: number, h = H): Pt[] => [[x0, y - h / 2], [x0 + w, y - h / 2], [x0 + w, y + h / 2], [x0, y + h / 2]];
  const bars: Bar[] = [];
  let t = 300;
  let n = 0;

  const drawBar = (b: number, atT: number): number => {
    const bar = bars[b];
    const id = `fb${b}`;
    let end = m.poly(`${id}o`, rect(X0, bar.y, W), atT, { color: 'ink', width: 3.5, dur: 600, silent: true });
    for (let i = 1; i < bar.n; i++) {
      const x = X0 + (W * i) / bar.n;
      end = Math.max(end, m.poly(`${id}d${i}`, [[x, bar.y - H / 2], [x, bar.y + H / 2]], atT + 250 + i * 50, { color: 'ink', closed: false, width: 2.5, dur: 220, silent: true }));
    }
    m.sound(atT, 'scribble', { dur: 700 });
    return end;
  };
  const labelOf = (b: Bar) => `{${b.k}/${b.n}}`;

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const s of plan.steps) {
    t = m.step(pick(s.say, lang), t, 2200);
    switch (s.op) {
      case 'bar': {
        const b = bars.length;
        const bar: Bar = { n: s.n, k: s.shade, y: Y0 + b * GAP, color: COLORS[b % 4], shade: `fb${b}s`, label: `fb${b}l` };
        bars.push(bar);
        t = drawBar(b, t);
        t = m.poly(bar.shade, rect(X0, bar.y, (W * bar.k) / bar.n), t, { color: bar.color, fill: bar.color, fillAlpha: 0.55, width: 3, dur: 800, z: 0, silent: true });
        m.text(bar.label, labelOf(bar), LX, bar.y, { size: 40, color: bar.color, z: 4 });
        t = m.appear(bar.label, t) + DUR.beat;
        break;
      }
      case 'split': {
        const bar = bars[s.bar];
        const newN = bar.n * s.by;
        let end = t;
        for (let i = 1; i < newN; i++) {
          if (i % s.by === 0) continue;
          const x = X0 + (W * i) / newN;
          end = Math.max(end, m.poly(`fs${n++}`, [[x, bar.y - H / 2], [x, bar.y + H / 2]], t + i * 30, { color: 'carry', closed: false, width: 2.5, dur: 300, silent: true, z: 2 }));
        }
        m.sound(t, 'scribble', { dur: 600 });
        bar.n = newN;
        bar.k *= s.by;
        m.focus(bar.label, end);
        const sw = m.swap(bar.label, labelOf(bar), end + 100);
        m.unfocus(bar.label, sw + 200);
        t = sw + 500;
        break;
      }
      case 'shade': {
        const bar = bars[s.bar];
        bar.k = s.to;
        const end = m.morph(bar.shade, rect(X0, bar.y, (W * bar.k) / bar.n), t, { dur: 900 });
        t = m.swap(bar.label, labelOf(bar), end - 300) + 500;
        break;
      }
      case 'join': {
        const A = bars[s.a];
        const B = bars[s.b];
        const b = bars.length;
        const bar: Bar = { n: A.n, k: A.k + B.k, y: Y0 + b * GAP, color: 'result', shade: `fb${b}s`, label: `fb${b}l` };
        bars.push(bar);
        t = drawBar(b, t);
        // The shaded parts of A and B fly onto the new bar, end to end.
        const wA = (W * A.k) / A.n;
        const wB = (W * B.k) / B.n;
        const fly = (src: Bar, w: number, dx: number, color: Role, tag: string) => {
          const id = `fj${n++}${tag}`;
          m.poly(id, rect(X0, src.y, w), t, { color, fill: color, fillAlpha: 0.55, width: 3, dur: 1, z: 3, silent: true });
          m.morph(id, rect(X0 + dx, bar.y, w), t + 200, { dur: 1100 });
        };
        fly(A, wA, 0, A.color, 'a');
        fly(B, wB, wA, B.color, 'b');
        m.sound(t + 200, 'swoosh', { dur: 1000 });
        t += 1500;
        // One shaded bar remains as the bar's own shading (so later steps can still change it).
        m.poly(bar.shade, rect(X0, bar.y, (W * bar.k) / bar.n), t, { color: 'result', fill: 'result', fillAlpha: 0.45, width: 3, dur: 1, z: 0, silent: true });
        m.text(bar.label, labelOf(bar), LX, bar.y, { size: 40, color: 'result', z: 4 });
        t = m.appear(bar.label, t) + DUR.beat;
        break;
      }
      case 'grid': {
        const N = s.rows * s.cols;
        const cell = Math.min(34, Math.floor(300 / s.rows), Math.floor(440 / s.cols));
        const gw = cell * s.cols;
        const gh = cell * s.rows;
        const gx = X0 + (440 - gw) / 2;
        const gy = 36 + (300 - gh) / 2;
        const ids: string[] = [];
        const stagger = Math.min(40, 1100 / N);
        for (let r = 0; r < s.rows; r++) {
          for (let c = 0; c < s.cols; c++) {
            const id = `fg${r}_${c}`;
            const x = gx + c * cell;
            const y = gy + r * cell;
            m.poly(id, [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]], t + (r * s.cols + c) * stagger, { color: '#8e99d6', width: 1.6, dur: 160, silent: true, z: 0 });
            ids.push(id);
          }
        }
        m.sound(t, 'scribble', { dur: 900 });
        t += N * stagger + 400;
        const per = Math.min(70, 1500 / Math.max(1, s.shade));
        for (let i = 0; i < s.shade; i++) m.fillTo(ids[i], 'a', t + i * per, 0.6, 220);
        t += s.shade * per + 400;
        m.text('fgl', `{${s.shade}/${N}}`, LX, 120, { size: 44, color: 'a', z: 4 });
        t = m.appear('fgl', t) + 300;
        let y = 200;
        // Decimal exists only for tenths / hundredths; percent whenever N divides 100.
        if (N === 10 || N === 100) {
          m.text('fgd', `= ${fmtNum(s.shade / N)}`, LX, y, { size: 36, color: 'result', z: 4 });
          t = m.appear('fgd', t) + 250;
          y += 56;
        }
        if (100 % N === 0 || N === 100) {
          m.text('fgp', `= ${fmtNum((s.shade * 100) / N)}%`, LX, y, { size: 36, color: 'result', z: 4 });
          t = m.appear('fgp', t) + 250;
        }
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

/* ---------------- statistics: bar chart / histogram ---------------- */

export const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
export const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

export function buildHistogram(plan: HistogramPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const nCat = plan.categories.length;
  const spec = { left: 78, top: 40, width: 430, height: 300, xMin: 0, xMax: nCat, yMin: 0, yMax: plan.yMax };
  const P = new Plane(m, spec);
  const COL = 616;
  const yb = P.px(0, 0)[1];
  let t = 300;
  let axes = false;
  let values: number[] | null = null;
  let k = 0;
  const lines: Array<{ id: string; label: string; kind: 'mean' | 'median' | 'line'; y?: number; text: string }> = [];

  const barPts = (i: number, v: number): Pt[] => {
    const x0 = P.px(i + 0.14, 0)[0];
    const x1 = P.px(i + 0.86, 0)[0];
    const top = P.px(0, v)[1];
    return [[x0, top], [x1, top], [x1, yb], [x0, yb]];
  };
  const ensureAxes = () => {
    if (axes) return;
    axes = true;
    t = P.grid(t, { labels: 'y', vlines: false, step: niceStep(plan.yMax, 6) });
    plan.categories.forEach((c, i) => {
      const id = m.text(`hc${i}`, c, P.px(i + 0.5, 0)[0], yb + 22, { size: 20, color: 'ink', z: 2 });
      m.appear(id, t - 300 + i * 40, 0, false);
    });
    if (plan.yLabel) {
      const id = m.text('hyl', `(${plan.yLabel})`, COL + 40, 28, { size: 22, color: 'ink', z: 2 });
      m.appear(id, t - 300, 0, false);
    }
    t += 300;
  };
  const lineY = (kind: 'mean' | 'median' | 'line', y?: number) => (kind === 'mean' ? mean(values!) : kind === 'median' ? median(values!) : y!);
  // The words mean / median are translated by the app (the positions and numbers stay identical).
  const WORD: Record<'mean' | 'median', Bi> = { mean: { en: 'mean', ml: 'ശരാശരി' }, median: { en: 'median', ml: 'മധ്യമം' } };
  const textFor = (kind: 'mean' | 'median' | 'line', v: number, label?: string) => (kind === 'line' ? `${label ? label + ' = ' : ''}${fmtNum(v)}` : `${pick(WORD[kind], lang)} = ${fmtNum(v)}`);
  const lineAt = (v: number): Pt[] => [[spec.left, P.px(0, v)[1]], [spec.left + spec.width, P.px(0, v)[1]]];
  const addLine = (kind: 'mean' | 'median' | 'line', y?: number, label?: string) => {
    const v = lineY(kind, y);
    const id = `hl${k++}`;
    const color: Role = kind === 'mean' ? 'accent' : kind === 'median' ? 'c' : 'carry';
    t = m.poly(id, lineAt(v), t, { color, closed: false, width: 3.5, dashed: true, dur: 900, z: 3 });
    const text = textFor(kind, v, label);
    const lid = m.text(`${id}t`, text, COL, 70 + lines.length * 48, { size: 28, color, z: 4 });
    t = m.appear(lid, t - 200) + DUR.beat;
    lines.push({ id, label: lid, kind, y, text });
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const s of plan.steps) {
    t = m.step(pick(s.say, lang), t, 2200);
    switch (s.op) {
      case 'axes':
        ensureAxes();
        break;
      case 'bars': {
        ensureAxes();
        values = [...s.values];
        values.forEach((v, i) => {
          const full = barPts(i, v);
          const flat: Pt[] = [[full[0][0], yb], [full[1][0], yb], full[2], full[3]];
          const color = COLORS[0];
          m.poly(`hb${i}`, flat, t + i * 140, { color, fill: color, fillAlpha: 0.5, width: 3, dur: 1, z: 1, silent: true });
          m.morph(`hb${i}`, full, t + i * 140 + 40, { dur: 900 });
          const lid = m.text(`hv${i}`, fmtNum(v), P.px(i + 0.5, 0)[0], P.px(0, v)[1] - 18, { size: 22, color: 'ink', z: 4 });
          m.appear(lid, t + i * 140 + 800, 0, false);
        });
        m.sound(t, 'swoosh', { dur: 1000 });
        t += nCat * 140 + 1300;
        break;
      }
      case 'highlight': {
        m.focus([`hb${s.index}`, `hv${s.index}`], t);
        m.unfocus([`hb${s.index}`, `hv${s.index}`], t + 1700);
        t += 1400;
        break;
      }
      case 'mean':
        addLine('mean');
        break;
      case 'median':
        addLine('median');
        break;
      case 'line':
        addLine('line', s.y, s.label);
        break;
      case 'change': {
        values![s.index] = s.to;
        const end = m.morph(`hb${s.index}`, barPts(s.index, s.to), t, { dur: 1100 });
        m.swap(`hv${s.index}`, fmtNum(s.to), t + 200);
        m.move(`hv${s.index}`, P.px(s.index + 0.5, 0)[0], P.px(0, s.to)[1] - 18, t, { dur: 1100, sound: false });
        // Mean / median lines slide to their new value and their labels roll to the new number.
        for (const L of lines) {
          if (L.kind === 'line') continue;
          const v = lineY(L.kind);
          m.morph(L.id, lineAt(v), t + 200, { dur: 1000 });
          m.swap(L.label, textFor(L.kind, v), t + 900);
        }
        t = end + 900;
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

/* ---------------- probability tree ---------------- */

interface Placed {
  node: TreeNode;
  parent: Placed | null;
  index: number;
  level: number;
  x: number;
  y: number;
  q: Q;
  /** Product of probabilities from the start (exact). */
  prod: Q;
  path: string;
  edge: string;
  edgeLabel: string;
  nodeLabel: string;
}

export function treeDepth(nodes: TreeNode[]): number {
  return 1 + Math.max(0, ...nodes.map((n) => (n.children?.length ? treeDepth(n.children) : 0)));
}
export function treeLeaves(nodes: TreeNode[]): number {
  return nodes.reduce((a, n) => a + (n.children?.length ? treeLeaves(n.children) : 1), 0);
}

export function buildTree(plan: TreePlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  const D = treeDepth(plan.branches);
  const L = treeLeaves(plan.branches);
  const X0 = 66;
  const X1 = 470;
  const TOP = 44;
  const BOT = 330;
  const levelX = (l: number) => X0 + (l * (X1 - X0)) / D;
  const leafY = (i: number) => TOP + ((i + 0.5) * (BOT - TOP)) / L;
  const placed: Placed[] = [];
  const byLevel: Placed[][] = Array.from({ length: D + 1 }, () => []);
  let leafNo = 0;
  let uid = 0;
  const place = (nodes: TreeNode[], parent: Placed | null, level: number): Placed[] =>
    nodes.map((node, index) => {
      const q = parseQ(node.p) ?? [1, 1];
      const ch: Placed[] = [];
      const me: Placed = {
        node,
        parent,
        index,
        level,
        x: levelX(level),
        y: 0,
        q,
        prod: qMul(parent ? parent.prod : [1, 1], q),
        path: `${parent ? parent.path + ' ' : ''}${node.label}`,
        edge: `te${uid}`,
        edgeLabel: `tp${uid}`,
        nodeLabel: `tn${uid++}`,
      };
      if (node.children?.length) {
        ch.push(...place(node.children, me, level + 1));
        me.y = ch.reduce((a, c) => a + c.y, 0) / ch.length;
      } else me.y = leafY(leafNo++);
      placed.push(me);
      byLevel[level].push(me);
      return me;
    });
  place(plan.branches, null, 1);
  const root = { x: levelX(0), y: byLevel[1].reduce((a, c) => a + c.y, 0) / byLevel[1].length };

  const at = (path: number[]): Placed => {
    let list = byLevel[1];
    let cur: Placed | undefined;
    for (const i of path) {
      cur = list[i];
      list = placed.filter((p) => p.parent === cur).sort((a, b) => a.index - b.index);
    }
    return cur!;
  };
  const chainOf = (p: Placed): Placed[] => (p.parent ? [...chainOf(p.parent), p] : [p]);

  let t = 300;
  let revealed = 0;
  let row: string[] = [];
  let hot: string[] = [];
  const startId = 'tstart';
  if (plan.start) m.text(startId, plan.start, root.x - 34, root.y, { size: 24, color: 'ink', z: 4 });

  const showLevel = (l: number) => {
    let end = t;
    if (l === 1) {
      m.dot('troot', root.x + 14, root.y, t, { color: 'ink', r: 5 });
      if (plan.start) m.appear(startId, t);
    }
    byLevel[l].forEach((p, i) => {
      const from: Pt = p.parent ? [p.parent.x + 18, p.parent.y] : [root.x + 14, root.y];
      const to: Pt = [p.x - 18, p.y];
      end = Math.max(end, m.poly(p.edge, [from, to], t + i * 120, { color: 'ink', closed: false, width: 3, dur: 600, silent: true, z: 1 }));
      const up = to[1] < from[1];
      m.text(p.edgeLabel, `{${p.q[0]}/${p.q[1]}}`.replace(/^\{(\d+)\/1\}$/, '$1'), (from[0] + to[0]) / 2 - 4, (from[1] + to[1]) / 2 + (up ? -22 : 22), { size: 26, color: 'carry', z: 4 });
      m.appear(p.edgeLabel, t + 350 + i * 120, 0, false);
      m.text(p.nodeLabel, p.node.label, p.x, p.y, { size: 28, color: 'ink', z: 4 });
      m.appear(p.nodeLabel, t + 500 + i * 120, 0, false);
      end = Math.max(end, t + 900 + i * 120);
    });
    m.sound(t, 'scribble', { dur: 700 });
    t = end + 300;
  };

  /** Writes tokens in a centred row under the tree, replacing the previous row. */
  const writeRow = (tokens: string[], colors: Array<Role | undefined> = []) => {
    for (const id of row) m.get(id).alpha.to(t, 300, 0);
    row = [];
    const gap = 14;
    const fit = (size: number) => tokens.reduce((a, tk) => a + tokenWidth(tk, size), 0) + gap * (tokens.length - 1);
    let size = 36;
    while (size > 20 && fit(size) > 640) size -= 2;
    let x = SCENE_W / 2 - fit(size) / 2;
    tokens.forEach((tk, i) => {
      const w = tokenWidth(tk, size);
      const id = m.text(`trow${uid++}`, tk, x + w / 2, 392, { size, color: colors[i] ?? (/^[=+×]$/.test(tk) ? 'ink' : 'result'), z: 4 });
      row.push(id);
      x += w + gap;
    });
    t = m.appear(row, t + 200, 150) + 500;
  };
  const clearHot = () => {
    if (hot.length) {
      m.recolor(hot, 'ink', t, 300);
      m.unfocus(hot.filter((id) => id.startsWith('te')), t);
    }
    hot = [];
  };
  const light = (leaf: Placed, color: Role) => {
    const ids: string[] = [];
    for (const p of chainOf(leaf)) ids.push(p.edge, p.nodeLabel);
    m.recolor(ids, color, t, 350);
    m.focus(ids.filter((id) => id.startsWith('te')), t + 100, false);
    hot.push(...ids);
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const s of plan.steps) {
    t = m.step(pick(s.say, lang), t, 2400);
    switch (s.op) {
      case 'grow':
        while (revealed < Math.min(s.levels, D)) showLevel(++revealed);
        break;
      case 'path': {
        clearHot();
        const leaf = at(s.path);
        light(leaf, 'carry');
        t += 700;
        const chain = chainOf(leaf);
        const tokens: string[] = [];
        chain.forEach((p, i) => {
          if (i) tokens.push('×');
          tokens.push(qTok(p.q));
        });
        tokens.push('=', qTok(leaf.prod));
        writeRow(tokens);
        break;
      }
      case 'event': {
        clearHot();
        const leaves = s.paths.map(at);
        leaves.forEach((lf) => light(lf, 'c'));
        t += 700;
        const tokens: string[] = [];
        let sum: Q = [0, 1];
        leaves.forEach((lf, i) => {
          if (i) tokens.push('+');
          tokens.push(qTok(lf.prod));
          sum = qAdd(sum, lf.prod);
        });
        tokens.push('=', qTok(sum));
        writeRow(tokens);
        break;
      }
      case 'total': {
        clearHot();
        const leaves = placed.filter((p) => !placed.some((c) => c.parent === p)).sort((a, b) => a.y - b.y);
        const ids = leaves.map((lf, i) => m.text(`tl${i}`, qTok(lf.prod), 560, lf.y, { size: 26, color: 'result', z: 4 }));
        t = m.appear(ids, t, 140) + 400;
        let sum: Q = [0, 1];
        const tokens: string[] = [];
        leaves.forEach((lf, i) => {
          if (i) tokens.push('+');
          tokens.push(qTok(lf.prod));
          sum = qAdd(sum, lf.prod);
        });
        tokens.push('=', qTok(sum));
        const width = tokens.reduce((a, tk) => a + tokenWidth(tk, 20), 0) + 14 * (tokens.length - 1);
        writeRow(width > 640 ? ['all ends', '=', qTok(sum)] : tokens);
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
