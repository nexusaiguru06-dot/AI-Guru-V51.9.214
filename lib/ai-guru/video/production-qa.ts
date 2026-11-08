import type { GuruLesson, GuruScene, VisualAction } from './scene-contracts';
import type { MathEngineRenderResult } from './math-engine-adapter';
import type { CueDrivenAnimationPlan } from './cue-driven-animation';

export type VideoQASeverity = 'error' | 'warning';
export type VideoQACode =
  | 'SCENE_DURATION'
  | 'MATH_VERIFICATION'
  | 'MATH_ASSET'
  | 'CUE_TARGET'
  | 'CUE_COVERAGE'
  | 'CUE_TIMING'
  | 'GEN_MATH_FORBIDDEN'
  | 'GEN_DURATION'
  | 'LAYER_RANGE'
  | 'LAYER_ORDER'
  | 'ACTION_TARGET'
  | 'LESSON_DURATION';

export interface VideoQAFinding {
  code: VideoQACode;
  severity: VideoQASeverity;
  sceneId?: string;
  message: string;
  objectIds?: string[];
  cueIds?: string[];
}

export interface VideoQAReport {
  passed: boolean;
  findings: VideoQAFinding[];
  sceneCount: number;
  errorCount: number;
  warningCount: number;
}

export interface ProductionQAOptions {
  strict?: boolean;
  requireSpeechCoverage?: boolean;
  requireMathVerification?: boolean;
}

function actionTargets(action: VisualAction): string[] {
  switch (action.type) {
    case 'create':
    case 'draw':
    case 'highlight':
    case 'erase':
    case 'move': return [action.objectId];
    case 'transform': return [action.fromObjectId, action.toObjectId];
    case 'camera':
    case 'pause': return [];
  }
}

function push(findings: VideoQAFinding[], finding: VideoQAFinding): void { findings.push(finding); }

