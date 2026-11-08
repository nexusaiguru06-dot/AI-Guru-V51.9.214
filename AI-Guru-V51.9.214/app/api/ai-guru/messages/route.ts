/**
 * V51.9.153 — messages for students and teachers (POST, JSON).
 *
 * Who: a student by their sign-in cookie; a teacher by { teacher: { code, key } } (the class code and 6-digit key).
 * Actions:
 *   { action: 'contacts' }                         — my conversations: the office, and my teacher (student) or my students (teacher)
 *   { action: 'open', with }                       — one conversation (marks it read); with = 'office' | 'teacher' | <studentId>
 *   { action: 'send', with, text, category? }      — write; to the office, the bot answers from the knowledge base when it can
 *   { action: 'solved', yes }                      — after a bot answer: did it solve it? (no → the office gets it)
 *   { action: 'unread' }                           — how many unread (for the badge)
 * V51.9.154 — teachers send notes:
 *   { action: 'notes' }                                       — my notes (from Teachers Notes, every class of mine)
 *   { action: 'send-note', with: <studentId> | 'all', itemId? | note:{title,body}, text? }
 *       the note arrives as a message with ⬇ Download to device and ▶ Teach it in the classroom
 */
import { NextResponse } from 'next/server';
import { studentFromRequest } from '@/lib/ai-guru/admin/auth';
import { openClass } from '@/lib/ai-guru/admin/teacher-auth';
import { readData, type AdminData } from '@/lib/ai-guru/admin/store';
import { BOT, CATEGORIES, CATEGORY_INFO, addMessage, cleanText, markRead, matchKb, newThread, threadIdFor, type Category, type Party, type Thread, type ThreadKind } from '@/lib/ai-guru/messages/core';
import { readIndex, readKb, readThread, saveThread, serial, tooMany } from '@/lib/ai-guru/messages/store';
import { classesOfTeacher, studentParty, studentsOfTeacher, teacherOfStudent, teacherParty } from '@/lib/ai-guru/messages/people';
import { cleanNote, type NoteAttachment } from '@/lib/ai-guru/messages/notes';
import { readContent } from '@/lib/ai-guru/admin/content-store';

export const dynamic = 'force-dynamic';
type Me = { role: 'student'; party: Party; teacher: Party | null; data: AdminData } | { role: 'teacher'; party: Party; data: AdminData };
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function whoAmI(req: Request, b: { teacher?: { code?: unknown; key?: unknown } }): Promise<Me | Response> {
  if (b.teacher) {
    const r = await openClass(req, b.teacher);
    if ('error' in r) return r.error;
    return { role: 'teacher', party: teacherParty(r.g), data: r.data };
  }
  const id = await studentFromRequest(req);
  if (!id) return bad('Sign in first to send messages.', 401);
  const data = await readData();
  const st = data.students.find((s) => s.id === id);
  if (!st) return bad('Sign in first to send messages.', 401);
  return { role: 'student', party: studentParty(st), teacher: teacherOfStudent(data, st)?.party ?? null, data };
}

