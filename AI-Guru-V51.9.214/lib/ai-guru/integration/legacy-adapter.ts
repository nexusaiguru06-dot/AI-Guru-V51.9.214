import type { AIGuruLesson as LegacyLesson, ParagraphSource as LegacySource, ParagraphTeachingUnit as LegacyParagraph, VisualAction as LegacyVisualAction } from '../lesson/types';
import type { Lesson, Paragraph, SourceReference, VisualStep, AudioCue, ParagraphId } from '../contracts';
import { ids } from '../contracts';

/** Bridges the existing v43 lesson contract to the canonical multi-agent contract. */
export function legacySourceToCanonical(source: LegacySource): SourceReference {
  return {
    bookId: ids.book(source.bookId),
    chapterId: ids.chapter(`${source.bookId}-${source.chapterIndex}`),
    pageNumber: source.pageNumber,
    pageImage: source.pageImage,
    text: source.text,
    boundingBox: source.boundingBox,
    sourceLocator: `book:${source.bookId}/page:${source.pageNumber}/paragraph:${source.paragraphIndex}`,
  };
}

function legacyVisualToStep(v: LegacyVisualAction, paragraphId: string, order: number): VisualStep {
  return {
    id: ids.visualStep(paragraphId, order),
    paragraphId: paragraphId as ParagraphId,
    order,
    purpose: `Visual teaching action ${order + 1}`,
    action: v,
    targetIds: 'targetId' in v && typeof v.targetId === 'string' ? [v.targetId] : [],
  };
}

function legacyCueToAudioCue(cue: LegacyParagraph['cues'][number], paragraphId: string, index: number): AudioCue {
  return {
    id: ids.audioCue(paragraphId, index),
    paragraphId: paragraphId as ParagraphId,
    language: cue.track,
    trigger: cue.trigger,
    triggerText: cue.triggerText,
    startMs: cue.startMs,
    endMs: cue.endMs,
    visualStepId: cue.action?.id ? ids.visualStep(paragraphId, Math.max(0, index)) : undefined,
  };
}

export function legacyParagraphToCanonical(p: LegacyParagraph, index: number): Paragraph {
  const lessonSeed = p.source.bookId + '-lesson';
  const paragraphId = ids.paragraph(lessonSeed, index);
  const visualSteps = p.english.visuals.map((v, i) => legacyVisualToStep(v, paragraphId, i));
  const audioCues = p.cues.map((c, i) => legacyCueToAudioCue(c, paragraphId, i));
  return {
    id: paragraphId,
    index,
    source: legacySourceToCanonical(p.source),
    teachingIntent: 'Teach and explain the supplied textbook paragraph clearly.',
    teachingStrategy: p.teachingStrategy,
    explanation: { english: p.english.text, malayalam: p.malayalam.text },
    visualSteps,
    audioCues,
    checkpoints: [],
    problems: [],
    state: 'idle',
    qa: {
      content: 'pending', lesson: 'pending', visual: 'pending', classroom: 'pending',
    },
  };
}

export function legacyLessonToCanonical(lesson: LegacyLesson): Lesson {
  const first = lesson.paragraphs[0]?.source;
  const bookId = ids.book(first?.bookId ?? lesson.id);
  const chapterId = ids.chapter(`${first?.bookId ?? lesson.id}-${first?.chapterIndex ?? 0}`);
  const courseId = ids.course(`${first?.bookId ?? lesson.id}-course`);
  return {
    schemaVersion: '2.0',
    id: ids.lesson(lesson.id),
    courseId,
    bookId,
    chapterId,
    title: lesson.title,
    language: { source: 'english', target: 'malayalam' },
    teachingMode: 'two-pass',
    paragraphs: lesson.paragraphs.map(legacyParagraphToCanonical),
  };
}

function stepToLegacyVisual(step: VisualStep): LegacyVisualAction | null {
  const action = step.action as any;
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') return null;
  if (['write','latex','shape','line','chart','highlight','move','transform','erase','pause'].includes(action.type)) {
    return { ...action, id: step.id } as LegacyVisualAction;
  }
  return null;
}

export function canonicalLessonToLegacy(lesson: Lesson, original?: LegacyLesson): LegacyLesson {
  const originalParagraphs = original?.paragraphs ?? [];
  return {
    schemaVersion: '1.0',
    id: original?.id ?? lesson.id,
    title: lesson.title,
    teachingMode: 'two-pass',
    language: { source: 'english', target: 'malayalam' },
    paragraphs: lesson.paragraphs.map((p, i) => {
      const old = originalParagraphs[i];
      const source: LegacySource = old?.source ?? {
        bookId: p.source.bookId,
        chapterIndex: 0,
        paragraphIndex: p.index,
        pageNumber: p.source.pageNumber,
        text: p.source.text,
        pageImage: String(p.source.pageImage),
        boundingBox: p.source.boundingBox,
      };
      const visuals = p.visualSteps.map(stepToLegacyVisual).filter(Boolean) as LegacyVisualAction[];
      const visualById = new Map(p.visualSteps.map(step => [step.id, step]));
      const cues = p.audioCues.map((cue, cueIndex) => {
        const step = cue.visualStepId ? visualById.get(cue.visualStepId) : undefined;
        const action = stepToLegacyVisual(step ?? p.visualSteps[cueIndex] ?? p.visualSteps[0]);
        return action ? {
          id: cue.id,
          paragraphId: old?.id ?? p.id,
          track: cue.language,
          startMs: cue.startMs,
          endMs: cue.endMs,
          trigger: cue.trigger,
          triggerText: cue.triggerText,
          action,
        } : null;
      }).filter(Boolean) as LegacyParagraph['cues'];
      return {
        id: old?.id ?? p.id,
        teachingStrategy: p.teachingStrategy,
        source,
        english: { text: p.explanation.english, visuals },
        malayalam: { text: p.explanation.malayalam, visuals: visuals.map(v => ({ ...v })) },
        cues,
        verified: old?.verified ?? true,
      };
    }),
  };
}
