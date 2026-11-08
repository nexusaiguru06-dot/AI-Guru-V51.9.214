/**
 * V51.9.120 — a part of a class taken from the whiteboard to the Reel Studio.
 *
 *  Not a video: the lesson's own material — the textbook blocks, the AI's teaching plans and the subject agents'
 *  plans — so the Reel Studio builds exactly the same maths animation again, and the student can then keep only some
 *  parts (read / teach / mistake …, one language), change the words the teacher says, re-voice it, and design it
 *  (colours, stickers, text) before making the MP4. It is small (text only), so it is also a file to save and open
 *  later ("….aiguru-class.json").
 */
import type { BookBlock } from '../motion-class/segment';
import type { BlockPlan } from '../motion-class/dna/types';
import type { SubjectPlan } from '../subjects/types';
import { compileMixed } from '../subjects/compile';
import { PILL, type ClassSegment } from '../motion-class/class';
import { withWords, type MotionScene } from './motion/engine';
import type { Lang } from './motion/captions';

export interface ClassClip {
  v: 1;
  /** The section / heading the class was on. */
  title: string;
  chapter?: string;
  kind: 'problem' | 'lecture';
  /** Problem 2, Lecture 3 … */
  nth: number;
  blocks: BookBlock[];
  plans: Record<string, BlockPlan>;
  subject: Record<string, SubjectPlan>;
  languages: Lang[];
  madeAt: string;
  /** Studio: the parts kept (segment ids); absent = every part of `lang`. */
  keep?: string[];
  /** Studio: the language of the reel (its parts in that language). */
  lang?: Lang;
  /** Studio: caption words changed (original → new). */
  words?: Record<string, string>;
}

const PHASE_NAME: Record<string, string> = { intro: 'Heading intro', read: 'Read', teach: 'Teach', mistake: 'Common mistake', check: 'Check', summary: 'Summary' };
const LANG_NAME: Record<Lang, string> = { en: 'English', ml: 'മലയാളം' };

/** The part of a class now on a board, as a clip (only the plans of its own blocks). */
export function makeClip(o: { title: string; chapter?: string; kind: 'problem' | 'lecture'; nth: number; blocks: BookBlock[]; plans: Map<string, BlockPlan>; subject: Map<string, SubjectPlan>; languages: Lang[] }): ClassClip {
  const ids = new Set(o.blocks.map((b) => b.id));
  const pick = <T>(m: Map<string, T>) => Object.fromEntries([...m].filter(([k]) => ids.has(k)));
  return { v: 1, title: o.title, chapter: o.chapter, kind: o.kind, nth: o.nth, blocks: o.blocks, plans: pick(o.plans), subject: pick(o.subject), languages: o.languages.length ? o.languages : ['en'], madeAt: new Date().toISOString() };
}

/** Checks a clip read from a file or from storage. Throws a readable message when it is not one. */
export function cleanClip(raw: unknown): ClassClip {
  const o = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<ClassClip> | null;
  if (!o || o.v !== 1 || !Array.isArray(o.blocks) || !o.blocks.length || typeof o.plans !== 'object' || !o.plans) throw new Error('This is not an AI Guru class file.');
  const langs = (Array.isArray(o.languages) ? o.languages : ['en']).filter((l): l is Lang => l === 'en' || l === 'ml');
  const words: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.words ?? {})) if (typeof v === 'string' && v.trim() && k !== v) words[String(k).slice(0, 600)] = v.slice(0, 600);
  return {
    v: 1,
    title: String(o.title ?? 'Class').slice(0, 160),
    chapter: o.chapter ? String(o.chapter).slice(0, 160) : undefined,
    kind: o.kind === 'lecture' ? 'lecture' : 'problem',
    nth: Math.max(1, Math.floor(Number(o.nth) || 1)),
    blocks: o.blocks.slice(0, 40),
    plans: o.plans,
    subject: (o.subject && typeof o.subject === 'object' ? o.subject : {}) as Record<string, SubjectPlan>,
    languages: langs.length ? langs : ['en'],
    madeAt: String(o.madeAt ?? ''),
    ...(Array.isArray(o.keep) ? { keep: o.keep.map(String).slice(0, 200) } : {}),
    ...(o.lang === 'en' || o.lang === 'ml' ? { lang: o.lang } : {}),
    ...(Object.keys(words).length ? { words } : {}),
  };
}

/** Every part (segment) the class made from the clip, in order. */
export function clipSegments(c: ClassClip): ClassSegment[] {
  return compileMixed(c.blocks, new Map(Object.entries(c.plans)), new Map(Object.entries(c.subject)), { title: c.title }, { order: 'per-language', languages: c.languages, mistakes: true });
}

export const clipLang = (c: ClassClip): Lang => c.lang ?? c.languages[0] ?? 'en';

/** The parts to show: the kept ones, or every part in the clip's language. */
export function keptSegments(c: ClassClip, all: ClassSegment[] = clipSegments(c)): ClassSegment[] {
  const lang = clipLang(c);
  const inLang = all.filter((s) => s.lang === lang);
  if (!c.keep) return inLang.length ? inLang : all;
  const keep = new Set(c.keep);
  const k = all.filter((s) => keep.has(s.id));
  return k.length ? k : inLang.length ? inLang : all;
}

/** A readable name of a part: "Teach · English", "Common mistake · മലയാളം". */
export const segmentName = (s: ClassSegment) => s.label || `${PHASE_NAME[s.phase] ?? s.phase} · ${LANG_NAME[s.lang]}`;

/** The reel's scenes (built inside buildReel, so the Reel Studio's voice times them; changed words applied). */
export function buildClipScenes(c: ClassClip): MotionScene[] {
  const segs = keptSegments(c);
  if (!segs.length) throw new Error('This class part has nothing to show.');
  const words = new Map(Object.entries(c.words ?? {}));
  const out: MotionScene[] = [];
  for (const seg of segs) {
    const parts = withWords(words, () => seg.build());
    for (const p of parts) { p.group = `class:${seg.id}`; p.pill = seg.pill ?? PILL[seg.phase]?.[seg.lang] ?? (seg.lang === 'ml' ? 'ഘട്ടം' : 'STEP'); }
    out.push(...parts);
  }
  return out;
}

/** The words the teacher says in the kept parts, in order (original captions, before changes). */
export function clipCaptions(c: ClassClip): string[] {
  const out: string[] = [];
  for (const seg of keptSegments(c)) for (const p of seg.build()) for (const cap of p.captions) if (!out.includes(cap.text)) out.push(cap.text);
  return out;
}

/* ---------------- handing over and files ---------------- */

const HANDOFF = 'ai-guru:class-clip:v1';
/** Kept on this device for the Reel Studio (the whiteboard opens it in a new tab). */
export function saveClip(c: ClassClip): boolean { try { localStorage.setItem(HANDOFF, JSON.stringify(c)); return true; } catch { return false; } }
export function loadClip(): ClassClip | null { try { const s = localStorage.getItem(HANDOFF); return s ? cleanClip(s) : null; } catch { return null; } }

export const clipFileName = (c: ClassClip) => `${(c.title || 'class').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'class'}-${c.kind}-${c.nth}.aiguru-class.json`;

/** Saves the clip as a file on this device (browser only). */
export function downloadClip(c: ClassClip) {
  const blob = new Blob([JSON.stringify(c)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = clipFileName(c);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
