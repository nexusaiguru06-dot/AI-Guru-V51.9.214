import { NextResponse } from 'next/server';
import { answerDoubt } from '@/lib/ai-guru/integration/sprint6-learning-loop';
import type { Lesson } from '@/lib/ai-guru/contracts';
import type { AIGuruLesson } from '@/lib/ai-guru/lesson/types';
import { legacyLessonToCanonical } from '@/lib/ai-guru/integration/legacy-adapter';
export async function POST(request: Request) {
  try {
    const body = await request.json() as { lesson: Lesson | AIGuruLesson; paragraphId: string; question: string; language?: 'english'|'malayalam' };
    if (!body.lesson?.id || !body.paragraphId || !body.question?.trim()) return NextResponse.json({ ok: false, error: 'lesson, paragraphId and question are required' }, { status: 400 });
    const lesson = (body.lesson as Lesson).schemaVersion === '2.0' && 'courseId' in body.lesson ? body.lesson as Lesson : legacyLessonToCanonical(body.lesson as AIGuruLesson);
    return NextResponse.json({ ok: true, doubt: await answerDoubt(lesson, body.paragraphId, body.question, body.language ?? 'english') });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
