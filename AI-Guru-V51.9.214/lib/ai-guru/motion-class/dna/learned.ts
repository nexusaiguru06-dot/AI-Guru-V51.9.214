/**
 * Learned DNAs: templates the AI composed for blocks no built-in DNA fitted.
 * Each is a named recipe of built-in DNA segments plus the keywords that
 * describe when to use it. They join selection like any other DNA, so the next
 * similar paragraph reuses the template instead of inventing a new one.
 *
 * Stored in localStorage in the browser (exportable as JSON); in memory in Node.
 */

import type { BlockKind } from '../segment';
import type { BlockFeatures, CompositePlan, DnaId } from './types';

export interface LearnedDna {
  id: string;
  name: string;
  description: string;
  kinds: BlockKind[];
  keywords: string[];
  /** The built-in DNAs this template is made of, in order. */
  segments: Array<Exclude<DnaId, 'ai-custom' | `learned:${string}` | 'bridge'>>;
  /** The first filled plan (shown to the AI as an example when the template is reused). */
  example: CompositePlan;
  createdAt: string;
  /** Where the template came from: the AI composed it ('ai', the default) or a teacher's video taught it (V51.9.63). */
  source?: 'ai' | 'teacher-video';
  /** Teacher-video templates: how the video teaches (layout, pace, how each step is shown), given to the planner. */
  styleNotes?: string;
  /** Teacher-video templates: the steps the video goes through, in order. */
  stepsOutline?: string[];
  /** Teacher-video templates: the video file the teacher uploaded (name only; the video itself is never kept). */
  sourceName?: string;
}

const KEY = 'ai-guru-motion-dna-learned';
let memory: LearnedDna[] | null = null;

function load(): LearnedDna[] {
  if (memory) return memory;
  memory = [];
  try {
    if (typeof localStorage !== 'undefined') memory = JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    memory = [];
  }
  return memory!;
}

function persist() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(memory ?? []));
  } catch {
    /* storage unavailable: keep in memory */
  }
}

export function learnedDnas(): LearnedDna[] {
  return load();
}

export function getLearned(id: string): LearnedDna | undefined {
  return load().find((d) => d.id === id);
}

export function saveLearned(d: LearnedDna): LearnedDna {
  const all = load();
  const i = all.findIndex((x) => x.id === d.id);
  if (i >= 0) all[i] = d;
  else all.push(d);
  persist();
  return d;
}

export function removeLearned(id: string): void {
  memory = load().filter((d) => d.id !== id);
  persist();
}

export function exportLearned(): string {
  return JSON.stringify(load(), null, 2);
}

export function importLearned(json: string): number {
  const list = JSON.parse(json) as LearnedDna[];
  for (const d of list) if (d?.id && Array.isArray(d.segments)) saveLearned(d);
  return list.length;
}

/** Keyword overlap with the block (stems), kind must match. Capped below the strongest built-ins. */
export function scoreLearned(d: LearnedDna, f: BlockFeatures): number {
  if (!d.kinds.includes(f.kind)) return 0;
  const text = f.text.toLowerCase();
  const hits = d.keywords.filter((k) => text.includes(k.toLowerCase())).length;
  if (!hits) return 0;
  return Math.min(0.89, 0.35 + (hits / Math.max(3, d.keywords.length)) * 0.6);
}

export function slugId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `dna-${Date.now()}`;
}
