import { NextResponse } from 'next/server';
import { readSessions, recordEvent } from '@/lib/ai-guru/attendance/server-store';
import { teacherGate } from '@/lib/ai-guru/admin/auth';

export const dynamic = 'force-dynamic';

/** POST { type: 'start' | 'beat' | 'end', sessionId, studentId, studentName } — sent by the classroom (also by sendBeacon on closing). */
export async function POST(request: Request) {
  try {
    const b = await request.json();
    if (!['start', 'beat', 'end'].includes(b?.type)) return NextResponse.json({ ok: false }, { status: 400 });
    await recordEvent({ type: b.type, sessionId: String(b.sessionId ?? ''), studentId: String(b.studentId ?? ''), studentName: String(b.studentName ?? '') });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }, { status: 500 }); }
}

/** GET — the last 120 days of visits (the teacher's page builds the register in its own time zone). V51.9.173: teacher or admin only. */
export async function GET(request: Request) {
  const no = await teacherGate(request); if (no) return no;
  const cut = Date.now() - 120 * 86400000;
  const sessions = (await readSessions()).filter((s) => Date.parse(s.enteredAt) >= cut);
  return NextResponse.json({ ok: true, now: Date.now(), sessions });
}
