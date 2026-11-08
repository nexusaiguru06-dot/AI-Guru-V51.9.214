/**
 * Teacher review of a compiled class (V51.9.46). Every segment (one unit, one language) is rendered to
 * its own video; the teacher watches it and marks it Approved or Needs changes (with a comment).
 * This module is pure: it fingerprints the plan a video was made from, builds the manifest, applies
 * the teacher's decisions, and spots approvals that no longer apply because the plan changed since.
 */

import type { ClassSegment } from './class';
import type { BlockPlan } from './dna/types';

export type ReviewStatus = 'pending' | 'approved' | 'changes';

export interface ReviewItem {
  segmentId: string;
  blockId: string;
  phase: 'read' | 'teach';
  lang: 'en' | 'ml';
  dna: string;
  label: string;
  /** Fingerprint of the plan the video was made from. */
  fingerprint: string;
  durationMs: number;
  /** The video, relative to the review folder. */
  file: string;
  /** What the video's timing was based on: "voice" (measured clips) or "estimate". */
  timing: 'voice' | 'estimate';
  status: ReviewStatus;
  comment?: string;
  reviewer?: string;
  decidedAt?: string;
}

export interface ReviewManifest {
  version: 1;
  title: string;
  generatedAt: string;
  items: ReviewItem[];
}

export interface ReviewDecision {
  segmentId: string;
  status: ReviewStatus;
  comment?: string;
}

/** JSON with sorted keys, so the same plan always gives the same text. */
export function stableJson(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stableJson).join(',')}]`;
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(x) ?? 'null';
}

function fnv(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** What makes a video: the DNA, the textbook text, the teaching plan and the lesson arc (not who planned it, nor warnings). */
export function planFingerprint(plan: Pick<BlockPlan, 'dna' | 'read' | 'teach' | 'arc'>): string {
  const s = stableJson({ dna: plan.dna, read: plan.read, teach: plan.teach, arc: plan.arc });
  return fnv(s, 2166136261) + fnv(s, 0x9e3779b1);
}

export interface ManifestInput {
  segment: Pick<ClassSegment, 'id' | 'blockId' | 'phase' | 'lang' | 'dna' | 'label'>;
  durationMs: number;
  file: string;
  timing: 'voice' | 'estimate';
}

export function buildManifest(title: string, inputs: ManifestInput[], plans: Map<string, BlockPlan>, now = new Date()): ReviewManifest {
  return {
    version: 1,
    title,
    generatedAt: now.toISOString(),
    items: inputs.map(({ segment: s, durationMs, file, timing }) => {
      const plan = plans.get(s.blockId);
      return {
        segmentId: s.id,
        blockId: s.blockId,
        phase: s.phase,
        lang: s.lang,
        dna: s.dna,
        label: s.label,
        fingerprint: plan ? planFingerprint(plan) : '',
        durationMs,
        file,
        timing,
        status: 'pending' as ReviewStatus,
      };
    }),
  };
}

/** Applies the teacher's decisions; unknown segments are ignored, "changes" needs a comment, "pending" clears a decision. */
export function applyReview(manifest: ReviewManifest, decisions: ReviewDecision[], reviewer?: string, now = new Date()): { manifest: ReviewManifest; rejected: string[] } {
  const rejected: string[] = [];
  const byId = new Map(decisions.map((d) => [d.segmentId, d]));
  const items = manifest.items.map((it) => {
    const d = byId.get(it.segmentId);
    if (!d) return it;
    if (!['pending', 'approved', 'changes'].includes(d.status)) {
      rejected.push(`${it.segmentId}: unknown status "${d.status}"`);
      return it;
    }
    if (d.status === 'changes' && !d.comment?.trim()) {
      rejected.push(`${it.segmentId}: say what needs to change`);
      return it;
    }
    if (d.status === 'pending') {
      const { comment: _c, reviewer: _r, decidedAt: _d, ...rest } = it;
      void _c; void _r; void _d;
      return { ...rest, status: 'pending' as ReviewStatus };
    }
    return { ...it, status: d.status, comment: d.comment?.trim() || undefined, reviewer, decidedAt: now.toISOString() };
  });
  for (const id of byId.keys()) if (!manifest.items.some((i) => i.segmentId === id)) rejected.push(`${id}: not in this class`);
  return { manifest: { ...manifest, items }, rejected };
}

/** Approved videos whose plan has changed since they were made (the approval no longer covers what will play). */
export function staleItems(manifest: ReviewManifest, plans: Map<string, BlockPlan>): ReviewItem[] {
  return manifest.items.filter((it) => {
    if (it.status === 'pending') return false;
    const plan = plans.get(it.blockId);
    return !plan || planFingerprint(plan) !== it.fingerprint;
  });
}

export interface ReviewSummary {
  total: number;
  approved: number;
  changes: number;
  pending: number;
  stale: number;
  /** Every video approved and none stale: the class can be published. */
  ready: boolean;
  totalMs: number;
}

export function reviewSummary(manifest: ReviewManifest, plans?: Map<string, BlockPlan>): ReviewSummary {
  const stale = plans ? staleItems(manifest, plans).length : 0;
  const c = (s: ReviewStatus) => manifest.items.filter((i) => i.status === s).length;
  const approved = c('approved');
  return {
    total: manifest.items.length,
    approved,
    changes: c('changes'),
    pending: c('pending'),
    stale,
    ready: manifest.items.length > 0 && approved === manifest.items.length && stale === 0,
    totalMs: manifest.items.reduce((a, i) => a + i.durationMs, 0),
  };
}

/** The teacher's notes as plain text, for passing back to the planner or a colleague. */
export function reviewNotes(manifest: ReviewManifest): string[] {
  return manifest.items.filter((i) => i.status === 'changes').map((i) => `${i.label} (${i.dna}, block ${i.blockId}): ${i.comment}`);
}

/** Clip-length function that estimates speaking time from the text (no voice synthesised): used when no real clips exist. */
export function estimatedClipMs(lang: 'en' | 'ml', estimate: (text: string, lang: 'en' | 'ml') => number) {
  return (spoken: string): number | undefined => (spoken.trim() ? estimate(spoken, lang) : undefined);
}
