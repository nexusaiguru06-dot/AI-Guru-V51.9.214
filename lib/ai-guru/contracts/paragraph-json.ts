import type { Lesson, MathParagraphArtifact } from './lesson-json';
import type { Paragraph, Problem, VisualStep, AudioCue } from './lesson-json';
import type { ParagraphId } from './ids';

export type ParagraphState = Paragraph['state'];

export interface ParagraphContext {
  lessonId: Lesson['id'];
  paragraph: Paragraph;
  previousParagraphId?: ParagraphId;
  nextParagraphId?: ParagraphId;
  currentProblemId?: Problem['id'];
}


export interface ParagraphArtifact {
  paragraphId: ParagraphId;
  sourcePage: number;
  referenceImage: string;
  visualSteps: VisualStep[];
  audioCues: AudioCue[];
  problems: Problem[];
  math?: MathParagraphArtifact;
}

export function getParagraph(lesson: Lesson, paragraphId: ParagraphId): Paragraph | undefined {
  return lesson.paragraphs.find((p) => p.id === paragraphId);
}

export function cloneParagraph(lesson: Lesson, paragraphId: ParagraphId, patch: Partial<Paragraph>): Lesson {
  return {
    ...lesson,
    paragraphs: lesson.paragraphs.map((p) => p.id === paragraphId ? { ...p, ...patch, id: p.id } : p),
  };
}
