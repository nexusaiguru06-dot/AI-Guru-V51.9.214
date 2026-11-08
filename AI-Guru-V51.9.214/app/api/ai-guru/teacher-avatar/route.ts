import { NextResponse } from 'next/server';
import { askerFor, avatarForReel, saveAvatar } from '@/lib/ai-guru/teacher/avatar-api';
import { deleteAvatar, readMeta } from '@/lib/ai-guru/teacher/avatar-store';

export const dynamic = 'force-dynamic';

/**
 * V51.9.100 — the teacher's own avatar (Teacher Portal → My avatar). Always POST: the class code and key travel in the body.
 * { code, key, action: 'get' }     the saved avatar (or null)
 * { code, key, action: 'save', … } photo, mouth/eye marks, style, consent, sharing, voice sample, face video
 * { code, key, action: 'remove' }  delete everything (photo, voice, video, settings)
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.code === undefined && b.key === undefined) return NextResponse.json({ ok: false, error: 'Sign in with your class code and teacher key.' }, { status: 401 });
  const a = await askerFor(req, b);
  if ('error' in a) return a.error;
  if (a.role !== 'teacher') return NextResponse.json({ ok: false }, { status: 403 });
  if (b.action === 'save') return saveAvatar(a, b);
  if (b.action === 'remove') {
    await deleteAvatar(a.id);
    return NextResponse.json({ ok: true, meta: null, avatar: null });
  }
  return NextResponse.json({ ok: true, id: a.id, teacherName: a.name, meta: await readMeta(a.id), avatar: await avatarForReel(a.id) }, { headers: { 'cache-control': 'private, no-store' } });
}
