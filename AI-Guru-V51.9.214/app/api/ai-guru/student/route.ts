import { NextResponse } from 'next/server';
import { analyzeStudent } from '@/lib/ai-guru/integration/sprint6-learning-loop';
import type { Lesson } from '@/lib/ai-guru/contracts';
import type { StudentAttempt } from '@/lib/ai-guru/agents/student-intelligence';
export async function POST(request: Request) {
  try {
    const body = await request.json() as { lesson: Lesson; studentId: string; attempts: StudentAttempt[] };
    if (!body.lesson?.id || !body.studentId || !Array.isArray(body.attempts)) return NextResponse.json({ ok: false, error: 'lesson, studentId and attempts are required' }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await analyzeStudent(body.lesson, body.studentId, body.attempts)) });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
