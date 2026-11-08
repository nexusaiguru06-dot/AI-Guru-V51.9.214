import type { GuruScene } from '../scene-contracts';
import type { VideoDNASelection } from '../video-dna-v2';
import type { LTXRetakeRequest, LTXAssetInput } from './LTXRequest';
import { buildLTXRequest } from './LTX2AdapterRequest';

export interface RetakeInput {
  scene: GuruScene;
  sourceVideo: LTXAssetInput;
  startMs: number;
  endMs: number;
  selection?: VideoDNASelection;
  seed?: number;
}

export function buildRetakeRequest(input: RetakeInput): LTXRetakeRequest {
  if (input.startMs < 0 || input.endMs <= input.startMs || input.endMs > input.scene.durationMs) {
    throw new Error(`Invalid LTX retake range: ${input.startMs}-${input.endMs}ms for ${input.scene.durationMs}ms scene`);
  }

  return {
    ...buildLTXRequest(input.scene, input.selection, {
      operation: 'retake',
      seed: input.seed,
    }),
    operation: 'retake',
    sourceVideo: input.sourceVideo,
    startMs: input.startMs,
    endMs: input.endMs,
  };
}
