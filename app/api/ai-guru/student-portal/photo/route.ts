import { NextResponse } from 'next/server';
import { isAdmin, studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { photoResponse, readPhoto } from '@/lib/ai-guru/admin/photo-store';
import { removePhotoFor, savePhotoFor } from '@/lib/ai-guru/admin/photo-api';

export const dynamic = 'force-dynamic';

/** The signed-in student (or the admin viewing their portal with ?as=). */
async function who(req: Request): Promise<string | null> {
  const asId = new URL(req.url).searchParams.get('as');
  return asId && (await isAdmin(req)) ? asId : studentFromRequest(req);
}

/**
 * V51.9.99 — the student's own photo.
 * GET                                   the picture (404 when there is none)
 * POST { image?, onReels, guardianOk }  add / replace the photo, or change only the two switches
 * DELETE                                remove it
 */
export async function GET(req: Request) {
  const id = await who(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await readPhoto(id);
  return p ? photoResponse(p) : NextResponse.json({ ok: false, error: 'No photo' }, { status: 404 });
}

export async function POST(req: Request) {
  const id = await who(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return savePhotoFor(id, b, 'student');
}

export async function DELETE(req: Request) {
  const id = await who(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  return removePhotoFor(id, 'student');
}
