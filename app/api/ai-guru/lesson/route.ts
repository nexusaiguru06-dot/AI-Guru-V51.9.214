import { NextResponse } from 'next/server';
import type { AIGuruLesson } from '@/lib/ai-guru/lesson/types';
import { validateLesson } from '@/lib/ai-guru/lesson/validate';
import { legacyLessonToCanonical } from '@/lib/ai-guru/integration/legacy-adapter';

export async function POST(request: Request) {
  try {
    const lesson = (await request.json()) as AIGuruLesson;
    const diagnostics = validateLesson(lesson);
    const hasErrors = diagnostics.some((item) => item.severity === 'error');
    if (hasErrors) {
      return NextResponse.json({ ok: false, error: 'Invalid AI Guru lesson', diagnostics }, { status: 400 });
    }
    const canonical = legacyLessonToCanonical(lesson);
    return NextResponse.json({ ok: true, lesson, canonical, diagnostics, runtime: 'ai-guru-native-v8.2' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
