/**
 * Builder for the `ai-sketch` DNA (V51.9.50): draws a validated SketchPlan with the motion grammar's own
 * verbs. Positions come only from the plan, so the English and Malayalam boards are the same picture;
 * words given as {"en","ml"} change language, numbers and maths do not.
 */

import { Motion, evalItem, type MotionScene } from '../../reels/motion/engine';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import { mathIds, placeMath } from '../../reels/motion/typeset';
import type { Bi } from './types';
import { actionKind, sketchHeight, SKETCH_W, type Pt, type SketchObject, type SketchPlan } from './sketch-math';

const pick = (b: Bi | string | undefined, lang: Lang): string => (typeof b === 'string' ? b : b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');

function circlePts(x: number, y: number, r: number): Pt[] {
  const n = 48;
  return Array.from({ length: n }, (_, i) => [x + r * Math.cos((2 * Math.PI * i) / n), y + r * Math.sin((2 * Math.PI * i) / n)] as Pt);
}

export function buildSketch(plan: SketchPlan, lang: Lang, title: string): MotionScene[] {
  const H = sketchHeight(plan);
  const m = new Motion(title, SKETCH_W, H);
  m.fixView(SKETCH_W / 2, SKETCH_W);
  const objs = new Map(plan.objects.map((o) => [o.id, o]));
  /** Engine item ids of each sketch object (a maths formula is many glyphs). */
  const items = new Map<string, string[]>();
  const pre = (id: string) => `sk_${id}`;
  let extra = 0;
  let t = 300;

  const ids = (list: string[]) => list.flatMap((id) => items.get(id) ?? []);
  const isShape = (o: SketchObject | undefined) => !!o && (o.kind === 'rect' || o.kind === 'circle' || o.kind === 'polygon');

  const show = (o: SketchObject, at: number): number => {
    const id = pre(o.id);
    switch (o.kind) {
      case 'text': {
        m.text(id, pick(o.text, lang), o.x, o.y, { size: o.size ?? 30, color: o.color ?? 'ink', z: 5 });
        items.set(o.id, [id]);
        return m.write([id], at);
      }
      case 'math': {
        const h = placeMath(m, id, o.tex, o.x, o.y, at, { size: o.size ?? 34, color: o.color ?? 'ink', maxWidth: 680, z: 5 });
        items.set(o.id, mathIds(h));
        return Math.max(m.write(h.glyphs.map((g) => g.id), at, 40), at + (h.strokes.length ? 450 : 0));
      }
      case 'line':
        items.set(o.id, [id]);
        return m.rule(id, o.x1, o.y1, o.x2, o.y2, at, { color: o.color ?? 'ink', width: o.width ?? 3 });
      case 'arrow':
        items.set(o.id, [id]);
        return m.vector(id, o.x1, o.y1, o.x2, o.y2, at, { color: o.color ?? 'ink' });
      case 'rect': {
        const { x, y, w, h } = o;
        items.set(o.id, [id]);
        return m.poly(id, [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]], at, { color: o.color ?? 'ink', fill: o.fill, fillAlpha: 0.35, width: 3, z: 1 });
      }
      case 'circle':
        items.set(o.id, [id]);
        return m.poly(id, circlePts(o.x, o.y, o.r), at, { color: o.color ?? 'ink', fill: o.fill, fillAlpha: 0.35, width: 3, z: 1 });
      case 'polygon':
        items.set(o.id, [id]);
        return m.poly(id, o.points, at, { color: o.color ?? 'ink', fill: o.fill, fillAlpha: 0.35, width: 3, closed: o.closed ?? true, dashed: o.dashed, z: 1 });
      case 'dot':
        items.set(o.id, [id]);
        return m.dot(id, o.x, o.y, at, { color: o.color ?? 'ink', r: o.r ?? 7 });
    }
  };

  if (plan.title) t = m.step(pick(plan.title, lang), t, 1600);
  for (const st of plan.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    const focused: string[] = [];
    for (const a of st.do) {
      const x = a as Record<string, unknown>;
      switch (actionKind(a)) {
        case 'show': {
          let end = t;
          (x.show as string[]).forEach((id, i) => {
            const o = objs.get(id);
            if (o) end = Math.max(end, show(o, t + i * 160));
          });
          t = end + 150;
          break;
        }
        case 'hide':
          t = m.fadeOut(ids(x.hide as string[]), t, 300) + 100;
          break;
        case 'focus': {
          const list = ids(x.focus as string[]);
          focused.push(...list);
          t = m.focus(list, t) + 150;
          break;
        }
        case 'dim':
          t = m.dim(ids(x.dim as string[]), t) + 100;
          break;
        case 'color': {
          const role = x.to as string;
          const list = x.color as string[];
          const shapes = list.filter((id) => isShape(objs.get(id)));
          m.recolor(ids(list), role as never, t);
          if (shapes.length) m.fillTo(ids(shapes), role as never, t, 0.45);
          t += 450;
          break;
        }
        case 'move': {
          const to = x.to as Pt;
          t = m.move(ids([x.move as string]), to[0], to[1], t) + 150;
          break;
        }
        case 'morph':
          t = m.morph(pre(x.morph as string), x.points as Pt[], t, { dur: 1000 }) + 150;
          break;
        case 'swap': {
          const id = ids([x.swap as string])[0];
          if (id) t = m.swap(id, pick(x.text as Bi | string, lang), t) + 150;
          break;
        }
        case 'box': {
          const [cx, cy, w, h] = x.box as number[];
          t = m.box(`sk_box${extra++}`, cx, cy, w, h, t, (x.color as never) ?? 'accent') + 150;
          break;
        }
        case 'tick': {
          const [tx, ty] = x.tick as Pt;
          t = m.tick(`sk_tick${extra++}`, tx, ty, t) + 150;
          break;
        }
      }
    }
    if (focused.length) m.unfocus(focused, t + 300);
    t += 200;
    m.hold(t);
  }
  m.hold(t + 1600);
  return [m.build()];
}

