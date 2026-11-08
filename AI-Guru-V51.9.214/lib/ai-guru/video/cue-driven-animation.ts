import type { AudioCue, GuruScene, ScenePoint, VisualAction } from './scene-contracts';

export interface TimedVisualAction {
  id: string;
  atMs: number;
  durationMs: number;
  action: VisualAction;
  cueId?: string;
  word?: string;
  tokenIndex?: number;
  targetObjectIds: string[];
}

export interface CueDrivenAnimationPlan {
  sceneId: string;
  durationMs: number;
  actions: TimedVisualAction[];
  generatedFromSpeech: boolean;
  unmatchedSpeechCueIds: string[];
  unboundActionIds: string[];
  metadata?: Record<string, string | number | boolean>;
}

export interface CueDrivenAnimationOptions {
  defaultActionDurationMs?: number;
  minGapMs?: number;
  strictTargets?: boolean;
  strictActionCoverage?: boolean;
  /** Optional explicit actionId -> cueId bindings authored by the lesson compiler. */
  actionCueMap?: Record<string, string>;
}

function actionTargets(action: VisualAction): string[] {
  switch (action.type) {
    case 'create':
    case 'draw':
    case 'highlight':
    case 'erase':
      return [action.objectId];
    case 'move':
      return [action.objectId];
    case 'transform':
      return [action.fromObjectId, action.toObjectId];
    case 'camera':
      return [];
    case 'pause':
      return [];
  }
}

