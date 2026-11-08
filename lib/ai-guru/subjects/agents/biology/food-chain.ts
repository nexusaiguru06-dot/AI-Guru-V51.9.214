/** Biology agent · template "food-chain": organisms linked by energy arrows, then an energy pyramid (10% rule computed). */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { measure } from '../../../reels/motion/metrics';
import { isBi, label, newScene, num, pick, rect, ring, sparkle, vec, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface ChainPlan {
  organisms: Array<{ name: Bi; role: Bi }>;
  startEnergy: number; // kJ at the first level
  steps: Array<{ op: 'show' | 'flow' | 'pyramid' | 'answer'; say: Bi }>;
}

export const chainEnergy = (p: ChainPlan) => p.organisms.map((_, i) => p.startEnergy / Math.pow(10, i));

export function validateChain(x: unknown): string[] {
  const p = x as ChainPlan;
  const e: string[] = [];
  if (!p || !Array.isArray(p.organisms) || p.organisms.length < 3 || p.organisms.length > 5) return ['3 to 5 organisms needed'];
  p.organisms.forEach((o, i) => {
    if (!isBi(o?.name) || !isBi(o?.role)) e.push(`organisms[${i}] needs name and role in en and ml`);
  });
  if (typeof p.startEnergy !== 'number' || !(p.startEnergy >= 10 && p.startEnergy <= 1e7)) e.push('startEnergy (kJ) must be 10 to 10000000');
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  const order = ['show', 'flow', 'pyramid', 'answer'];
  let last = -1;
  p.steps.forEach((s, i) => {
    const k = order.indexOf(s.op);
    if (k <= last) e.push(`steps[${i}]: order is ${order.join(', ')}`);
    last = Math.max(last, k);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('first step is "show"');
  return e;
}

export function buildChain(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as ChainPlan;
  const n = p.organisms.length;
  const en = chainEnergy(p);
  const m = newScene(title, 760);
  const cols = ['c', 'carry', 'a', 'b', 'accent'] as const;
  const bw = n >= 5 ? 112 : n === 4 ? 140 : 180;
  const fit = (txt: string, max: number) => Math.min(max, Math.floor((bw - 10) / Math.max(1, measure(txt, 10, '700') / 10)));
  const gap = (640 - n * bw) / (n - 1 || 1);
  const bx = (i: number) => 40 + i * (bw + gap) + bw / 2;
  let t = 300;
  const box: string[] = [];
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      p.organisms.forEach((o, i) => {
        rect(m, bx(i) - bw / 2, 90, bw, 90, t + 250 * i, cols[i % cols.length], { alpha: 0.2 });
        box.push(label(m, pick(o.name, lang), bx(i), 125, t + 250 * i, { size: fit(pick(o.name, lang), 24), weight: '700', color: cols[i % cols.length] }));
        label(m, pick(o.role, lang), bx(i), 160, t + 250 * i, { size: fit(pick(o.role, lang), 19), color: 'ink' });
      });
      t += 250 * n + 800;
    } else if (st.op === 'flow') {
      for (let i = 0; i < n - 1; i++) {
        vec(m, [bx(i) + bw / 2 + 2, 135], [bx(i + 1) - bw / 2 - 2, 135], t + 500 * i, 'accent');
        label(m, '10%', (bx(i) + bx(i + 1)) / 2, 78, t + 500 * i + 350, { size: 22, color: 'accent', weight: '700' });
      }
      t += 500 * n + 600;
    } else if (st.op === 'pyramid') {
      const top = 260;
      const rh = 70;
      p.organisms.forEach((o, i) => {
        const level = n - 1 - i; // producer at the bottom
        const w = 560 - level * (440 / (n - 1 || 1));
        const y = top + level * rh;
        rect(m, 360 - w / 2, y, w, rh - 6, t + 400 * i, cols[i % cols.length], { alpha: 0.3 });
        label(m, `${pick(o.name, lang)} · ${num(en[i])} kJ`, 360, y + (rh - 6) / 2, t + 400 * i + 200, { size: 22, weight: '700', color: 'ink' });
      });
      t += 400 * n + 800;
    } else if (st.op === 'answer') {
      const y = top2(n);
      label(m, `${num(en[0])} → ${num(en[n - 1])} kJ`, 360, y, t, { size: 34, color: 'tick', weight: '700' });
      ring(m, 360, y, 190, 34, t + 200, 'tick');
      sparkle(m, 360, y, t + 300);
      t += 1600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}
const top2 = (n: number) => 260 + n * 70 + 40;

export const CHAIN_EXAMPLE: ChainPlan = {
  organisms: [
    { name: { en: 'Grass', ml: 'പുല്ല്' }, role: { en: 'producer', ml: 'ഉത്പാദകൻ' } },
    { name: { en: 'Grasshopper', ml: 'പുൽച്ചാടി' }, role: { en: 'primary consumer', ml: 'പ്രാഥമിക ഉപഭോക്താവ്' } },
    { name: { en: 'Frog', ml: 'തവള' }, role: { en: 'secondary consumer', ml: 'ദ്വിതീയ ഉപഭോക്താവ്' } },
    { name: { en: 'Snake', ml: 'പാമ്പ്' }, role: { en: 'tertiary consumer', ml: 'തൃതീയ ഉപഭോക്താവ്' } },
  ],
  startEnergy: 10000,
  steps: [
    { op: 'show', say: { en: 'A food chain: grass is eaten by a grasshopper, then a frog, then a snake.', ml: 'ഒരു ഭക്ഷ്യശൃംഖല: പുല്ല് പുൽച്ചാടിക്കും, പിന്നെ തവളയ്ക്കും, പിന്നെ പാമ്പിനും ഭക്ഷണം.' } },
    { op: 'flow', say: { en: 'Energy moves along the arrows, but only about ten percent passes to the next level.', ml: 'ഊർജ്ജം അമ്പുകളിലൂടെ നീങ്ങുന്നു, എന്നാൽ ഏകദേശം പത്തു ശതമാനം മാത്രമേ അടുത്ത തലത്തിലെത്തൂ.' } },
    { op: 'pyramid', say: { en: 'Stack the levels: each step up holds ten times less energy.', ml: 'തലങ്ങൾ അടുക്കുക: ഓരോ പടിയിലും ഊർജ്ജം പത്തിലൊന്നായി കുറയുന്നു.' } },
    { op: 'answer', say: { en: 'Of the energy in the grass, very little reaches the snake.', ml: 'പുല്ലിലെ ഊർജ്ജത്തിൽ വളരെ കുറച്ചേ പാമ്പിലെത്തുന്നുള്ളൂ.' } },
  ],
};
export const chainTemplate: AgentTemplate = { id: 'food-chain', title: 'Food chain and energy pyramid', about: 'Organisms linked by energy arrows; the 10% rule is computed.', example: CHAIN_EXAMPLE, validate: validateChain, build: buildChain };
