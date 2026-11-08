import { NextResponse } from 'next/server';
import { deleteSet, readSets, upsertSet } from '@/lib/ai-guru/quiz/sets-server';
import { teacherGate } from '@/lib/ai-guru/admin/auth';

export const dynamic = 'force-dynamic';

/** GET — the teacher's question sets (?active=1 for the students: only the sets the teacher has switched on). */
export async function GET(request: Request) {
  const active = new URL(request.url).searchParams.get('active') === '1';
  if (!active) { const no = await teacherGate(request); if (no) return no; } // V51.9.173: hidden sets are the teacher's
  const all = await readSets();
  const sets = active ? all.filter((s) => s.active) : all;
  return NextResponse.json({ ok: true, sets });
}

/** POST { set } — add or update. V51.9.173: teacher or admin only. */
export async function POST(request: Request) {
  const no = await teacherGate(request); if (no) return no;
  try {
    const b = await request.json();
    const set = await upsertSet(b.set);
    return set ? NextResponse.json({ ok: true, set }) : NextResponse.json({ ok: false, error: 'A set needs a name and at least one complete question.' }, { status: 400 });
  } catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const no = await teacherGate(request); if (no) return no;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  await deleteSet(id);
  return NextResponse.json({ ok: true });
}
