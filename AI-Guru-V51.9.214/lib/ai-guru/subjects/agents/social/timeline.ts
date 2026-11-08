/**
 * V51.9.149 — Social-science agent · template "timeline": historical events on a time line drawn to scale.
 * Events appear one by one (dot, year, name); the app computes the years between two events (there is no year 0:
 * from 50 BCE to 50 CE is 99 years) and the century of an event ("1857 is in the 19th century").
 * (Idea of the scene: theonize/timeline, MIT; the drawing is the app's own.)
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, pick, ring, sparkle, uid, vec, type Bi } from '../../kit';
import type { AgentTemplate } from '../../types';

export interface TimelinePlan {
  title?: Bi;
  /** Year: CE positive, BCE negative (−326 = 326 BCE). */
  events: Array<{ year: number; label: Bi }>;
  steps: Array<{ op: 'show' | 'event' | 'gap' | 'century'; i?: number; j?: number; say: Bi }>;
}

export const yearText = (y: number, lang: Lang) => (y < 0 ? `${-y} ${lang === 'ml' ? 'ബി.സി.ഇ.' : 'BCE'}` : `${y}${y < 1000 ? (lang === 'ml' ? ' സി.ഇ.' : ' CE') : ''}`);
/** Years from a to b (there is no year 0). */
export const yearsBetween = (a: number, b: number) => { const d = Math.abs(b - a); return (a < 0) !== (b < 0) ? d - 1 : d; };
/** The century of a year: 1857 → 19, 1900 → 19, −326 → 4 (BCE). */
export const centuryOf = (y: number) => Math.ceil(Math.abs(y) / 100);
const ordinal = (n: number, lang: Lang) => (lang === 'ml' ? `${n}-ാം` : `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`);

