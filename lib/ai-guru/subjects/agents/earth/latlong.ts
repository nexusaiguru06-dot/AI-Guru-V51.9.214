/** Earth agent · template "latlong": a degree grid with places placed by latitude and longitude; the time difference from Greenwich is computed (4 minutes per degree). */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, num, pick, ring, sparkle, uid, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface LatLongPlan {
  title: Bi;
  places: Array<{ name: Bi; lat: number; lon: number }>;
  steps: Array<{ op: 'show' | 'place' | 'time' | 'answer'; i?: number; say: Bi }>;
}

const X0 = 40;
const X1 = 680;
const Y0 = 130;
const Y1 = 450;
export const gx = (lon: number) => X0 + ((lon + 180) / 360) * (X1 - X0);
export const gy = (lat: number) => Y0 + ((90 - lat) / 180) * (Y1 - Y0);
/** Minutes the local sun time differs from Greenwich: 4 per degree of longitude (east is ahead). */
export const minutesFromGreenwich = (lon: number) => Math.round(lon * 4);
export function clockDiff(lon: number, lang: Lang = 'en'): string {
  const mins = minutesFromGreenwich(lon);
  const a = Math.abs(mins);
  const h = Math.floor(a / 60);
  const r = a % 60;
  const hm = lang === 'ml' ? `${h} മണിക്കൂർ ${r} മിനിറ്റ്` : `${h} h ${r} min`;
  if (mins === 0) return lang === 'ml' ? 'ഗ്രീനിച്ച് സമയം തന്നെ' : 'same as Greenwich';
  return mins > 0 ? (lang === 'ml' ? `ഗ്രീനിച്ചിനേക്കാൾ ${hm} മുന്നിൽ` : `${hm} ahead of Greenwich`) : (lang === 'ml' ? `ഗ്രീനിച്ചിനേക്കാൾ ${hm} പിന്നിൽ` : `${hm} behind Greenwich`);
}
const hemi = (v: number, pos: string, neg: string) => `${num(Math.abs(v))}°${v >= 0 ? pos : neg}`;

