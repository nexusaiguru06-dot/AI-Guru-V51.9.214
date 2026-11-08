import { NextResponse } from 'next/server';
import { denied } from '../../guard';
import { photoResponse, readPhoto } from '@/lib/ai-guru/admin/photo-store';
import { removePhotoFor, savePhotoFor } from '@/lib/ai-guru/admin/photo-api';

export const dynamic = 'force-dynamic';

/**
 * V51.9.99 — students' photos for the office.
 * GET ?id=                                       the picture
 * POST { id, image?, onReels, guardianOk }       add / replace (e.g. from the admission form), or change the switches
 * DELETE ?id=                                    remove (also to take down a photo that should not be there)
 */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const p = await readPhoto(new URL(req.url).searchParams.get('id') ?? '');
  return p ? photoResponse(p) : NextResponse.json({ ok: false, error: 'No photo' }, { status: 404 });
}

export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return savePhotoFor(String(b.id ?? ''), b, 'admin');
}

export async function DELETE(req: Request) {
  const d = await denied(req); if (d) return d;
  return removePhotoFor(new URL(req.url).searchParams.get('id') ?? '', 'admin');
}
