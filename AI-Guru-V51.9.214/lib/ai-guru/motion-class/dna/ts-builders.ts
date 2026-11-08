/**
 * DNA builder for typeset formula lines (V51.9.45): fractions, roots, powers and matrices laid out by the
 * typesetter, then written, turned into the next line (shared symbols glide, the rest fade and appear),
 * stacked, lit and boxed. English and Malayalam classes have identical pictures; only the captions and
 * the small notes under a line change language.
 */

import { Motion, type MotionScene } from '../../reels/motion/engine';
import { STAGGER_TEXT } from '../../reels/motion/curves';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import { becomeMath, layoutMath, mathBox, mathGlyphs, mathIds, placeMath, type MathHandle } from '../../reels/motion/typeset';
import type { Bi, TsPlan } from './types';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const SCENE_W = 720;
const SCENE_H = 444;
/** Size of a line, the widest it may be, where the first line sits, the gap between lines, and the lowest point. */
export const TS_SIZE = 52;
export const TS_MAXW = 640;
export const TS_TOP = 40;
export const TS_GAP = 30;
export const TS_BOTTOM = 424;
export const TS_NOTE_H = 36;

interface Row {
  h: MathHandle;
  note: string | null;
  noteY: number;
}

export function buildTypeset(plan: TsPlan, lang: Lang, title: string): MotionScene[] {
  const m = new Motion(title, SCENE_W, SCENE_H);
  m.fixView(SCENE_W / 2, SCENE_W);
  let t = 300;
  let uid = 0;
  const rows: Row[] = [];
  const o = { size: TS_SIZE, maxWidth: TS_MAXW, colors: plan.colors };

  const rowIds = (r: Row) => [...mathIds(r.h), ...(r.note ? [r.note] : [])];
  const lastRow = (): Row => rows[rows.length - 1];
  const addNote = (r: Row, note: Bi | undefined, at: number) => {
    const text = pick(note, lang);
    if (!text) return;
    const id = `nt${uid++}`;
    const size = tokenWidth(text, 22) > TS_MAXW ? Math.floor((22 * TS_MAXW) / tokenWidth(text, 22)) : 22;
    m.text(id, text, SCENE_W / 2, r.noteY, { size, color: 'carry', z: 5 });
    r.note = id;
    m.appear([id], at, 0, false);
  };

  /** The formula's height above and below its axis, and the room its note needs. */
  const measure = (tex: string, withNote: boolean) => {
    const L = layoutMath(tex, o.size, o.maxWidth);
    return { up: L.up, down: L.down, below: L.down + (withNote ? TS_NOTE_H : 0) };
  };

  const fresh = (tex: string, note: Bi | undefined) => {
    const had = rows.length;
    for (const r of rows) m.fadeOut(rowIds(r), t, 350);
    rows.length = 0;
    const me = measure(tex, !!pick(note, lang));
    const cy = Math.max(TS_TOP + me.up, 170);
    t += had ? 400 : 0;
    const h = placeMath(m, `l${uid++}`, tex, SCENE_W / 2, cy, t, o);
    const end = Math.max(m.write(h.glyphs.map((g) => g.id), t, STAGGER_TEXT), t + (h.strokes.length ? 450 : 0));
    const row: Row = { h, note: null, noteY: cy + h.down + 24 };
    rows.push(row);
    t = end + 200;
    addNote(row, note, t);
    if (row.note) t += 400;
  };

  const doBecome = (tex: string, note: Bi | undefined) => {
    const r = lastRow();
    if (r.note) m.fadeOut([r.note], t, 300);
    const res = becomeMath(m, r.h, `l${uid++}`, tex, t, { ...o, cx: SCENE_W / 2, cy: r.h.cy });
    const row: Row = { h: res.h, note: null, noteY: r.h.cy + res.h.down + 24 };
    rows[rows.length - 1] = row;
    t = res.end + 200;
    addNote(row, note, t);
    if (row.note) t += 400;
  };

  const doAdd = (tex: string, note: Bi | undefined) => {
    const r = lastRow();
    const me = measure(tex, !!pick(note, lang));
    const cy = r.h.cy + r.h.down + (r.note ? TS_NOTE_H : 0) + TS_GAP + me.up;
    if (cy + me.below > TS_BOTTOM) return fresh(tex, note);
    for (const row of rows) m.dim(rowIds(row), t);
    const h = placeMath(m, `l${uid++}`, tex, SCENE_W / 2, cy, t, o);
    const end = Math.max(m.write(h.glyphs.map((g) => g.id), t, STAGGER_TEXT), t + (h.strokes.length ? 450 : 0));
    const row: Row = { h, note: null, noteY: cy + h.down + 24 };
    rows.push(row);
    t = end + 200;
    addNote(row, note, t);
    if (row.note) t += 400;
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);

  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    switch (st.op) {
      case 'show': fresh(st.tex, st.note); break;
      case 'become': doBecome(st.tex, st.note); break;
      case 'add': doAdd(st.tex, st.note); break;
      case 'focus': {
        const ids = mathGlyphs(lastRow().h, st.parts);
        if (ids.length) t = m.focus(ids, t) + 500;
        break;
      }
      case 'box': {
        const b = mathBox(lastRow().h);
        t = m.box(`bx${uid++}`, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.x1 - b.x0 + 28, b.y1 - b.y0 + 20, t, 'result') + 200;
        break;
      }
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
