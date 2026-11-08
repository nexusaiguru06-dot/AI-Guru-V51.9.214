import type { GuruScene } from '../scene-contracts';
import type { VideoDNASelection } from '../video-dna-v2';
import type { GenerativeVideoEngine, GenerativeVideoExtendInput, GenerativeVideoOptions, GenerativeVideoRetakeInput } from '../generative-video';
import type { LTXClient } from './LTXClient';
import type { LTXJobResult, LTXExtendRequest } from './LTXRequest';
import { buildLTXRequest } from './LTX2AdapterRequest';
import { buildRetakeRequest } from './LTXRetake';

export type LTX2GenerateOptions = GenerativeVideoOptions;

export type LTX2ExtendInput = GenerativeVideoExtendInput;

/**
 * Sprint-C LTX-2 adapter.
 *
 * This class deliberately speaks to an AI Guru LTX-2 bridge instead of
 * importing LTX Python internals into the Next.js app. The bridge can run the
 * official LTX-2 pipelines locally; the browser/server code remains renderer
 * neutral and mathematical truth remains outside LTX.
 */
export class LTX2Adapter implements GenerativeVideoEngine {
  constructor(private readonly client: LTXClient) {}

  async generate(
    scene: GuruScene,
    selection?: VideoDNASelection,
    options: LTX2GenerateOptions = {},
  ): Promise<LTXJobResult> {
    const request = buildLTXRequest(scene, selection, options);
    return this.client.submit(request);
  }

  async retake(input: GenerativeVideoRetakeInput): Promise<LTXJobResult> {
    const request = buildRetakeRequest(input);
    return this.client.retake(request);
  }

  async extend(input: LTX2ExtendInput): Promise<LTXJobResult> {
    if (input.extensionMs <= 0) throw new Error('LTX extension must be greater than zero');

    const base = buildLTXRequest(input.scene, input.selection, {
      operation: 'extend',
      seed: input.seed,
    });

    const request: LTXExtendRequest = {
      ...base,
      operation: 'extend',
      sourceVideo: input.sourceVideo,
      direction: input.direction,
      extensionMs: input.extensionMs,
    };

    return this.client.extend(request);
  }
}
