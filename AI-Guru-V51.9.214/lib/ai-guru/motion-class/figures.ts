/**
 * V51.9.141 — pictures from the textbook, explained on the whiteboard.
 *
 * The server cuts every picture out of the passage's page (/api/ai-guru/material-studio/page-figures). Each picture
 * becomes a short cinematic explainer on the board: the picture shown whole, and a few sentences saying what it shows
 * and how it connects to the lesson. With the student's AI key the sentences come from an AI that LOOKS at the picture
 * (Gemini vision; English and Malayalam); without one, from the picture's caption, its labels and the lesson text.
 */
import type { XScript, XShot, Bi } from '../reels/explainer/script';

export interface PageFigureOut {
  box: { x: number; y: number; w: number; h: number };
  kind: 'image' | 'drawing';
  inside: string;
  near: string;
  /** PNG data URL of the cut-out picture. */
  image: string;
}

/** The pictures of one page ([] when there are none or the server cannot read the page). */
export async function fetchPageFigures(base: string, page: number, signal?: AbortSignal): Promise<PageFigureOut[]> {
  try {
    const r = await fetch(`${base}?page=${page}`, { signal });
    const j = await r.json();
    return j?.ok && Array.isArray(j.figures) ? (j.figures as PageFigureOut[]).filter((f) => typeof f.image === 'string' && f.image.startsWith('data:image/')) : [];
  } catch {
    return [];
  }
}

/** A caption such as "Figure 6.1 A right triangle" or "ചിത്രം 2". */
const CAPTION = /\b(fig(?:ure)?|picture|diagram|table|graph|map|ചിത്രം)\b/i;
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'its', 'figure', 'fig', 'picture', 'diagram', 'table', 'graph', 'map', 'shows', 'showing']);
const sentences = (s: string) => s.replace(/\s+/g, ' ').split(/(?<=[.?!])\s+(?=[A-Z0-9"“(ഀ-ൿ])/).map((x) => x.trim()).filter((x) => x.length > 12);

/** The explanation without AI: what the textbook says around the picture. */
export function plainFigureShots(f: PageFigureOut, passage: string): XShot[] {
  const shots: XShot[] = [];
  const say = (en: string, ml?: string): XShot => ({ text: ml ? { en, ml } : { en }, visual: 'figure', photo: f.image });
  // the caption starts at "Figure …"; single letters before it are the picture's own labels (A, B, C at the corners)
  const at = f.near.search(CAPTION);
  const caption = at >= 0 ? f.near.slice(at, at + 160).trim() : '';
  const before = at > 0 ? f.near.slice(0, at).split(/\s+/).filter((w) => w && w.length <= 3) : [];
  shots.push(say(caption ? `Look at this picture from your textbook — *${caption}*` : 'Look at this picture from your textbook.', caption ? `പാഠപുസ്തകത്തിലെ ഈ ചിത്രം നോക്കൂ — *${caption}*` : 'പാഠപുസ്തകത്തിലെ ഈ ചിത്രം നോക്കൂ.'));
  const labels = [...new Set([...f.inside.split(/\s+/), ...before].filter((w) => w && w.length <= 12))].slice(0, 8);
  if (labels.length >= 2) shots.push(say(`Find the labels in the picture: ${labels.join(', ')}.`, `ചിത്രത്തിലെ അടയാളങ്ങൾ കണ്ടെത്തൂ: ${labels.join(', ')}.`));
  // the lesson's sentences that speak about what is in the picture (or the first ones)
  const words = new Set([...labels, ...caption.split(/\W+/)].map((w) => w.toLowerCase()).filter((w) => w.length > 2 && !STOP.has(w)));
  const all = sentences(passage);
  const about = all.filter((s) => [...words].some((w) => s.toLowerCase().includes(w)));
  for (const s of (about.length ? about : all).slice(0, 2)) shots.push(say(s.slice(0, 230)));
  return shots;
}

const VISION_SYSTEM = `You are a friendly school teacher in Kerala explaining ONE picture from the student's textbook on the class whiteboard.
Reply with JSON only: {"title":{"en":"…","ml":"…"},"shots":[{"text":{"en":"…","ml":"…"}}]}
Rules:
- 3 to 5 shots. Each "text" is ONE short sentence (at most 22 words) a student can follow.
- First say what the picture shows. Then what its labels, parts or numbers mean. Then how it connects to the lesson text given.
- Say only what you can see in the picture or what the lesson text says. Do not invent numbers, names or facts.
- Mark 1–2 key words with *stars*. Give every text in English ("en") and natural, simple Malayalam ("ml").`;

export type Vision = (system: string, prompt: string, imageBase64: string, mimeType: string) => Promise<string>;

/** One picture's shots: with a vision AI when given (and it answers), otherwise from the textbook's own words. */
export async function figureShots(f: PageFigureOut, ctx: { passage: string; chapter?: string; standard?: string }, vision?: Vision | null): Promise<{ shots: XShot[]; title?: Bi; by: 'ai' | 'plain' }> {
  if (vision) {
    try {
      const prompt = `${ctx.standard ? `Class: Std ${ctx.standard}. ` : ''}${ctx.chapter ? `Chapter: ${ctx.chapter}.\n` : ''}Caption or text next to the picture: ${f.near || '(none)'}\nText written inside the picture: ${f.inside || '(none)'}\nLesson text on this page:\n"""\n${ctx.passage.slice(0, 2500)}\n"""`;
      const raw = await vision(VISION_SYSTEM, prompt, f.image.replace(/^data:image\/\w+;base64,/, ''), 'image/png');
      const o = JSON.parse(raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()) as { title?: Bi; shots?: Array<{ text?: Bi }> };
      const shots = (o.shots ?? [])
        .map((s) => s?.text)
        .filter((t): t is Bi => !!t && typeof t.en === 'string' && t.en.trim().length > 3)
        .slice(0, 6)
        .map((t): XShot => ({ text: { en: t.en.trim().slice(0, 240), ...(typeof t.ml === 'string' && t.ml.trim() ? { ml: t.ml.trim().slice(0, 240) } : {}) }, visual: 'figure', photo: f.image }));
      if (shots.length) return { shots, title: o.title, by: 'ai' };
    } catch { /* no key, no answer or not JSON: the textbook's own words below */ }
  }
  return { shots: plainFigureShots(f, ctx.passage), by: 'plain' };
}

/** All the pictures of the page as one explainer script (null when the page has none). */
export async function figureScript(figs: PageFigureOut[], ctx: { passage: string; chapter?: string; heading?: string; standard?: string }, vision?: Vision | null): Promise<{ script: XScript; by: 'ai' | 'plain' } | null> {
  if (!figs.length) return null;
  const shots: XShot[] = [];
  let by: 'ai' | 'plain' = 'plain';
  for (const f of figs.slice(0, 4)) {
    const r = await figureShots(f, ctx, vision);
    if (r.by === 'ai') by = 'ai';
    shots.push(...r.shots);
  }
  if (!shots.length) return null;
  const title = ctx.heading || ctx.chapter || 'From your textbook';
  return { script: { title: { en: `${title} · pictures`, ml: `${title} · ചിത്രങ്ങൾ` }, shots: shots.slice(0, 14) }, by };
}
