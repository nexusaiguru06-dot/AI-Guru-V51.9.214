/**
 * CHAPTER INTRO — "what is this chapter about?" in the same motion grammar.
 *
 *  The heading is written with a pen underline, then each key idea appears as one
 *  board line. Words wrapped in *stars* are key terms: they take a role colour and
 *  get focused while the caption explains them. Finished ideas fade to "done".
 *  Lines can also be maths tokens (same token format as derivations).
 */

import { DUR, type Role } from '../grammar';
import { Motion, type MotionScene } from '../engine';
import { tokenWidth } from '../metrics';

export interface IntroPoint {
  /** Short board text with *key terms*, e.g. "Two *equations*, two *unknowns*". */
  board?: string;
  /** Or a maths line in derivation token format. */
  math?: string[];
  /** Spoken caption for this point. */
  say: string;
}

export interface IntroInput {
  /** Reel title (title pill). */
  title: string;
  /** Big heading on the board, e.g. "Pair of Linear Equations". */
  heading: string;
  points: IntroPoint[];
}

const KEY_ROLES: Role[] = ['a', 'b', 'c'];

interface Piece {
  text: string;
  key: boolean;
}

function pieces(board: string): Piece[] {
  const out: Piece[] = [];
  board.split(/(\*[^*]+\*)/).forEach((p) => {
    if (!p) return;
    if (p.startsWith('*') && p.endsWith('*')) out.push({ text: p.slice(1, -1), key: true });
    else out.push({ text: p, key: false });
  });
  return out;
}

export function buildIntro(input: IntroInput): MotionScene {
  const headSize = 50;
  const lineSize = 42;
  const mathSize = 58;
  const rows = input.points.map((p) => (p.math ? 92 : 72));
  const height = 120 + rows.reduce((a, b) => a + b, 0) + 40;
  const m = new Motion(input.title, 720, height);
  const view = Math.min(height, 470);
  m.camH.set(0, view);
  m.camY.set(0, view / 2);

  let t = 300;
  t = m.step(input.points[0]?.say ?? input.heading, t, 1200);
  let hs = headSize;
  while (tokenWidth(input.heading, hs, '700') > 660 && hs > 26) hs -= 2;
  const hw = tokenWidth(input.heading, hs, '700');
  m.text('heading', input.heading, 360, 52, { size: hs, weight: '700', color: 'accent' });
  t = m.write('heading', t, 0, 700);
  t = m.rule('underline', 360 - hw / 2, 88, 360 + hw / 2, 88, t - 200, { color: 'accent', width: 4 }) + DUR.beat;

  let y = 120;
  let keyNo = 0;
  const done: string[] = [];
  input.points.forEach((p, k) => {
    const h = rows[k];
    const cy = y + h / 2;
    y += h;
    if (k > 0) t = m.step(p.say, t, 2600);
    else m.hold(t + 2200);
    if (height > view) m.look(t, cy + h - view / 2);
    const ids: string[] = [];
    const keys: string[] = [];

    if (p.math) {
      const ws = p.math.map((tk) => tokenWidth(tk, mathSize));
      const gap = mathSize * 0.24;
      const total = ws.reduce((a, b) => a + b, 0) + gap * (p.math.length - 1);
      let x = 360 - total / 2;
      p.math.forEach((tk, j) => {
        const role: Role = /^[0-9{]/.test(tk) ? KEY_ROLES[keyNo++ % 3] : 'ink';
        ids.push(m.text(`p${k}_${j}`, tk, x + ws[j] / 2, cy, { size: mathSize, color: role }));
        x += ws[j] + gap;
      });
      t = m.appear(ids, t, 90) + DUR.beat;
    } else {
      let size = lineSize;
      const ps = pieces(p.board ?? '');
      const width = (px: number) => ps.reduce((w, q) => w + tokenWidth(q.text, px, q.key ? '700' : '400'), 0);
      while (width(size) > 680 && size > 22) size -= 2;
      let x = 360 - width(size) / 2;
      ps.forEach((q, j) => {
        const w = tokenWidth(q.text, size, q.key ? '700' : '400');
        const color: Role = q.key ? KEY_ROLES[keyNo++ % 3] : 'ink';
        const id = m.text(`p${k}_${j}`, q.text, x + w / 2, cy, { size, color, weight: q.key ? '700' : '400' });
        ids.push(id);
        if (q.key) keys.push(id);
        x += w;
      });
      t = m.write(ids, t, 180, 420) + DUR.beat;
    }
    if (keys.length) {
      t = m.focus(keys, t) + 700;
      m.unfocus(keys, t);
    }
    if (done.length) m.dim(done, t - 400);
    done.push(...ids);
    t += 1200;
    m.hold(t);
  });
  m.hold(t + 600);
  return m.build(900);
}
