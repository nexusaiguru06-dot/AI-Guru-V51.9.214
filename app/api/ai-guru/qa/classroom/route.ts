import { NextResponse } from 'next/server';
import { runClassroomQA } from '@/lib/ai-guru/qa/classroom';
import type { Lesson } from '@/lib/ai-guru/contracts';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { lesson: Lesson };
    if (!body.lesson) return NextResponse.json({ ok: false, error: 'lesson is required' }, { status: 400 });
    const qa = runClassroomQA(body.lesson);
    return NextResponse.json({ ok: qa.status === 'passed', qa });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
