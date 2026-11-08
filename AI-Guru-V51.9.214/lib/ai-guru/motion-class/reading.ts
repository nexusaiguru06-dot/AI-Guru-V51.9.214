/**
 * Reading scene: the textbook passage on the board, read aloud sentence by
 * sentence (English as printed, or its Malayalam translation). Prose wraps
 * left-aligned; equation lines are centred in larger type, as in the book.
 * The sentence being read turns dark with its numbers coloured, read sentences
 * fade back, and the camera follows down long passages.
 */

import { Motion, type MotionScene } from '../reels/motion/engine';
import { tokenWidth } from '../reels/motion/metrics';
import type { Lang } from '../reels/motion/captions';
import { looksLikeMath } from './layout';

/** Sentences; keeps decimals, "(1)", "i.e." and fraction tokens intact. */
export function sentences(text: string): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const out: string[] = [];
  let buf = '';
  const parts = t.split(/(?<=[.?!;:])\s+(?=[A-Z(ഀ-ൿ"'0-9{])/);
  for (const p of parts) {
    buf = buf ? `${buf} ${p}` : p;
    // Very short pieces ("So," "That is,") stay with what follows.
    if (buf.length >= 18 || /[.?!]$/.test(buf)) {
      out.push(buf);
      buf = '';
    }
  }
  if (buf) out.push(buf);
  return out;
}

interface Unit {
  text: string;
  math: boolean;
}

/** Passage → reading units: prose sentences and whole equation lines. */
export function readingUnits(text: string): Unit[] {
  const out: Unit[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const label = /^(.{6,90}?)(?:\s*[:→]\s+)([^:→]*=.*)$/.exec(line);
    if (label && looksLikeMath(label[2]) && !looksLikeMath(label[1])) {
      out.push(...sentences(label[1]).map((s) => ({ text: s, math: false })));
      out.push({ text: label[2], math: true });
    } else if (looksLikeMath(line) || (/=/.test(line) && line.length < 40)) out.push({ text: line, math: true });
    else out.push(...sentences(line).map((s) => ({ text: s, math: false })));
  }
  return out;
}

export function buildReadingScene(text: string, lang: Lang, title: string): MotionScene {
  const proseSize = lang === 'ml' ? 28 : 30;
  const mathSize = 38;
  const width = 640;
  const units = readingUnits(text);

  // Lay out: prose flows (new line after an equation), equations get their own centred line.
  type W = { w: string; u: number };
  const rows: Array<{ words: W[]; math: boolean }> = [];
  let cur: { words: W[]; math: boolean } | null = null;
  let lw = 0;
  units.forEach((u, ui) => {
    const size = u.math ? mathSize : proseSize;
    const space = tokenWidth(' ', size) * 1.05;
    if (u.math) {
      cur = { words: [], math: true };
      rows.push(cur);
      lw = 0;
    } else if (!cur || cur.math) {
      cur = { words: [], math: false };
      rows.push(cur);
      lw = 0;
    }
    for (const w of u.text.split(/\s+/).filter(Boolean)) {
      const ww = tokenWidth(w, size);
      if (!u.math && lw > 0 && lw + space + ww > width) {
        cur = { words: [], math: false };
        rows.push(cur);
        lw = 0;
      }
      cur!.words.push({ w, u: ui });
      lw += (lw > 0 ? space : 0) + ww;
    }
    if (u.math) cur = null;
  });

  const lineH = (math: boolean) => (math ? mathSize * 1.55 : proseSize * 1.5);
  const height = Math.max(300, 70 + rows.reduce((a, r) => a + lineH(r.math), 0) + 30);
  const m = new Motion(title, 720, height);
  // A tight camera keeps the type large on a 16:9 class screen; it follows the sentence being read.
  const view = Math.min(height, 340);
  m.camH.set(0, view);
  m.camY.set(0, view / 2);
  const byUnit: string[][] = units.map(() => []);
  const unitY: number[] = units.map(() => 0);
  let k = 0;
  let y = 70;
  for (const row of rows) {
    const size = row.math ? mathSize : proseSize;
    const space = tokenWidth(' ', size) * 1.05;
    const widths = row.words.map((x) => tokenWidth(x.w, size));
    const total = widths.reduce((a, b) => a + b, 0) + space * (row.words.length - 1);
    let x = row.math ? 360 - total / 2 : 40;
    row.words.forEach((x0, i) => {
      const id = m.text(`r${k++}`, x0.w, x + widths[i] / 2, y, { size, color: '#b9b5d6' });
      byUnit[x0.u].push(id);
      if (!unitY[x0.u]) unitY[x0.u] = y;
      x += widths[i] + space;
    });
    y += lineH(row.math);
  }

  let t = 250;
  const all = byUnit.flat();
  m.write(all, t, 6, 220);
  t += Math.min(1400, all.length * 6 + 300);
  const roles = ['a', 'b', 'c'];
  units.forEach((u, ui) => {
    t = m.step(u.text, t, Math.max(1500, u.text.length * 55));
    if (height > view) m.look(t, unitY[ui] + 40, view, 600);
    let r = 0;
    for (const id of byUnit[ui]) {
      const word = m.get(id).text;
      const bare = word.replace(/[.,?;:]/g, '');
      // Numbers, fractions and maths letters (not the words "a" / "I").
      const isNum = /\d/.test(word) || /^\{.*\}$/.test(word) || /^[b-hj-z]$/.test(bare);
      m.recolor(id, isNum ? roles[r++ % 3] : 'ink', t, 250);
    }
    if (u.math) t = m.focus(byUnit[ui], t + 200, false);
    if (ui > 0) m.dim(byUnit[ui - 1], t);
    t += 600;
    m.hold(t);
  });
  m.hold(t + 800);
  return m.build(700);
}
