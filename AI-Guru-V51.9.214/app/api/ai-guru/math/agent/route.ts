import { NextResponse } from 'next/server';
import { ids } from '@/lib/ai-guru/contracts';
import { MathAgent } from '@/lib/ai-guru/agents/math';
import { MathJsMathstepsVerifier } from '@/lib/ai-guru/math/mathjs-mathsteps';
import { SympyHttpVerifier } from '@/lib/ai-guru/math/adapters/sympy';
import { legacyLessonToCanonical, canonicalLessonToLegacy } from '@/lib/ai-guru/integration/legacy-adapter';
import type { AIGuruLesson } from '@/lib/ai-guru/lesson/types';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { lesson: AIGuruLesson; paragraphId?: string };
    if (!body.lesson?.paragraphs?.length) return NextResponse.json({ ok: false, error: 'lesson.paragraphs is required' }, { status: 400 });
    const canonical = legacyLessonToCanonical(body.lesson);
    const runId = ids.agentRun(`math-api-${canonical.id}-${Date.now()}`);
    const baseVerifier = new MathJsMathstepsVerifier();
    const sympy = new SympyHttpVerifier();
    const verifier = sympy.configured ? { verify: async (expression: string, expected?: string) => { const primary = await baseVerifier.verify(expression, expected); if (primary.valid) return primary; const advanced = await sympy.verify(expression, expected); return advanced.valid ? advanced : primary; } } : baseVerifier;
    const result = await new MathAgent(verifier).execute({
      agent: 'math',
      context: { runId, lessonId: canonical.id, paragraphId: body.paragraphId },
      input: { lesson: canonical, paragraphId: body.paragraphId },
    });
    if (!result.ok || !result.output) return NextResponse.json({ ok: false, error: result.error?.message ?? 'Math agent failed' }, { status: 500 });
    const failures = result.output.lesson.paragraphs.flatMap(p => (p.math?.failures ?? []).map(message => ({ paragraphId: p.id, message })));
    return NextResponse.json({ ok: failures.length === 0, runId, lesson: canonicalLessonToLegacy(result.output.lesson, body.lesson), canonicalLesson: result.output.lesson, failures });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
