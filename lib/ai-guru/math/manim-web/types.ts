import type { UniversalMathScene } from '../universal/types';

export interface ManimWebRenderOptions {
  width?: number;
  height?: number;
  frameWidth?: number;
  frameHeight?: number;
  backgroundColor?: string;
}

export interface ManimWebRenderPlan {
  scene: UniversalMathScene;
  durationMs: number;
  visualObjectCount: number;
  transformCount: number;
  createCount: number;
  highlightCount: number;
  tokenTransformCount: number;
  tokenMoveCount: number;
  unsupportedKinds: string[];
  warnings: string[];
}
