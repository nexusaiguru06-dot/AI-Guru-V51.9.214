import { NextResponse } from 'next/server';
import { synchronizeLessonWords } from '@/lib/ai-guru/sync';
import type { Lesson } from '@/lib/ai-guru/contracts';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { lesson: Lesson; wordBoundaries?: Record<string, { language: 'english'|'malayalam'; word: string; startMs: number; endMs?: number }[]> };
    if (!body.lesson) return NextResponse.json({ ok: false, error: 'lesson is required' }, { status: 400 });
    const result = synchronizeLessonWords(body.lesson, body.wordBoundaries ?? {});
    return NextResponse.json({ ok: result.failures.length === 0, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