export function validateLatLong(x: unknown): string[] {
  const p = x as LatLongPlan;
  const e: string[] = [];
  if (!p || !Array.isArray(p.places) || p.places.length < 1 || p.places.length > 3) return ['1 to 3 places needed'];
  if (!isBi(p.title)) e.push('title needs en and ml');
  p.places.forEach((s, i) => {
    if (!isBi(s?.name)) e.push(`places[${i}].name needs en and ml`);
    if (typeof s?.lat !== 'number' || s.lat < -90 || s.lat > 90) e.push(`places[${i}].lat must be -90 to 90`);
    if (typeof s?.lon !== 'number' || s.lon < -180 || s.lon > 180) e.push(`places[${i}].lon must be -180 to 180`);
  });
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  p.steps.forEach((s, i) => {
    if (!['show', 'place', 'time', 'answer'].includes(s.op)) e.push(`steps[${i}].op unknown`);
    if (s.op === 'place' && !(Number.isInteger(s.i) && s.i! >= 0 && s.i! < p.places.length)) e.push(`steps[${i}].i out of range`);
    if (!isBi(s.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('first step is "show"');
  return e;
}

export function buildLatLong(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as LatLongPlan;
  const m = newScene(title, 640);
  let t = 300;
  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      label(m, pick(p.title, lang), 360, 56, t, { size: 30, weight: '700' });
      m.poly(uid('fr'), [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]], t, { color: 'ink', closed: true, width: 3, dur: 500, z: 1, silent: true });
      let k = 0;
      for (const lat of [-60, -30, 0, 30, 60]) {
        const eq = lat === 0;
        m.rule(uid('la'), X0, gy(lat), X1, gy(lat), t + 120 * k++, { color: eq ? 'accent' : 'tick', width: eq ? 4 : 1.5 });
        label(m, lat === 0 ? (lang === 'ml' ? '0° മധ്യരേഖ' : '0° Equator') : hemi(lat, 'N', 'S'), X0 + 36, gy(lat) - 12, t + 600, { size: 17, color: eq ? 'accent' : 'ink' });
      }
      for (const lon of [-120, -60, 0, 60, 120]) {
        const pm = lon === 0;
        m.rule(uid('lo'), gx(lon), Y0, gx(lon), Y1, t + 120 * k++, { color: pm ? 'accent' : 'tick', width: pm ? 4 : 1.5 });
        label(m, pm ? (lang === 'ml' ? '0° ഗ്രീനിച്ച്' : '0° Greenwich') : hemi(lon, 'E', 'W'), gx(lon), Y1 + 22, t + 700, { size: 17, color: pm ? 'accent' : 'ink' });
      }
      t += 1800;
    } else if (st.op === 'place') {
      const pl = p.places[st.i!];
      const x = gx(pl.lon);
      const y = gy(pl.lat);
      m.dot(uid('pt'), x, y, t, { color: 'result', r: 9 });
      ring(m, x, y, 24, 24, t + 200, 'accent');
      label(m, pick(pl.name, lang), x, y - 34, t + 300, { size: 22, weight: '700', color: 'result' });
      label(m, `${hemi(pl.lat, 'N', 'S')}, ${hemi(pl.lon, 'E', 'W')}`, 360, 520 + 30 * st.i!, t + 400, { size: 22, weight: '700', color: 'ink' });
      t += 1800;
    } else if (st.op === 'time') {
      const pl = p.places[0];
      label(m, `${hemi(pl.lon, 'E', 'W')} × 4 = ${num(Math.abs(minutesFromGreenwich(pl.lon)))} min`, 360, 520 + 30 * p.places.length, t, { size: 22, color: 'tick', weight: '700' });
      t += 1800;
    } else if (st.op === 'answer') {
      const pl = p.places[0];
      label(m, clockDiff(pl.lon, lang), 360, 520 + 30 * (p.places.length + 1), t, { size: 24, color: 'tick', weight: '700' });
      sparkle(m, 360, 520 + 30 * (p.places.length + 1), t + 300);
      t += 1600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

const say = (en: string, ml: string) => ({ en, ml });
export const LATLONG_EXAMPLE: LatLongPlan = {
  title: say('Latitude and longitude', 'അക്ഷാംശവും രേഖാംശവും'),
  places: [{ name: say('Kochi', 'കൊച്ചി'), lat: 10, lon: 76 }],
  steps: [
    { op: 'show', say: say('Lines across are latitudes; lines up and down are longitudes.', 'കുറുകെയുള്ള വരകൾ അക്ഷാംശങ്ങൾ; നെടുകെയുള്ളവ രേഖാംശങ്ങൾ.') },
    { op: 'place', i: 0, say: say('Every place has one latitude and one longitude, which fix its spot.', 'ഓരോ സ്ഥലത്തിനും ഒരു അക്ഷാംശവും ഒരു രേഖാംശവുമുണ്ട്; അവ സ്ഥാനം ഉറപ്പിക്കുന്നു.') },
    { op: 'time', say: say('The Sun crosses 1 degree of longitude in 4 minutes.', 'ഒരു ഡിഗ്രി രേഖാംശം സൂര്യൻ 4 മിനിറ്റിൽ കടക്കുന്നു.') },
    { op: 'answer', say: say('So this place keeps a different clock time from Greenwich.', 'അതിനാൽ ഈ സ്ഥലത്തെ സമയം ഗ്രീനിച്ചിലേതിൽ നിന്ന് വ്യത്യസ്തമാണ്.') },
  ],
};
export const latLongTemplate: AgentTemplate = { id: 'latlong', title: 'Latitude, longitude and time', about: 'A degree grid with places plotted; the time difference from Greenwich is computed.', example: LATLONG_EXAMPLE, validate: validateLatLong, build: buildLatLong };
