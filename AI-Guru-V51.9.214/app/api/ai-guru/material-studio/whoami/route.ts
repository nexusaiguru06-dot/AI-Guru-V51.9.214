import { NextResponse } from 'next/server';
import { requesterOf } from '@/lib/ai-guru/library/requester';

export const runtime = 'nodejs';

/**
 * V51.9.180 (UX review) — whether the person on the Material Studio is signed in, so the page tells them where their
 * book will go (the shared library, or kept privately for this browser) instead of describing both cases.
 * Only the kind is returned; never a name or id.
 */
export async function GET(request: Request) {
  const who = await requesterOf(request).catch(() => null);
  return NextResponse.json({ ok: true, signedIn: !!who, kind: who?.kind ?? 'guest' }, { headers: { 'cache-control': 'private, no-store' } });
}
