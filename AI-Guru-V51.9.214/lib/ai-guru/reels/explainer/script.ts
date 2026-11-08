/**
 * V51.9.124 — EXPLAINER reels: the cinematic science-explainer style. One short sentence per screen, written word by
 * word in a big serif as the voice says it (key words in bold italic, one phrase in a highlight box), over a dark,
 * slowly moving picture — a star field, a glowing planet, light rain, a beam, an arrow traced back, a lit detector
 * grid, an atom — or the student's own photo; small all-caps labels and big count-up numbers.
 *
 * The script: the AI writes it from a topic or a lesson passage (English and Malayalam); without AI the passage is
 * split into sentences and the pictures are guessed from the words. Everything is drawn in code: nothing to download,
 * no one else's footage. Pure (no DOM) except the storage helpers.
 */

export type Bi = { en: string; ml?: string };
export const VISUALS = ['night-sky', 'planet', 'rain', 'beam', 'arrow', 'grid', 'atom', 'title', 'photo', 'plain', 'figure'] as const;
export type Visual = (typeof VISUALS)[number];
export const VISUAL_NAME: Record<Visual, string> = { 'night-sky': 'Night sky', planet: 'Planet', rain: 'Light rain', beam: 'Beam of light', arrow: 'Arrow', grid: 'Glowing grid', atom: 'Atom', title: 'Big title word', photo: 'My photo', plain: 'Plain dark', figure: 'Textbook picture' };
export const PLANETS = ['earth', 'sun', 'moon', 'mars'] as const;
export type Planet = (typeof PLANETS)[number];
export const PLANET_NAME: Record<Planet, string> = { earth: 'Earth', sun: 'Sun', moon: 'Moon', mars: 'Mars' };

export interface XShot {
  /** The sentence. *words* = bold italic; [words] = in a highlight box. */
  text: Bi;
  visual: Visual;
  planet?: Planet;
  /** Small all-caps label ("EVERY SECOND", "THE SUN"). */
  label?: Bi;
  /** A number that counts up, with what it is ("15" + " crore km", label "DISTANCE TO THE SUN"). */
  number?: { value: number; suffix?: Bi; decimals?: number };
  /** The big word of a 'title' shot. */
  big?: Bi;
  /** A photo for a 'photo' shot (small JPEG data URL, kept on this device). */
  photo?: string;
}
export interface XScript { title: Bi; shots: XShot[] }

export const pickBi = (b: Bi | undefined, lang: 'en' | 'ml'): string => (b ? (lang === 'ml' ? b.ml?.trim() || b.en : b.en) : '');

/* ---------------- the markup ---------------- */

export interface XWord { text: string; em: boolean; hl: boolean }
/** "The *Sun* is [very far] away." → words with their emphasis and highlight. */
export function parseMarkup(s: string): XWord[] {
  const out: XWord[] = [];
  let em = false, hl = false, cur = '';
  const push = () => { if (cur) { out.push({ text: cur, em, hl }); cur = ''; } };
  for (const ch of s) {
    if (ch === '*') { push(); em = !em; continue; }
    if (ch === '[') { push(); hl = true; continue; }
    if (ch === ']') { push(); hl = false; continue; }
    if (/\s/.test(ch)) { push(); continue; }
    cur += ch;
  }
  push();
  return out;
}
/** The sentence without the markup (what the voice says and the caption file holds). */
export const plainText = (s: string) => s.replace(/[*[\]]/g, '').replace(/\s+/g, ' ').trim();

/* ---------------- the AI prompt and checking ---------------- */

export const MAX_SHOTS = 14;
export const XPLAIN_SYSTEM = `You write the script of a short cinematic explainer reel (60–90 seconds) for Indian school students, in the style of science explainer shorts: one short sentence per screen, a strong hook first, one idea at a time, a memorable last line.
Reply with JSON only:
{"title":{"en":"…","ml":"…"},"shots":[{"text":{"en":"…","ml":"…"},"visual":"…","planet":"…","label":{"en":"…","ml":"…"},"number":{"value":15,"suffix":{"en":" crore km","ml":" കോടി കി.മീ."}},"big":{"en":"…","ml":"…"}}]}
Rules:
- 6 to ${MAX_SHOTS} shots. Each "text" is ONE sentence of at most 14 words. Mark 1–2 key words with *stars* (bold italic). In at most one shot of every three, put one short phrase in [square brackets] (a highlight box).
- visual is one of: night-sky (stars, a person looking up), planet (with "planet": earth, sun, moon or mars), rain (tiny particles passing through), beam (a flash / ray of light), arrow (a direction, tracing back), grid (sensors / dots lighting up), atom (atoms, electrons), title (a big word: put it in "big"), plain.
- "label": an optional SHORT all-caps tag (2–4 words) shown under the picture. "number": an optional number that counts up (use Indian units: lakh, crore).
- Every fact must be correct; use only what the passage says, or well-known school facts. No fear, no exaggeration.
- Give every text in English ("en") and natural, simple Malayalam ("ml").`;
export const xplainUser = (topic: string, standard?: string) => `${standard ? `Class: Std ${standard}.\n` : ''}Topic or passage:\n"""\n${topic.trim().slice(0, 5000)}\n"""`;

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
function bi(v: unknown, max = 300): Bi | undefined {
  if (typeof v === 'string') { const t = str(v, max); return t ? { en: t } : undefined; }
  const o = (v ?? {}) as Record<string, unknown>;
  const en = str(o.en, max), ml = str(o.ml, max);
  if (!en && !ml) return undefined;
  return { en: en || ml, ...(ml ? { ml } : {}) };
}
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => (typeof v === 'string' && (list as readonly string[]).includes(v.trim().toLowerCase()) ? (v.trim().toLowerCase() as T) : undefined);

