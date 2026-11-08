import type { Lesson } from './lesson-json';
import type { AgentRunId } from './ids';

export type AgentName =
  | 'teaching-controller' | 'curriculum' | 'rag-book' | 'lesson' | 'visual-step'
  | 'math' | 'graph' | 'geometry' | 'voice' | 'sync' | 'assessment'
  | 'student-intelligence' | 'remediation' | 'doubt' | 'material' | 'teacher'
  | 'parent' | 'analytics' | 'session-memory' | 'model-router' | 'recovery';

export interface AgentContext {
  runId: AgentRunId;
  lessonId?: string;
  paragraphId?: string;
  problemId?: string;
  sessionId?: string;
  studentId?: string;
  language?: 'english' | 'malayalam';
  metadata?: Record<string, unknown>;
}

export interface AgentRequest<TInput = unknown> {
  agent: AgentName;
  context: AgentContext;
  input: TInput;
}

export interface AgentResult<TOutput = unknown> {
  ok: boolean;
  agent: AgentName;
  runId: AgentRunId;
  output?: TOutput;
  error?: { code: string; message: string; details?: unknown };
  warnings?: string[];
}

export interface AIGuruAgent<TInput = unknown, TOutput = unknown> {
  readonly name: AgentName;
  execute(request: AgentRequest<TInput>): Promise<AgentResult<TOutput>>;
}

export interface TeachingControllerInput {
  lesson: Lesson;
  fromParagraphId?: string;
}
