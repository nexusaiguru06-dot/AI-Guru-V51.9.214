import type { AIGuruTeachingLesson, TeachingBeat, TeachingSegment } from '../math/teaching';
import { applyVideoDNA, selectVideoDNA } from './video-dna-v2';
import type {
  AudioCue,
  GuruLesson,
  GuruScene,
  GenerativeVisualPlan,
  SceneAssetRef,
  SceneCompilerInput,
  VisualAction,
  CompositionLayer,
  VisualObject,
} from './scene-contracts';

const DEFAULT_FORBIDDEN_OUTPUTS: GenerativeVisualPlan['forbiddenOutputs'] = [
  'equations',
  'graphs',
  'geometry-truth',
  'verified-labels',
  'mathematical-transformations',
];

/**
 * Converts the existing teaching-beat model into the renderer-neutral scene contract.
 * No LTX-2, HyperFrames or browser rendering code is called here.
 */
export function compileGuruScene(input: SceneCompilerInput): GuruScene {
  const mathObjectIds = input.mathObjectIds ?? input.targetObjects ?? [];
  const targetObjects = input.targetObjects ?? mathObjectIds;
  const referenceAssets = input.references ?? [];

  const objects: VisualObject[] = [
    ...mathObjectIds.map((id): VisualObject => ({
      id,
      kind: 'shape',
      source: 'math-engine',
      semanticRef: id,
      deterministic: true,
      persistent: true,
    })),
    ...(input.textbook
      ? [{
          id: `textbook:${input.segmentId}`,
          kind: 'image' as const,
          source: 'textbook' as const,
          asset: input.textbook,
          deterministic: true,
          persistent: true,
        }]
      : []),
    ...referenceAssets.map((asset) => ({
      id: `reference:${asset.id}`,
      kind: asset.type === 'video' ? ('video' as const) : ('image' as const),
      source: 'asset' as const,
      asset,
      deterministic: true,
      persistent: true,
    })),
  ];

  const actions: VisualAction[] = input.actions ?? targetObjects.map((objectId) => ({
    type: 'highlight' as const,
    objectId,
  }));

  const generative: GuruScene['generative'] = {
    enabled: input.generative?.enabled ?? referenceAssets.length > 0,
    purpose: input.generative?.purpose ?? 'cinematic',
    conditions: input.generative?.conditions ?? referenceAssets.map((asset) => ({
      type: asset.type === 'video' ? ('reference-video' as const) : ('reference-image' as const),
      asset,
    })),
    durationMs: input.generative?.durationMs ?? input.durationMs,
    forbiddenOutputs: input.generative?.forbiddenOutputs ?? DEFAULT_FORBIDDEN_OUTPUTS,
  };

  const cue: AudioCue = {
    id: `audio:${input.beatId}`,
    atMs: 0,
    durationMs: input.durationMs,
    language: input.language,
    text: input.narration,
    targetObjectIds: targetObjects,
  };

  const words = (input.cueWords?.length ? input.cueWords : input.narration.match(/[^\s]+/gu) ?? [])
    .map((word) => word.trim())
    .filter(Boolean);
  const wordCues: AudioCue[] = words.map((word, index) => ({
    id: `word:${input.beatId}:${index}`,
    atMs: Math.round((index / Math.max(1, words.length)) * input.durationMs),
    durationMs: 1,
    language: input.language,
    text: word,
    word,
    tokenIndex: index,
    targetObjectIds: targetObjects,
  }));

  return {
    schemaVersion: '1.0',
    id: `scene:${input.lessonId}:${input.segmentId}:${input.beatId}`,
    lessonId: input.lessonId,
    segmentId: input.segmentId,
    beatId: input.beatId,
    title: input.segmentTitle,
    domain: input.domain,
    grade: input.grade,
    gradeBand: input.gradeBand,
    language: input.language,
    durationMs: input.durationMs,
    teachingGoal: input.teachingGoal,
    objects,
    actions,
    cameras: [],
    keyframes: [{
      id: `keyframe:${input.beatId}:start`,
      atMs: 0,
      state: 'beat-start',
      objectIds: targetObjects,
      narrationCueId: cue.id,
    }],
    timelineCues: [{
      id: `cue:${input.beatId}`,
      atMs: 0,
      durationMs: input.durationMs,
      language: input.language,
      text: input.narration,
      targetObjectIds: targetObjects,
      beatId: input.beatId,
    }],
    audioCues: [cue, ...wordCues],
    generative,
    layers: buildLayers(input, targetObjects),
    rendererPolicy: {
      math: { renderer: 'math-engine', deterministic: true },
      generative: { renderer: generative.enabled ? 'ltx' : 'none', enabled: generative.enabled, deterministic: false },
      composition: { renderer: 'composition', deterministic: true },
    },
    verificationRefs: input.verificationRefs ?? [],
    metadata: input.cueWords?.length ? { cueWords: input.cueWords.join('|') } : undefined,
  };
}

