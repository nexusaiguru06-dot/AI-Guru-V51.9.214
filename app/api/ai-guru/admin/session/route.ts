import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/ai-guru/admin/auth';

export const dynamic = 'force-dynamic';
/** { ok: true } only for a signed-in admin; the admin page uses it to send everyone else back to the classroom. */
export async function GET(request: Request) {
  return (await isAdmin(request)) ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false }, { status: 404 });
}