export function validateTimeline(x: unknown): string[] {
  const p = x as TimelinePlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (!Array.isArray(p.events) || p.events.length < 2 || p.events.length > 8) return ['events: 2 to 8'];
  p.events.forEach((ev, i) => {
    if (!Number.isInteger(ev?.year) || ev.year === 0 || Math.abs(ev.year) > 5000) e.push(`events[${i}].year is a whole year (BCE negative, no year 0)`);
    if (!isBi(ev?.label)) e.push(`events[${i}].label needs en and ml`);
  });
  if (!e.length && p.events.some((ev, i) => i > 0 && ev.year < p.events[i - 1].year)) e.push('events are in time order (earliest first)');
  if (!Array.isArray(p.steps) || !p.steps.length || p.steps.length > 14) return [...e, 'steps: 1 to 14'];
  if (p.steps[0]?.op !== 'show') e.push('the first step is "show"');
  const n = p.events.length;
  p.steps.forEach((s, i) => {
    if (!['show', 'event', 'gap', 'century'].includes(s?.op)) e.push(`steps[${i}].op is show, event, gap or century`);
    const okI = (k: unknown) => Number.isInteger(k) && (k as number) >= 0 && (k as number) < n;
    if ((s?.op === 'event' || s?.op === 'century') && !okI(s.i)) e.push(`steps[${i}].i is an event index 0–${n - 1}`);
    if (s?.op === 'gap' && (!okI(s.i) || !okI(s.j) || s.i === s.j)) e.push(`steps[${i}] needs two different event indexes i and j`);
    if (!isBi(s?.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  return e;
}

export function buildTimeline(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as TimelinePlan;
  const m = newScene(title, 620);
  const ys = p.events.map((e) => e.year);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max(1, (hi - lo) * 0.08);
  const X0 = 60, X1 = 660, Y = 300;
  const X = (y: number) => X0 + ((y - (lo - pad)) / (hi - lo + 2 * pad)) * (X1 - X0);
  const shown = new Set<number>();
  let t = 300;
  let line = 0;
  const say = (text: string, at: number, color: string) => label(m, text, 360, 470 + 44 * line++, at, { size: 24, color, weight: '700' });
  const showEvent = (i: number, at: number) => {
    if (shown.has(i)) return;
    shown.add(i);
    const ev = p.events[i];
    const x = X(ev.year);
    const up = i % 2 === 0;
    const ty = up ? Y - 70 - (i % 4 === 0 ? 0 : 50) : Y + 70 + (i % 4 === 1 ? 0 : 50);
    m.dot(uid('ev'), x, Y, at, { color: 'accent', r: 8 });
    m.rule(uid('st'), x, Y + (up ? -10 : 10), x, ty + (up ? 30 : -30), at + 150, { color: 'done', width: 1.5 });
    label(m, yearText(ev.year, lang), x, ty + (up ? 12 : -12), at + 250, { size: 22, color: 'accent', weight: '700' });
    label(m, pick(ev.label, lang), Math.min(620, Math.max(100, x)), ty + (up ? -14 : 14), at + 400, { size: 17, color: 'ink' });
  };

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      vec(m, [X0 - 20, Y], [X1 + 30, Y], t, 'ink', 4);
      // ticks at a round step
      const span = hi - lo + 2 * pad;
      const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find((s) => span / s <= 8) ?? 5000;
      for (let y = Math.ceil((lo - pad) / step) * step; y <= hi + pad; y += step) {
        if (y === 0) continue;
        m.rule(uid('tk'), X(y), Y - 6, X(y), Y + 6, t + 300, { color: 'ink', width: 2 });
        label(m, yearText(y, lang), X(y), Y + 24, t + 400, { size: 13, color: 'done' });
      }
      if (lo < 0 && hi > 0) label(m, lang === 'ml' ? 'ബി.സി.ഇ. ← | → സി.ഇ.' : 'BCE ← | → CE', X(0), Y - 24, t + 500, { size: 14, color: 'b' });
      if (p.title) label(m, pick(p.title, lang), 360, 60, t, { size: 26, color: 'ink', weight: '700' });
      t += 1400;
    } else if (st.op === 'event') {
      showEvent(st.i!, t);
      t += 1300;
    } else if (st.op === 'gap') {
      const [a, b] = [p.events[st.i!], p.events[st.j!]].sort((u, v) => u.year - v.year);
      showEvent(st.i!, t);
      showEvent(st.j!, t);
      const xa = X(a.year), xb = X(b.year);
      vec(m, [(xa + xb) / 2, Y + 36], [xb, Y + 36], t + 300, 'c', 3);
      vec(m, [(xa + xb) / 2, Y + 36], [xa, Y + 36], t + 300, 'c', 3);
      const n = yearsBetween(a.year, b.year);
      const txt = a.year < 0 && b.year > 0
        ? `${yearText(b.year, lang)} ← ${yearText(a.year, lang)}: ${-a.year} + ${b.year} − 1 = ${n} ${lang === 'ml' ? 'വർഷം' : 'years'}`
        : `${b.year} − ${a.year < 0 ? `(${a.year})` : a.year} = ${n} ${lang === 'ml' ? 'വർഷം' : 'years'}`;
      const y = 470 + 44 * line;
      say(txt, t + 600, 'c');
      ring(m, 360, y, Math.min(330, txt.length * 7.8 + 30), 24, t + 1300, 'c');
      t += 2200;
    } else if (st.op === 'century') {
      const ev = p.events[st.i!];
      showEvent(st.i!, t);
      ring(m, X(ev.year), Y, 22, 22, t, 'carry');
      const c = centuryOf(ev.year);
      say(lang === 'ml'
        ? `${yearText(ev.year, lang)} → ${ordinal(c, lang)} നൂറ്റാണ്ട്${ev.year < 0 ? ' ബി.സി.ഇ.' : ''}`
        : `${yearText(ev.year, lang)} is in the ${ordinal(c, lang)} century${ev.year < 0 ? ' BCE' : ''}`, t + 500, 'carry');
      t += 1800;
    }
    t += 150;
    m.hold(t);
  }
  sparkle(m, 360, Y, t);
  m.hold(t + 1400);
  return [m.build()];
}

export const TIMELINE_EXAMPLE: TimelinePlan = {
  title: { en: 'India’s freedom struggle', ml: 'ഇന്ത്യയുടെ സ്വാതന്ത്ര്യസമരം' },
  events: [
    { year: 1857, label: { en: 'First War of Independence', ml: 'ഒന്നാം സ്വാതന്ത്ര്യസമരം' } },
    { year: 1885, label: { en: 'Indian National Congress', ml: 'ഇന്ത്യൻ നാഷണൽ കോൺഗ്രസ്' } },
    { year: 1920, label: { en: 'Non-Cooperation Movement', ml: 'നിസ്സഹകരണ പ്രസ്ഥാനം' } },
    { year: 1930, label: { en: 'Salt Satyagraha', ml: 'ഉപ്പുസത്യാഗ്രഹം' } },
    { year: 1942, label: { en: 'Quit India Movement', ml: 'ക്വിറ്റ് ഇന്ത്യാ സമരം' } },
    { year: 1947, label: { en: 'Independence', ml: 'സ്വാതന്ത്ര്യം' } },
  ],
  steps: [
    { op: 'show', say: { en: 'A time line puts events in order, with distances in years.', ml: 'കാലരേഖ സംഭവങ്ങളെ ക്രമത്തിൽ, വർഷങ്ങളുടെ അകലത്തിൽ കാണിക്കുന്നു.' } },
    { op: 'event', i: 0, say: { en: 'The struggle began with the revolt of 1857.', ml: '1857-ലെ കലാപത്തോടെ സമരം തുടങ്ങി.' } },
    { op: 'event', i: 1, say: { en: 'The Indian National Congress was formed in 1885.', ml: '1885-ൽ ഇന്ത്യൻ നാഷണൽ കോൺഗ്രസ് രൂപീകരിച്ചു.' } },
    { op: 'event', i: 2, say: { en: 'Gandhiji led the Non-Cooperation Movement.', ml: 'ഗാന്ധിജി നിസ്സഹകരണ പ്രസ്ഥാനം നയിച്ചു.' } },
    { op: 'event', i: 3, say: { en: 'Then came the Salt Satyagraha.', ml: 'തുടർന്ന് ഉപ്പുസത്യാഗ്രഹം.' } },
    { op: 'event', i: 4, say: { en: 'The Quit India Movement demanded that the British leave.', ml: 'ബ്രിട്ടീഷുകാർ ഇന്ത്യ വിടണമെന്ന് ക്വിറ്റ് ഇന്ത്യാ സമരം ആവശ്യപ്പെട്ടു.' } },
    { op: 'event', i: 5, say: { en: 'India became independent in 1947.', ml: '1947-ൽ ഇന്ത്യ സ്വതന്ത്രമായി.' } },
    { op: 'gap', i: 0, j: 5, say: { en: 'How long did the struggle take, from 1857 to 1947?', ml: '1857 മുതൽ 1947 വരെ എത്ര വർഷം?' } },
    { op: 'century', i: 0, say: { en: 'And which century was 1857 in?', ml: '1857 ഏതു നൂറ്റാണ്ടിലാണ്?' } },
  ],
};

export const timelineTemplate: AgentTemplate = {
  id: 'timeline',
  title: 'History time line',
  about: 'Events on a time line drawn to scale (BCE and CE); the years between two events and the century of an event are computed.',
  example: TIMELINE_EXAMPLE,
  validate: validateTimeline,
  build: buildTimeline,
};
