import { NextResponse } from 'next/server';
import { buildAssessment, evaluateAssessment } from '@/lib/ai-guru/integration/sprint6-learning-loop';
import type { Lesson } from '@/lib/ai-guru/contracts';
import type { AIGuruLesson } from '@/lib/ai-guru/lesson/types';
import { legacyLessonToCanonical } from '@/lib/ai-guru/integration/legacy-adapter';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { lesson: Lesson | AIGuruLesson; paragraphId?: string; response?: { itemId: string; answer: string } };
    if (!body.lesson?.id) return NextResponse.json({ ok: false, error: 'lesson is required' }, { status: 400 });
    const lesson = (body.lesson as Lesson).schemaVersion === '2.0' && 'courseId' in body.lesson ? body.lesson as Lesson : legacyLessonToCanonical(body.lesson as AIGuruLesson);
    if (body.response) return NextResponse.json({ ok: true, evaluation: await evaluateAssessment(lesson, body.response) });
    return NextResponse.json({ ok: true, assessment: await buildAssessment(lesson, body.paragraphId) });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
