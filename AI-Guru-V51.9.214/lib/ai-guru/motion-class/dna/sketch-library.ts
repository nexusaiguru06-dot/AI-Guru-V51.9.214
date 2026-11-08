/**
 * Sketch candidates (V51.9.50). Every free sketch the AI draws for a block no template fitted is kept
 * here as a CANDIDATE. It is used for that block only. A teacher looks at it in the class and either
 * promotes it — it then becomes a learned DNA (a one-segment `ai-sketch` template whose example is this
 * sketch), so the next similar block is planned from it — or rejects it.
 *
 * Unlike AI-composed templates of built-in DNAs (saved straight to the learned library, unchanged
 * behaviour), a sketch's maths is not checked by the app, so it is never reused without a person's yes.
 *
 * Stored in localStorage in the browser (exportable as JSON); in memory in Node.
 */

import type { BlockKind } from '../segment';
import { saveLearned, slugId, type LearnedDna } from './learned';
import type { SketchPlan } from './sketch-math';

export type SketchStatus = 'candidate' | 'promoted' | 'rejected';

export interface SketchCandidate {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  kinds: BlockKind[];
  plan: SketchPlan;
  /** The start of the block it was drawn for (shown when reviewing). */
  blockText: string;
  blockId: string;
  status: SketchStatus;
  createdAt: string;
  /** Learned DNA id once promoted. */
  learnedId?: string;
}

const KEY = 'ai-guru-motion-sketch-candidates';
let memory: SketchCandidate[] | null = null;

function load(): SketchCandidate[] {
  if (memory) return memory;
  memory = [];
  try {
    if (typeof localStorage !== 'undefined') memory = JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    memory = [];
  }
  if (!Array.isArray(memory)) memory = [];
  return memory!;
}

function persist() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(memory ?? []));
  } catch {
    /* storage unavailable: keep in memory */
  }
}

export function sketchCandidates(status?: SketchStatus): SketchCandidate[] {
  const all = load();
  return status ? all.filter((c) => c.status === status) : all;
}

export function getSketchCandidate(id: string): SketchCandidate | undefined {
  return load().find((c) => c.id === id);
}

/** Records a new sketch (or replaces the candidate drawn for the same block). Returns it. */
export function saveSketchCandidate(c: Omit<SketchCandidate, 'id' | 'status' | 'createdAt'> & { id?: string; now?: Date }): SketchCandidate {
  const all = load();
  const base = slugId(c.name || 'sketch');
  const existing = all.find((x) => x.blockId === c.blockId && x.status === 'candidate');
  let id = c.id ?? existing?.id ?? base;
  if (!c.id && !existing) for (let n = 2; all.some((x) => x.id === id); n++) id = `${base}-${n}`;
  const rec: SketchCandidate = {
    id,
    name: c.name,
    description: c.description,
    keywords: c.keywords.slice(0, 12),
    kinds: c.kinds,
    plan: c.plan,
    blockText: c.blockText.slice(0, 300),
    blockId: c.blockId,
    status: 'candidate',
    createdAt: (c.now ?? new Date()).toISOString(),
  };
  const i = all.findIndex((x) => x.id === id);
  if (i >= 0) all[i] = rec;
  else all.push(rec);
  persist();
  return rec;
}

/** Teacher's yes: the sketch becomes a learned DNA that similar blocks are planned from. */
export function promoteSketch(id: string, o: { now?: Date } = {}): LearnedDna | null {
  const c = getSketchCandidate(id);
  if (!c) return null;
  const learned = saveLearned({
    id: `sketch-${c.id}`,
    name: c.name,
    description: `${c.description} (free sketch promoted by a teacher)`,
    kinds: c.kinds,
    keywords: c.keywords,
    segments: ['ai-sketch'],
    example: { segments: [{ dna: 'ai-sketch', plan: c.plan }] },
    createdAt: (o.now ?? new Date()).toISOString(),
  });
  c.status = 'promoted';
  c.learnedId = learned.id;
  persist();
  return learned;
}

export function rejectSketch(id: string): void {
  const c = getSketchCandidate(id);
  if (!c) return;
  c.status = 'rejected';
  persist();
}

export function removeSketchCandidate(id: string): void {
  memory = load().filter((c) => c.id !== id);
  persist();
}

export function exportSketchCandidates(): string {
  return JSON.stringify(load(), null, 2);
}

export function importSketchCandidates(json: string): number {
  const list = JSON.parse(json) as SketchCandidate[];
  let n = 0;
  const all = load();
  for (const c of list) {
    if (!c?.id || !c.plan || !Array.isArray(c.plan.objects)) continue;
    const i = all.findIndex((x) => x.id === c.id);
    if (i >= 0) all[i] = c;
    else all.push(c);
    n++;
  }
  persist();
  return n;
}

/** Test helper: forget everything held in memory. */
export function _resetSketchCandidates(): void {
  memory = [];
  persist();
}
