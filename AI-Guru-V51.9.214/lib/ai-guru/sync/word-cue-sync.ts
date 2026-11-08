import type { AudioCue, Language, Lesson, Paragraph } from '../contracts';
import { alignCuesToWords, buildWordCues } from '../cues/engine';

export interface SyncFailure { paragraphId: string; cueId: string; language: Language; reason: string; }
export interface SyncResult { lesson: Lesson; failures: SyncFailure[]; alignedCount: number; }

/** Aligns existing paragraph cues against real word boundaries. No duration-based timing is generated. */
export function synchronizeLessonWords(lesson: Lesson, boundariesByParagraph: Record<string, { language: Language; word: string; startMs: number; endMs?: number }[]>): SyncResult {
  const failures: SyncFailure[] = [];
  let alignedCount = 0;
  const paragraphs = lesson.paragraphs.map(p => {
    const boundaries = boundariesByParagraph[p.id] ?? [];
    const byLang = (['english', 'malayalam'] as const).flatMap(language => {
      const words = buildWordCues(p.explanation[language], boundaries.filter(b => b.language === language));
      return p.audioCues.filter(c => c.language === language).map(c => ({ cue: c, words }));
    });
    let audioCues: AudioCue[] = p.audioCues.map(c => ({ ...c }));
    for (const { cue, words } of byLang) {
      const aligned = alignCuesToWords([cue], words)[0];
      const changed = aligned.startMs !== cue.startMs || aligned.endMs !== cue.endMs;
      if (changed) { alignedCount++; audioCues = audioCues.map(c => c.id === cue.id ? aligned : c); }
      else if (cue.trigger !== 'time' && cue.triggerText) failures.push({ paragraphId: p.id, cueId: cue.id, language: cue.language, reason: `No word/phrase boundary matched "${cue.triggerText}"` });
    }
    return { ...p, audioCues };
  });
  return { lesson: { ...lesson, paragraphs }, failures, alignedCount };
}
