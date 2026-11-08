import { NextResponse } from 'next/server';
import { studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { newId, readData, update } from '@/lib/ai-guru/admin/store';
import { readContent, updateContent } from '@/lib/ai-guru/admin/content-store';
import { scoreAttempt, studentView } from '@/lib/ai-guru/admin/class-content';

export const dynamic = 'force-dynamic';

/** GET — what my own teacher shared with my class (notes, exams, shared templates). Nobody outside the class sees any of it. */
export async function GET(req: Request) {
  const id = await studentFromRequest(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  const data = await readData();
  const me = data.students.find((s) => s.id === id);
  const g = me?.classId ? data.classes.find((x) => x.id === me.classId) : undefined;
  if (!me || !g) return NextResponse.json({ ok: true, class: null, items: [], unseen: 0, live: null });
  const c = await readContent();
  const items = c.items.filter((it) => it.classId === g.id).sort((a, z) => z.createdAt.localeCompare(a.createdAt))
    .map((it) => studentView(it, c.attempts.find((a) => a.itemId === it.id && a.studentId === me.id), me.teacherSeenAt)).filter(Boolean) as Array<{ id: string; title: string; kind: string; isNew: boolean; live?: boolean }>;
  const unseen = items.filter((i) => i.isNew).length;
  const live = items.find((i) => i.kind === 'exam' && i.live);
  if (new URL(req.url).searchParams.get('count') === '1') return NextResponse.json({ ok: true, unseen, live: live ? { id: live.id, title: live.title } : null });
  return NextResponse.json({ ok: true, class: { name: g.name, teacher: g.teacherName, serial: me.classSerial ?? null }, unseen, items });
}

/** POST { id, answers: number[] } — hand in an exam. One try; the mark and the right answers come back at once. */
export async function POST(req: Request) {
  const id = await studentFromRequest(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.action === 'seen') { await update((d) => { const s = d.students.find((x) => x.id === id); if (s) s.teacherSeenAt = new Date().toISOString(); }); return NextResponse.json({ ok: true }); }
  const data = await readData();
  const me = data.students.find((s) => s.id === id);
  if (!me?.classId) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  const r = await updateContent((c) => {
    const it = c.items.find((x) => x.id === b.id);
    if (!it || it.classId !== me.classId || !it.shared || it.kind !== 'exam') return 'Not found';
    if (!it.open) return 'This exam is not open now';
    if (c.attempts.some((a) => a.itemId === it.id && a.studentId === me.id)) return 'You have already handed this exam in';
    const sc = scoreAttempt(it, b.answers);
    const at = { id: newId('att'), itemId: it.id, classId: it.classId, studentId: me.id, ...sc, at: new Date().toISOString() };
    c.attempts.push(at);
    return studentView(it, at);
  });
  return typeof r === 'string' ? NextResponse.json({ ok: false, error: r }, { status: r === 'Not found' ? 404 : 400 }) : NextResponse.json({ ok: true, item: r });
}
