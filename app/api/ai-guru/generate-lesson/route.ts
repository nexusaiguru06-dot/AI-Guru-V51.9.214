import { NextResponse } from 'next/server';
import type { AIGuruLesson, ParagraphSource } from '@/lib/ai-guru/lesson/types';
import { HybridMathVerifier } from '@/lib/ai-guru/math/verifier';
import { MathJsMathstepsVerifier } from '@/lib/ai-guru/math/mathjs-mathsteps';
import { runV43TeachingPipeline } from '@/lib/ai-guru/integration/v43-pipeline';
import { validateLesson } from '@/lib/ai-guru/lesson/validate';
import { validateAIGuruLesson } from '@/lib/ai-guru/qa/validator';

/** Existing v43 endpoint, now routed through the canonical multi-agent pipeline. */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { source: ParagraphSource; title?: string; lessonId?: string };
    if (!body.source?.text) return NextResponse.json({ ok: false, error: 'source.text is required' }, { status: 400 });

    const paragraphId = `${body.source.bookId}:${body.source.pageNumber}:${body.source.paragraphIndex}`;
    const lesson: AIGuruLesson = {
      schemaVersion: '1.0',
      id: body.lessonId || `lesson:${body.source.bookId}`,
      title: body.title || 'AI Guru Lesson',
      language: { source: 'english', target: 'malayalam' },
      teachingMode: 'two-pass',
      paragraphs: [{
        id: paragraphId,
        source: body.source,
        english: { text: '', visuals: [] },
        malayalam: { text: '', visuals: [] },
        cues: [],
        verified: false,
      }],
    };

    const pipeline = await runV43TeachingPipeline(lesson);
    const generated = pipeline.lesson;

    const mathVerifier = new HybridMathVerifier(new MathJsMathstepsVerifier());
    const latex = generated.paragraphs.flatMap(p => [...p.english.visuals, ...p.malayalam.visuals])
      .filter((v: any) => v.type === 'latex').map((v: any) => String(v.latex));
    const mathChecks = await Promise.all(latex.map(x => mathVerifier.verify(x)));
    const mathValid = mathChecks.every(x => x.valid);
    generated.paragraphs.forEach(p => { p.verified = mathValid; });

    const validation = [
      ...validateLesson(generated),
      ...validateAIGuruLesson(generated).map(x => ({ severity: x.severity === 'error' ? 'error' : 'warning', code: x.code, message: x.message })),
    ];

    return NextResponse.json({
      ok: pipeline.status === 'passed' && !validation.some(x => x.severity === 'error'),
      lesson: generated,
      pipeline: { runId: pipeline.runId, status: pipeline.status, contentQA: pipeline.contentQA, lessonQA: pipeline.lessonQA, visualQA: pipeline.visualQA, visualParagraphQA: pipeline.visualParagraphQA, visualRecoveryAttempts: pipeline.visualRecoveryAttempts, math: pipeline.math, mathFailures: pipeline.mathFailures },
      mathChecks,
      validation,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
