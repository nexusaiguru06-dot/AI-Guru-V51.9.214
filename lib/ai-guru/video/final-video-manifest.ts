import type { CompositionAsset } from './composition-engine';
import type { MathEngineRenderResult } from './math-engine-adapter';
import type { GuruLesson, GuruScene } from './scene-contracts';
import type { LTXJobResult } from './ltx/LTXRequest';

export type FinalAssetRenderer = 'textbook' | 'math-engine' | 'ltx' | 'audio' | 'caption' | 'system';

export interface FinalVideoAsset {
  id: string;
  uri: string;
  type: CompositionAsset['type'];
  renderer: FinalAssetRenderer;
  deterministic: boolean;
  sceneId?: string;
  durationMs?: number;
  semanticObjectIds?: string[];
  verificationRefs?: string[];
  metadata?: Record<string, string | number | boolean>;
}

export interface FinalVideoCue {
  id: string;
  atMs: number;
  durationMs?: number;
  kind: 'timeline' | 'audio' | 'word' | 'camera';
  text?: string;
  word?: string;
  tokenIndex?: number;
  beatId?: string;
  targetObjectIds: string[];
}

export interface FinalVideoScene {
  id: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  dnaId?: string;
  mathAssetIds: string[];
  generativeAssetIds: string[];
  audioAssetIds: string[];
  verificationRefs: string[];
  cues: FinalVideoCue[];
}

export interface FinalVideoVerificationLedger {
  sceneId: string;
  verificationRefs: string[];
  mathAssetIds: string[];
}

export interface AIGuruFinalVideoManifest {
  schemaVersion: '1.0';
  lessonId: string;
  title: string;
  language: GuruLesson['language'];
  width: number;
  height: number;
  fps: number;
  totalDurationMs: number;
  assets: FinalVideoAsset[];
  scenes: FinalVideoScene[];
  verificationLedger: FinalVideoVerificationLedger[];
  composition: {
    authority: 'hyperframes';
    deterministic: true;
    requestId: string;
    outputContainer: 'mp4' | 'webm';
    outputUri?: string;
  };
  safety: {
    mathTruthOwner: 'math-engine';
    generativeOwner: 'ltx';
    timingOwner: 'hyperframes';
    forbiddenGenerativeOutputs: string[];
  };
}

export interface FinalVideoManifestInput {
  lesson: GuruLesson;
  mathResults?: Record<string, MathEngineRenderResult>;
  ltxResults?: Array<{ sceneId: string; result: LTXJobResult }>;
  audioAssets?: Array<{
    id: string;
    uri: string;
    sceneId?: string;
    durationMs?: number;
    metadata?: Record<string, string | number | boolean>;
  }>;
  compositionRequestId: string;
  width: number;
  height: number;
  fps: number;
  outputContainer: 'mp4' | 'webm';
  outputUri?: string;
}

function sceneCues(scene: GuruScene): FinalVideoCue[] {
  return [
    ...scene.timelineCues.map((cue) => ({
      id: cue.id,
      atMs: cue.atMs,
      durationMs: cue.durationMs,
      kind: 'timeline' as const,
      text: cue.text,
      beatId: cue.beatId,
      targetObjectIds: cue.targetObjectIds ?? [],
    })),
    ...scene.audioCues.map((cue) => ({
      id: cue.id,
      atMs: cue.atMs,
      durationMs: cue.durationMs,
      kind: cue.word || cue.tokenIndex !== undefined ? ('word' as const) : ('audio' as const),
      text: cue.text,
      word: cue.word,
      tokenIndex: cue.tokenIndex,
      targetObjectIds: cue.targetObjectIds ?? [],
    })),
    ...scene.cameras.map((camera) => ({
      id: camera.id,
      atMs: camera.atMs,
      durationMs: camera.durationMs,
      kind: 'camera' as const,
      text: camera.reason,
      targetObjectIds: [],
    })),
  ].sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id));
}

function validateSceneCues(scene: GuruScene, cues: FinalVideoCue[]): void {
  let previousWordAt = -1;
  for (const cue of cues) {
    if (!Number.isFinite(cue.atMs) || cue.atMs < 0 || cue.atMs > scene.durationMs) {
      throw new Error(`Cue ${cue.id} is outside scene ${scene.id}`);
    }
    if (cue.durationMs !== undefined && cue.durationMs < 0) {
      throw new Error(`Cue ${cue.id} has a negative duration`);
    }
    if (cue.kind === 'word') {
      if (cue.atMs < previousWordAt) throw new Error(`Word cues are not monotonic in scene ${scene.id}`);
      previousWordAt = cue.atMs;
    }
  }
}

