import type {
  CompositionAsset,
  CompositionCameraKeyframe,
  CompositionCue,
  CompositionRenderOptions,
  CompositionSceneRequest,
  CompositionTrack,
} from '../composition-engine';
import type { GuruLesson, GuruScene } from '../scene-contracts';

const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_FPS = 30;

function stableId(prefix: string, value: string): string {
  return `${prefix}:${value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120)}`;
}

function sceneAssets(scene: GuruScene, provided: CompositionAsset[]): CompositionAsset[] {
  const byUri = new Map(provided.map((asset) => [asset.uri, asset]));
  const derived: CompositionAsset[] = [];

  for (const object of scene.objects) {
    const asset = object.asset;
    if (!asset) continue;
    if (!byUri.has(asset.uri)) {
      const type = asset.type === 'audio' ? 'audio' : asset.type === 'data' ? 'data' : asset.type === 'video' ? 'video' : 'image';
      const next: CompositionAsset = { id: asset.id, uri: asset.uri, type, metadata: asset.metadata };
      byUri.set(asset.uri, next);
      derived.push(next);
    }
  }

  return [...provided, ...derived];
}

function compositionPriority(source: CompositionTrack['source']): number {
  // HyperFrames receives an explicit safety order so a malformed authored zIndex
  // cannot accidentally put generative pixels above verified mathematical output.
  switch (source) {
    case 'textbook': return 0;
    case 'ltx': return 10;
    case 'system': return 15;
    case 'math-engine': return 20;
    case 'caption': return 30;
    case 'audio': return 40;
  }
}

function buildTracks(scene: GuruScene): CompositionTrack[] {
  return scene.layers
    .slice()
    .sort((a, b) => compositionPriority(a.source) - compositionPriority(b.source) || a.zIndex - b.zIndex || a.id.localeCompare(b.id))
    .map((layer) => ({
      id: layer.id,
      source: layer.source,
      assetIds: layer.assetIds ?? [],
      objectIds: layer.objectIds ?? [],
      startMs: Math.max(0, layer.startMs),
      endMs: Math.min(scene.durationMs, Math.max(layer.startMs, layer.endMs)),
      zIndex: compositionPriority(layer.source),
      opacity: layer.opacity ?? 1,
      blendMode: layer.blendMode ?? 'normal',
      muted: false,
    }));
}

function buildCues(scene: GuruScene): CompositionCue[] {
  const cues: CompositionCue[] = scene.timelineCues.map((cue) => ({
    id: cue.id,
    atMs: cue.atMs,
    durationMs: cue.durationMs,
    kind: 'timeline',
    text: cue.text,
    beatId: cue.beatId,
    targetObjectIds: cue.targetObjectIds ?? [],
  }));

  for (const cue of scene.audioCues) {
    cues.push({
      id: cue.id,
      atMs: cue.atMs,
      durationMs: cue.durationMs,
      kind: cue.word || cue.tokenIndex !== undefined ? 'word' : 'audio',
      text: cue.text,
      word: cue.word,
      tokenIndex: cue.tokenIndex,
      targetObjectIds: cue.targetObjectIds ?? [],
    });
  }

  for (const camera of scene.cameras) {
    cues.push({
      id: camera.id,
      atMs: camera.atMs,
      durationMs: camera.durationMs,
      kind: 'camera',
      text: camera.reason,
      targetObjectIds: [],
    });
  }

  return cues.sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id));
}

function buildCamera(scene: GuruScene): CompositionCameraKeyframe[] {
  return scene.cameras
    .slice()
    .sort((a, b) => a.atMs - b.atMs)
    .map((camera) => ({
      id: camera.id,
      atMs: camera.atMs,
      durationMs: camera.durationMs,
      from: camera.from ? { ...camera.from } : undefined,
      to: camera.to ? { ...camera.to } : undefined,
      reason: camera.reason,
    }));
}

