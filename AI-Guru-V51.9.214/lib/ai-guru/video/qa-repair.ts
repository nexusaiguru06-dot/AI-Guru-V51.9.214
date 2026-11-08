import type { GuruLesson, GuruScene } from './scene-contracts';
import type { VideoQAFinding } from './production-qa';

export interface VideoQARepairOptions { clampCues?: boolean; recomputeLessonDuration?: boolean; }
export interface VideoQARepairResult { lesson: GuruLesson; repaired: string[]; remainingFindings: VideoQAFinding[]; }

function repairScene(scene: GuruScene, repaired: string[], options: VideoQARepairOptions): GuruScene {
  let next = scene;
  if (options.clampCues !== false) {
    const audioCues = next.audioCues.map((cue) => ({ ...cue, atMs: Math.max(0, Math.min(next.durationMs, cue.atMs)), durationMs: cue.durationMs === undefined ? undefined : Math.max(0, Math.min(cue.durationMs, next.durationMs - Math.max(0, Math.min(next.durationMs, cue.atMs)))) }));
    const timelineCues = next.timelineCues.map((cue) => ({ ...cue, atMs: Math.max(0, Math.min(next.durationMs, cue.atMs)), durationMs: cue.durationMs === undefined ? undefined : Math.max(0, Math.min(cue.durationMs, next.durationMs - Math.max(0, Math.min(next.durationMs, cue.atMs)))) }));
    next = { ...next, audioCues, timelineCues };
    repaired.push(`clamped-cues:${scene.id}`);
  }
  return next;
}

/** Conservative repair: fixes mechanical timeline drift only; it never changes math objects/actions. */
export function repairVideoTimeline(lesson: GuruLesson, options: VideoQARepairOptions = {}): VideoQARepairResult {
  const repaired: string[] = [];
  const scenes = lesson.scenes.map((scene) => repairScene(scene, repaired, options));
  const totalDurationMs = options.recomputeLessonDuration === false ? lesson.totalDurationMs : scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
  if (totalDurationMs !== lesson.totalDurationMs) repaired.push('recomputed-lesson-duration');
  return { lesson: { ...lesson, scenes, totalDurationMs }, repaired, remainingFindings: [] };
}
