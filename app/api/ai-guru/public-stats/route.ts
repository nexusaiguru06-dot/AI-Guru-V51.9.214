import { NextResponse } from 'next/server';
import { publicStats } from '@/lib/ai-guru/public/stats';

export const dynamic = 'force-dynamic';
/** GET — counts and testimonials for the public pages (no names or contact details of students). */
export async function GET() { return NextResponse.json({ ok: true, ...(await publicStats()) }); }