export function cleanShot(raw: unknown): XShot | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const text = bi(o.text, 240);
  if (!text || !plainText(text.en)) return null;
  let visual = oneOf(o.visual, VISUALS) ?? guessVisual(text.en);
  const planet = oneOf(o.planet, PLANETS) ?? (visual === 'planet' ? guessPlanet(text.en) : undefined);
  const big = bi(o.big, 30);
  if (visual === 'title' && !big) visual = 'plain';
  const photo = typeof o.photo === 'string' && o.photo.startsWith('data:image/') ? o.photo : undefined;
  if ((visual === 'photo' || visual === 'figure') && !photo) visual = 'night-sky'; // V51.9.141: a textbook picture needs its picture
  const n = (o.number ?? null) as Record<string, unknown> | null;
  const value = n ? Number(n.value) : NaN;
  const label = bi(o.label, 40);
  return {
    text, visual,
    ...(planet ? { planet } : {}),
    ...(label ? { label: { en: label.en.toUpperCase(), ...(label.ml ? { ml: label.ml } : {}) } } : {}),
    ...(n && Number.isFinite(value) && Math.abs(value) < 1e12 ? { number: { value, ...(bi(n.suffix, 30) ? { suffix: bi(n.suffix, 30) } : {}), ...(Number.isInteger(value) ? {} : { decimals: 1 }) } } : {}),
    ...(visual === 'title' && big ? { big } : {}),
    ...(photo ? { photo } : {}),
  };
}

/** Checks an AI script (text or object); throws when there is nothing usable in it. */
export function parseScript(input: string | unknown): XScript {
  const raw = typeof input === 'string' ? JSON.parse(input.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()) : input;
  const o = (raw ?? {}) as Record<string, unknown>;
  const shots = (Array.isArray(o.shots) ? o.shots : []).map(cleanShot).filter((s): s is XShot => !!s).slice(0, MAX_SHOTS);
  if (!shots.length) throw new Error('The script has no shots.');
  return { title: bi(o.title, 80) ?? { en: 'Explainer' }, shots };
}

/* ---------------- without AI ---------------- */

const WORDS: Array<[Visual, RegExp]> = [
  ['planet', /\b(sun|earth|moon|mars|planet|solar)\b|സൂര്യ|ഭൂമി|ചന്ദ്ര|ഗ്രഹ/i],
  ['atom', /\b(atom|electron|proton|neutron|nucleus|molecule)s?\b|ആറ്റം|ഇലക്ട്രോൺ/i],
  ['beam', /\b(light|ray|flash|laser|lightning|energy)\b|പ്രകാശ|വെളിച്ച|മിന്നൽ/i],
  ['rain', /\b(rain|particle|neutrino|drop|flow|current)s?\b|മഴ|കണിക/i],
  ['arrow', /\b(direction|toward|towards|back|path|travel|move)s?\b|ദിശ|സഞ്ചര/i],
  ['grid', /\b(sensor|detector|cell|grid|pixel|data)s?\b|ഡാറ്റ/i],
  ['night-sky', /\b(star|sky|night|space|galaxy|universe)s?\b|നക്ഷത്ര|ആകാശ|രാത്രി/i],
];
export function guessVisual(text: string): Visual {
  for (const [v, re] of WORDS) if (re.test(text)) return v;
  return 'night-sky';
}
export function guessPlanet(text: string): Planet {
  if (/\bsun\b|സൂര്യ/i.test(text)) return 'sun';
  if (/\bmoon\b|ചന്ദ്ര/i.test(text)) return 'moon';
  if (/\bmars\b|ചൊവ്വ/i.test(text)) return 'mars';
  return 'earth';
}

/** A script without AI: one sentence per shot, pictures guessed from the words, numbers found in the text. */
export function scriptWithoutAi(passage: string, title?: string): XScript {
  const text = passage.replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('Type a topic or paste a passage first.');
  const ml = /[ഀ-ൿ]/.test(text);
  const ss = text.split(/(?<=[.!?।])\s+/).map((s) => s.trim()).filter((s) => s.length > 1).slice(0, MAX_SHOTS);
  const shots: XShot[] = ss.map((s, k) => {
    const visual = guessVisual(s);
    const num = /(\d[\d,]*(?:\.\d+)?)\s*(lakh|crore|million|billion|km|kilometres?|minutes?|seconds?|years?|%)?/i.exec(s);
    const value = num ? Number(num[1].replace(/,/g, '')) : NaN;
    return {
      text: ml ? { en: s, ml: s } : { en: s },
      visual: k === 0 && visual === 'night-sky' ? 'night-sky' : visual,
      ...(visual === 'planet' ? { planet: guessPlanet(s) } : {}),
      ...(num && Number.isFinite(value) && value > 1 ? { number: { value, ...(num[2] ? { suffix: { en: ` ${num[2]}` } } : {}) } } : {}),
    };
  });
  const t = title?.trim() || (ss[0] && ss[0].length <= 48 ? ss[0] : `${(ss[0] ?? text).slice(0, 45)}…`);
  return { title: ml ? { en: t, ml: t } : { en: t }, shots };
}

