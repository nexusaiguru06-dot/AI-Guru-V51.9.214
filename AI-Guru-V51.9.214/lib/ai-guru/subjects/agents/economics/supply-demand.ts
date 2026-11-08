/**
 * V51.9.149 — Economics agent · template "supply-demand": straight-line demand Qd = a − bP and supply Qs = c + dP
 * on a price–quantity graph; the equilibrium (where Qd = Qs) is computed: P* = (a − c) ÷ (b + d), Q* = a − bP*.
 * A shift (demand or supply rising or falling by some units at every price) moves the curve and the new equilibrium
 * is computed too. (Idea of the scene: econgraphs, MIT; the drawing is the app's own.)
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, ring, sparkle, uid, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface SupplyDemandPlan {
  good?: Bi;
  /** Qd = a − b P */
  demand: { a: number; b: number };
  /** Qs = c + d P */
  supply: { c: number; d: number };
  /** Optional shift: the curve moves by `by` units of quantity at every price (+ = more). */
  shift?: { curve: 'demand' | 'supply'; by: number };
  /** Unit of price, e.g. "₹". */
  currency?: string;
  steps: Array<{ op: 'show' | 'demand' | 'supply' | 'equilibrium' | 'shift'; say: Bi }>;
}
const ORDER = ['show', 'demand', 'supply', 'equilibrium', 'shift'] as const;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function sdFacts(p: SupplyDemandPlan) {
  const eq = (a: number, b: number, c: number, d: number) => { const P = r2((a - c) / (b + d)); return { P, Q: r2(a - b * P) }; };
  const e1 = eq(p.demand.a, p.demand.b, p.supply.c, p.supply.d);
  let e2: { P: number; Q: number } | null = null;
  if (p.shift) e2 = p.shift.curve === 'demand' ? eq(p.demand.a + p.shift.by, p.demand.b, p.supply.c, p.supply.d) : eq(p.demand.a, p.demand.b, p.supply.c + p.shift.by, p.supply.d);
  return { e1, e2 };
}

