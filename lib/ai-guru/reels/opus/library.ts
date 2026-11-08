/**
 * V51.9.135 — the Opus-inspired STYLE LIBRARY for the Reel Studio.
 *
 * The awesome-opus5-5-videos collection is 703 prompts, not animation code. Each prompt that is safe for school
 * (scripts/ai-guru-build-opus-library.mjs filters brands, violence, gambling, alcohol, adult, horror and politics) is
 * kept as a STYLE RECIPE for the engine AI Guru already has:
 *
 *   recipe = engine choices (look, camera, pace, music, sounds, fonts, opener, ending)
 *          + a short style direction and preferred pictures for the AI explainer writer
 *          + the creator's credit and a link to the original
 *
 * Choosing a recipe never runs anything from the original and never replaces the lesson: the whiteboard / sum /
 * class part stays the content; only how it looks and moves changes. So the preview is still frame-exact with the
 * MP4, and every reel still goes through the self-check.
 *
 * Pure (no DOM, no fetch): used by the API route, the panel and the tests.
 */
import { z } from 'zod';
import type { StyleChoices } from '../motion/variety';
import { ALL_LOOKS, CARD_FONTS, BOARD_FONTS } from '../motion/look';
import { CAMERAS } from '../motion/camera';
import { ENDINGS, OPENERS } from '../motion/recipes/hooks';
import { MUSICS, SFX_PACKS } from '../motion/sfx';
import { VISUALS, type Visual, type Llm } from '../explainer/script';

export const OPUS_CATEGORIES = ['pro', 'maths', 'science', 'steps', 'words', 'celebration', 'motion'] as const;
export type OpusCategory = (typeof OPUS_CATEGORIES)[number];
export const OPUS_CATEGORY_NAME: Record<OpusCategory, string> = {
  pro: '🎬 Pro templates', // V51.9.156: after HyperFrames
  maths: '➗ Maths',
  science: '🔭 Science',
  steps: '🪜 Step by step',
  words: '🔤 Words & stories',
  celebration: '🎉 Celebration',
  motion: '✨ Motion ideas',
};
/** The Reel Studio content kinds a recipe suits best (same ids as the studio's modes). */
export const STUDIO_MODES = ['sum', 'branch', 'chapter', 'story', 'class', 'explainer'] as const;
export type StudioMode = (typeof STUDIO_MODES)[number];

const oneOf = <T extends string>(list: readonly T[]) => z.string().refine((v): v is T => (list as readonly string[]).includes(v), { message: `one of ${list.join(', ')}` });

/** Only values the engine really has: a bad file can never put an unknown look or camera in a reel. */
export const OpusChoicesSchema = z.object({
  look: oneOf(ALL_LOOKS.map((l) => l.id)),
  camera: oneOf(CAMERAS),
  pace: oneOf(['brisk', 'normal', 'relaxed'] as const),
  music: oneOf(MUSICS),
  pack: oneOf(SFX_PACKS),
  font: oneOf(CARD_FONTS),
  boardFont: oneOf(BOARD_FONTS),
  opener: oneOf([...OPENERS, 'none'] as string[]),
  ending: oneOf([...ENDINGS, 'none'] as string[]),
});

export const OpusRecipeSchema = z.object({
  id: z.string().regex(/^opus-[a-z0-9-]+$/),
  name: z.string().min(3).max(80),
  hint: z.string().max(120).nullable(),
  category: z.enum(OPUS_CATEGORIES),
  mood: z.string().max(20),
  bestFor: z.array(z.enum(STUDIO_MODES)).min(1),
  score: z.number(),
  recommended: z.boolean(),
  choices: OpusChoicesSchema,
  visuals: z.array(z.enum(VISUALS)).max(4),
  direction: z.string().max(400),
  inspiration: z.string().max(300),
  tech: z.array(z.string()),
  credit: z.object({
    author: z.string(),
    authorUrl: z.string().url().nullable().optional(),
    postUrl: z.string().url().nullable().optional(),
    exampleUrl: z.string().url().nullable().optional(),
    thumbnail: z.string().url().nullable().optional(), // Pro templates have none: the panel draws a live preview
  }),
});
export type OpusRecipe = z.infer<typeof OpusRecipeSchema>;

export const OpusLibrarySchema = z.object({
  v: z.literal(1),
  source: z.object({ name: z.string(), url: z.string().url(), license: z.string(), total: z.number(), note: z.string() }),
  builtAt: z.string(),
  counts: z.object({ upstream: z.number(), kept: z.number(), recommended: z.number(), dropped: z.number() }),
  recipes: z.array(OpusRecipeSchema),
});
export type OpusLibrary = z.infer<typeof OpusLibrarySchema>;

