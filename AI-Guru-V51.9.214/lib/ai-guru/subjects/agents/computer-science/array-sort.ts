/** Computer-science agent · template "array-sort": the app RUNS the sort and animates every compare and swap, counting them. */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, pick, rect, sparkle, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';

export type SortKind = 'bubble' | 'selection' | 'insertion';
export interface SortPlan {
  kind: SortKind;
  values: number[];
  steps: Array<{ op: 'show' | 'run' | 'answer'; say: Bi }>;
}
export interface SortTrace {
  ops: Array<{ type: 'cmp' | 'swap'; i: number; j: number }>;
  sorted: number[];
  comparisons: number;
  swaps: number;
}

export function runSort(kind: SortKind, values: number[]): SortTrace {
  const a = [...values];
  const ops: SortTrace['ops'] = [];
  let comparisons = 0;
  let swaps = 0;
  const cmp = (i: number, j: number) => {
    comparisons++;
    ops.push({ type: 'cmp', i, j });
    return a[i] > a[j];
  };
  const swap = (i: number, j: number) => {
    swaps++;
    ops.push({ type: 'swap', i, j });
    [a[i], a[j]] = [a[j], a[i]];
  };
  const n = a.length;
  if (kind === 'bubble') {
    for (let p = 0; p < n - 1; p++) for (let i = 0; i < n - 1 - p; i++) if (cmp(i, i + 1)) swap(i, i + 1);
  } else if (kind === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let mn = i;
      for (let j = i + 1; j < n; j++) if (cmp(mn, j)) mn = j;
      if (mn !== i) swap(i, mn);
    }
  } else {
    for (let i = 1; i < n; i++) for (let j = i; j > 0; j--) { if (cmp(j - 1, j)) swap(j - 1, j); else break; }
  }
  return { ops, sorted: a, comparisons, swaps };
}

export function validateSort(x: unknown): string[] {
  const p = x as SortPlan;
  const e: string[] = [];
  if (!p || !['bubble', 'selection', 'insertion'].includes(p.kind)) e.push('kind is bubble, selection or insertion');
  if (!Array.isArray(p?.values) || p.values.length < 3 || p.values.length > 7 || p.values.some((v) => !Number.isInteger(v) || v < 0 || v > 99)) e.push('values: 3 to 7 whole numbers 0–99');
  if (!Array.isArray(p?.steps) || !p.steps.length) return [...e, 'steps needed'];
  const order = ['show', 'run', 'answer'];
  let last = -1;
  p.steps.forEach((s, i) => {
    const k = order.indexOf(s.op);
    if (k <= last) e.push(`steps[${i}]: order is show, run, answer`);
    last = Math.max(last, k);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('first step is "show"');
  return e;
}

export function buildSort(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as SortPlan;
  const tr = runSort(p.kind, p.values);
  const n = p.values.length;
  const m = newScene(title, 640);
  const cw = 70;
  const gap = 14;
  const x0 = 360 - (n * cw + (n - 1) * gap) / 2 + cw / 2;
  const slotX = (i: number) => x0 + i * (cw + gap);
  const Y = 230;
  // tiles are numbered by value index; `at[slot]` is the tile now in that slot
  const at = p.values.map((_, i) => i);
  const ids = p.values.map((v, k) => ({ box: `sb${k}`, txt: `st${k}`, v }));
  let t = 300;
  const counts = { cmp: 0, swap: 0 };
  let cmpId = '';
  let swpId = '';
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      ids.forEach((d, k) => {
        const x = slotX(k);
        m.poly(d.box, [[x - cw / 2, Y - 40], [x + cw / 2, Y - 40], [x + cw / 2, Y + 40], [x - cw / 2, Y + 40]], t + 150 * k, { color: 'b', fill: 'b', fillAlpha: 0.2, closed: true, width: 3, dur: 350, z: 2, silent: true });
        m.text(d.txt, String(d.v), x, Y, { size: 40, color: 'ink', weight: '700', z: 5 });
        m.appear([d.txt], t + 150 * k + 100, 0, false);
      });
      cmpId = label(m, `${lang === 'ml' ? 'താരതമ്യങ്ങൾ' : 'Comparisons'}: 0`, 360, 380, t + 800, { size: 28, color: 'a', weight: '700' });
      swpId = label(m, `${lang === 'ml' ? 'കൈമാറ്റങ്ങൾ' : 'Swaps'}: 0`, 360, 430, t + 800, { size: 28, color: 'accent', weight: '700' });
      t += 150 * n + 1000;
    } else if (st.op === 'run') {
      const hop = Math.max(450, Math.min(900, 9000 / tr.ops.length));
      for (const op of tr.ops) {
        const a = at[op.i];
        const b = at[op.j];
        if (op.type === 'cmp') {
          counts.cmp++;
          m.focus([ids[a].box, ids[b].box], t, false);
          m.swap(cmpId, `${lang === 'ml' ? 'താരതമ്യങ്ങൾ' : 'Comparisons'}: ${counts.cmp}`, t + 100, 'a');
        } else {
          counts.swap++;
          m.move([ids[a].box, ids[a].txt], slotX(op.j), Y, t, { dur: hop * 0.8, arc: -30, sound: false });
          m.move([ids[b].box, ids[b].txt], slotX(op.i), Y, t, { dur: hop * 0.8, arc: 30, sound: false });
          [at[op.i], at[op.j]] = [b, a];
          m.swap(swpId, `${lang === 'ml' ? 'കൈമാറ്റങ്ങൾ' : 'Swaps'}: ${counts.swap}`, t + 100, 'accent');
        }
        t += hop;
      }
      t += 400;
    } else if (st.op === 'answer') {
      at.forEach((k) => rect(m, slotX(at.indexOf(k)) - cw / 2, Y + 56, cw, 8, t, 'tick', { alpha: 0.9 }));
      sparkle(m, 360, Y, t + 200);
      label(m, tr.sorted.join('  '), 360, 520, t + 200, { size: 40, color: 'tick', weight: '700' });
      t += 1600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

const say = (en: string, ml: string) => ({ en, ml });
export const SORT_EXAMPLE: SortPlan = {
  kind: 'bubble',
  values: [5, 2, 8, 1, 4],
  steps: [
    { op: 'show', say: say('We want to sort these numbers from smallest to largest.', 'ഈ സംഖ്യകളെ ചെറുതിൽ നിന്ന് വലുതിലേക്ക് ക്രമീകരിക്കണം.') },
    { op: 'run', say: say('Bubble sort compares neighbours and swaps them when they are in the wrong order.', 'ബബിൾ സോർട്ട് അടുത്തടുത്ത സംഖ്യകളെ താരതമ്യം ചെയ്ത് തെറ്റായ ക്രമത്തിലാണെങ്കിൽ മാറ്റുന്നു.') },
    { op: 'answer', say: say('The list is sorted. Count how many comparisons and swaps it needed.', 'പട്ടിക ക്രമത്തിലായി. എത്ര താരതമ്യങ്ങളും കൈമാറ്റങ്ങളും വേണ്ടിവന്നെന്ന് നോക്കൂ.') },
  ],
};
export const sortTemplate: AgentTemplate = { id: 'array-sort', title: 'Sorting an array', about: 'The sort is run by the app; compares and swaps are animated and counted.', example: SORT_EXAMPLE, validate: validateSort, build: buildSort };
