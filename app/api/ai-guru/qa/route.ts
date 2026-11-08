import { NextResponse } from 'next/server';
import { validateAIGuruLesson } from '@/lib/ai-guru/qa/validator';
import { legacyLessonToCanonical } from '@/lib/ai-guru/integration/legacy-adapter';
import { runVisualStepQA } from '@/lib/ai-guru/qa/visual/visual-step-qa';
import { runTeachingStrategyQA } from '@/lib/ai-guru/qa/teaching-strategy';
import { runMathStepsQA } from '@/lib/ai-guru/qa/math-steps';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { lesson: any; paragraphId?: string; problemId?: string; visualStepId?: string };
    const lesson = body.lesson ?? body;
    const items = validateAIGuruLesson(lesson);
    const canonical = legacyLessonToCanonical(lesson);
    const visualQA = runVisualStepQA(canonical, { paragraphId: body.paragraphId, problemId: body.problemId, visualStepId: body.visualStepId });
    const strategyQA = runTeachingStrategyQA(canonical, body.paragraphId);
    const mathStepsQA = runMathStepsQA(canonical, body.paragraphId);
    return NextResponse.json({ ok: !items.some(x => x.severity === 'error') && visualQA.status !== 'failed' && strategyQA.status !== 'failed' && mathStepsQA.status !== 'failed', items, visualQA, strategyQA, mathStepsQA });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
