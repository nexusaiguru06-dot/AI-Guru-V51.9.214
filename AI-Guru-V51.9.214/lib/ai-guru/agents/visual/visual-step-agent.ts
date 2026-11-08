import { ids, type AgentResult, type AgentRequest, type Lesson, type Paragraph, type VisualStep } from '../../contracts';
import { selectVisualStyle } from '../../math/universal/style-selector';
import { getReferenceQAProfile } from '../../qa/visual/reference-qa-profiles';

export interface VisualStepAgentInput { lesson: Lesson; paragraphId?: string; }
export interface VisualStepAgentOutput { lesson: Lesson; paragraphIds: string[]; }

/** Converts the already-generated v43 visual actions into canonical paragraph-scoped visual steps.
 * It deliberately does not replace the v43 visual planner; it is an adapter/normalizer.
 */
export class VisualStepAgent {
  readonly name = 'visual-step' as const;

  async execute(request: AgentRequest<VisualStepAgentInput>): Promise<AgentResult<VisualStepAgentOutput>> {
    const target = request.input.paragraphId;
    const paragraphs = request.input.lesson.paragraphs.map((p) => {
      if (target && p.id !== target) return p;
      return normalizeParagraphVisuals(p);
    });
    return { ok: true, agent: 'visual-step', runId: request.context.runId, output: { lesson: { ...request.input.lesson, paragraphs }, paragraphIds: paragraphs.filter(p => !target || p.id === target).map(p => p.id) } };
  }
}

function inferParagraphGrade(p: Paragraph): number {
  const raw = p.source.sourceLocator ?? '';
  const match = raw.match(/(?:class|grade)[-_ ]?(\d{1,2})/i);
  return match ? Math.min(12, Math.max(1, Number(match[1]))) : 12;
}

function normalizeParagraphVisuals(p: Paragraph): Paragraph {
  const expression = [p.teachingIntent, p.source.text, p.explanation.english].join(' ');
  const domain = p.math?.domain ?? 'general';
  const selected = selectVisualStyle({ domain, expression, mode:'hybrid', grade: inferParagraphGrade(p), bilingual:true });
  const steps: VisualStep[] = p.visualSteps.map((step, index) => ({
    ...step,
    id: ids.visualStep(p.id, index),
    paragraphId: p.id,
    order: index,
    targetIds: step.targetIds ?? [],
    cueIds: step.cueIds ?? [],
    action: { ...step.action, visualStyleId: selected.style.id, qaProfileId: selected.style.qaProfileId, commonTeachingStyleId: selected.style.commonTeachingStyleId, referenceSegmentId: selected.referenceSegment?.id, referenceSegmentAsset: selected.referenceSegment?.asset, referenceSegmentStartMs: selected.referenceSegment?.sourceStartMs, referenceSegmentEndMs: selected.referenceSegment?.sourceEndMs, requiredVisualChecks: applicableChecks(step.action, getReferenceQAProfile(selected.style.qaProfileId).requiredChecks) },
  }));
  const validIds = new Set(steps.map(s => s.id));
  const cues = p.audioCues.map(c => ({ ...c, paragraphId: p.id, visualStepId: c.visualStepId && validIds.has(c.visualStepId) ? c.visualStepId : undefined }));
  return { ...p, visualSteps: steps, audioCues: cues, qa: { ...p.qa, visual: 'pending' } };
}

function applicableChecks(action: Record<string, unknown>, checks: string[]): string[] {
  const type = String(action.type ?? '');
  const out = new Set<string>();
  for (const check of checks) {
    const applicable = check === 'latex-token-decomposition' ? ['latex','transform','highlight'].includes(type)
      : check === 'token-equation-transformation' ? ['transform','move','latex'].includes(type)
      : check === 'term-movement' ? ['move','transform'].includes(type)
      : check === 'symbol-morphing' ? type === 'transform'
      : check === 'operation-animation' ? ['move','transform','write','latex'].includes(type)
      : check === 'fraction-transformation' ? ['transform','shape','move','latex'].includes(type)
      : check === 'arrow-annotation' ? ['line','write','latex','highlight'].includes(type) || action.annotation != null
      : check === 'highlight-circle-underline' ? ['highlight','shape','line'].includes(type)
      : check === 'write-erase' ? ['write','erase','latex'].includes(type)
      : check === 'graph-progressive-drawing' ? ['chart','line','point','shape'].includes(type)
      : check === 'geometry-progressive-construction' ? ['shape','line','point'].includes(type)
      : check === 'camera-zoom-pan' ? action.camera != null || action.viewport != null || action.zoom != null || action.pan != null
      : check === 'pause-emphasis' ? type === 'pause' || action.emphasis === true
      : check === 'voice-cue-sync' ? Boolean(action.cueId || action.voiceCue)
      : check === 'transformation-qa' ? type === 'transform'
      : false;
    if (applicable) out.add(check);
  }
  return [...out];
}
