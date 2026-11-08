/**
 * Subtitle files for a reel (.srt for YouTube/Facebook, .vtt for the web).
 * Timed to the voice when there is one, otherwise to the on-screen captions.
 * With a second-language line, both lines go into each cue.
 */

import type { MotionReel } from './reel';

export interface SubtitleCue {
  start: number;
  end: number;
  lines: string[];
}

export function reelSubtitleCues(reel: MotionReel, o: { both?: boolean } = {}): SubtitleCue[] {
  const out: SubtitleCue[] = [];
  let base = 0;
  for (const p of reel.parts) {
    for (const c of p.captions) {
      const start = base + (c.voiceT0 ?? c.t0);
      const end = base + (c.voiceT0 !== undefined && c.voiceMs ? Math.max(c.voiceT0 + c.voiceMs, c.t0 + 1200) : c.t1);
      out.push({ start, end: Math.min(end, base + c.t1), lines: o.both !== false && c.sub ? [c.text, c.sub] : [c.text] });
    }
    base += p.durationMs;
  }
  return out;
}

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, '0');
function stamp(ms: number, sep: ',' | '.') {
  const t = Math.max(0, Math.round(ms));
  return `${pad(t / 3600000)}:${pad((t / 60000) % 60)}:${pad((t / 1000) % 60)}${sep}${pad(t % 1000, 3)}`;
}

export function toSrt(cues: SubtitleCue[]): string {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.lines.join('\n')}\n`).join('\n');
}

export function toVtt(cues: SubtitleCue[]): string {
  return `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.lines.join('\n')}\n`).join('\n')}`;
}