/* ---------------- layout check (both languages) ---------------- */

/**
 * Text that overlaps other text or runs off the board, at the end of every step, in English and in
 * Malayalam (Malayalam words are often wider). Same rule as the quality gate of the built-in DNAs.
 */
export function sketchLayoutProblems(plan: SketchPlan): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (!out.includes(s) && out.length < 6) out.push(s);
  };
  for (const lang of ['en', 'ml'] as const) {
    let sc: MotionScene;
    try {
      sc = buildSketch(plan, lang, 'qa')[0];
    } catch (e) {
      add(`The sketch does not build (${lang}): ${(e as Error).message}`);
      continue;
    }
    for (let k = 0; k < sc.captions.length; k++) {
      const time = sc.captions[k].t1 - 40;
      const st = sc.items
        .filter((it) => it.kind === 'text' && it.id.startsWith('sk_') && !it.id.includes('_g'))
        .map((it) => evalItem(it, time))
        .filter((s) => s.alpha > 0.5)
        .map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2 };
        });
      for (const b of st) if (b.l < 2 || b.r > SKETCH_W - 2) add(`At step ${k + 1} the ${lang === 'ml' ? 'Malayalam ' : ''}text "${b.q.text}" runs off the board; move it or make it shorter.`);
      for (let i = 0; i < st.length; i++)
        for (let j = i + 1; j < st.length; j++) {
          if (Math.abs(st[i].q.y - st[j].q.y) > Math.max(st[i].q.size, st[j].q.size) * 0.7) continue;
          const gap = Math.max(st[i].l, st[j].l) - Math.min(st[i].r, st[j].r);
          if (gap < -1.5) add(`At step ${k + 1} the ${lang === 'ml' ? 'Malayalam ' : ''}texts "${st[i].q.text}" and "${st[j].q.text}" overlap; move them apart.`);
        }
    }
  }
  return out;
}
