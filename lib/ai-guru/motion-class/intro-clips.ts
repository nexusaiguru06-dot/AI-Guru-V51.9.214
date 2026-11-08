/**
 * V51.9.88 — HyperFrames heading-intro clips. tools/hyperframes-intros renders one short WebM per heading (eight looks);
 * the class looks a clip up here by a key made from the heading, the sub-line, the language and the look. The look choice
 * and the key must equal the ones in tools/hyperframes-intros/pick-look.mjs (intro-clips.test.ts checks that).
 * No clip → the three.js intro is used, so nothing depends on the clips being there.
 */
export interface IntroClipEntry { file: string; ms: number; look: string; heading: string; lang: string }
export interface IntroClips { base: string; clips: Record<string, IntroClipEntry> }
/** What the render tool needs for one heading (see build-intros.mjs). */
export interface IntroRequest { heading: string; sub?: string; lang: 'en' | 'ml'; subject?: string; kicker: string; chapter: string; look: number }

export const LOOKS: Array<{ id: string; subjects: string[] }> = [
  { id: 'graph', subjects: ['maths', 'general'] },
  { id: 'chalk', subjects: ['maths', 'science', 'general'] },
  { id: 'globe', subjects: ['earth', 'general'] },
  { id: 'rain', subjects: ['maths', 'science'] },
  { id: 'curtain', subjects: ['maths', 'science', 'earth', 'general'] },
  { id: 'atom', subjects: ['science'] },
  { id: 'notebook', subjects: ['maths', 'science', 'earth', 'general'] },
  { id: 'sunrise', subjects: ['earth', 'general'] },
];

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function subjectClass(subject: string | undefined): 'maths' | 'science' | 'earth' | 'general' {
  const k = (subject ?? '').toLowerCase();
  if (/geograph|earth|ഭൂമി|ഭൂമിശാസ്ത്ര/.test(k)) return 'earth';
  if (/sci|phys|chem|bio|ശാസ്ത്ര|ഭൗതിക|രസതന്ത്ര|ജീവ/.test(k)) return 'science';
  if (/social|histor|civic|econom|english|malayalam|hindi|language|സാമൂഹ്യ|ചരിത്ര|ഭാഷ/.test(k)) return 'general';
  return 'maths';
}

/** Index into LOOKS for the n-th heading of a chapter; never the same look twice in a row. */
export function pickLook(subject: string | undefined, n: number, prev: number, chapterTitle = ''): number {
  const cls = subjectClass(subject);
  const pool = LOOKS.map((l, i) => ({ l, i })).filter(({ l }) => l.subjects.includes(cls));
  let k = (hash(`${chapterTitle}|${cls}`) + n) % pool.length;
  if (pool[k].i === prev && pool.length > 1) k = (k + 1) % pool.length;
  return pool[k].i;
}

export function introKey(o: { heading: string; sub?: string; lang: string; look: number }): string {
  const s = `${o.look}|${o.lang}|${o.heading}|${o.sub ?? ''}`;
  return hash(s).toString(16).padStart(8, '0') + hash(`${s}#`).toString(16).padStart(8, '0');
}

export const INTRO_CLIP_BASE = '/ai-guru/intros/';

/** Loads the manifest of rendered clips; null when there is none (nothing was rendered yet). */
export async function loadIntroClips(base = INTRO_CLIP_BASE, fetcher: typeof fetch = fetch): Promise<IntroClips | null> {
  try {
    const r = await fetcher(`${base}manifest.json`, { cache: 'no-cache' });
    // V51.9.181: a missing manifest's page is let go at once; left unread it kept the page from ever settling
    if (!r.ok) { void r.body?.cancel().catch(() => undefined); return null; }
    const j = (await r.json()) as { clips?: Record<string, IntroClipEntry> };
    return j.clips && Object.keys(j.clips).length ? { base, clips: j.clips } : null;
  } catch {
    return null;
  }
}

/** The clip's URL for this heading, or undefined when it was not rendered. */
export function clipFor(c: IntroClips | undefined, o: { heading: string; sub?: string; lang: string; look: number }): { src: string; ms: number } | undefined {
  const e = c?.clips[introKey(o)];
  return e ? { src: c!.base + e.file, ms: e.ms } : undefined;
}