export function validateVideoProduction(
  lesson: GuruLesson,
  mathResults: Record<string, MathEngineRenderResult> = {},
  cuePlans: Record<string, CueDrivenAnimationPlan> = {},
  options: ProductionQAOptions = {},
): VideoQAReport {
  const findings: VideoQAFinding[] = [];
  const strict = options.strict ?? true;
  const requireSpeech = options.requireSpeechCoverage ?? false;
  const requireVerification = options.requireMathVerification ?? true;

  let computedDuration = 0;
  for (const scene of lesson.scenes) {
    computedDuration += scene.durationMs;
    const objectIds = new Set(scene.objects.map((o) => o.id));
    const mathObjectIds = new Set(scene.objects.filter((o) => o.source === 'math-engine' && o.deterministic !== false).map((o) => o.id));

    if (!Number.isFinite(scene.durationMs) || scene.durationMs <= 0) {
      push(findings, { code: 'SCENE_DURATION', severity: 'error', sceneId: scene.id, message: 'Scene duration must be positive.' });
    }

    if (requireVerification && mathObjectIds.size > 0 && scene.verificationRefs.length === 0) {
      push(findings, { code: 'MATH_VERIFICATION', severity: 'error', sceneId: scene.id, message: 'Math objects exist without certified verification references.' });
    }

    for (const action of scene.actions) {
      const unknown = actionTargets(action).filter((id) => !objectIds.has(id));
      if (unknown.length) push(findings, { code: 'ACTION_TARGET', severity: 'error', sceneId: scene.id, message: `Action references unknown object(s): ${unknown.join(', ')}`, objectIds: unknown });
    }

    const wordCues = scene.audioCues.filter((c) => c.word || c.tokenIndex !== undefined);
    let previous = -1;
    for (const cue of wordCues) {
      if (cue.atMs < 0 || cue.atMs > scene.durationMs || (cue.durationMs !== undefined && cue.atMs + cue.durationMs > scene.durationMs)) {
        push(findings, { code: 'CUE_TIMING', severity: 'error', sceneId: scene.id, message: `Speech cue ${cue.id} falls outside the scene timeline.`, cueIds: [cue.id] });
      }
      if (cue.atMs < previous) push(findings, { code: 'CUE_TIMING', severity: 'error', sceneId: scene.id, message: 'Word cues are not monotonic.', cueIds: [cue.id] });
      previous = cue.atMs;
      const targets = cue.targetObjectIds ?? [];
      const unknownTargets = targets.filter((id) => !objectIds.has(id));
      if (unknownTargets.length) push(findings, { code: 'CUE_TARGET', severity: 'error', sceneId: scene.id, message: `Speech cue ${cue.id} targets unknown object(s).`, cueIds: [cue.id], objectIds: unknownTargets });
    }

    const plan = cuePlans[scene.id];
    if (requireSpeech && wordCues.length > 0 && plan && (plan.unmatchedSpeechCueIds.length || plan.unboundActionIds.length)) {
      const severity: VideoQASeverity = strict ? 'error' : 'warning';
      push(findings, { code: 'CUE_COVERAGE', severity, sceneId: scene.id, message: `Cue-driven coverage is incomplete: ${plan.unmatchedSpeechCueIds.length} unmatched speech cue(s), ${plan.unboundActionIds.length} unbound action(s).`, cueIds: plan.unmatchedSpeechCueIds });
    }

    const math = mathResults[scene.id];
    if (math) {
      if (math.sceneId !== scene.id || math.durationMs <= 0) push(findings, { code: 'MATH_ASSET', severity: 'error', sceneId: scene.id, message: 'Math Engine result does not match the scene or has invalid duration.' });
      const verified = new Set(scene.verificationRefs);
      for (const asset of math.assets) {
        if (asset.renderer !== 'math-engine' || asset.deterministic !== true) push(findings, { code: 'MATH_ASSET', severity: 'error', sceneId: scene.id, message: `Math asset ${asset.id} is not deterministic.` });
        if (asset.verificationRefs.some((ref: string) => !verified.has(ref))) push(findings, { code: 'MATH_VERIFICATION', severity: 'error', sceneId: scene.id, message: `Math asset ${asset.id} references an unverified source.` });
      }
    }

    if (scene.generative.durationMs <= 0 || scene.generative.durationMs > scene.durationMs) {
      push(findings, { code: 'GEN_DURATION', severity: 'error', sceneId: scene.id, message: 'Generative duration must fit within the scene duration.' });
    }
    if (scene.generative.forbiddenOutputs.length === 0) {
      push(findings, { code: 'GEN_MATH_FORBIDDEN', severity: strict ? 'error' : 'warning', sceneId: scene.id, message: 'Generative plan has no explicit mathematical-output guardrails.' });
    }

    for (const layer of scene.layers) {
      if (layer.startMs < 0 || layer.endMs <= layer.startMs || layer.endMs > scene.durationMs) {
        push(findings, { code: 'LAYER_RANGE', severity: 'error', sceneId: scene.id, message: `Layer ${layer.id} has an invalid time range.` });
      }
    }
    const mathLayers = scene.layers.filter((l) => l.source === 'math-engine');
    const ltxLayers = scene.layers.filter((l) => l.source === 'ltx');
    if (mathLayers.length && ltxLayers.length && Math.max(...mathLayers.map((l) => l.zIndex)) <= Math.max(...ltxLayers.map((l) => l.zIndex))) {
      push(findings, { code: 'LAYER_ORDER', severity: 'error', sceneId: scene.id, message: 'Math Engine layer must be above LTX in composition order.' });
    }
  }

  if (Math.abs(computedDuration - lesson.totalDurationMs) > 1) {
    push(findings, { code: 'LESSON_DURATION', severity: 'error', message: `Lesson totalDurationMs=${lesson.totalDurationMs} does not equal scene sum=${computedDuration}.` });
  }

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  return { passed: errorCount === 0, findings, sceneCount: lesson.scenes.length, errorCount, warningCount };
}

export function assertVideoProductionReady(report: VideoQAReport): void {
  if (!report.passed) {
    const summary = report.findings.filter((f) => f.severity === 'error').map((f) => `${f.code}: ${f.message}`).join('; ');
    throw new Error(`AI Guru video production QA failed: ${summary}`);
  }
}
