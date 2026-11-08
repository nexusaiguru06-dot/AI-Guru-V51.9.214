/**
 * Timeline check (V51.9.50). A lesson picture should not stand still for long: this finds the stretches in
 * which nothing on the board moves, and how long the finished picture rests after its last movement.
 * The idea of both limits comes from "motionmaxxing" (Apache-2.0, see NOTICE-motion-core.md); the code is ours.
 * Spoken captions legitimately sit on a still picture while they are read, so the still limit is the length of a
 * short caption; longer than that the viewer is waiting for nothing.
 */

import { motionIntervals, type MotionScene } from '../../reels/motion/engine';

export const MAX_STILL_MS = 4200;
export const MAX_END_HOLD_MS = 1400;
/** How long the last caption may stay up after it appears before the rest counts (ms). */
export const CAPTION_READ_MS = 2400;

export interface TimelineReport {
  ok: boolean;
  stillGaps: Array<{ fromMs: number; toMs: number }>;
  endHoldMs: number;
}

/** The still gaps longer than `maxStillMs` and the rest at the end, from every movement in the scene. */
export function timelineReport(scene: MotionScene, o: { maxStillMs?: number; maxEndHoldMs?: number } = {}): TimelineReport {
  const maxStill = o.maxStillMs ?? MAX_STILL_MS;
  const maxHold = o.maxEndHoldMs ?? MAX_END_HOLD_MS;
  const iv = motionIntervals(scene.items, [scene.camY, scene.camH, scene.camX]).sort((a, b) => a[0] - b[0]);
  const gaps: Array<{ fromMs: number; toMs: number }> = [];
  let cursor = 0;
  for (const [t0, t1] of iv) {
    if (t0 - cursor > maxStill) gaps.push({ fromMs: cursor, toMs: t0 });
    cursor = Math.max(cursor, t1);
  }
  // The last caption is allowed the time it needs to be read (up to CAPTION_READ_MS after it starts).
  const last = scene.captions[scene.captions.length - 1];
  const floor = Math.max(cursor, last ? last.t0 + CAPTION_READ_MS : 0);
  const endHoldMs = Math.max(0, scene.durationMs - floor);
  return { ok: !gaps.length && endHoldMs <= maxHold, stillGaps: gaps, endHoldMs };
}

/** Sentences the planner can act on (empty when the timeline is fine). */
export function timelineProblems(scenes: MotionScene[]): string[] {
  const out: string[] = [];
  for (const sc of scenes) {
    const r = timelineReport(sc);
    for (const g of r.stillGaps) {
      if (out.length >= 2) break;
      out.push(`From ${(g.fromMs / 1000).toFixed(1)} s to ${(g.toMs / 1000).toFixed(1)} s nothing on the board moves; add a step that shows something or shorten the long step.`);
    }
    if (r.endHoldMs > MAX_END_HOLD_MS && out.length < 2) out.push(`The picture rests ${(r.endHoldMs / 1000).toFixed(1)} s after its last movement; end the unit sooner.`);
  }
  return out;
}
