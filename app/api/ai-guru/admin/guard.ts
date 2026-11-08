import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/ai-guru/admin/auth';

/** Not signed in as admin: answer exactly as an unknown address would, so the portal's existence is not shown. */
export async function denied(req: Request): Promise<NextResponse | null> {
  return (await isAdmin(req)) ? null : NextResponse.json({ ok: false }, { status: 404 });
}
export const bad = (problems: string[] | string, status = 400) => NextResponse.json({ ok: false, error: Array.isArray(problems) ? problems.join('. ') : problems }, { status });