function buildLayers(input: SceneCompilerInput, targetObjects: string[]): CompositionLayer[] {
  const layers: CompositionLayer[] = [
    {
      id: `math:${input.beatId}`,
      source: 'math-engine' as const,
      objectIds: targetObjects,
      startMs: 0,
      endMs: input.durationMs,
      zIndex: 20,
    },
    {
      id: `audio:${input.beatId}`,
      source: 'audio' as const,
      startMs: 0,
      endMs: input.durationMs,
      zIndex: 40,
    },
  ];

  if (input.textbook) {
    layers.unshift({
      id: `textbook:${input.beatId}`,
      source: 'textbook' as const,
      assetIds: [input.textbook.id],
      startMs: 0,
      endMs: input.durationMs,
      zIndex: 0,
    });
  }

  if (input.generative?.enabled === true || (input.generative?.enabled === undefined && (input.references?.length ?? 0) > 0)) {
    layers.splice(1, 0, {
      id: `ltx:${input.beatId}`,
      source: 'ltx' as const,
      assetIds: (input.references ?? []).map((asset) => asset.id),
      startMs: 0,
      endMs: input.durationMs,
      zIndex: 10,
    });
  }

  return layers;
}

/**
 * Sprint-A compiler: turns the existing AI Guru teaching lesson into a sequence
 * of renderer-neutral scenes. Existing math verification remains upstream.
 */

/**
 * Sprint-B compiler: select one Video-DNA per teaching segment and attach the
 * renderer-neutral decision to every scene generated from that segment.
 * Selection is deterministic and does not generate mathematical content.
 */
export async function compileGuruLessonWithVideoDNA(
  lesson: AIGuruTeachingLesson,
  language: 'english' | 'malayalam' = 'english',
): Promise<GuruLesson> {
  const scenes: GuruScene[] = [];

  for (const segment of lesson.segments) {
    const selection = await selectVideoDNA({
      lesson,
      segment: {
        id: segment.id,
        title: segment.title,
        intuition: segment.intuition.explanation,
        mathematics: segment.mathematics.explanation,
        beats: segment.beats,
      },
      problemText: lesson.openingQuestion,
      expression: lesson.expression,
      teachingIntent: lesson.learningGoal,
      requiredVisuals: [
        ...(lesson.visualGrammar?.motifs ?? []),
        lesson.visualGrammar?.constructionPattern ?? '',
      ].filter(Boolean),
      previousDNAId: scenes.at(-1)?.metadata?.videoDNAPrimaryId as string | undefined,
    });

    for (const beat of segment.beats) {
      const scene = compileBeat(lesson, segment, beat, language);
      scenes.push(applyVideoDNA(scene, selection));
    }
  }

  return {
    schemaVersion: '1.0',
    id: lesson.id,
    title: lesson.title,
    grade: lesson.grade,
    gradeBand: lesson.gradeBand,
    domain: lesson.domain,
    language,
    scenes,
    totalDurationMs: scenes.reduce((sum, scene) => sum + scene.durationMs, 0),
  };
}

export function compileGuruLesson(lesson: AIGuruTeachingLesson, language: 'english' | 'malayalam' = 'english'): GuruLesson {
  const scenes: GuruScene[] = [];

  for (const segment of lesson.segments) {
    for (const beat of segment.beats) {
      scenes.push(compileBeat(lesson, segment, beat, language));
    }
  }

  return {
    schemaVersion: '1.0',
    id: lesson.id,
    title: lesson.title,
    grade: lesson.grade,
    gradeBand: lesson.gradeBand,
    domain: lesson.domain,
    language,
    scenes,
    totalDurationMs: scenes.reduce((sum, scene) => sum + scene.durationMs, 0),
  };
}

function compileBeat(
  lesson: AIGuruTeachingLesson,
  segment: TeachingSegment,
  beat: TeachingBeat,
  language: 'english' | 'malayalam',
): GuruScene {
  return compileGuruScene({
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    grade: lesson.grade,
    gradeBand: lesson.gradeBand,
    domain: lesson.domain,
    language,
    teachingGoal: lesson.learningGoal,
    segmentId: segment.id,
    segmentTitle: segment.title,
    beatId: beat.id,
    narration: beat.narration,
    durationMs: beat.durationMs ?? 2500,
    cueWords: beat.cueWords,
    targetObjects: beat.targetObjects,
    actions: mapTeachingActions(beat.actions),
    mathObjectIds: beat.targetObjects,
    verificationRefs: lesson.quality?.checks?.['math-correctness']
      ? [`math-verification:${lesson.id}`]
      : [],
  });
}

function mapTeachingActions(actions: TeachingBeat['actions']): VisualAction[] {
  return actions.flatMap((action): VisualAction[] => {
    switch (action.type) {
      case 'create':
        return [{ type: 'create', objectId: action.objectId }];
      case 'draw':
        return [{ type: 'draw', objectId: action.objectId }];
      case 'move':
        return [{ type: 'move', objectId: action.objectId, to: { x: action.toX, y: action.toY } }];
      case 'transform':
        return [{ type: 'transform', fromObjectId: action.fromObjectId, toObjectId: action.toObjectId }];
      case 'morph':
        return [{ type: 'transform', fromObjectId: action.fromObjectId, toObjectId: action.toObjectId }];
      case 'highlight':
      case 'indicate':
        return [{ type: 'highlight', objectId: action.objectId }];
      case 'erase':
        return [{ type: 'erase', objectId: action.objectId }];
      case 'camera':
        return [{ type: 'camera', cameraId: `camera:${action.action}:${action.targetId ?? 'scene'}` }];
      case 'pause':
        return [{ type: 'pause', durationMs: action.durationMs }];
      default:
        return [];
    }
  });
}

export type { SceneAssetRef };
