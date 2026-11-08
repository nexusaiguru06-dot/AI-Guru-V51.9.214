/**
 * V51.9.149 — English agent · template "sentence": the structure of an English sentence. The sentence is written,
 * then split into its parts — Subject, Verb, Object, Indirect object, Complement, Adverbial — each in its own colour;
 * the pattern (S + V + O + A …) and the kind of sentence are computed from the parts; a tree shows
 * Sentence → Subject + Predicate. The app checks that the parts are exactly the words of the sentence.
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, pick, rect, ring, sparkle, uid, type Bi } from '../../kit';
import { measure } from '../../../reels/motion/metrics';
import type { AgentTemplate } from '../../types';

export type Role = 'subject' | 'verb' | 'object' | 'indirect-object' | 'complement' | 'adverbial';
export interface SentencePlan {
  sentence: string;
  parts: Array<{ text: string; role: Role }>;
  steps: Array<{ op: 'show' | 'parts' | 'pattern' | 'kind' | 'tree'; say: Bi }>;
}
const ORDER = ['show', 'parts', 'pattern', 'kind', 'tree'] as const;
const ROLES: Role[] = ['subject', 'verb', 'object', 'indirect-object', 'complement', 'adverbial'];
const ROLE_INFO: Record<Role, { short: string; color: string; name: Bi }> = {
  subject: { short: 'S', color: 'b', name: { en: 'Subject', ml: 'കർത്താവ് (Subject)' } },
  verb: { short: 'V', color: 'a', name: { en: 'Verb', ml: 'ക്രിയ (Verb)' } },
  object: { short: 'O', color: 'c', name: { en: 'Object', ml: 'കർമം (Object)' } },
  'indirect-object': { short: 'IO', color: '#2a9d8f', name: { en: 'Indirect object', ml: 'പരോക്ഷ കർമം' } },
  complement: { short: 'C', color: 'carry', name: { en: 'Complement', ml: 'പൂരകം (Complement)' } },
  adverbial: { short: 'A', color: '#8338ec', name: { en: 'Adverbial', ml: 'ക്രിയാവിശേഷണം (Adverbial)' } },
};
const words = (s: string) => s.replace(/[^A-Za-z0-9'’ -]/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);

export function sentenceFacts(p: SentencePlan) {
  const pattern = p.parts.map((x) => ROLE_INFO[x.role].short).join(' + ');
  const end = p.sentence.trim().slice(-1);
  const hasSubject = p.parts.some((x) => x.role === 'subject');
  const kind: Bi = end === '?' ? { en: 'Interrogative (a question)', ml: 'ചോദ്യവാക്യം (Interrogative)' }
    : end === '!' ? { en: 'Exclamatory (a strong feeling)', ml: 'വ്യാക്ഷേപകവാക്യം (Exclamatory)' }
    : !hasSubject ? { en: 'Imperative (an order or request; the subject "you" is understood)', ml: 'ആജ്ഞാവാക്യം (Imperative)' }
    : { en: 'Declarative (a statement)', ml: 'പ്രസ്താവനാവാക്യം (Declarative)' };
  return { pattern, kind };
}

export function validateSentence(x: unknown): string[] {
  const p = x as SentencePlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (typeof p.sentence !== 'string' || words(p.sentence).length < 2 || words(p.sentence).length > 22) e.push('sentence: one English sentence of 2–22 words');
  if (!Array.isArray(p.parts) || p.parts.length < 1 || p.parts.length > 7) return [...e, 'parts: 1 to 7'];
  p.parts.forEach((pt, i) => {
    if (typeof pt?.text !== 'string' || !pt.text.trim()) e.push(`parts[${i}].text is the words of that part`);
    if (!ROLES.includes(pt?.role)) e.push(`parts[${i}].role is one of ${ROLES.join(', ')}`);
  });
  if (!e.length && words(p.parts.map((q) => q.text).join(' ')).join(' ') !== words(p.sentence).join(' ')) e.push('the parts, in order, must be exactly the words of the sentence');
  if (!e.length && !p.parts.some((q) => q.role === 'verb')) e.push('a sentence needs a verb part');
  if (!Array.isArray(p.steps) || !p.steps.length) return [...e, 'steps needed'];
  let last = -1;
  p.steps.forEach((s, i) => {
    const k = ORDER.indexOf(s?.op as (typeof ORDER)[number]);
    if (k < 0 || k <= last) e.push(`steps[${i}]: the order is ${ORDER.join(', ')}, each at most once`);
    last = Math.max(last, k);
    if (!isBi(s?.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  if (p.steps[0]?.op !== 'show') e.push('the first step is "show"');
  if (!p.steps.some((s) => s.op === 'parts')) e.push('a "parts" step is needed');
  return e;
}

export function buildSentence(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as SentencePlan;
  const f = sentenceFacts(p);
  const m = newScene(title, 620);
  // the sentence laid out part by part; smaller when long
  let SZ = 34;
  const gap = 22;
  const widthAt = (sz: number) => p.parts.reduce((a, q) => a + measure(q.text, sz, '700') + gap, -gap);
  while (widthAt(SZ) > 660 && SZ > 18) SZ -= 2;
  let x = 360 - widthAt(SZ) / 2;
  const boxes = p.parts.map((q) => { const w = measure(q.text, SZ, '700'); const b = { cx: x + w / 2, w }; x += w + gap; return b; });
  const Y = 150;
  const textIds: string[] = [];
  let t = 300;

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      p.parts.forEach((q, i) => textIds.push(label(m, q.text, boxes[i].cx, Y, t + i * 150, { size: SZ, color: 'ink', weight: '700' })));
      t += 1200 + p.parts.length * 150;
    } else if (st.op === 'parts') {
      p.parts.forEach((q, i) => {
        const at = t + i * 900;
        const info = ROLE_INFO[q.role];
        m.recolor(textIds[i], info.color, at);
        rect(m, boxes[i].cx - boxes[i].w / 2 - 8, Y - SZ * 0.75, boxes[i].w + 16, SZ * 1.5, at, info.color, { alpha: 0, width: 2.5, z: 1 });
        label(m, info.short, boxes[i].cx, Y - SZ - 14, at + 200, { size: 22, color: info.color, weight: '700' });
        label(m, pick(info.name, lang), boxes[i].cx, Y + SZ + 12 + (i % 2) * 22, at + 300, { size: 15, color: info.color });
      });
      t += p.parts.length * 900 + 400;
    } else if (st.op === 'pattern') {
      label(m, lang === 'ml' ? 'ഘടന' : 'Pattern', 360, 270, t, { size: 18, color: 'done' });
      label(m, f.pattern, 360, 304, t + 300, { size: 34, color: 'accent', weight: '700' });
      ring(m, 360, 304, Math.min(320, f.pattern.length * 11 + 40), 30, t + 900, 'accent');
      t += 1800;
    } else if (st.op === 'kind') {
      label(m, pick(f.kind, lang), 360, 360, t, { size: 22, color: 'b', weight: '700' });
      t += 1500;
    } else if (st.op === 'tree') {
      const top: [number, number] = [360, 410];
      const subj = p.parts.findIndex((q) => q.role === 'subject');
      const predParts = p.parts.map((q, i) => ({ q, i })).filter(({ q }) => q.role !== 'subject');
      label(m, lang === 'ml' ? 'വാക്യം' : 'Sentence', top[0], top[1], t, { size: 22, color: 'ink', weight: '700' });
      const sX = 200, pX = 500, row2 = 470, row3 = 540;
      if (subj >= 0) {
        m.rule(uid('tr'), top[0], top[1] + 14, sX, row2 - 14, t + 300, { color: 'done', width: 2 });
        label(m, lang === 'ml' ? 'ഉദ്ദേശ്യം (Subject)' : 'Subject', sX, row2, t + 400, { size: 19, color: 'b', weight: '700' });
        label(m, p.parts[subj].text, sX, row3, t + 700, { size: 18, color: 'b' });
        m.rule(uid('tr'), sX, row2 + 12, sX, row3 - 12, t + 600, { color: 'done', width: 1.5 });
      }
      m.rule(uid('tr'), top[0], top[1] + 14, pX, row2 - 14, t + 300, { color: 'done', width: 2 });
      label(m, lang === 'ml' ? 'വിധേയം (Predicate)' : 'Predicate', pX, row2, t + 400, { size: 19, color: 'a', weight: '700' });
      const span = Math.min(110, 260 / Math.max(1, predParts.length - 1));
      predParts.forEach(({ q }, k) => {
        const cx = pX + (k - (predParts.length - 1) / 2) * span;
        m.rule(uid('tr'), pX, row2 + 12, cx, row3 - 12, t + 700 + k * 200, { color: 'done', width: 1.5 });
        label(m, ROLE_INFO[q.role].short, cx, row3, t + 800 + k * 200, { size: 18, color: ROLE_INFO[q.role].color, weight: '700' });
      });
      sparkle(m, 360, top[1], t + 1200);
      t += 1800 + predParts.length * 200;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const SENTENCE_EXAMPLE: SentencePlan = {
  sentence: 'The farmer sold his mangoes in the market yesterday.',
  parts: [
    { text: 'The farmer', role: 'subject' },
    { text: 'sold', role: 'verb' },
    { text: 'his mangoes', role: 'object' },
    { text: 'in the market', role: 'adverbial' },
    { text: 'yesterday.', role: 'adverbial' },
  ],
  steps: [
    { op: 'show', say: { en: 'Read the sentence. Who did what?', ml: 'വാക്യം വായിക്കൂ. ആര് എന്തു ചെയ്തു?' } },
    { op: 'parts', say: { en: 'The farmer is the subject; sold is the verb; his mangoes is the object; the rest tells where and when.', ml: '"The farmer" കർത്താവ്; "sold" ക്രിയ; "his mangoes" കർമം; ബാക്കി എവിടെ, എപ്പോൾ എന്ന് പറയുന്നു.' } },
    { op: 'pattern', say: { en: 'So the pattern is subject, verb, object, adverbials.', ml: 'അതിനാൽ ഘടന: കർത്താവ് + ക്രിയ + കർമം + ക്രിയാവിശേഷണങ്ങൾ.' } },
    { op: 'kind', say: { en: 'It makes a statement, so it is a declarative sentence.', ml: 'ഇത് ഒരു പ്രസ്താവനയാണ്; പ്രസ്താവനാവാക്യം.' } },
    { op: 'tree', say: { en: 'Every sentence has a subject and a predicate: what we say about the subject.', ml: 'എല്ലാ വാക്യത്തിനും ഉദ്ദേശ്യവും വിധേയവും ഉണ്ട്.' } },
  ],
};

export const sentenceTemplate: AgentTemplate = {
  id: 'sentence',
  title: 'Sentence structure',
  about: 'A sentence split into Subject, Verb, Object, Complement and Adverbial in colour; its pattern and kind computed; a Subject–Predicate tree.',
  example: SENTENCE_EXAMPLE,
  validate: validateSentence,
  build: buildSentence,
};
