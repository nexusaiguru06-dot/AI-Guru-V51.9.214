/**
 * V51.9.153 — the office's messages (admin only).
 *   GET ?category=&status=&kind=&q=&offset=   — the inbox: who wrote (name, ID), colour, status, unread; 50 at a time
 *   POST { action: 'open', id }               — one conversation in full (marks it read for the office)
 *   POST { action: 'reply', id, text }        — the office answers
 *   POST { action: 'compose', to: { role, id }, text } — the office writes first to a student or a teacher
 *   POST { action: 'status', id, status }     — mark closed / needs reply
 *   POST { action: 'people', q }              — find a student or teacher to write to
 *   POST { action: 'kb' } | { action: 'kb-save', entry } | { action: 'kb-delete', id } — the bot's knowledge base
 */
import { NextResponse } from 'next/server';
import { denied, bad } from '../guard';
import { readData } from '@/lib/ai-guru/admin/store';
import { CATEGORIES, OFFICE, addMessage, cleanText, counts, inbox, markRead, newThread, threadIdFor, type Category, type KbEntry, type Party, type Status, type ThreadKind } from '@/lib/ai-guru/messages/core';
import { readIndex, readKb, readThread, saveThread, serial, writeKb } from '@/lib/ai-guru/messages/store';
import { allTeachers, studentParty } from '@/lib/ai-guru/messages/people';

export const dynamic = 'force-dynamic';
const PAGE = 50;

export async function GET(req: Request) {
  const no = await denied(req); if (no) return no;
  const u = new URL(req.url).searchParams;
  const all = await readIndex();
  const list = inbox(all, { category: (u.get('category') as Category | 'all') || 'all', status: (u.get('status') as Status | 'all' | 'open') || 'all', kind: (u.get('kind') as ThreadKind | 'all') || 'all', q: u.get('q') ?? '' });
  const offset = Math.max(0, Number(u.get('offset') ?? 0) || 0);
  const unread = all.filter((t) => t.kind !== 'teacher-student').reduce((a, t) => a + (t.unread.admin ?? 0), 0);
  // the list shows who wrote, not what they wrote
  const items = list.slice(offset, offset + PAGE).map(({ last, ...rest }) => { void last; return rest; });
  return NextResponse.json({ ok: true, total: list.length, offset, items, counts: counts(all), unread });
}

export async function POST(req: Request) {
  const no = await denied(req); if (no) return no;
  const b = await req.json().catch(() => ({}));
  if (b.action === 'open' || b.action === 'reply' || b.action === 'status') {
    const id = String(b.id ?? '');
    return serial(async () => {
      const t = await readThread(id);
      if (!t) return bad('No such conversation.', 404);
      if (b.action === 'reply') {
        if (t.kind === 'teacher-student') return bad('This is a conversation between a teacher and a student; the office can read it but not write in it.');
        const text = cleanText(b.text);
        if (!text) return bad('Write a reply first.');
        addMessage(t, { at: new Date().toISOString(), from: 'admin', by: OFFICE, text });
      }
      if (b.action === 'status' && ['needs-reply', 'answered', 'closed', 'bot'].includes(b.status)) t.status = b.status;
      markRead(t, 'admin');
      await saveThread(t);
      return NextResponse.json({ ok: true, thread: t });
    });
  }
  if (b.action === 'compose') {
    const text = cleanText(b.text);
    if (!text) return bad('Write a message first.');
    const data = await readData();
    const to = b.to ?? {};
    let kind: ThreadKind;
    let party: Party;
    if (to.role === 'student') { const st = data.students.find((s) => s.id === to.id); if (!st) return bad('No such student.'); kind = 'student-admin'; party = studentParty(st); }
    else if (to.role === 'teacher') { const te = allTeachers(data).find((x) => x.id === to.id); if (!te) return bad('No such teacher.'); kind = 'teacher-admin'; party = te; }
    else return bad('Choose a student or a teacher.');
    return serial(async () => {
      const t = (await readThread(threadIdFor(kind, party.id))) ?? newThread(kind, party);
      addMessage(t, { at: new Date().toISOString(), from: 'admin', by: OFFICE, text });
      markRead(t, 'admin');
      await saveThread(t);
      return NextResponse.json({ ok: true, thread: t });
    });
  }
  if (b.action === 'people') {
    const q = String(b.q ?? '').trim().toLowerCase();
    const data = await readData();
    const hit = (xs: Array<string | undefined>) => !q || xs.some((x) => (x ?? '').toLowerCase().includes(q));
    const students = data.students.filter((s) => hit([s.name, s.studentCode, s.admissionNo, s.guardianPhone])).slice(0, 12).map((s) => ({ ...studentParty(s), standard: s.standard }));
    const teachers = allTeachers(data).filter((t) => hit([t.name, t.code])).slice(0, 8);
    return NextResponse.json({ ok: true, people: [...teachers, ...students] });
  }
  if (b.action === 'kb') return NextResponse.json({ ok: true, kb: await readKb() });
  if (b.action === 'kb-save' || b.action === 'kb-delete') {
    return serial(async () => {
      const kb = await readKb();
      if (b.action === 'kb-delete') { const next = kb.filter((e) => e.id !== b.id); await writeKb(next); return NextResponse.json({ ok: true, kb: next }); }
      const e = b.entry ?? {};
      const entry: KbEntry = {
        id: typeof e.id === 'string' && e.id ? e.id : `kb-${Date.now().toString(36)}`,
        category: CATEGORIES.includes(e.category) ? e.category : 'other',
        question: cleanText(e.question).slice(0, 200),
        keywords: (Array.isArray(e.keywords) ? e.keywords : String(e.keywords ?? '').split(',')).map((k: unknown) => String(k).trim()).filter(Boolean).slice(0, 20),
        answer: cleanText(e.answer),
        ...(cleanText(e.answerMl) ? { answerMl: cleanText(e.answerMl) } : {}),
        audience: ['student', 'teacher'].includes(e.audience) ? e.audience : 'all',
        updatedAt: new Date().toISOString(),
      };
      if (!entry.question || !entry.answer || !entry.keywords.length) return bad('A question, at least one keyword and an answer are needed.');
      const i = kb.findIndex((x) => x.id === entry.id);
      if (i >= 0) kb[i] = entry; else kb.unshift(entry);
      await writeKb(kb);
      return NextResponse.json({ ok: true, kb });
    });
  }
  return bad('Unknown action.');
}
