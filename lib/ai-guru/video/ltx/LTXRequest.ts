import type { GuruLanguage, SceneRegion } from '../scene-contracts';

export type LTXOperation = 'generate' | 'retake' | 'extend';

export interface LTXAssetInput {
  id: string;
  uri: string;
  type: 'image' | 'video';
  startMs?: number;
  endMs?: number;
}

export interface LTXKeyframeInput {
  id: string;
  atMs: number;
  asset: LTXAssetInput;
  purpose?: string;
}

export interface LTXMaskInput {
  region: SceneRegion;
  targetObjectIds?: string[];
}

export type LTXConditioningInput =
  | { type: 'reference-image'; asset: LTXAssetInput; strength?: number }
  | { type: 'reference-video'; asset: LTXAssetInput; strength?: number; startMs?: number; endMs?: number }
  | { type: 'keyframe'; keyframe: LTXKeyframeInput }
  | { type: 'mask'; mask: LTXMaskInput }
  | { type: 'previous-state'; sceneId: string }
  | { type: 'text'; prompt: string };

export interface LTXOutputSpec {
  container?: 'mp4' | 'webm';
  codec?: string;
  fps?: number;
  width?: number;
  height?: number;
}

export interface LTXGenerationRequest {
  operation: LTXOperation;
  requestId: string;
  sceneId: string;
  lessonId: string;
  language: GuruLanguage;
  prompt: string;
  negativePrompt: string;
  durationMs: number;
  fps: number;
  width: number;
  height: number;
  seed?: number;
  model?: string;
  conditions: LTXConditioningInput[];
  output: LTXOutputSpec;
  forbiddenOutputs: string[];
  metadata: Record<string, string | number | boolean>;
}

export interface LTXRetakeRequest extends LTXGenerationRequest {
  operation: 'retake';
  sourceVideo: LTXAssetInput;
  startMs: number;
  endMs: number;
}

export interface LTXExtendRequest extends LTXGenerationRequest {
  operation: 'extend';
  sourceVideo: LTXAssetInput;
  direction: 'before' | 'after';
  extensionMs: number;
}

export type LTXRequest = LTXGenerationRequest | LTXRetakeRequest | LTXExtendRequest;

export interface LTXJobResult {
  status: 'queued' | 'running' | 'completed' | 'failed';
  jobId: string;
  assetUri?: string;
  previewUri?: string;
  error?: string;
  metadata?: Record<string, string | number | boolean>;
}
