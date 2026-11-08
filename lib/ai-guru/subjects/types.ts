/**
 * Subject agents (V51.9.69): beyond maths, every subject is its own agent with its own planner, its own
 * validator and its own picture templates. The maths engine (motion-class) is not touched; an agent only
 * borrows the shared drawing engine (Motion) and hands back ordinary class segments.
 *
 *   claim    — "is this textbook block mine?" (a score 0–1, decided from the words, never from maths)
 *   plan     — fill the agent's own template: from the AI when a key is set, else from the text itself
 *   validate — the agent checks its own plan (an agent never trusts the AI's numbers)
 *   build    — deterministic scenes; every number written on the board is computed by the app
 */

import type { MotionScene } from '../reels/motion/engine';
import type { Lang } from '../reels/motion/captions';
import type { BookBlock } from '../motion-class/segment';
import type { Bi } from '../motion-class/dna/types';

export type SubjectId = 'physics' | 'chemistry' | 'biology' | 'earth' | 'computer-science' | 'social' | 'economics' | 'english';

export type { Bi };
/** Same shape as the AI planner's model call: system prompt, user prompt → text. */
export type Llm = (system: string, user: string) => Promise<string>;

export interface SubjectContext {
  chapterTitle: string;
  sectionTitle: string;
  /** The textbook's own subject if the app knows it ("Physics", "Science"…); only a hint. */
  subjectHint?: string;
}

/** What an agent produces for one block. */
export interface SubjectPlan {
  agent: SubjectId;
  /** Which of the agent's templates draws it. */
  template: string;
  /** Textbook text to read aloud. */
  read: Bi;
  /** The template's own plan (validated). */
  teach: unknown;
  /** Where the plan came from. */
  source: 'ai' | 'text';
}

export interface AgentTemplate {
  id: string;
  title: string;
  /** A one-line description (teacher screens). */
  about: string;
  /** A ready, valid plan to show the template (tests, samples, the teacher's preview). */
  example: unknown;
  /** The reasons a plan cannot be drawn (empty = fine). */
  validate: (teach: unknown) => string[];
  build: (teach: unknown, lang: Lang, title: string) => MotionScene[];
}

export interface SubjectAgent {
  id: SubjectId;
  name: string;
  templates: AgentTemplate[];
  /** 0–1: how sure the agent is that the block is its subject. */
  claim: (b: BookBlock, ctx: SubjectContext) => number;
  /** The plan read straight from the text (no AI); null when the text has nothing the agent can draw. */
  fromText: (b: BookBlock, ctx: SubjectContext) => { template: string; teach: unknown } | null;
  /** System prompt for the AI planner: the agent's own templates and rules. */
  system: string;
}

export type AgentStage = 'claim' | 'plan' | 'validate' | 'fallback' | 'skip';
export interface AgentEvent {
  agent: SubjectId;
  blockId: string;
  stage: AgentStage;
  ok: boolean;
  note: string;
}
