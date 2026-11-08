import type { MathEngineRenderResult, MathEngineRenderer } from './math-engine-adapter';
import type { GuruScene } from './scene-contracts';
import {
  buildMathEngineAnimationPayload,
  compileCueDrivenAnimation,
  type CueDrivenAnimationOptions,
  type CueDrivenAnimationPlan,
} from './cue-driven-animation';

export interface CueDrivenMathEngineRenderer extends MathEngineRenderer {
  renderCueDrivenScene(
    scene: GuruScene,
    options?: CueDrivenAnimationOptions & { width?: number; height?: number; fps?: number; outputUri?: string },
  ): Promise<{ animation: CueDrivenAnimationPlan; result: MathEngineRenderResult }>;
}

export interface CueDrivenMathEngineClient {
  renderCueDriven(request: {
    sceneId: string;
    lessonId: string;
    durationMs: number;
    domain: string;
    grade: number;
    objects: GuruScene['objects'];
    verificationRefs: string[];
    animation: ReturnType<typeof buildMathEngineAnimationPayload>;
    outputUri?: string;
    width?: number;
    height?: number;
    fps?: number;
  }): Promise<MathEngineRenderResult>;
}

/**
 * Adapter that makes the Sprint-G cue timeline an explicit input to the
 * deterministic Math Engine. The existing MathEngineAdapter remains usable
 * for non-cue-driven rendering.
 */
export class CueDrivenMathEngineAdapter implements CueDrivenMathEngineRenderer {
  constructor(private readonly client: CueDrivenMathEngineClient, private readonly base: MathEngineRenderer) {}

  renderScene(scene: GuruScene, options?: { outputUri?: string; width?: number; height?: number; fps?: number }): Promise<MathEngineRenderResult> {
    return this.base.renderScene(scene, options);
  }

  async renderCueDrivenScene(
    scene: GuruScene,
    options: CueDrivenAnimationOptions & { width?: number; height?: number; fps?: number; outputUri?: string } = {},
  ): Promise<{ animation: CueDrivenAnimationPlan; result: MathEngineRenderResult }> {
    const animation = compileCueDrivenAnimation(scene, options);
    const result = await this.client.renderCueDriven({
      sceneId: scene.id,
      lessonId: scene.lessonId,
      durationMs: scene.durationMs,
      domain: String(scene.domain),
      grade: scene.grade,
      objects: scene.objects,
      verificationRefs: scene.verificationRefs,
      animation: buildMathEngineAnimationPayload(animation),
      outputUri: options.outputUri,
      width: options.width,
      height: options.height,
      fps: options.fps,
    });
    return { animation, result };
  }
}
