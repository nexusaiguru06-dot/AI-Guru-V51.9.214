import type { GuruScene } from './scene-contracts';
import type { VideoDNASelection } from './video-dna-v2';
import type { LTXAssetInput, LTXJobResult } from './ltx/LTXRequest';

export interface GenerativeVideoOptions {
  seed?: number;
  fps?: number;
  width?: number;
  height?: number;
  model?: string;
}

export interface GenerativeVideoRetakeInput {
  scene: GuruScene;
  sourceVideo: LTXAssetInput;
  startMs: number;
  endMs: number;
  selection?: VideoDNASelection;
  seed?: number;
}

export interface GenerativeVideoExtendInput {
  scene: GuruScene;
  sourceVideo: LTXAssetInput;
  direction: 'before' | 'after';
  extensionMs: number;
  selection?: VideoDNASelection;
  seed?: number;
}

/** Renderer-neutral boundary. LTX-2 is one implementation; HyperFrames remains downstream. */
export interface GenerativeVideoEngine {
  generate(scene: GuruScene, selection?: VideoDNASelection, options?: GenerativeVideoOptions): Promise<LTXJobResult>;
  retake(input: GenerativeVideoRetakeInput): Promise<LTXJobResult>;
  extend(input: GenerativeVideoExtendInput): Promise<LTXJobResult>;
}
