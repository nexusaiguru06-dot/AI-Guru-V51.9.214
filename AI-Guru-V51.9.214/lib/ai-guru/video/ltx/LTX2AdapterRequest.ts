import type { GuruScene } from '../scene-contracts';
import type { VideoDNASelection } from '../video-dna-v2';
import type { LTXGenerationRequest, LTXOperation } from './LTXRequest';
import { mapGenerativeConditions, dedupeConditions } from './LTXConditioning';
import { buildLTXKeyframes } from './LTXKeyframes';

const DEFAULT_NEGATIVE_PROMPT = [
  'equations',
  'formula text',
  'graphs',
  'coordinate axes with values',
  'mathematical labels',
  'verified symbols',
  'exact geometry construction',
  'incorrect mathematical transformations',
  'watermarks',
  'logos',
  'copied artwork',
].join(', ');

export function buildGenerativePrompt(scene: GuruScene, selection?: VideoDNASelection): string {
  const style = selection?.style;
  const motifs = style?.motifs?.slice(0, 5).join(', ') || 'clean educational visual motion';
  const family = style?.family || 'step-by-step educational visual';
  const purpose = scene.generative.purpose;
  const camera = style?.camera || 'focus';

  return [
    `Educational ${purpose} visual for an AI Guru mathematics lesson.`,
    `Visual grammar family: ${family}.`,
    `Camera: ${camera}.`,
    `Motion motifs: ${motifs}.`,
    'Use abstract or reference-grounded imagery to support the lesson.',
    'Keep the composition clean, classroom-appropriate, and visually consistent.',
    'Do not render mathematical truth; leave equations, graphs, geometry, labels and transformations to the deterministic math engine.',
  ].join(' ');
}

export interface BuildLTXRequestOptions {
  operation?: LTXOperation;
  seed?: number;
  fps?: number;
  width?: number;
  height?: number;
  model?: string;
}

export function buildLTXRequest(
  scene: GuruScene,
  selection?: VideoDNASelection,
  options: BuildLTXRequestOptions = {},
): LTXGenerationRequest {
  if (!scene.rendererPolicy.generative.enabled || !scene.generative.enabled) {
    throw new Error(`Generative renderer is disabled for scene ${scene.id}`);
  }

  if (scene.generative.durationMs <= 0) {
    throw new Error(`Invalid generative duration for scene ${scene.id}`);
  }

  const conditions = [
    ...mapGenerativeConditions(scene.generative.conditions),
    ...buildLTXKeyframes(scene, selection).map((keyframe) => ({ type: 'keyframe' as const, keyframe })),
  ];

  return {
    operation: options.operation ?? 'generate',
    requestId: `ltx:${scene.id}:${options.operation ?? 'generate'}`,
    sceneId: scene.id,
    lessonId: scene.lessonId,
    language: scene.language,
    prompt: buildGenerativePrompt(scene, selection),
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    durationMs: scene.generative.durationMs,
    fps: options.fps ?? 24,
    width: options.width ?? 1280,
    height: options.height ?? 720,
    seed: options.seed,
    model: options.model,
    conditions: dedupeConditions(conditions),
    output: { container: 'mp4', codec: 'h264', fps: options.fps ?? 24, width: options.width ?? 1280, height: options.height ?? 720 },
    forbiddenOutputs: scene.generative.forbiddenOutputs,
    metadata: {
      aiGuruSchema: '1.0',
      videoDNASelectionId: String(scene.metadata?.videoDNASelectionId ?? ''),
      videoDNAPrimaryId: String(scene.metadata?.videoDNAPrimaryId ?? ''),
      exactMathRenderer: scene.rendererPolicy.math.renderer,
    },
  };
}
