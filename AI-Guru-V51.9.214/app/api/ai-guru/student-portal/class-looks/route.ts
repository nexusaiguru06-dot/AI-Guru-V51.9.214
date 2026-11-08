import { NextResponse } from 'next/server';
import { studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { readData } from '@/lib/ai-guru/admin/store';
import { recordLook, todayCounts } from '@/lib/ai-guru/reels/class-looks';

export const dynamic = 'force-dynamic';

async function me(req: Request) {
  const id = await studentFromRequest(req);
  if (!id) return null;
  const s = (await readData()).students.find((x) => x.id === id);
  return s ? { id: s.id, classId: s.classId ?? null } : null;
}

/** GET — V51.9.105: how many classmates used each reel look today (the student's own reels left out). */
export async function GET(req: Request) {
  const s = await me(req);
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  if (!s.classId) return NextResponse.json({ ok: true, counts: {} });
  return NextResponse.json({ ok: true, counts: await todayCounts(s.classId, s.id) });
}

/** POST { look } — the student downloaded a reel in this look (only the id is sent). */
export async function POST(req: Request) {
  const s = await me(req);
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { look?: unknown };
  if (typeof b.look !== 'string' || b.look.length > 20) return NextResponse.json({ ok: false, error: 'look' }, { status: 400 });
  if (s.classId) await recordLook(s.classId, s.id, b.look);
  return NextResponse.json({ ok: true });
}
