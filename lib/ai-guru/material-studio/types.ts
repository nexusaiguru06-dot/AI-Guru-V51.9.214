import type { VisualAction } from '../lesson/types';

export const MATERIAL_TYPES = [
  'mcq', 'qa', 'revision-notes', 'flashcards', 'worksheet', 'question-paper',
  'ppt', 'mind-map', 'whiteboard-notes', 'knowledge-base', 'problems-formulae',
] as const;
export type MaterialType = typeof MATERIAL_TYPES[number];

export interface IndexedSource {
  id: string;
  page: number;
  paragraph: number;
  text: string;
  title?: string;
  chapterId?: string;
  chapterTitle?: string;
}

export interface BookChapter {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  sourceIds: string[];
  summary?: string;
}

export interface IndexedDocument {
  id: string;
  fileName: string;
  mimeType: string;
  pageCount: number;
  indexedAt: string;
  parser: string;
  subject: string;
  grade: string;
  syllabus: string;
  sourceLanguage: string;
  teachingLanguage: string;
  chapters: BookChapter[];
  sources: IndexedSource[];
  /** V51.9.93: parts (1–5) anyone may study without paying; empty/absent = the school-wide default (Part 1). Set by the admin. */
  freeParts?: number[];
  /** V51.9.205: this PDF is one part of a bigger book (e.g. Part 1 of 5, pages 1–38 of 190); all of it is free. */
  excerpt?: { part: number; of: number; fromPage: number; toPage: number; totalPages: number };
  /** V51.9.95: who uploaded the book, the PDF's SHA-256 (the same PDF is indexed once), and the admin's hide switch. */
  owner?: { kind: 'admin' | 'student' | 'guest'; id?: string; name?: string; via?: 'studio' | 'cloud' };
  pdfHash?: string;
  hidden?: boolean;
}

export interface MathTeachingStep {
  id: string;
  before: string;
  operation: string;
  after: string;
  captionEnglish: string;
  captionMalayalam?: string;
  visualIds: string[];
  verified: boolean;
  source?: 'mathsteps' | 'sympy' | 'mathjs' | 'gemini' | 'manual';
}

export interface BilingualTeachingPass {
  sourceText: string;
  englishExplanation: string;
  translatedExplanation: string;
  visuals: VisualAction[];
  sourceIds: string[];
}

export interface StudyMaterialSection {
  id: string;
  heading: string;
  content: string;
  contentTranslation?: string;
  activity?: string;
  activityTranslation?: string;
  answer?: string;
  answerTranslation?: string;
  options?: string[];
  translatedOptions?: string[];
  sourceIds: string[];
  sourceText?: string;
  teachingPass?: BilingualTeachingPass;
  mathSteps?: MathTeachingStep[];
  visuals: VisualAction[];
  whiteboardCommands?: unknown;
  notes?: string;
}

export interface StudyMaterial {
  id: string;
  documentId: string;
  type: MaterialType;
  title: string;
  overview: string;
  overviewTranslation?: string;
  teachingLanguage: string;
  materialLanguages: string[];
  chapterIds?: string[];
  sections: StudyMaterialSection[];
  sources: IndexedSource[];
  qa: { status: 'passed'|'failed'|'needs_review'; score: number; issues: string[]; checkedAt: string };
  model: string;
  createdAt: string;
  updatedAt: string;
  /** V51.9.95: who made it (admin or a student; in Material Studio with their own key, or on the AI Guru cloud). */
  owner?: { kind: 'admin' | 'student' | 'guest'; id?: string; name?: string; via?: 'studio' | 'cloud' };
  hidden?: boolean;
  /** V51.9.193: made or edited by a school's teacher — seen only by that school (its students, its teachers, the office). */
  school?: string;
  /** …the AI material it replaces for that school's students (an edited copy), if any. */
  basedOn?: string;
  teacher?: { id: string; name: string; subject: string };
}
