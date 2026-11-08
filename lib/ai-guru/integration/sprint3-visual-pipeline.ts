import { ids, type Lesson } from '../contracts';
import { VisualStepAgent } from '../agents/visual/visual-step-agent';
import { runVisualStepQA } from '../qa/visual/visual-step-qa';
import { recoverVisualFailure } from '../recovery/visual-step-recovery';
import { executeAIGuruAgent } from '../runtime/execute-agent';

export interface VisualPipelineResult {
  lesson: Lesson;
  visualQA: ReturnType<typeof runVisualStepQA>;
  paragraphQA: Array<ReturnType<typeof runVisualStepQA>>;
  recoveryAttempts: number;
  status: 'passed'|'blocked';
}

/**
 * Sprint 3 visual pipeline. Each paragraph is an independent QA/recovery unit.
 * A failure in P12 never regenerates or mutates P11/P13. Repaired output must
 * pass Visual Step QA again before that paragraph is accepted.
 */
export async function runVisualStepPipeline(lesson: Lesson, paragraphId?: string, maxAttempts = 3): Promise<VisualPipelineResult> {
  const agent = new VisualStepAgent();
  let current = lesson;
  let recoveryAttempts = 0;
  const targets = paragraphId ? [paragraphId] : current.paragraphs.map(p => p.id);
  const paragraphQA: Array<ReturnType<typeof runVisualStepQA>> = [];

  for (const target of targets) {
    const generated = await executeAIGuruAgent(agent, { agent: 'visual-step', context: { runId: ids.agentRun(`visual-${current.id}-${target}-${Date.now()}`), lessonId: current.id, paragraphId: target }, input: { lesson: current, paragraphId: target } });
    if (!generated.ok || !generated.output) throw new Error(generated.error?.message ?? 'Visual Step Agent failed');
    current = generated.output.lesson;

    let qa = runVisualStepQA(current, { paragraphId: target });
    let attempts = 0;
    while (qa.status === 'failed' && attempts < maxAttempts) {
      const failure = qa.failures.find(f => f.recoverable && f.paragraphId === target);
      if (!failure) break;
      attempts += 1;
      recoveryAttempts += 1;
      current = recoverVisualFailure(current, failure);
      qa = runVisualStepQA(current, { paragraphId: target, problemId: failure.problemId, visualStepId: failure.visualStepId });
    }
    current = {
      ...current,
      paragraphs: current.paragraphs.map(p => p.id === target ? { ...p, qa: { ...p.qa, visual: qa.status === 'passed' ? 'passed' : 'failed' } } : p),
    };
    paragraphQA.push(qa);
  }

  const failures = paragraphQA.flatMap(q => q.failures);
  const aggregate = runVisualStepQA(current, paragraphId ? { paragraphId } : {});
  const visualQA = paragraphId ? aggregate : ({ ...aggregate, failures, status: (failures.some(f => f.severity === 'error') ? 'failed' : 'passed') as 'passed' | 'failed' });
  return { lesson: current, visualQA, paragraphQA, recoveryAttempts, status: failures.some(f => f.severity === 'error') ? 'blocked' : 'passed' };
}
