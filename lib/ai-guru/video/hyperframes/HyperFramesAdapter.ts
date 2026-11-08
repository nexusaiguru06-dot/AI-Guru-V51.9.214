import type {
  CompositionAsset,
  CompositionEngine,
  CompositionJobResult,
  CompositionRenderOptions,
} from '../composition-engine';
import type { GuruLesson, GuruScene } from '../scene-contracts';
import type { HyperFramesClient } from './HyperFramesClient';
import { buildHyperFramesLessonRequest, buildHyperFramesSceneRequest } from './HyperFramesRequest';

/**
 * Deterministic composition adapter.
 *
 * HyperFrames is downstream of both the verified math renderer and LTX-2.
 * It never invents mathematical objects; it only assembles supplied assets,
 * camera states, audio/cue timing and authored layer order.
 */
export class HyperFramesAdapter implements CompositionEngine {
  constructor(private readonly client: HyperFramesClient) {}

  async renderScene(
    scene: GuruScene,
    assets: CompositionAsset[] = [],
    options: CompositionRenderOptions = {},
  ): Promise<CompositionJobResult> {
    return this.client.submit(buildHyperFramesSceneRequest(scene, assets, options));
  }

  async renderLesson(
    lesson: GuruLesson,
    assets: CompositionAsset[] = [],
    options: CompositionRenderOptions = {},
  ): Promise<CompositionJobResult> {
    return this.client.submit(buildHyperFramesLessonRequest(lesson, assets, options));
  }
}
