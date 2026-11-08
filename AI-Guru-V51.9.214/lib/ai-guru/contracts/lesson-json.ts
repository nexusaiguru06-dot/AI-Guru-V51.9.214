import type { AudioCueId, AssetId, BookId, ChapterId, CourseId, LessonId, ParagraphId, ProblemId, VisualStepId } from './ids';
import type { MathDomain, UniversalMathScene, UniversalMathStep } from '../math/universal/types';
import type { TeachingStrategy } from '../teaching/strategy';

export const LESSON_SCHEMA_VERSION = '2.0' as const;
export type Language = 'english' | 'malayalam';
export type Difficulty = 'easy' | 'medium' | 'hard';


export interface MathParagraphArtifact {
  domain: MathDomain;
  expressions: string[];
  verifiedExpressions: string[];
  scenes: UniversalMathScene[];
  failures: string[];
  steps?: UniversalMathStep[];
  strategy?: TeachingStrategy;
  status: 'passed' | 'failed' | 'not-applicable';
}

export interface SourceReference {
  bookId: BookId;
  chapterId: ChapterId;
  pageNumber: number;
  pageImage: AssetId | string;
  text: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  sourceLocator?: string;
}

export interface VisualStep {
  id: VisualStepId;
  paragraphId: ParagraphId;
  order: number;
  purpose: string;
  action: Record<string, unknown>;
  targetIds?: string[];
  dependsOn?: VisualStepId[];
  durationMs?: number;
  cueIds?: AudioCueId[];
  stateBefore?: string;
  stateAfter?: string;
}

export interface VoiceArtifact {
  provider: string;
  language: Language;
  audioId?: string;
  audioUrl?: string;
  durationMs?: number;
  words?: { id: string; word: string; startMs: number; endMs: number }[];
  alignment: 'word' | 'phrase' | 'time' | 'pending';
}

export interface AudioCue {
  id: AudioCueId;
  paragraphId: ParagraphId;
  language: Language;
  trigger: 'word' | 'phrase' | 'time';
  triggerText?: string;
  startMs: number;
  endMs?: number;
  visualStepId?: VisualStepId;
}

export interface Checkpoint {
  id: string;
  paragraphId: ParagraphId;
  prompt: string;
  expected?: string;
  difficulty?: Difficulty;
}

export interface Problem {
  id: ProblemId;
  paragraphId?: ParagraphId;
  sourceText: string;
  language: Language;
  difficulty?: Difficulty;
  verified: boolean;
  solution?: {
    finalAnswer: string;
    steps: string[];
    verificationRef?: string;
  };
  visualSteps: VisualStep[];
  audioCues: AudioCue[];
}

export interface Paragraph {
  id: ParagraphId;
  index: number;
  source: SourceReference;
  heading?: string;
  teachingIntent: string;
  explanation: Record<Language, string>;
  visualSteps: VisualStep[];
  audioCues: AudioCue[];
  voice?: Partial<Record<Language, VoiceArtifact>>;
  checkpoints: Checkpoint[];
  problems: Problem[];
  math?: MathParagraphArtifact;
  teachingStrategy?: TeachingStrategy;
  state: 'idle' | 'source' | 'explain' | 'visualize' | 'check' | 'student_response' | 'remediate' | 'mastered' | 'complete' | 'error';
  qa: { content: 'pending' | 'passed' | 'failed'; lesson: 'pending' | 'passed' | 'failed'; visual: 'pending' | 'passed' | 'failed'; classroom: 'pending' | 'passed' | 'failed' };
}

export interface Lesson {
  schemaVersion: typeof LESSON_SCHEMA_VERSION;
  id: LessonId;
  courseId: CourseId;
  bookId: BookId;
  chapterId: ChapterId;
  title: string;
  language: { source: 'english'; target: 'malayalam' };
  teachingMode: 'two-pass';
  paragraphs: Paragraph[];
  metadata?: Record<string, unknown>;
}

export function isLesson(value: unknown): value is Lesson {
  if (!value || typeof value !== 'object') return false;
  const lesson = value as Partial<Lesson>;
  return lesson.schemaVersion === LESSON_SCHEMA_VERSION && typeof lesson.id === 'string' && Array.isArray(lesson.paragraphs);
}