/** The conversation `with` someone, as this user sees it (null when they may not talk to them). */
function target(me: Me, withWho: unknown): { id: string; kind: ThreadKind; party: Party; teacher?: Party } | null {
  if (withWho === 'office') return me.role === 'student'
    ? { id: threadIdFor('student-admin', me.party.id), kind: 'student-admin', party: me.party }
    : { id: threadIdFor('teacher-admin', me.party.id), kind: 'teacher-admin', party: me.party };
  if (me.role === 'student') {
    if (withWho !== 'teacher' || !me.teacher) return null;
    return { id: threadIdFor('teacher-student', me.teacher.id, me.party.id), kind: 'teacher-student', party: me.party, teacher: me.teacher };
  }
  const st = studentsOfTeacher(me.data, me.party.id).find((s) => s.id === withWho);
  if (!st) return null;
  return { id: threadIdFor('teacher-student', me.party.id, st.id), kind: 'teacher-student', party: studentParty(st), teacher: me.party };
}
const load = async (t: NonNullable<ReturnType<typeof target>>): Promise<Thread> => (await readThread(t.id)) ?? newThread(t.kind, t.party, t.teacher);
const view = (t: Thread) => ({ ...t, messages: t.messages.slice(-200) });

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const me = await whoAmI(req, b);
  if (me instanceof Response) return me;
  const role = me.role;

  if (b.action === 'unread' || b.action === 'contacts') {
    const idx = await readIndex();
    const mineIds = new Set<string>([threadIdFor(role === 'student' ? 'student-admin' : 'teacher-admin', me.party.id)]);
    const rows: Array<{ with: string; name: string; code?: string; kind: ThreadKind; unread: number; lastAt?: string; category?: Category; status?: string }> = [];
    const office = idx.find((x) => mineIds.has(x.id));
    rows.push({ with: 'office', name: 'AI Guru office', kind: role === 'student' ? 'student-admin' : 'teacher-admin', unread: office?.unread[role] ?? 0, lastAt: office?.lastAt, category: office?.category, status: office?.status });
    if (me.role === 'student' && me.teacher) {
      const t = idx.find((x) => x.id === threadIdFor('teacher-student', me.teacher!.id, me.party.id));
      rows.push({ with: 'teacher', name: me.teacher.name, code: me.teacher.code, kind: 'teacher-student', unread: t?.unread.student ?? 0, lastAt: t?.lastAt });
    }
    if (me.role === 'teacher') {
      for (const s of studentsOfTeacher(me.data, me.party.id)) {
        const t = idx.find((x) => x.id === threadIdFor('teacher-student', me.party.id, s.id));
        rows.push({ with: s.id, name: s.name, code: s.studentCode || s.admissionNo || undefined, kind: 'teacher-student', unread: t?.unread.teacher ?? 0, lastAt: t?.lastAt });
      }
    }
    const unread = rows.reduce((a, r) => a + r.unread, 0);
    if (b.action === 'unread') return NextResponse.json({ ok: true, unread });
    return NextResponse.json({ ok: true, me: { role, name: me.party.name, code: me.party.code }, unread, contacts: rows, categories: CATEGORIES.map((c) => ({ id: c, ...CATEGORY_INFO[c] })) });
  }

  if (b.action === 'notes' || b.action === 'send-note') {
    if (me.role !== 'teacher') return bad('Only a teacher can send notes.', 403);
    const classIds = new Set(classesOfTeacher(me.data, me.party.id).map((c) => c.id));
    const mine = (await readContent()).items.filter((it) => classIds.has(it.classId) && it.kind !== 'exam')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (b.action === 'notes') return NextResponse.json({ ok: true, notes: mine.map((it) => ({ id: it.id, kind: it.kind, title: it.title, body: it.body, updatedAt: it.updatedAt })) });

    let note: NoteAttachment | null = null;
    if (typeof b.itemId === 'string' && b.itemId) { const it = mine.find((x) => x.id === b.itemId); if (!it) return bad('That note is not in your classes.', 404); note = cleanNote({ title: it.title, body: it.body, itemId: it.id }); }
    else note = cleanNote(b.note);
    if (!note) return bad('Choose a note, or write a title and the note.');
    const all = studentsOfTeacher(me.data, me.party.id);
    const to = b.with === 'all' ? all : all.filter((s) => s.id === b.with);
    if (!to.length) return bad(b.with === 'all' ? 'No students have joined your class yet.' : 'You cannot message this person.', b.with === 'all' ? 400 : 403);
    if (tooMany(`teacher-note:${me.party.id}`)) return bad('Too many notes in an hour. Please wait a little.', 429);
    const extra = cleanText(b.text);
    const text = `📝 ${note.title}${extra ? `\n${extra}` : ''}`;
    return serial(async () => {
      const now = new Date().toISOString();
      let last: Thread | null = null;
      for (const st of to) {
        const party = studentParty(st);
        const t = (await readThread(threadIdFor('teacher-student', me.party.id, st.id))) ?? newThread('teacher-student', party, me.party);
        addMessage(t, { at: now, from: 'teacher', by: me.party.name, text, note, category: 'study' });
        t.unread.teacher = 0;
        await saveThread(t);
        if (b.with !== 'all') last = t;
      }
      return NextResponse.json({ ok: true, sent: to.length, ...(last ? { thread: view(last) } : {}) });
    });
  }

  const tg = target(me, b.with);
  if (!tg) return bad('You cannot message this person.', 403);

  if (b.action === 'open') {
    return serial(async () => {
      const t = await load(tg);
      if ((t.unread[role] ?? 0) > 0) { markRead(t, role); await saveThread(t); }
      return NextResponse.json({ ok: true, thread: view(t) });
    });
  }

  if (b.action === 'send') {
    const text = cleanText(b.text);
    if (!text) return bad('Write a message first.');
    if (tooMany(`${role}:${me.party.id}`)) return bad('Too many messages in an hour. Please wait a little.', 429);
    const chosen = CATEGORIES.includes(b.category) ? (b.category as Category) : undefined;
    const kb = tg.kind === 'teacher-student' ? [] : await readKb();
    return serial(async () => {
      const t = await load(tg);
      const now = new Date().toISOString();
      addMessage(t, { at: now, from: role, by: me.party.name, text, category: chosen });
      // to the office: the bot answers first when the knowledge base has the answer
      if (tg.kind !== 'teacher-student') {
        const hit = matchKb(text, kb, { category: t.category, role });
        const ml = /[ഀ-ൿ]/.test(text);
        if (hit) addMessage(t, { at: now, from: 'bot', by: BOT, text: (ml && hit.entry.answerMl) || hit.entry.answer, kb: hit.entry.id, ask: 'solved' });
        else {
          const lastBot = [...t.messages].reverse().find((m) => m.from === 'bot');
          const said = lastBot && !lastBot.kb && Date.parse(now) - Date.parse(lastBot.at) < 30 * 60_000;
          if (!said) addMessage(t, { at: now, from: 'bot', by: BOT, text: `Thank you! Your message is with the AI Guru office (${CATEGORY_INFO[t.category].en}). They will reply here.` });
          t.status = 'needs-reply';
        }
        t.unread[role] = 0; // the writer has seen the bot's answer
      }
      await saveThread(t);
      return NextResponse.json({ ok: true, thread: view(t) });
    });
  }

  if (b.action === 'solved') {
    if (tg.kind === 'teacher-student') return bad('Nothing to answer.');
    return serial(async () => {
      const t = await load(tg);
      const now = new Date().toISOString();
      if (b.yes) { addMessage(t, { at: now, from: 'bot', by: BOT, text: 'Glad that helped! Write again any time.' }); t.status = 'bot'; }
      else { addMessage(t, { at: now, from: 'bot', by: BOT, text: 'Sorry about that. Your message is now with the AI Guru office; they will reply here.' }); t.status = 'needs-reply'; t.unread.admin = (t.unread.admin ?? 0) + 1; }
      t.unread[role] = 0;
      for (const m of t.messages) if (m.ask) delete m.ask;
      await saveThread(t);
      return NextResponse.json({ ok: true, thread: view(t) });
    });
  }
  return bad('Unknown action.');
}

