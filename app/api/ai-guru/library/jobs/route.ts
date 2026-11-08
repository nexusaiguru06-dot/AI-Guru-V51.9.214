import { NextResponse } from 'next/server';
import { requesterOf } from '@/lib/ai-guru/library/requester';
import { jobsFor, pump, requestCloudMaterials } from '@/lib/ai-guru/library/cloud';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** V51.9.95 — create study materials on the AI Guru cloud.
 *  GET                — the caller's jobs (the admin sees every job), newest first
 *  POST { documentId, part, types[] } — one job per type; a type that already exists for that part is returned, not made again */
export async function GET(req: Request) {
  const who = await requesterOf(req);
  if (!who) return NextResponse.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  void pump(); // V51.9.177: every status look also starts waiting jobs (and jobs whose server copy went away)
  const list = (await jobsFor(who.kind === 'admin' ? { kind: 'admin' } : { kind: 'student', id: who.student.id })).slice(0, 100);
  return NextResponse.json({ ok: true, jobs: who.kind === 'admin' ? list : list.map(({ by: _b, runner: _r, ...j }) => j) }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  const who = await requesterOf(req);
  if (!who) return NextResponse.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const r = await requestCloudMaterials(who, String(b.documentId ?? ''), Math.round(Number(b.part)), Array.isArray(b.types) ? b.types.map(String) : []);
  return r.ok ? NextResponse.json({ ok: true, results: r.results.map((x) => ({ type: x.type, existing: x.existing, error: x.error, job: x.job ? { id: x.job.id, status: x.job.status } : undefined })) }) : NextResponse.json({ ok: false, error: r.error }, { status: r.status });
}
