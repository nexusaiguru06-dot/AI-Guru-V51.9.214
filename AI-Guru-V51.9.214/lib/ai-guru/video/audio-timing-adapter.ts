import type { AudioCue, GuruScene, GuruLanguage } from './scene-contracts';

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
  tokenIndex?: number;
}

export interface SpeechSynthesisResult {
  assetUri: string;
  durationMs: number;
  language: GuruLanguage;
  wordTimings: WordTiming[];
  provider: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface SpeechTimingEngine {
  synthesize(input: {
    text: string;
    language: GuruLanguage;
    sceneId: string;
    outputUri?: string;
  }): Promise<SpeechSynthesisResult>;
}

export interface AudioTimingOptions {
  /** If true, every cue word must be represented by a timing entry. */
  strictWordCoverage?: boolean;
  /** Maximum allowed drift between generated speech and scene duration. */
  maxDurationDriftMs?: number;
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[.,!?;:"'“”‘’()\[\]{}]/g, '')
    .trim();
}

function expectedWords(cues: AudioCue[]): AudioCue[] {
  return cues.filter((cue) => cue.word && cue.word.trim().length > 0);
}

/**
 * Converts provider word timings into the renderer-neutral scene audio cues.
 * The provider owns speech synthesis; HyperFrames owns final placement.
 */
export function synchronizeSpeechToScene(
  scene: GuruScene,
  speech: SpeechSynthesisResult,
  options: AudioTimingOptions = {},
): AudioCue[] {
  if (speech.language !== scene.language) {
    throw new Error(`Speech language mismatch for ${scene.id}: ${speech.language} != ${scene.language}`);
  }
  if (!Number.isFinite(speech.durationMs) || speech.durationMs <= 0) {
    throw new Error(`Invalid speech duration for ${scene.id}`);
  }
  if (speech.durationMs > scene.durationMs + (options.maxDurationDriftMs ?? 0)) {
    throw new Error(`Speech exceeds scene duration for ${scene.id}: ${speech.durationMs}ms > ${scene.durationMs}ms`);
  }

  const sourceWordCues = expectedWords(scene.audioCues);
  const timings = [...speech.wordTimings].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  let cursor = 0;
  const synchronized: AudioCue[] = [];

  for (const cue of sourceWordCues) {
    const wanted = normalize(cue.word!);
    let match = -1;
    for (let i = cursor; i < timings.length; i += 1) {
      if (normalize(timings[i].word) === wanted) {
        match = i;
        break;
      }
    }
    if (match < 0) {
      if (options.strictWordCoverage ?? true) {
        throw new Error(`Speech timing is missing cue word "${cue.word}" in scene ${scene.id}`);
      }
      synchronized.push(cue);
      continue;
    }
    const timing = timings[match];
    cursor = match + 1;
    if (timing.startMs < 0 || timing.endMs < timing.startMs) {
      throw new Error(`Invalid word timing for "${timing.word}" in scene ${scene.id}`);
    }
    synchronized.push({
      ...cue,
      atMs: timing.startMs,
      durationMs: Math.max(0, timing.endMs - timing.startMs),
      tokenIndex: timing.tokenIndex ?? cue.tokenIndex,
    });
  }

  // Preserve non-word audio cues exactly; only word cues are retimed.
  const wordIds = new Set(sourceWordCues.map((cue) => cue.id));
  return [
    ...scene.audioCues.filter((cue) => !wordIds.has(cue.id)),
    ...synchronized,
  ].sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id));
}

export function applySpeechTimings(scene: GuruScene, speech: SpeechSynthesisResult, options?: AudioTimingOptions): GuruScene {
  const synchronized = synchronizeSpeechToScene(scene, speech, options);
  const durationMs = Math.max(scene.durationMs, speech.durationMs);
  const extended = durationMs !== scene.durationMs;
  return {
    ...scene,
    durationMs,
    audioCues: synchronized,
    generative: { ...scene.generative, durationMs: Math.max(scene.generative.durationMs, durationMs) },
    layers: scene.layers.map((layer) => ({ ...layer, endMs: Math.max(layer.endMs, durationMs) })),
    metadata: {
      ...(scene.metadata ?? {}),
      speechProvider: speech.provider,
      speechAssetUri: speech.assetUri,
      speechDurationMs: speech.durationMs,
      speechExtendedScene: extended,
    },
  };
}
