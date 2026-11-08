import { NextResponse } from 'next/server';
import { askerFor, avatarForReel } from '@/lib/ai-guru/teacher/avatar-api';

export const dynamic = 'force-dynamic';

/**
 * V51.9.100 — GET: the signed-in student's class teacher's avatar, for the reels the student makes.
 * Only when the teacher ticked consent and "my students may use it". 404 otherwise (no class, not shared).
 */
export async function GET(req: Request) {
  const a = await askerFor(req, {});
  if ('error' in a) return a.error;
  const avatar = await avatarForReel(a.id, true);
  if (!avatar) return NextResponse.json({ ok: false, error: 'Your teacher has not shared an avatar.' }, { status: 404 });
  return NextResponse.json({ ok: true, avatar }, { headers: { 'cache-control': 'private, no-store' } });
}
