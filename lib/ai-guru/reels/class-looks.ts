/**
 * V51.9.105 — which looks classmates used today, so a class's reels spread across the looks.
 *
 * When a student downloads a reel, the phone tells the AI Guru server its look (only the look's id: no video, no
 * picture). When planning a new reel, the phone asks for today's counts in the student's class (the student's own
 * reels left out: their phone already avoids its last 5 looks). A file on the AI Guru PC; no AI, no cost.
 * Only today (India time) is kept.
 */

import { docs } from '../storage';
import { LOOKS } from './motion/look';

const KEY = 'data/ai-guru/reel-looks/today.json';

/** looks downloaded today: class → student → look ids (newest last, at most 10 per student). */
export interface ClassLooksDay { day: string; classes: Record<string, Record<string, string[]>> }

export const istToday = (now: Date = new Date()) => new Date(now.getTime() + 19_800_000).toISOString().slice(0, 10);
export const MAX_PER_STUDENT = 10;

/** Adds one download (pure). A new day starts empty; unknown looks are ignored. */
export function addLook(d: ClassLooksDay | null, day: string, classId: string, studentId: string, look: string): ClassLooksDay {
  const out: ClassLooksDay = d && d.day === day ? d : { day, classes: {} };
  if (!LOOKS.some((l) => l.id === look)) return out;
  const cls = (out.classes[classId] ??= {});
  cls[studentId] = [...(cls[studentId] ?? []), look].slice(-MAX_PER_STUDENT);
  return out;
}

/** Today's count per look in a class, the asking student's own downloads left out (pure). */
export function classCounts(d: ClassLooksDay | null, day: string, classId: string, except?: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (!d || d.day !== day) return out;
  for (const [sid, looks] of Object.entries(d.classes[classId] ?? {})) {
    if (sid === except) continue;
    for (const l of new Set(looks)) out[l] = (out[l] ?? 0) + 1; // a student counts once per look
  }
  return out;
}

async function read(): Promise<ClassLooksDay | null> {
  try { return await docs.get<ClassLooksDay>(KEY); } catch { return null; }
}

export function recordLook(classId: string, studentId: string, look: string, now: Date = new Date()): Promise<void> {
  return docs.update<ClassLooksDay, void>(KEY, (cur) => ({ value: addLook(cur, istToday(now), classId, studentId, look), result: undefined }));
}

export async function todayCounts(classId: string, studentId: string, now: Date = new Date()): Promise<Record<string, number>> {
  return classCounts(await read(), istToday(now), classId, studentId);
}
