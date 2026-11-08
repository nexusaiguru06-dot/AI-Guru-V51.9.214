/** Earth agent · template "monsoon": land and sea heat at different speeds, so air moves from the high-pressure side to the low-pressure side. The direction is computed from the temperatures. */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, rect, sparkle, uid, vec, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface MonsoonPlan {
  title: Bi;
  landTemp: number;
  seaTemp: number;
  steps: Array<{ op: 'show' | 'heat' | 'flow' | 'rain' | 'answer'; say: Bi }>;
}
/** The warmer side has low pressure; wind blows towards it. */
export function windFrom(p: Pick<MonsoonPlan, 'landTemp' | 'seaTemp'>): 'sea' | 'land' { return p.landTemp > p.seaTemp ? 'sea' : 'land'; }
export const tempGap = (p: Pick<MonsoonPlan, 'landTemp' | 'seaTemp'>) => Math.abs(p.landTemp - p.seaTemp);

export function validateMonsoon(x: unknown): string[] {
  const p = x as MonsoonPlan;
  const e: string[] = [];
  if (!p || typeof p !== 'object') return ['plan needed'];
  if (!isBi(p.title)) e.push('title needs en and ml');
  for (const k of ['landTemp', 'seaTemp'] as const) if (typeof p[k] !== 'number' || p[k] < -50 || p[k] > 60) e.push(`${k} must be a temperature in °C`);
  if (typeof p.landTemp === 'number' && p.landTemp === p.seaTemp) e.push('land and sea temperatures must differ');
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  p.steps.forEach((s, i) => {
    if (!['show', 'heat', 'flow', 'rain', 'answer'].includes(s.op)) e.push(`steps[${i}].op unknown`);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('first step is "show"');
  return e;
}

export function buildMonsoon(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as MonsoonPlan;
  const m = newScene(title, 720);
  const from = windFrom(p);
  const seaX = 40, landX = 370, W = 310, Y = 430;
  const seaMid = seaX + W / 2, landMid = landX + W / 2;
  const warmMid = p.landTemp > p.seaTemp ? landMid : seaMid;
  const coolMid = p.landTemp > p.seaTemp ? seaMid : landMid;
  let t = 300;
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      label(m, pick(p.title, lang), 360, 56, t, { size: 30, weight: '700' });
      rect(m, seaX, Y, W, 150, t, 'b', { alpha: 0.35 });
      rect(m, landX, Y, W, 150, t + 300, 'carry', { alpha: 0.35 });
      label(m, lang === 'ml' ? 'കടൽ' : 'Sea', seaMid, Y + 75, t + 500, { size: 26, color: 'b', weight: '700' });
      label(m, lang === 'ml' ? 'കര' : 'Land', landMid, Y + 75, t + 600, { size: 26, color: 'carry', weight: '700' });
      t += 1600;
    } else if (st.op === 'heat') {
      for (const [mid, tp, col] of [[seaMid, p.seaTemp, 'b'], [landMid, p.landTemp, 'carry']] as const) {
        label(m, `${num(tp)}°C`, mid, Y + 115, t, { size: 28, color: col, weight: '700' });
      }
      label(m, '☀', 360, 120, t + 200, { size: 60, color: 'accent' });
      label(m, `${num(tempGap(p))}°C ${lang === 'ml' ? 'വ്യത്യാസം' : 'difference'}`, 360, 190, t + 500, { size: 24, color: 'accent', weight: '700' });
      t += 2000;
    } else if (st.op === 'flow') {
      label(m, lang === 'ml' ? 'താഴ്ന്ന മർദ്ദം (L)' : 'Low pressure (L)', warmMid, 305, t, { size: 22, color: 'accent', weight: '700' });
      label(m, lang === 'ml' ? 'ഉയർന്ന മർദ്ദം (H)' : 'High pressure (H)', coolMid, 305, t + 300, { size: 22, color: 'b', weight: '700' });
      vec(m, [coolMid, 350], [warmMid, 350], t + 700, 'accent', 7);
      label(m, from === 'sea' ? (lang === 'ml' ? 'കടലിൽ നിന്ന് കരയിലേക്ക് കാറ്റ്' : 'Wind from sea to land') : (lang === 'ml' ? 'കരയിൽ നിന്ന് കടലിലേക്ക് കാറ്റ്' : 'Wind from land to sea'), 360, 395, t + 1000, { size: 24, color: 'accent', weight: '700' });
      t += 2200;
    } else if (st.op === 'rain') {
      if (from === 'sea') {
        for (let i = 0; i < 4; i++) {
          const x = landMid - 90 + i * 60;
          m.poly(uid('rn'), [[x, 190], [x - 8, 255]], t + 200 * i, { color: 'b', closed: false, width: 5, dur: 400, z: 3, silent: true });
        }
        label(m, '☁', landMid, 170, t, { size: 56, color: 'b' });
        label(m, lang === 'ml' ? 'ഈർപ്പമുള്ള കാറ്റ് മഴ നൽകുന്നു' : 'Moist wind brings rain', landMid, 110, t + 300, { size: 20, color: 'b', weight: '700' });
      } else {
        label(m, lang === 'ml' ? 'കരയിൽ നിന്നുള്ള കാറ്റ് വരണ്ടതാണ്' : 'Wind from land is dry', 360, 120, t, { size: 24, color: 'carry', weight: '700' });
      }
      t += 1800;
    } else if (st.op === 'answer') {
      label(m, from === 'sea' ? (lang === 'ml' ? 'ചൂടുള്ള കര → താഴ്ന്ന മർദ്ദം → മഴ' : 'Warm land → low pressure → rain') : (lang === 'ml' ? 'ചൂടുള്ള കടൽ → താഴ്ന്ന മർദ്ദം → വരണ്ട കാറ്റ്' : 'Warm sea → low pressure → dry wind'), 360, 650, t, { size: 26, color: 'tick', weight: '700' });
      sparkle(m, 360, 650, t + 300);
      t += 1600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

const say = (en: string, ml: string) => ({ en, ml });
export const SUMMER_MONSOON: MonsoonPlan = {
  title: say('How the summer monsoon forms', 'വേനൽ മൺസൂൺ ഉണ്ടാകുന്നത് എങ്ങനെ'),
  landTemp: 42,
  seaTemp: 28,
  steps: [
    { op: 'show', say: say('Land and sea sit side by side but warm up differently.', 'കരയും കടലും അടുത്തടുത്താണ്, പക്ഷേ വ്യത്യസ്തമായി ചൂടാകുന്നു.') },
    { op: 'heat', say: say('In summer the land heats much faster than the sea.', 'വേനലിൽ കര കടലിനേക്കാൾ വളരെ വേഗം ചൂടാകുന്നു.') },
    { op: 'flow', say: say('Warm air rises over land, leaving low pressure, so air rushes in from the sea.', 'ചൂടുവായു കരയിൽ ഉയർന്ന് താഴ്ന്ന മർദ്ദമുണ്ടാകുന്നു; കടലിൽ നിന്ന് വായു ഇരച്ചെത്തുന്നു.') },
    { op: 'rain', say: say('This wind carries moisture and gives heavy rain.', 'ഈ കാറ്റ് ഈർപ്പം കൊണ്ടുവന്ന് കനത്ത മഴ നൽകുന്നു.') },
    { op: 'answer', say: say('That is the monsoon: a seasonal wind that brings the rains.', 'ഇതാണ് മൺസൂൺ: മഴ കൊണ്ടുവരുന്ന കാലികമായ കാറ്റ്.') },
  ],
};
export const monsoonTemplate: AgentTemplate = { id: 'monsoon', title: 'Winds and monsoon', about: 'Land and sea heating; pressure and wind direction computed from the temperatures.', example: SUMMER_MONSOON, validate: validateMonsoon, build: buildMonsoon };