export type Llm = (system: string, user: string) => Promise<string>;
export async function makeScript(topic: string, llm: Llm | null, o: { standard?: string; title?: string } = {}): Promise<{ script: XScript; by: 'ai' | 'plain'; note?: string }> {
  if (!topic.trim()) throw new Error('Type a topic or paste a passage first.');
  if (llm) {
    try {
      const script = parseScript(await llm(XPLAIN_SYSTEM, xplainUser(topic, o.standard)));
      if (o.title?.trim()) script.title = { ...script.title, en: o.title.trim() };
      return { script, by: 'ai' };
    } catch (e) {
      return { script: scriptWithoutAi(topic, o.title), by: 'plain', note: `AI could not write it (${e instanceof Error ? e.message : String(e)}), so the text was split into sentences.` };
    }
  }
  return { script: scriptWithoutAi(topic, o.title), by: 'plain' };
}

/* ---------------- kept on this device ---------------- */

const KEY = 'ai-guru:explainer:v1';
export function saveScript(s: XScript): boolean { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; } }
export function loadScript(): XScript | null { try { const s = localStorage.getItem(KEY); return s ? parseScript(JSON.parse(s)) : null; } catch { return null; } }

/* ---------------- a ready sample ---------------- */

export const SAMPLE_EXPLAINERS: Array<{ id: string; label: string; script: XScript }> = [
  {
    id: 'sun-8-minutes',
    label: 'The Sun you see is 8 minutes old',
    script: {
      title: { en: 'The Sun you see is 8 minutes old', ml: 'നിങ്ങൾ കാണുന്ന സൂര്യന് 8 മിനിറ്റ് പഴക്കം' },
      shots: [
        { text: { en: 'Every morning, the *Sun* rises over Kerala.', ml: 'എല്ലാ ദിവസവും രാവിലെ *സൂര്യൻ* ഉദിക്കുന്നു.' }, visual: 'planet', planet: 'sun', label: { en: 'THE SUN', ml: 'സൂര്യൻ' } },
        { text: { en: 'But the Sun is [very, very far] away.', ml: 'പക്ഷേ സൂര്യൻ [വളരെ വളരെ ദൂരെയാണ്].' }, visual: 'night-sky' },
        { text: { en: 'About *15 crore kilometres* from us.', ml: 'നമ്മിൽ നിന്ന് ഏകദേശം *15 കോടി കിലോമീറ്റർ* അകലെ.' }, visual: 'plain', number: { value: 15, suffix: { en: ' crore km', ml: ' കോടി കി.മീ.' } }, label: { en: 'DISTANCE TO THE SUN', ml: 'സൂര്യനിലേക്കുള്ള ദൂരം' } },
        { text: { en: 'Light travels *3 lakh kilometres* every second.', ml: 'പ്രകാശം ഓരോ സെക്കൻഡിലും *3 ലക്ഷം കിലോമീറ്റർ* സഞ്ചരിക്കുന്നു.' }, visual: 'beam', label: { en: 'EVERY SECOND', ml: 'ഓരോ സെക്കൻഡിലും' } },
        { text: { en: 'Even so, sunlight needs about *8 minutes* to reach us.', ml: 'എന്നിട്ടും സൂര്യപ്രകാശം നമ്മുടെ അടുത്തെത്താൻ ഏകദേശം *8 മിനിറ്റ്* എടുക്കും.' }, visual: 'plain', number: { value: 8, suffix: { en: ' minutes', ml: ' മിനിറ്റ്' } } },
        { text: { en: 'It leaves the Sun and travels *straight* to your eyes.', ml: 'അത് സൂര്യനിൽ നിന്ന് *നേരെ* നിങ്ങളുടെ കണ്ണിലേക്ക് എത്തുന്നു.' }, visual: 'arrow', label: { en: 'FROM THE SUN TO YOU', ml: 'സൂര്യനിൽ നിന്ന് നിങ്ങളിലേക്ക്' } },
        { text: { en: 'So the Sun you see is [8 minutes old].', ml: 'അതായത് നിങ്ങൾ കാണുന്ന സൂര്യന് [8 മിനിറ്റ് പഴക്കമുണ്ട്].' }, visual: 'planet', planet: 'earth' },
        { text: { en: 'Every time you look up, you look *back in time*.', ml: 'ഓരോ തവണ മുകളിലേക്ക് നോക്കുമ്പോഴും നിങ്ങൾ *ഭൂതകാലത്തിലേക്ക്* നോക്കുന്നു.' }, visual: 'night-sky' },
      ],
    },
  },
];