function buildSceneRequest(
  scene: GuruScene,
  operation: 'render-scene' | 'render-lesson',
  lessonId: string,
  assets: CompositionAsset[],
  options: CompositionRenderOptions = {},
  sceneIds: string[] = [scene.id],
  durationMs = scene.durationMs,
): CompositionSceneRequest {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const fps = options.fps ?? DEFAULT_FPS;

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('Composition dimensions must be positive');
  }
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('Composition FPS must be positive');
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('Composition duration must be positive');

  return {
    schemaVersion: '1.0',
    operation,
    requestId: options.requestId ?? stableId('compose', `${lessonId}:${sceneIds.join('|')}:${durationMs}`),
    lessonId,
    sceneIds,
    durationMs,
    width,
    height,
    fps,
    language: scene.language,
    assets: sceneAssets(scene, assets),
    tracks: buildTracks(scene),
    cues: buildCues(scene),
    camera: buildCamera(scene),
    output: {
      container: options.container ?? 'mp4',
      codec: options.codec,
      uri: options.outputUri,
    },
    deterministic: true,
    metadata: {
      aiGuruSchema: scene.schemaVersion,
      mathRenderer: scene.rendererPolicy.math.renderer,
      generativeRenderer: scene.rendererPolicy.generative.renderer,
      generativeEnabled: scene.rendererPolicy.generative.enabled,
      verificationRefs: scene.verificationRefs.length,
    },
  };
}

export function buildHyperFramesSceneRequest(
  scene: GuruScene,
  assets: CompositionAsset[] = [],
  options: CompositionRenderOptions = {},
): CompositionSceneRequest {
  return buildSceneRequest(scene, 'render-scene', scene.lessonId, assets, options);
}

export function buildHyperFramesLessonRequest(
  lesson: GuruLesson,
  assets: CompositionAsset[] = [],
  options: CompositionRenderOptions = {},
): CompositionSceneRequest {
  if (lesson.scenes.length === 0) throw new Error('Cannot compose a lesson with no scenes');

  const first = lesson.scenes[0];
  const durationMs = lesson.totalDurationMs || lesson.scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
  let offset = 0;
  const tracks: CompositionTrack[] = [];
  const cues: CompositionCue[] = [];
  const camera: CompositionCameraKeyframe[] = [];
  const allAssets = [...assets];

  for (const scene of lesson.scenes) {
    const request = buildHyperFramesSceneRequest(scene, allAssets, {
      ...options,
      requestId: stableId('scene', scene.id),
    });
    for (const asset of request.assets) if (!allAssets.some((item) => item.uri === asset.uri)) allAssets.push(asset);
    tracks.push(...request.tracks.map((track) => ({ ...track, id: stableId(`scene-${scene.id}`, track.id), startMs: track.startMs + offset, endMs: track.endMs + offset })));
    cues.push(...request.cues.map((cue) => ({ ...cue, id: stableId(`scene-${scene.id}`, cue.id), atMs: cue.atMs + offset })));
    camera.push(...request.camera.map((keyframe) => ({ ...keyframe, id: stableId(`scene-${scene.id}`, keyframe.id), atMs: keyframe.atMs + offset })));
    offset += scene.durationMs;
  }

  return {
    schemaVersion: '1.0',
    operation: 'render-lesson',
    requestId: options.requestId ?? stableId('lesson', lesson.id),
    lessonId: lesson.id,
    sceneIds: lesson.scenes.map((scene) => scene.id),
    durationMs,
    width: options.width ?? DEFAULT_WIDTH,
    height: options.height ?? DEFAULT_HEIGHT,
    fps: options.fps ?? DEFAULT_FPS,
    language: first.language,
    assets: allAssets,
    tracks,
    cues: cues.sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id)),
    camera: camera.sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id)),
    output: {
      container: options.container ?? 'mp4',
      codec: options.codec,
      uri: options.outputUri,
    },
    deterministic: true,
    metadata: {
      aiGuruSchema: lesson.schemaVersion,
      sceneCount: lesson.scenes.length,
      totalDurationMs: durationMs,
      mathRenderer: 'math-engine',
      compositionAuthority: 'hyperframes',
    },
  };
}
