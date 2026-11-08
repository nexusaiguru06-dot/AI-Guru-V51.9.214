import type { GuruLesson, GuruScene } from './scene-contracts';

export type CompositionSource = 'textbook' | 'math-engine' | 'ltx' | 'audio' | 'caption' | 'system';
export type CompositionOutputContainer = 'mp4' | 'webm';

export interface CompositionAsset {
  id: string;
  uri: string;
  type: 'image' | 'video' | 'audio' | 'data';
  durationMs?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface CompositionTrack {
  id: string;
  source: CompositionSource;
  assetIds: string[];
  objectIds: string[];
  startMs: number;
  endMs: number;
  zIndex: number;
  opacity: number;
  blendMode: string;
  muted: boolean;
}

export interface CompositionCue {
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

export interface CompositionCameraKeyframe {
  id: string;
  atMs: number;
  durationMs: number;
  from?: Record<string, number | string>;
  to?: Record<string, number | string>;
  reason?: string;
}

export interface CompositionSceneRequest {
  schemaVersion: '1.0';
  operation: 'render-scene' | 'render-lesson';
  requestId: string;
  lessonId: string;
  sceneIds: string[];
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  language: 'english' | 'malayalam';
  assets: CompositionAsset[];
  tracks: CompositionTrack[];
  cues: CompositionCue[];
  camera: CompositionCameraKeyframe[];
  output: {
    container: CompositionOutputContainer;
    codec?: string;
    uri?: string;
  };
  deterministic: true;
  metadata: Record<string, string | number | boolean>;
}

export interface CompositionJobResult {
  status: 'queued' | 'running' | 'completed' | 'failed';
  jobId: string;
  assetUri?: string;
  previewUri?: string;
  error?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface CompositionRenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  container?: CompositionOutputContainer;
  codec?: string;
  outputUri?: string;
  requestId?: string;
}

export interface CompositionEngine {
  renderScene(scene: GuruScene, assets?: CompositionAsset[], options?: CompositionRenderOptions): Promise<CompositionJobResult>;
  renderLesson(lesson: GuruLesson, assets?: CompositionAsset[], options?: CompositionRenderOptions): Promise<CompositionJobResult>;
}
