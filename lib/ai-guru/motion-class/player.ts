'use client';

/**
 * Prepares class segments for playback/export: voice clips through the
 * classroom TTS chain, then the reel re-timed to the voice.
 */

import { clipMs, mixReelAudio, voiceScript, makeReel, type MotionReel, type VoiceClips } from '../reels/motion';
import { synthesizeVoiceClips } from '../reels/motion/voice';
import { segmentReel, type ClassSegment } from './class';

export interface PreparedSegment {
  segment: ClassSegment;
  reel: MotionReel;
  clips: VoiceClips | null;
  voiceError?: string;
}

export async function prepareSegment(seg: ClassSegment, voice: boolean, signal?: AbortSignal): Promise<PreparedSegment> {
  const silent = segmentReel(seg);
  if (!voice) return { segment: seg, reel: silent, clips: null };
  const script = voiceScript(silent);
  if (!script.length) return { segment: seg, reel: silent, clips: null };
  const res = await synthesizeVoiceClips(script, seg.lang, { signal });
  if (!res.clips.size) return { segment: seg, reel: silent, clips: null, voiceError: res.lastError || 'no voice' };
  const reel = segmentReel(seg, (t) => (res.clips.has(t) ? clipMs(res.clips.get(t)!) : undefined));
  return { segment: seg, reel, clips: res.clips, voiceError: res.failed.length ? `${res.failed.length} line(s) silent: ${res.lastError ?? ''}` : undefined };
}

/** Several prepared segments → one reel + one clip map (for a section MP4). */
export function joinSegments(title: string, list: PreparedSegment[]): { reel: MotionReel; clips: VoiceClips } {
  const clips: VoiceClips = new Map();
  for (const p of list) for (const [k, v] of p.clips ?? []) clips.set(k, v);
  return { reel: makeReel(title, list.flatMap((p) => p.reel.parts)), clips };
}

export function segmentAudio(p: PreparedSegment): Float32Array<ArrayBuffer> {
  return mixReelAudio(p.reel, p.clips);
}