function cueTargets(cue: AudioCue): string[] {
  return cue.targetObjectIds ?? [];
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function objectTerms(scene: GuruScene, objectId: string): string[] {
  const object = scene.objects.find((item) => item.id === objectId);
  if (!object) return [normalize(objectId)];
  const metadata = Object.values(object.metadata ?? {}).filter((value): value is string => typeof value === 'string');
  return [object.id, object.content ?? '', object.semanticRef ?? '', ...metadata]
    .map(normalize)
    .filter(Boolean);
}

function semanticObjectMatches(scene: GuruScene, cue: AudioCue): string[] {
  const wanted = normalize(cue.word || cue.text);
  if (!wanted) return [];
  return scene.objects
    .filter((object) => object.source === 'math-engine' && object.deterministic !== false)
    .filter((object) => objectTerms(scene, object.id).some((term) => term === wanted || term.includes(wanted) || wanted.includes(term)))
    .map((object) => object.id);
}

function actionMatchesCue(action: VisualAction, targets: Set<string>): boolean {
  if (action.type === 'camera' || action.type === 'pause') return false;
  return actionTargets(action).some((id) => targets.has(id));
}

function actionId(action: VisualAction, index: number): string {
  switch (action.type) {
    case 'transform': return `action:${index}:transform:${action.fromObjectId}->${action.toObjectId}`;
    case 'move': return `action:${index}:move:${action.objectId}`;
    case 'camera': return `action:${index}:camera:${action.cameraId}`;
    case 'pause': return `action:${index}:pause`;
    default: return `action:${index}:${action.type}:${action.objectId}`;
  }
}

function clampEnd(atMs: number, durationMs: number, sceneDurationMs: number): number {
  return Math.min(sceneDurationMs, Math.max(atMs, atMs + Math.max(0, durationMs)));
}

/**
 * Compiles speech cues into deterministic, timestamped Math Engine actions.
 * It never creates new mathematical objects and never delegates math to LTX.
 */
export function compileCueDrivenAnimation(
  scene: GuruScene,
  options: CueDrivenAnimationOptions = {},
): CueDrivenAnimationPlan {
  const defaultDuration = Math.max(1, options.defaultActionDurationMs ?? 280);
  const minGap = Math.max(0, options.minGapMs ?? 20);
  const wordCues = scene.audioCues.filter((cue) => Boolean(cue.word || cue.tokenIndex !== undefined));
  const cues = wordCues.length ? wordCues : scene.audioCues;
  const usedCueIds = new Set<string>();
  const timed: TimedVisualAction[] = [];
  const boundActionIds = new Set<string>();

  const resolvedCueTargets = new Map<string, Set<string>>();
  for (const cue of cues) {
    const explicit = cueTargets(cue);
    const semantic = explicit.length ? [] : semanticObjectMatches(scene, cue);
    const targets = new Set([...explicit, ...semantic]);
    resolvedCueTargets.set(cue.id, targets);
  }

  scene.actions.forEach((action, index) => {
    const id = actionId(action, index);
    const explicitCueId = options.actionCueMap?.[id];
    let cue = explicitCueId ? cues.find((item) => item.id === explicitCueId) : undefined;
    if (!cue) {
      cue = cues.find((candidate) => {
        const targets = resolvedCueTargets.get(candidate.id) ?? new Set<string>();
        return actionMatchesCue(action, targets) && !usedCueIds.has(candidate.id);
      });
    }
    if (!cue && action.type === 'camera') {
      cue = scene.audioCues.find((candidate) => Math.abs(candidate.atMs - (scene.cameras.find((c) => c.id === action.cameraId)?.atMs ?? -99999)) <= 50);
    }
    if (!cue) return;

    const duration = Math.min(
      defaultDuration,
      Math.max(1, cue.durationMs ?? defaultDuration),
      Math.max(1, scene.durationMs - cue.atMs),
    );
    const start = Math.max(0, cue.atMs);
    timed.push({
      id: `timed:${id}`,
      atMs: start,
      durationMs: duration,
      action,
      cueId: cue.id,
      word: cue.word,
      tokenIndex: cue.tokenIndex,
      targetObjectIds: actionTargets(action),
    });
    boundActionIds.add(id);
    if (action.type !== 'camera' && action.type !== 'pause') usedCueIds.add(cue.id);
  });

  if (options.strictActionCoverage && boundActionIds.size !== scene.actions.length) {
    const missing = scene.actions.map((action, index) => actionId(action, index)).filter((id) => !boundActionIds.has(id));
    throw new Error(`Unbound visual actions in ${scene.id}: ${missing.join(', ')}`);
  }

  const unmatchedSpeechCueIds = cues.filter((cue) => !usedCueIds.has(cue.id) && (cue.targetObjectIds?.length || cue.word)).map((cue) => cue.id);
  if (options.strictTargets && unmatchedSpeechCueIds.length) {
    throw new Error(`Speech cues could not be mapped to math actions in ${scene.id}: ${unmatchedSpeechCueIds.join(', ')}`);
  }

  // Avoid two deterministic actions landing on exactly the same instant unless they
  // explicitly target different objects. Stable ordering keeps renders reproducible.
  timed.sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id));
  for (let i = 1; i < timed.length; i += 1) {
    const previous = timed[i - 1];
    const current = timed[i];
    if (current.atMs === previous.atMs) {
      const overlap = current.targetObjectIds.some((id) => previous.targetObjectIds.includes(id));
      if (overlap) current.atMs = Math.min(scene.durationMs, previous.atMs + minGap);
    }
  }
  for (const action of timed) {
    action.durationMs = Math.max(1, clampEnd(action.atMs, action.durationMs, scene.durationMs) - action.atMs);
  }

  return {
    sceneId: scene.id,
    durationMs: scene.durationMs,
    actions: timed,
    generatedFromSpeech: wordCues.length > 0,
    unmatchedSpeechCueIds,
    unboundActionIds: scene.actions.map((action, index) => actionId(action, index)).filter((id) => !boundActionIds.has(id)),
    metadata: {
      cueCount: cues.length,
      timedActionCount: timed.length,
      mathActionCount: scene.actions.length,
    },
  };
}

/** Converts the timed plan to a deterministic renderer payload. */
export function buildMathEngineAnimationPayload(plan: CueDrivenAnimationPlan): {
  sceneId: string;
  durationMs: number;
  actions: Array<TimedVisualAction & { renderer: 'math-engine'; deterministic: true }>;
} {
  return {
    sceneId: plan.sceneId,
    durationMs: plan.durationMs,
    actions: plan.actions.map((action) => ({
      ...action,
      renderer: 'math-engine' as const,
      deterministic: true as const,
    })),
  };
}
