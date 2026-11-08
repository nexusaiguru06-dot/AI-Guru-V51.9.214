import type { CompositionAsset } from './composition-engine';
import type { GuruScene } from './scene-contracts';

export type MathRenderAssetType = 'image' | 'video' | 'data';

/** A renderer output owned by the deterministic Math Engine. */
export interface MathRenderAsset {
  id: string;
  uri: string;
  type: MathRenderAssetType;
  durationMs?: number;
  semanticObjectIds: string[];
  verificationRefs: string[];
  renderer: 'math-engine';
  deterministic: true;
  metadata?: Record<string, string | number | boolean>;
}

export interface MathEngineRenderResult {
  sceneId: string;
  durationMs: number;
  assets: MathRenderAsset[];
  verificationRefs: string[];
  metadata?: Record<string, string | number | boolean>;
}

export interface MathEngineRenderOptions {
  outputUri?: string;
  width?: number;
  height?: number;
  fps?: number;
}

export interface MathEngineRenderer {
  renderScene(scene: GuruScene, options?: MathEngineRenderOptions): Promise<MathEngineRenderResult>;
}

/**
 * Validates and normalizes deterministic Math Engine output before it is handed
 * to HyperFrames. This is the hard boundary that prevents an LTX asset from
 * masquerading as mathematical truth.
 */
export function validateMathEngineRender(scene: GuruScene, result: MathEngineRenderResult): MathEngineRenderResult {
  if (result.sceneId !== scene.id) {
    throw new Error(`Math render scene mismatch: expected ${scene.id}, received ${result.sceneId}`);
  }
  if (!Number.isFinite(result.durationMs) || result.durationMs <= 0) {
    throw new Error(`Math render duration must be positive for ${scene.id}`);
  }

  const sceneObjectIds = new Set(scene.objects.filter((object) => object.source === 'math-engine').map((object) => object.id));
  const requiredVerificationRefs = new Set(scene.verificationRefs);

  for (const asset of result.assets) {
    if (asset.renderer !== 'math-engine' || asset.deterministic !== true) {
      throw new Error(`Non-deterministic asset returned by Math Engine: ${asset.id}`);
    }
    if (!asset.id || !asset.uri) throw new Error(`Math Engine asset ${asset.id || '<unknown>'} is missing id/uri`);
    for (const objectId of asset.semanticObjectIds) {
      if (!sceneObjectIds.has(objectId)) {
        throw new Error(`Math asset ${asset.id} references unknown math object ${objectId}`);
      }
    }
    for (const verificationRef of asset.verificationRefs) {
      if (!requiredVerificationRefs.has(verificationRef)) {
        throw new Error(`Math asset ${asset.id} references unverified source ${verificationRef}`);
      }
    }
  }

  for (const verificationRef of result.verificationRefs) {
    if (!requiredVerificationRefs.has(verificationRef)) {
      throw new Error(`Math render returned verification ref not present on scene: ${verificationRef}`);
    }
  }

  return {
    ...result,
    assets: result.assets.map((asset) => ({
      ...asset,
      semanticObjectIds: [...new Set(asset.semanticObjectIds)],
      verificationRefs: [...new Set(asset.verificationRefs)],
    })),
    verificationRefs: [...new Set(result.verificationRefs)],
  };
}

export function mathRenderAssetsToCompositionAssets(result: MathEngineRenderResult): CompositionAsset[] {
  return result.assets.map((asset) => ({
    id: asset.id,
    uri: asset.uri,
    type: asset.type,
    durationMs: asset.durationMs ?? result.durationMs,
    metadata: {
      renderer: 'math-engine',
      deterministic: true,
      semanticObjectIds: asset.semanticObjectIds.join('|'),
      verificationRefs: asset.verificationRefs.join('|'),
      ...(asset.metadata ?? {}),
    },
  }));
}

export interface MathEngineClient {
  render(request: {
    sceneId: string;
    lessonId: string;
    durationMs: number;
    domain: string;
    grade: number;
    objects: GuruScene['objects'];
    actions: GuruScene['actions'];
    verificationRefs: string[];
    outputUri?: string;
    width?: number;
    height?: number;
    fps?: number;
  }): Promise<MathEngineRenderResult>;
}

/** HTTP/client-neutral adapter for the existing deterministic Math Engine. */
export class MathEngineAdapter implements MathEngineRenderer {
  constructor(private readonly client: MathEngineClient) {}

  async renderScene(scene: GuruScene, options: MathEngineRenderOptions = {}): Promise<MathEngineRenderResult> {
    const result = await this.client.render({
      sceneId: scene.id,
      lessonId: scene.lessonId,
      durationMs: scene.durationMs,
      domain: String(scene.domain),
      grade: scene.grade,
      objects: scene.objects,
      actions: scene.actions,
      verificationRefs: scene.verificationRefs,
      outputUri: options.outputUri,
      width: options.width,
      height: options.height,
      fps: options.fps,
    });
    return validateMathEngineRender(scene, result);
  }
}
