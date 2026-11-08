/** Canonical, stable identifiers used across AI Guru agents, QA, recovery and runtime. */
export type AIGuruId = string & { readonly __brand: 'AIGuruId' };
export type CourseId = AIGuruId & { readonly __kind: 'course' };
export type BookId = AIGuruId & { readonly __kind: 'book' };
export type ChapterId = AIGuruId & { readonly __kind: 'chapter' };
export type LessonId = AIGuruId & { readonly __kind: 'lesson' };
export type ParagraphId = AIGuruId & { readonly __kind: 'paragraph' };
export type ProblemId = AIGuruId & { readonly __kind: 'problem' };
export type VisualStepId = AIGuruId & { readonly __kind: 'visualStep' };
export type AudioCueId = AIGuruId & { readonly __kind: 'audioCue' };
export type AssetId = AIGuruId & { readonly __kind: 'asset' };
export type AgentRunId = AIGuruId & { readonly __kind: 'agentRun' };
export type QARunId = AIGuruId & { readonly __kind: 'qaRun' };
export type RecoveryRunId = AIGuruId & { readonly __kind: 'recoveryRun' };

export type AIGuruEntityKind =
  | 'course' | 'book' | 'chapter' | 'lesson' | 'paragraph' | 'problem'
  | 'visualStep' | 'audioCue' | 'asset' | 'agentRun' | 'qaRun' | 'recoveryRun';

const SAFE = /^[a-z0-9][a-z0-9._-]*$/;

export function makeAIGuruId(kind: AIGuruEntityKind, value: string): AIGuruId {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!normalized || !SAFE.test(normalized)) throw new Error(`Invalid ${kind} identifier value`);
  return `${kind}_${normalized}` as AIGuruId;
}

export function makeScopedId(kind: Exclude<AIGuruEntityKind, 'course' | 'book' | 'chapter' | 'lesson' | 'agentRun' | 'qaRun' | 'recoveryRun'>, parentId: string, value: string): AIGuruId {
  return makeAIGuruId(kind, `${parentId}_${value}`);
}

export function isAIGuruId(value: unknown, kind?: AIGuruEntityKind): value is AIGuruId {
  if (typeof value !== 'string' || !value) return false;
  if (kind && !value.startsWith(`${kind}_`)) return false;
  return /^[a-zA-Z][a-zA-Z0-9._:-]*$/.test(value);
}

/** Stable ID helpers: the same logical input produces the same ID. */
export const ids = {
  course: (value: string) => makeAIGuruId('course', value) as CourseId,
  book: (value: string) => makeAIGuruId('book', value) as BookId,
  chapter: (value: string) => makeAIGuruId('chapter', value) as ChapterId,
  lesson: (value: string) => makeAIGuruId('lesson', value) as LessonId,
  paragraph: (lessonId: string, index: number | string) => makeScopedId('paragraph', lessonId, String(index)) as ParagraphId,
  problem: (parentId: string, index: number | string) => makeScopedId('problem', parentId, String(index)) as ProblemId,
  visualStep: (paragraphId: string, index: number | string) => makeScopedId('visualStep', paragraphId, String(index)) as VisualStepId,
  audioCue: (paragraphId: string, index: number | string) => makeScopedId('audioCue', paragraphId, String(index)) as AudioCueId,
  asset: (value: string) => makeAIGuruId('asset', value) as AssetId,
  agentRun: (value: string) => makeAIGuruId('agentRun', value) as AgentRunId,
  qaRun: (value: string) => makeAIGuruId('qaRun', value) as QARunId,
  recoveryRun: (value: string) => makeAIGuruId('recoveryRun', value) as RecoveryRunId,
};
