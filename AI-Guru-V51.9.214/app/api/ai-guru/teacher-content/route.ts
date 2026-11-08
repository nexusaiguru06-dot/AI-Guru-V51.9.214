import { NextResponse } from 'next/server';
import { openClass } from '@/lib/ai-guru/admin/teacher-auth';
import { newId } from '@/lib/ai-guru/admin/store';
import { readContent, updateContent } from '@/lib/ai-guru/admin/content-store';
import { cleanItem, STARTERS, type ClassItem } from '@/lib/ai-guru/admin/class-content';

export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/**
 * POST { code, key, action } — a teacher's own notes, templates and exams for THEIR class only (every item is stored under that class).
 *   list                          → items (with how many students have handed in each exam) and starter templates
 *   save  { item:{ id?, kind, title, body, questions?, minutes?, shared?, open? } }
 *   delete { id }    toggle { id, field: 'shared' | 'open' | 'live' }  (live = send the exam into the regular class)    use { id, kind? } copies an item into a new one
 *   results { id }                → every student of the class with their mark (roll no., student number, name, score)
 */
export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const o = await openClass(request, b);
  if ('error' in o) return o.error;
  const { g, data } = o;
  const mine = (it: ClassItem) => it.classId === g.id;

  if (b.action === 'list') {
    const c = await readContent();
    const items = c.items.filter(mine).sort((a, z) => z.updatedAt.localeCompare(a.updatedAt)).map((it) => ({ ...it, handedIn: c.attempts.filter((a) => a.itemId === it.id).length }));
    return NextResponse.json({ ok: true, items, starters: STARTERS, students: data.students.filter((s) => s.classId === g.id).length });
  }
  if (b.action === 'save') {
    const r = (b.item ?? {}) as Record<string, unknown>;
    const f = cleanItem(r);
    if (typeof f === 'string') return bad(f);
    const now = new Date().toISOString();
    const out = await updateContent((c) => {
      const old = r.id ? c.items.find((x) => x.id === r.id) : undefined;
      if (r.id && (!old || !mine(old))) return 'Not found';
      if (old) {
        // an exam that has been taken keeps its questions: changing them would make the marks meaningless
        if (old.kind === 'exam' && c.attempts.some((a) => a.itemId === old.id) && JSON.stringify(f.questions) !== JSON.stringify(old.questions)) return 'Students have already handed this exam in. Make a copy to change the questions.';
        Object.assign(old, f, { updatedAt: now });
        if (r.shared !== undefined) { if (!!r.shared && !old.shared) old.sharedAt = now; old.shared = !!r.shared; }
        if (r.open !== undefined) old.open = !!r.open;
        return old;
      }
      const it: ClassItem = { id: newId('itm'), classId: g.id, ...f, shared: r.shared !== undefined ? !!r.shared : f.kind !== 'template', open: f.kind === 'exam' ? !!r.open : false, createdAt: now, updatedAt: now };
      if (it.shared) it.sharedAt = now;
      c.items.push(it);
      return it;
    });
    return typeof out === 'string' ? bad(out, out === 'Not found' ? 404 : 400) : NextResponse.json({ ok: true, item: out });
  }
  if (b.action === 'delete') {
    const r = await updateContent((c) => { const it = c.items.find((x) => x.id === b.id); if (!it || !mine(it)) return false; c.items = c.items.filter((x) => x.id !== it.id); c.attempts = c.attempts.filter((a) => a.itemId !== it.id); return true; });
    return r ? NextResponse.json({ ok: true }) : bad('Not found', 404);
  }
  if (b.action === 'toggle') {
    const field = b.field === 'open' ? 'open' : b.field === 'live' ? 'live' : 'shared';
    const r = await updateContent((c) => {
      const it = c.items.find((x) => x.id === b.id); if (!it || !mine(it)) return null;
      if ((field === 'open' || field === 'live') && it.kind !== 'exam') return null;
      const now = new Date().toISOString();
      if (field === 'live') {
        // "send into the regular class": shown, open and popping up while students learn
        const on = !it.live;
        it.live = on;
        if (on) { it.shared = true; it.open = true; it.sharedAt = now; }
        it.updatedAt = now; return it.live;
      }
      it[field] = !it[field];
      if (field === 'shared' && it.shared) it.sharedAt = now;
      if (field === 'open' && !it.open) it.live = false;
      it.updatedAt = now; return it[field];
    });
    return r === null ? bad('Not found', 404) : NextResponse.json({ ok: true, value: r });
  }
  if (b.action === 'use') {
    const r = await updateContent((c) => {
      const it = c.items.find((x) => x.id === b.id) ?? undefined;
      const st = it ? undefined : STARTERS.find((x) => x.id === b.id);
      const src = it && mine(it) ? it : st;
      if (!src) return null;
      const kind = b.kind === 'exam' || b.kind === 'template' || b.kind === 'note' ? b.kind : src.kind === 'template' ? 'note' : src.kind;
      const now = new Date().toISOString();
      const copy: ClassItem = { id: newId('itm'), classId: g.id, kind, title: src.title, body: src.body, questions: kind === 'exam' ? (src.questions ? JSON.parse(JSON.stringify(src.questions)) : [{ q: 'Question 1', options: ['A', 'B', 'C', 'D'], answer: 0 }]) : undefined, minutes: (src as { minutes?: number }).minutes, shared: false, open: false, live: false, createdAt: now, updatedAt: now };
      c.items.push(copy);
      return copy;
    });
    return r ? NextResponse.json({ ok: true, item: r }) : bad('Not found', 404);
  }
  if (b.action === 'results') {
    const c = await readContent();
    const it = c.items.find((x) => x.id === b.id);
    if (!it || !mine(it) || it.kind !== 'exam') return bad('Not found', 404);
    const members = data.students.filter((s) => s.classId === g.id).sort((a, z) => (a.classSerial ?? 1e9) - (z.classSerial ?? 1e9));
    const rows = members.map((s) => { const a = c.attempts.find((x) => x.itemId === it.id && x.studentId === s.id); return { serial: s.classSerial ?? null, studentCode: s.studentCode ?? '', name: s.name, done: !!a, score: a?.score ?? null, total: it.questions?.length ?? 0, at: a?.at ?? null }; });
    const done = rows.filter((r) => r.done);
    return NextResponse.json({ ok: true, title: it.title, rows, handedIn: done.length, average: done.length ? Math.round((done.reduce((s, r) => s + (r.score! / Math.max(1, r.total)) * 100, 0) / done.length)) : null });
  }
  return bad('Unknown action');
}
