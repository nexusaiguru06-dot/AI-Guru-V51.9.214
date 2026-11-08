import type { AIGuruLesson, ParagraphSource, VisualAction } from './types';

/** Creates a safe importable lesson draft from extracted source text. It deliberately does not invent translations. */
export function createLessonDraft(sources: ParagraphSource[], title = 'AI Guru Imported Lesson'): AIGuruLesson {
  return {
    schemaVersion: '1.0', id: `lesson:${Date.now()}`, title,
    language: { source: 'english', target: 'malayalam' },
    paragraphs: sources.map((source) => ({
      id: `paragraph:${source.paragraphIndex}`,
      source,
      english: { text: '', visuals: [] as VisualAction[] },
      malayalam: { text: '', visuals: [] as VisualAction[] },
      cues: [], verified: false,
    })),
  };
}