/** What the panel needs for a card (the inspiration text is fetched only when a recipe is opened). */
export type OpusCard = Omit<OpusRecipe, 'inspiration' | 'tech' | 'score'>;
export const toCard = ({ inspiration: _i, tech: _t, score: _s, ...card }: OpusRecipe): OpusCard => card;

/* ---------------- search ---------------- */

export interface OpusQuery {
  q?: string;
  category?: OpusCategory | 'all';
  /** Only recipes that suit this studio mode. */
  mode?: StudioMode;
  /** 'recommended' (default) = hand-picked for lessons; 'all' = every safe idea. */
  view?: 'recommended' | 'all';
  offset?: number;
  limit?: number;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]+/gu, ' ');

export function searchRecipes(recipes: readonly OpusRecipe[], o: OpusQuery = {}): { total: number; items: OpusRecipe[] } {
  const words = norm(o.q ?? '').split(/\s+/).filter((w) => w.length > 1);
  let list = recipes.filter((r) => (o.view === 'all' ? true : r.recommended));
  if (o.category && o.category !== 'all') list = list.filter((r) => r.category === o.category);
  if (o.mode) list = list.filter((r) => r.bestFor.includes(o.mode!));
  if (words.length) {
    const scored = list
      .map((r) => {
        const name = norm(`${r.name} ${r.hint ?? ''}`), body = norm(`${r.inspiration} ${r.mood} ${r.category} ${r.credit.author} ${r.choices.look}`);
        let s = 0;
        for (const w of words) s += name.includes(w) ? 3 : body.includes(w) ? 1 : -5;
        return { r, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || Number(b.r.recommended) - Number(a.r.recommended));
    list = scored.map((x) => x.r);
  }
  const offset = Math.max(0, Math.floor(o.offset ?? 0));
  const limit = Math.max(1, Math.min(60, Math.floor(o.limit ?? 24)));
  return { total: list.length, items: list.slice(offset, offset + limit) };
}

/* ---------------- using a recipe ---------------- */

/** The recipe as Reel Studio style choices (the student's own picks and pins still win over it). */
export function recipeChoices(r: Pick<OpusRecipe, 'choices'>): StyleChoices {
  const c = r.choices;
  return {
    look: c.look,
    camera: c.camera as StyleChoices['camera'],
    pace: c.pace as StyleChoices['pace'],
    music: c.music as StyleChoices['music'],
    pack: c.pack as StyleChoices['pack'],
    font: c.font as StyleChoices['font'],
    boardFont: c.boardFont as StyleChoices['boardFont'],
    opener: c.opener as StyleChoices['opener'],
    ending: c.ending as StyleChoices['ending'],
  };
}

/** Extra lines for the explainer writer's system prompt: the style, and the pictures to prefer. Facts stay the lesson's. */
export function recipeDirection(r: Pick<OpusRecipe, 'name' | 'direction' | 'visuals'>): string {
  const pics = r.visuals.length ? ` Prefer the visuals ${r.visuals.join(', ')} where they fit the sentence; otherwise choose freely.` : '';
  return `\nSTYLE (from the "${r.name}" style; it changes only HOW the reel feels, never the facts): ${r.direction}${pics}\nThe lesson text is the only source of facts. Do not add brand names, products or people from any example.`;
}

/** The student's AI, writing in the recipe's style (same JSON contract and checks as the explainer editor). */
export const styledLlm = (llm: Llm, r: Pick<OpusRecipe, 'name' | 'direction' | 'visuals'> | null): Llm => (r ? (system, user) => llm(system + recipeDirection(r), user) : llm);

/** The readable text of a class part (what the explainer writer turns into shots). */
export function clipPassage(clip: { title?: string; blocks: Array<{ text?: string }> }): string {
  const body = clip.blocks.map((b) => (b.text ?? '').trim()).filter(Boolean).join('\n');
  return [clip.title?.trim(), body].filter(Boolean).join('\n').slice(0, 5000);
}

export const isVisual = (v: string): v is Visual => (VISUALS as readonly string[]).includes(v);

/* ---------------- the chosen recipe, kept on this device ---------------- */

const KEY = 'ai-guru:reel-opus-style:v1';
export function saveChosenRecipe(r: OpusCard | null): void {
  try { if (r) localStorage.setItem(KEY, JSON.stringify(r)); else localStorage.removeItem(KEY); } catch { /* private mode */ }
}
export function loadChosenRecipe(): OpusCard | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = OpusRecipeSchema.omit({ inspiration: true, tech: true, score: true }).safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
