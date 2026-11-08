import { NextResponse } from 'next/server';
import { readState, writeState } from '@/lib/ai-guru/teacher/dna-server';
import { teacherGate } from '@/lib/ai-guru/admin/auth';

export const dynamic = 'force-dynamic';

/** The teacher's pinned DNAs and video-learned templates. Everyone's classroom reads them; V51.9.173: only the teacher (or admin) changes them. */
export async function GET() {
  return NextResponse.json({ ok: true, ...(await readState()) });
}

/** POST { pins, templates } — the teacher's full lists (the classroom reads them back on start). */
export async function POST(request: Request) {
  const no = await teacherGate(request); if (no) return no;
  try {
    const b = await request.json();
    const st = await writeState({ pins: b.pins, templates: b.templates });
    return NextResponse.json({ ok: true, pins: st.pins.length, templates: st.templates.length });
  } catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
