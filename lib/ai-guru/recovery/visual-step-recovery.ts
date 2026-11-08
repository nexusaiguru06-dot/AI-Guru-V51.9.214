import { ids, type Lesson, type Paragraph, type Problem, type VisualStep } from '../contracts';
import { selectRecoveryScope, defaultMaxRecoveryAttempts } from '../contracts/recovery-policy';
import type { QAFailure } from '../contracts';

/** Smallest-scope visual recovery. It never rewrites unrelated paragraphs. */
export function recoverVisualFailure(lesson: Lesson, failure: QAFailure): Lesson {
  if (!failure.paragraphId) return lesson;
  return {
    ...lesson,
    paragraphs: lesson.paragraphs.map(p => p.id === failure.paragraphId ? recoverParagraph(p, failure) : p),
  };
}

function recoverParagraph(p: Paragraph, failure: QAFailure): Paragraph {
  if (failure.problemId) {
    return { ...p, problems: p.problems.map(problem => problem.id === failure.problemId ? recoverProblem(problem, failure) : problem), qa: { ...p.qa, visual: 'pending' } };
  }
  if (failure.visualStepId) {
    const steps = p.visualSteps.map((step, i) => step.id === failure.visualStepId ? normalizeStep(step, p.id, i) : step);
    return { ...p, visualSteps: steps, qa: { ...p.qa, visual: 'pending' } };
  }
  const steps = p.visualSteps.map((step, i) => normalizeStep(step, p.id, i));
  return { ...p, visualSteps: steps, qa: { ...p.qa, visual: 'pending' } };
}

function recoverProblem(problem: Problem, failure: QAFailure): Problem {
  return { ...problem, visualSteps: problem.visualSteps.map((step, i) => normalizeStep(step, problem.id, i)) };
}

function normalizeStep(step: VisualStep, parentId: string, index: number): VisualStep {
  return { ...step, id: step.id, paragraphId: parentId as Paragraph['id'], order: index };
}

export { selectRecoveryScope, defaultMaxRecoveryAttempts };