function buildSceneAssets(
  scene: GuruScene,
  mathResult: MathEngineRenderResult | undefined,
  ltxResult: LTXJobResult | undefined,
  audioAssets: FinalVideoManifestInput['audioAssets'],
): FinalVideoAsset[] {
  const assets: FinalVideoAsset[] = [];

  for (const object of scene.objects) {
    if (!object.asset) continue;
    assets.push({
      id: object.asset.id,
      uri: object.asset.uri,
      type: object.asset.type === 'pdf-page' ? 'image' : object.asset.type === 'data' ? 'data' : object.asset.type,
      renderer: object.source === 'textbook' ? 'textbook' : 'system',
      deterministic: object.deterministic !== false,
      sceneId: scene.id,
      metadata: object.asset.metadata,
    });
  }

  if (mathResult) {
    for (const asset of mathResult.assets) {
      assets.push({
        id: asset.id,
        uri: asset.uri,
        type: asset.type,
        renderer: 'math-engine',
        deterministic: true,
        sceneId: scene.id,
        durationMs: asset.durationMs ?? mathResult.durationMs,
        semanticObjectIds: asset.semanticObjectIds,
        verificationRefs: asset.verificationRefs,
        metadata: asset.metadata,
      });
    }
  }

  if (ltxResult?.assetUri) {
    assets.push({
      id: `ltx:${ltxResult.jobId}`,
      uri: ltxResult.assetUri,
      type: 'video',
      renderer: 'ltx',
      deterministic: false,
      sceneId: scene.id,
      durationMs: scene.durationMs,
      metadata: { jobId: ltxResult.jobId },
    });
  }

  for (const audio of audioAssets ?? []) {
    if (audio.sceneId && audio.sceneId !== scene.id) continue;
    assets.push({
      id: audio.id,
      uri: audio.uri,
      type: 'audio',
      renderer: 'audio',
      deterministic: true,
      sceneId: scene.id,
      durationMs: audio.durationMs,
      metadata: audio.metadata,
    });
  }

  return assets;
}

export function buildFinalVideoManifest(input: FinalVideoManifestInput): AIGuruFinalVideoManifest {
  if (input.lesson.scenes.length === 0) throw new Error('Cannot build a video manifest with no scenes');
  if (input.width <= 0 || input.height <= 0 || input.fps <= 0) throw new Error('Invalid final video dimensions/FPS');

  const assets: FinalVideoAsset[] = [];
  const scenes: FinalVideoScene[] = [];
  const verificationLedger: FinalVideoVerificationLedger[] = [];
  let offset = 0;

  for (const scene of input.lesson.scenes) {
    const mathResult = input.mathResults?.[scene.id];
    const ltxResult = input.ltxResults?.find((item) => item.sceneId === scene.id)?.result;
    const sceneAssets = buildSceneAssets(scene, mathResult, ltxResult, input.audioAssets);
    assets.push(...sceneAssets);

    const cues = sceneCues(scene);
    validateSceneCues(scene, cues);

    const mathAssetIds = sceneAssets.filter((asset) => asset.renderer === 'math-engine').map((asset) => asset.id);
    const generativeAssetIds = sceneAssets.filter((asset) => asset.renderer === 'ltx').map((asset) => asset.id);
    const audioAssetIds = sceneAssets.filter((asset) => asset.renderer === 'audio').map((asset) => asset.id);
    const dnaId = typeof scene.metadata?.videoDNAPrimaryId === 'string' ? scene.metadata.videoDNAPrimaryId : undefined;

    scenes.push({
      id: scene.id,
      startMs: offset,
      endMs: offset + scene.durationMs,
      durationMs: scene.durationMs,
      dnaId,
      mathAssetIds,
      generativeAssetIds,
      audioAssetIds,
      verificationRefs: [...scene.verificationRefs],
      cues: cues.map((cue) => ({ ...cue, atMs: cue.atMs + offset })),
    });
    verificationLedger.push({
      sceneId: scene.id,
      verificationRefs: [...scene.verificationRefs],
      mathAssetIds,
    });

    offset += scene.durationMs;
  }

  const dedupedAssets = [...new Map(assets.map((asset) => [asset.id, asset])).values()];

  return {
    schemaVersion: '1.0',
    lessonId: input.lesson.id,
    title: input.lesson.title,
    language: input.lesson.language,
    width: input.width,
    height: input.height,
    fps: input.fps,
    totalDurationMs: offset,
    assets: dedupedAssets,
    scenes,
    verificationLedger,
    composition: {
      authority: 'hyperframes',
      deterministic: true,
      requestId: input.compositionRequestId,
      outputContainer: input.outputContainer,
      outputUri: input.outputUri,
    },
    safety: {
      mathTruthOwner: 'math-engine',
      generativeOwner: 'ltx',
      timingOwner: 'hyperframes',
      forbiddenGenerativeOutputs: ['equations', 'graphs', 'geometry-truth', 'verified-labels', 'mathematical-transformations'],
    },
  };
}