export function validateSD(x: unknown): string[] {
  const p = x as SupplyDemandPlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  const pos = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (!p.demand || !pos(p.demand.a) || !pos(p.demand.b)) e.push('demand: {a, b} positive (Qd = a − bP)');
  if (!p.supply || typeof p.supply.c !== 'number' || !pos(p.supply.d)) e.push('supply: {c, d}, d positive (Qs = c + dP)');
  if (!e.length) {
    const f = sdFacts(p);
    if (!(f.e1.P > 0 && f.e1.Q > 0)) e.push('these curves do not meet at a positive price and quantity');
    if (p.shift) {
      if (!(p.shift.curve === 'demand' || p.shift.curve === 'supply') || typeof p.shift.by !== 'number' || p.shift.by === 0) e.push('shift: {curve: "demand"|"supply", by: non-zero number}');
      else if (!(f.e2 && f.e2.P > 0 && f.e2.Q > 0)) e.push('after the shift there is no positive equilibrium');
    }
  }
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  let last = -1;
  p.steps.forEach((s, i) => {
    const k = ORDER.indexOf(s?.op as (typeof ORDER)[number]);
    if (k < 0 || k <= last) e.push(`steps[${i}]: the order is ${ORDER.join(', ')}, each at most once`);
    last = Math.max(last, k);
    if (!isBi(s?.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('the first step is "show"');
  if (!p.steps.some((s) => s.op === 'equilibrium')) e.push('an "equilibrium" step is needed');
  if (p.steps.some((s) => s.op === 'shift') && !p.shift) e.push('"shift" needs the shift');
  return e;
}

export function buildSD(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as SupplyDemandPlan;
  const f = sdFacts(p);
  const ml = lang === 'ml';
  const cur = p.currency ?? '₹';
  const m = newScene(title, 640);
  const ox = 100, oy = 420, gw = 380, gh = 330;
  const Pmax = Math.max(p.demand.a / p.demand.b, f.e1.P, f.e2?.P ?? 0) * 1.15;
  const Qmax = Math.max(p.demand.a + Math.max(0, p.shift?.curve === 'demand' ? p.shift.by : 0), f.e1.Q, f.e2?.Q ?? 0, p.supply.c + p.supply.d * Pmax) * 1.05;
  const X = (q: number) => ox + (q / Qmax) * gw;
  const Y = (pr: number) => oy - (pr / Pmax) * gh;
  /** A line Q = q0 + s P drawn over the prices where 0 ≤ Q ≤ Qmax. */
  const lineQ = (q0: number, s: number): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) { const pr = (Pmax * i) / 40; const q = q0 + s * pr; if (q >= 0 && q <= Qmax) pts.push([X(q), Y(pr)]); }
    return pts;
  };
  let t = 300;
  let line = 0;
  const say = (text: string, at: number, color: string) => label(m, text, 595, 110 + 36 * line++, at, { size: 17, color, weight: '700' });
  const marks = (e: { P: number; Q: number }, at: number, color: string) => {
    m.poly(uid('dp'), [[ox, Y(e.P)], [X(e.Q), Y(e.P)], [X(e.Q), oy]], at, { color, closed: false, width: 1.6, dashed: true, dur: 600, z: 2, silent: true });
    m.dot(uid('eq'), X(e.Q), Y(e.P), at + 300, { color, r: 7 });
    label(m, `${cur}${num(e.P)}`, ox - 36, Y(e.P), at + 500, { size: 17, color, weight: '700' });
    label(m, num(e.Q), X(e.Q), oy + 20, at + 500, { size: 17, color, weight: '700' });
  };

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      m.rule(uid('ax'), ox, oy, ox + gw + 20, oy, t, { color: 'ink', width: 3 });
      m.rule(uid('ay'), ox, oy, ox, oy - gh - 20, t + 200, { color: 'ink', width: 3 });
      label(m, ml ? 'അളവ് (Q)' : 'Quantity (Q)', ox + gw / 2, oy + 48, t + 400, { size: 18, color: 'ink' });
      label(m, ml ? `വില (P, ${cur})` : `Price (P, ${cur})`, ox + 30, oy - gh - 34, t + 400, { size: 18, color: 'ink' });
      if (p.good) label(m, pick(p.good, lang), 360, 22, t + 300, { size: 22, color: 'ink', weight: '700' });
      t += 1300;
    } else if (st.op === 'demand') {
      m.poly(uid('D'), lineQ(p.demand.a, -p.demand.b), t, { color: 'a', closed: false, width: 4, dur: 900, z: 3, silent: true });
      const end = lineQ(p.demand.a, -p.demand.b).at(-1)!;
      label(m, 'D', end[0] + 14, end[1] - 10, t + 700, { size: 24, color: 'a', weight: '700' });
      say(`${ml ? 'ചോദനം' : 'Demand'}: Qd = ${num(p.demand.a)} − ${p.demand.b === 1 ? '' : num(p.demand.b)}P`, t + 500, 'a');
      t += 1700;
    } else if (st.op === 'supply') {
      m.poly(uid('S'), lineQ(p.supply.c, p.supply.d), t, { color: 'c', closed: false, width: 4, dur: 900, z: 3, silent: true });
      const end = lineQ(p.supply.c, p.supply.d).at(-1)!;
      label(m, 'S', end[0] + 14, end[1] - 10, t + 700, { size: 24, color: 'c', weight: '700' });
      say(`${ml ? 'പ്രദാനം' : 'Supply'}: Qs = ${num(p.supply.c)} ${p.supply.c < 0 ? '− ' : '+ '}${p.supply.d === 1 ? '' : num(p.supply.d)}P`.replace(`${num(p.supply.c)} − `, `${num(Math.abs(p.supply.c))} − `).replace(`= -`, '= −'), t + 500, 'c');
      t += 1700;
    } else if (st.op === 'equilibrium') {
      marks(f.e1, t, 'accent');
      ring(m, X(f.e1.Q), Y(f.e1.P), 22, 22, t + 400, 'accent');
      say('Qd = Qs', t + 800, 'accent');
      say(`P = (${num(p.demand.a)} − ${p.supply.c < 0 ? `(${num(p.supply.c)})` : num(p.supply.c)}) ÷ (${num(p.demand.b)} + ${num(p.supply.d)})`, t + 1000, 'accent');
      say(`= ${cur}${num(f.e1.P)}`, t + 1150, 'accent');
      say(`Q = ${num(p.demand.a)} − ${num(p.demand.b)} × ${num(f.e1.P)} = ${num(f.e1.Q)}`, t + 1300, 'accent');
      t += 2400;
    } else if (st.op === 'shift' && p.shift && f.e2) {
      const isD = p.shift.curve === 'demand';
      const pts = isD ? lineQ(p.demand.a + p.shift.by, -p.demand.b) : lineQ(p.supply.c + p.shift.by, p.supply.d);
      m.poly(uid('sh'), pts, t, { color: isD ? 'a' : 'c', closed: false, width: 3, dashed: true, dur: 900, z: 3, silent: true });
      const end = pts.at(-1)!;
      label(m, isD ? 'D₂' : 'S₂', end[0] + 16, end[1] - 10, t + 700, { size: 22, color: isD ? 'a' : 'c', weight: '700' });
      marks(f.e2, t + 900, 'b');
      const up = f.e2.P > f.e1.P;
      say(`${ml ? 'പുതിയ' : 'new'}: P = ${cur}${num(f.e2.P)} ${up ? '↑' : '↓'}, Q = ${num(f.e2.Q)} ${f.e2.Q > f.e1.Q ? '↑' : '↓'}`, t + 1500, 'b');
      sparkle(m, X(f.e2.Q), Y(f.e2.P), t + 1700);
      t += 2600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const SD_EXAMPLE: SupplyDemandPlan = {
  good: { en: 'Market for mangoes', ml: 'മാമ്പഴ വിപണി' },
  demand: { a: 100, b: 2 },
  supply: { c: 10, d: 1 },
  shift: { curve: 'demand', by: 30 },
  currency: '₹',
  steps: [
    { op: 'show', say: { en: 'A graph of price against quantity for mangoes in a market.', ml: 'ഒരു വിപണിയിലെ മാമ്പഴത്തിന്റെ വിലയും അളവും കാണിക്കുന്ന ഗ്രാഫ്.' } },
    { op: 'demand', say: { en: 'Demand: when the price rises, people buy less, so the line slopes down.', ml: 'ചോദനം: വില കൂടുമ്പോൾ ആളുകൾ കുറച്ച് വാങ്ങുന്നു; രേഖ താഴേക്ക് ചരിയുന്നു.' } },
    { op: 'supply', say: { en: 'Supply: at a higher price sellers offer more, so the line slopes up.', ml: 'പ്രദാനം: വില കൂടുമ്പോൾ വിൽപ്പനക്കാർ കൂടുതൽ നൽകുന്നു; രേഖ മുകളിലേക്ക് ചരിയുന്നു.' } },
    { op: 'equilibrium', say: { en: 'Where they cross, demand equals supply: the equilibrium price.', ml: 'ഇവ കൂടിമുട്ടുന്നിടത്ത് ചോദനം = പ്രദാനം: സന്തുലിത വില.' } },
    { op: 'shift', say: { en: 'In the festival season demand rises; the price and the quantity both go up.', ml: 'ഉത്സവകാലത്ത് ചോദനം കൂടുന്നു; വിലയും അളവും കൂടുന്നു.' } },
  ],
};

export const supplyDemandTemplate: AgentTemplate = {
  id: 'supply-demand',
  title: 'Demand, supply and price',
  about: 'Straight-line demand and supply on a price–quantity graph; the equilibrium price and quantity, and a shift of either curve, all computed.',
  example: SD_EXAMPLE,
  validate: validateSD,
  build: buildSD,
};
