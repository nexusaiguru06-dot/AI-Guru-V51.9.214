/**
 * V51.9.149 — Economics agent · template "circular-flow": households and firms (and, optionally, government and
 * banks). Goods and services and factors of production flow one way (real flow), money the other way (money flow),
 * shown by dots moving round the loops. With figures, the app computes saving = income − consumption (and, with
 * tax, disposable income = income − tax). (Idea of the scene: circular-flow-model; the drawing is the app's own.)
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, rect, ring, sparkle, uid, vec, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface CircularPlan {
  /** Add the government (taxes and public services). */
  government?: boolean;
  /** Optional figures (crore ₹ or any unit): income Y, consumption C, tax T. */
  income?: number;
  consumption?: number;
  tax?: number;
  unit?: string;
  steps: Array<{ op: 'show' | 'real' | 'money' | 'government' | 'saving'; say: Bi }>;
}
const ORDER = ['show', 'real', 'money', 'government', 'saving'] as const;

export function flowFacts(p: CircularPlan) {
  const disposable = p.income !== undefined ? p.income - (p.tax ?? 0) : undefined;
  const saving = disposable !== undefined && p.consumption !== undefined ? disposable - p.consumption : undefined;
  return { disposable, saving };
}

export function validateCircular(x: unknown): string[] {
  const p = x as CircularPlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  const nn = (v: unknown) => v === undefined || (typeof v === 'number' && v >= 0 && Number.isFinite(v));
  if (!nn(p.income) || !nn(p.consumption) || !nn(p.tax)) e.push('income, consumption and tax are non-negative numbers');
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  let last = -1;
  p.steps.forEach((s, i) => {
    const k = ORDER.indexOf(s?.op as (typeof ORDER)[number]);
    if (k < 0 || k <= last) e.push(`steps[${i}]: the order is ${ORDER.join(', ')}, each at most once`);
    last = Math.max(last, k);
    if (!isBi(s?.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('the first step is "show"');
  if (p.steps.some((s) => s.op === 'government') && !p.government) e.push('"government" needs government: true');
  if (p.steps.some((s) => s.op === 'saving')) {
    const f = flowFacts(p);
    if (f.saving === undefined) e.push('"saving" needs income and consumption');
    else if (f.saving < 0) e.push('consumption is more than the income left after tax');
  }
  return e;
}

export function buildCircular(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as CircularPlan;
  const f = flowFacts(p);
  const ml = lang === 'ml';
  const u = p.unit ? ` ${p.unit}` : '';
  const m = newScene(title, 660);
  const H: Pt = [130, 300], F: Pt = [590, 300]; // households, firms
  let t = 300;
  let line = 0;
  const say = (text: string, at: number, color: string) => label(m, text, 360, 575 + 38 * line++, at, { size: 20, color, weight: '700' });
  /** An arc from a to b bulging by `h` (negative = up), with moving dots. */
  const arc = (a: Pt, b: Pt, h: number): Pt[] => Array.from({ length: 25 }, (_, i) => { const q = i / 24; return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q + h * Math.sin(Math.PI * q)]; });
  const flow = (pts: Pt[], at: number, color: string, text: string, ty: number) => {
    m.poly(uid('fl'), pts, at, { color, closed: false, width: 4, dur: 800, z: 2, silent: true });
    vec(m, pts[22], pts[24], at + 700, color, 4);
    label(m, text, pts[12][0], pts[12][1] + ty, at + 600, { size: 18, color, weight: '700' });
    for (let d = 0; d < 4; d++) {
      const id = uid('dot');
      m.dot(id, pts[0][0], pts[0][1], at + 800 + d * 300, { color, r: 6 });
      for (let k = 1; k < pts.length; k += 2) m.move(id, pts[k][0], pts[k][1], at + 800 + d * 300 + k * 60, { dur: 120, sound: false });
      m.fadeOut(id, at + 800 + d * 300 + pts.length * 60, 200);
    }
  };

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      rect(m, H[0] - 95, H[1] - 40, 190, 80, t, 'b', { alpha: 0, width: 3, z: 3 });
      label(m, ml ? 'കുടുംബങ്ങൾ' : 'Households', H[0], H[1], t + 300, { size: 24, color: 'b', weight: '700', z: 6 });
      rect(m, F[0] - 95, F[1] - 40, 190, 80, t + 400, 'carry', { alpha: 0, width: 3, z: 3 });
      label(m, ml ? 'ഉത്പാദകർ (സ്ഥാപനങ്ങൾ)' : 'Firms', F[0], F[1], t + 700, { size: ml ? 18 : 24, color: 'carry', weight: '700', z: 6 });
      t += 1500;
    } else if (st.op === 'real') {
      flow(arc([F[0] - 60, F[1] - 40], [H[0] + 60, H[1] - 40], -170), t, 'c', ml ? 'സാധനങ്ങളും സേവനങ്ങളും' : 'goods and services', -18);
      flow(arc([H[0] + 60, H[1] + 40], [F[0] - 60, F[1] + 40], 170), t + 1600, 'c', ml ? 'ഉത്പാദന ഘടകങ്ങൾ (തൊഴിൽ, ഭൂമി…)' : 'factors of production (labour, land…)', 18);
      t += 3600;
    } else if (st.op === 'money') {
      flow(arc([H[0] + 30, H[1] - 40], [F[0] - 30, F[1] - 40], -95), t, 'accent', ml ? '₹ ഉപഭോഗ ചെലവ്' : '₹ spending on goods', -16);
      flow(arc([F[0] - 30, F[1] + 40], [H[0] + 30, H[1] + 40], 95), t + 1600, 'accent', ml ? '₹ വരുമാനം (കൂലി, വാടക…)' : '₹ income (wages, rent…)', 16);
      t += 3600;
    } else if (st.op === 'government') {
      const G: Pt = [360, 300];
      rect(m, G[0] - 75, G[1] - 28, 150, 56, t, 'a', { alpha: 0, width: 3, z: 3 });
      label(m, ml ? 'സർക്കാർ' : 'Government', G[0], G[1], t + 300, { size: 22, color: 'a', weight: '700', z: 6 });
      vec(m, [H[0] + 98, H[1] - 10], [G[0] - 78, G[1] - 10], t + 600, 'a', 3);
      label(m, ml ? 'നികുതി' : 'taxes', (H[0] + G[0]) / 2 + 10, G[1] - 28, t + 900, { size: 16, color: 'a', weight: '700' });
      vec(m, [G[0] + 78, G[1] + 10], [F[0] - 98, F[1] + 10], t + 900, 'a', 3);
      label(m, ml ? 'പൊതുചെലവ്' : 'public spending', (F[0] + G[0]) / 2 - 10, G[1] + 30, t + 1200, { size: 16, color: 'a', weight: '700' });
      t += 2000;
    } else if (st.op === 'saving' && f.saving !== undefined) {
      if (p.tax !== undefined) say(`${ml ? 'വിനിയോഗ വരുമാനം' : 'Disposable income'} = ${num(p.income!)} − ${num(p.tax)} = ${num(f.disposable!)}${u}`, t, 'a');
      const txt = `${ml ? 'സമ്പാദ്യം' : 'Saving'} = ${num(f.disposable!)} − ${num(p.consumption!)} = ${num(f.saving)}${u}`;
      const y = 575 + 38 * line;
      say(txt, t + 500, 'tick');
      ring(m, 360, y, Math.min(320, txt.length * 7.4 + 30), 22, t + 1200, 'tick');
      sparkle(m, 360, y, t + 1400);
      t += 2400;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const CIRCULAR_EXAMPLE: CircularPlan = {
  income: 1000,
  consumption: 750,
  unit: 'crore ₹',
  steps: [
    { op: 'show', say: { en: 'An economy has two sectors: households and firms.', ml: 'ഒരു സമ്പദ്‌വ്യവസ്ഥയിൽ രണ്ടു മേഖലകൾ: കുടുംബങ്ങളും ഉത്പാദകരും.' } },
    { op: 'real', say: { en: 'Firms give goods and services; households give labour, land and capital.', ml: 'ഉത്പാദകർ സാധനങ്ങളും സേവനങ്ങളും നൽകുന്നു; കുടുംബങ്ങൾ തൊഴിലും ഭൂമിയും മൂലധനവും നൽകുന്നു.' } },
    { op: 'money', say: { en: 'Money flows the other way: spending to firms, income to households.', ml: 'പണം എതിർദിശയിൽ: ചെലവ് ഉത്പാദകരിലേക്ക്, വരുമാനം കുടുംബങ്ങളിലേക്ക്.' } },
    { op: 'saving', say: { en: 'What households do not spend is their saving.', ml: 'കുടുംബങ്ങൾ ചെലവാക്കാത്തതാണ് സമ്പാദ്യം.' } },
  ],
};

export const circularTemplate: AgentTemplate = {
  id: 'circular-flow',
  title: 'Circular flow of income',
  about: 'Households and firms (optionally government): the real flow and the money flow moving round; saving = income − tax − consumption computed.',
  example: CIRCULAR_EXAMPLE,
  validate: validateCircular,
  build: buildCircular,
};
