export interface TtsWordTiming { word: string; startMs: number; endMs: number; source: 'provider' | 'measured-audio'; }

const tokenize = (text: string) => text.match(/[^\s]+/gu) ?? [];

/**
 * Creates word timing from the measured duration of the returned audio.
 * This is deliberately labelled measured-audio: the clip duration is real,
 * but individual word boundaries are estimated until a provider returns them.
 */
export function estimateWordTimings(text: string, durationMs: number): TtsWordTiming[] {
  const words = tokenize(String(text || '').trim());
  if (!words.length || !Number.isFinite(durationMs) || durationMs <= 0) return [];
  const weights = words.map(w => Math.max(1, w.replace(/[^\p{L}\p{N}]/gu, '').length));
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = 0;
  return words.map((word, index) => {
    const startMs = Math.round(cursor);
    cursor += durationMs * (weights[index] / total);
    const endMs = Math.round(index === words.length - 1 ? durationMs : cursor);
    return { word, startMs, endMs: Math.max(startMs + 1, endMs), source: 'measured-audio' as const };
  });
}

export function mergeProviderWordTimings(
  text: string,
  durationMs: number,
  providerWords?: Array<{ word: string; startMs: number; endMs?: number }>,
): TtsWordTiming[] {
  if (providerWords?.length) {
    return providerWords.map(w => ({
      word: String(w.word),
      startMs: Math.max(0, Number(w.startMs) || 0),
      endMs: Math.max((Number(w.startMs) || 0) + 1, Number(w.endMs) || (Number(w.startMs) || 0) + 120),
      source: 'provider' as const,
    }));
  }
  return estimateWordTimings(text, durationMs);
}
