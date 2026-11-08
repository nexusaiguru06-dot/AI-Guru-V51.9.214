import type { AIGuruLesson, ParagraphTeachingUnit } from './types';

export interface LessonDiagnostic { path: string; message: string; severity: 'error' | 'warning'; }

export function validateParagraph(unit: ParagraphTeachingUnit): LessonDiagnostic[] {
  const d: LessonDiagnostic[] = [];
  if (!unit.id) d.push({ path: 'id', message: 'Missing paragraph id', severity: 'error' });
  if (!unit.source.text.trim()) d.push({ path: 'source.text', message: 'Source paragraph is empty', severity: 'error' });
  if (!unit.source.pageImage) d.push({ path: 'source.pageImage', message: 'Reference page image is missing', severity: 'error' });
  if (!Number.isInteger(unit.source.pageNumber) || unit.source.pageNumber < 1) d.push({ path: 'source.pageNumber', message: 'Invalid source page number', severity: 'error' });
  if (!unit.english.text.trim()) d.push({ path: 'english.text', message: 'English explanation is empty', severity: 'error' });
  if (!unit.malayalam.text.trim()) d.push({ path: 'malayalam.text', message: 'Malayalam translation is empty', severity: 'error' });
  if (unit.english.captions) {
    for (const action of unit.english.visuals) {
      if (!unit.english.captions[action.id]?.trim()) d.push({ path: `english.captions.${action.id}`, message: 'Missing English step caption', severity: 'error' });
    }
  }
  if (unit.malayalam.captions) {
    for (const action of unit.english.visuals) {
      if (!unit.malayalam.captions[action.id]?.trim()) d.push({ path: `malayalam.captions.${action.id}`, message: 'Missing Malayalam step caption for shared visual', severity: 'error' });
    }
  }
  if (!unit.verified) d.push({ path: 'verified', message: 'Math/lesson verification has not passed', severity: 'warning' });
  for (const cue of unit.cues) {
    if (cue.startMs < 0) d.push({ path: `cues.${cue.id}.startMs`, message: 'Cue cannot start before zero', severity: 'error' });
    if (cue.endMs != null && cue.endMs < cue.startMs) d.push({ path: `cues.${cue.id}.endMs`, message: 'Cue end precedes cue start', severity: 'error' });
  }
  return d;
}

export function validateLesson(lesson: AIGuruLesson): LessonDiagnostic[] {
  const d: LessonDiagnostic[] = [];
  if (lesson.schemaVersion !== '1.0') d.push({ path: 'schemaVersion', message: 'Unsupported lesson schema version', severity: 'error' });
  if (!lesson.paragraphs.length) d.push({ path: 'paragraphs', message: 'Lesson has no paragraphs', severity: 'error' });
  const sorted = [...lesson.paragraphs].sort((a, b) => a.source.paragraphIndex - b.source.paragraphIndex);
  if (lesson.teachingMode === 'two-pass') {
    for (const p of lesson.paragraphs) {
      const enIds = p.english.visuals.map(v => v.id);
      const mlIds = p.malayalam.visuals.map(v => v.id);
      if (mlIds.length && JSON.stringify(enIds) !== JSON.stringify(mlIds)) d.push({ path: `paragraphs.${p.id}.visuals`, message: 'Two-pass lesson must replay the identical visual sequence in English and Malayalam', severity: 'error' });
      if (!p.english.captions || !p.malayalam.captions) d.push({ path: `paragraphs.${p.id}.captions`, message: 'Two-pass lesson requires captions for both language tracks', severity: 'error' });
    }
  }
  sorted.forEach((p, i) => {
    if (p.source.paragraphIndex !== i) d.push({ path: `paragraphs.${p.id}.paragraphIndex`, message: `Expected contiguous paragraph index ${i}`, severity: 'warning' });
    d.push(...validateParagraph(p).map(x => ({ ...x, path: `paragraphs.${p.id}.${x.path}` })));
  });
  return d;
}
