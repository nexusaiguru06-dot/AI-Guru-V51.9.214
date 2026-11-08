/**
 * Moves the teacher's DNA choices between the teacher screen and the classroom (V51.9.63).
 * The classroom pulls once before it plans a lesson; the teacher screen pushes after every change.
 * Any failure (offline, no server) leaves the local copy as it is.
 */
import { allPins, mergePins, type TeacherPin } from '../motion-class/dna/teacher-dna';
import { learnedDnas, saveLearned, removeLearned, type LearnedDna } from '../motion-class/dna/learned';

let pulled: Promise<void> | null = null;

export const teacherTemplates = (): LearnedDna[] => learnedDnas().filter((d) => d.source === 'teacher-video');

export function pullTeacherDna(force = false): Promise<void> {
  if (pulled && !force) return pulled;
  pulled = (async () => {
    try {
      const res = await Promise.race([fetch('/api/ai-guru/teacher-dna', { cache: 'no-store' }), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))]);
      if (!res.ok) return;
      const j = (await res.json()) as { pins: TeacherPin[]; templates: LearnedDna[] };
      mergePins(j.pins ?? []);
      for (const t of j.templates ?? []) if (t.source === 'teacher-video') saveLearned(t);
    } catch { /* offline: use what this device has */ }
  })();
  return pulled;
}

export async function pushTeacherDna(): Promise<boolean> {
  try {
    const res = await fetch('/api/ai-guru/teacher-dna', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pins: allPins(), templates: teacherTemplates() }) });
    return res.ok;
  } catch { return false; }
}

export async function deleteTeacherTemplate(id: string): Promise<boolean> {
  removeLearned(id);
  return pushTeacherDna();
}
