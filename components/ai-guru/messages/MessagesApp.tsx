'use client';

/**
 * V51.9.153 — Messages for students and teachers. Two kinds of contact in each app:
 *   student: the AI Guru office (the bot answers first) and their teacher (when they joined a class)
 *   teacher: the AI Guru office (the bot answers first) and each of their students
 * A teacher signs in with the class code and key (as in the teacher portal); a student with their sign-in.
 */
import { useCallback, useEffect, useState } from 'react';
import { loadTeacherAuth, saveTeacherAuth, type TeacherAuth } from '@/lib/ai-guru/teacher/avatar-client';
import { CATEGORY_INFO, type Category, type Thread } from '@/lib/ai-guru/messages/core';
import { Bubbles, CategoryPicker, Composer } from './ChatView';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

type Contact = { with: string; name: string; code?: string; kind: string; unread: number; lastAt?: string; category?: Category; status?: string };
type Who = { kind: 'student' } | { kind: 'teacher'; auth: TeacherAuth };

async function call(who: Who, body: Record<string, unknown>) {
  const r = await (who.kind === 'student' ? (u: string, i: RequestInit) => fetchIfSignedIn(['student'], u, i) : fetch)('/api/ai-guru/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store', body: JSON.stringify(who.kind === 'teacher' ? { ...body, teacher: who.auth } : body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && !!j.ok, status: r.status, j };
}

type MyNote = { id: string; kind: string; title: string; body: string; updatedAt: string };

/** V51.9.154 — a teacher sends a note: one from Teachers Notes, or a new one written here; to this student or to all. */
function NoteSender({ who, studentId, studentName, studentCount, onSent, onClose }: { who: Who; studentId: string; studentName: string; studentCount: number; onSent: (r: { sent: number; thread?: Thread }, all: boolean) => void; onClose: () => void }) {
  const [notes, setNotes] = useState<MyNote[] | null>(null);
  const [pick, setPick] = useState<string>('new');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [text, setText] = useState('');
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { void call(who, { action: 'notes' }).then((r) => { const n: MyNote[] = r.ok ? r.j.notes : []; setNotes(n); if (n.length) setPick(n[0].id); }); }, [who]);
  const chosen = notes?.find((n) => n.id === pick);
  const send = async (withWho: string) => {
    setBusy(true); setErr('');
    const r = await call(who, { action: 'send-note', with: withWho, text, ...(pick === 'new' ? { note: { title, body } } : { itemId: pick }) });
    setBusy(false);
    if (!r.ok) { setErr(r.j.error ?? 'Could not send'); return; }
    onSent(r.j, withWho === 'all');
  };
  return (
    <div className="space-y-2 rounded-xl border border-amber-300/40 bg-amber-300/[0.07] p-3 text-sm" data-note-sender>
      <div className="flex items-center gap-2"><b>📝 Send a note</b><span className="text-xs text-white/50">The student can download it or have it taught in the classroom.</span><button onClick={onClose} className="ml-auto text-xs text-white/50 underline">Close</button></div>
      <select value={pick} onChange={(e) => setPick(e.target.value)} className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm" data-note-pick>
        {(notes ?? []).map((n) => <option key={n.id} value={n.id}>{n.kind === 'template' ? '🧩' : '📝'} {n.title}</option>)}
        <option value="new">✏️ Write a new note…</option>
      </select>
      {notes === null && <p className="text-xs text-white/50">Loading your notes…</p>}
      {pick === 'new' ? (
        <div className="space-y-1.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Title (e.g. Photosynthesis — key points)" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" data-note-title />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} rows={6} placeholder="Write the note. Leave a blank line between paragraphs — the classroom teaches one paragraph at a time." className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" data-note-text />
        </div>
      ) : chosen && <p className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/25 p-2 text-xs text-white/70">{chosen.body}</p>}
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="A line to the student (optional): e.g. Read this before Monday" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2" data-note-message />
      <label className="flex items-center gap-2 text-xs text-white/75"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} data-note-all /> Send to all my students ({studentCount}) instead of only {studentName}</label>
      {err && <p className="text-xs text-rose-300">{err}</p>}
      <button disabled={busy || (pick === 'new' && (!title.trim() || !body.trim()))} onClick={() => void send(all ? 'all' : studentId)} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-extrabold text-[#1a1200] disabled:opacity-50" data-note-send>{busy ? 'Sending…' : all ? `Send to all ${studentCount} students` : `Send to ${studentName}`}</button>
    </div>
  );
}

function TeacherSignIn({ onIn }: { onIn: (a: TeacherAuth) => void }) {
  const [code, setCode] = useState('');
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const go = async () => {
    const a = { code: code.trim(), key: key.trim() };
    const r = await call({ kind: 'teacher', auth: a }, { action: 'unread' });
    if (r.ok) { saveTeacherAuth(a); onIn(a); } else setErr(r.j.error ?? 'The class code or key is not right');
  };
  return (
    <div className="space-y-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/[0.06] p-4" data-teacher-signin>
      <p className="text-sm font-bold">Teacher? Sign in with your class code and key</p>
      <div className="flex flex-wrap gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Class code" className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" data-teacher-code />
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="6-digit key" inputMode="numeric" className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" data-teacher-key />
        <button onClick={() => void go()} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-extrabold text-[#04121f]" data-teacher-go>Open my messages</button>
      </div>
      {err && <p className="text-xs text-rose-300">{err}</p>}
    </div>
  );
}

export default function MessagesApp() {
  const [who, setWho] = useState<Who | null>(null);
  const [needSignIn, setNeedSignIn] = useState(false);
  const [me, setMe] = useState<{ role: 'student' | 'teacher'; name: string; code?: string } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [notice, setNotice] = useState('');

  // who is here: a signed-in student, else a teacher who signed in on this tab, else ask
  useEffect(() => {
    const asTeacher = new URLSearchParams(window.location.search).get('as') === 'teacher';
    const t = loadTeacherAuth();
    void (async () => {
      if (!asTeacher) { const r = await call({ kind: 'student' }, { action: 'unread' }); if (r.ok) { setWho({ kind: 'student' }); return; } }
      if (t) { const r = await call({ kind: 'teacher', auth: t }, { action: 'unread' }); if (r.ok) { setWho({ kind: 'teacher', auth: t }); return; } }
      setNeedSignIn(true);
    })();
  }, []);

  const loadContacts = useCallback(async () => {
    if (!who) return;
    const r = await call(who, { action: 'contacts' });
    if (r.ok) { setContacts(r.j.contacts); setMe(r.j.me); setOpen((o) => o ?? r.j.contacts[0]?.with ?? null); }
  }, [who]);
  useEffect(() => { void Promise.resolve().then(() => loadContacts()); const id = setInterval(() => void loadContacts(), 20000); return () => clearInterval(id); }, [loadContacts]);

  const loadThread = useCallback(async () => {
    if (!who || !open) return;
    const r = await call(who, { action: 'open', with: open });
    if (r.ok) setThread(r.j.thread);
  }, [who, open]);
  useEffect(() => { void Promise.resolve().then(() => loadThread()); const id = setInterval(() => void loadThread(), 10000); return () => clearInterval(id); }, [loadThread]);

  const office = open === 'office';
  const send = async (text: string) => {
    if (!who || !open) return false;
    if (office && !category && !(thread?.messages.length)) { setErr('First choose what your message is about (above).'); return false; }
    setBusy(true); setErr('');
    const r = await call(who, { action: 'send', with: open, text, category: category ?? undefined });
    setBusy(false);
    if (!r.ok) { setErr(r.j.error ?? 'Could not send'); return false; }
    setThread(r.j.thread); void loadContacts();
    return true;
  };
  const solved = async (yes: boolean) => {
    if (!who) return;
    setBusy(true);
    const r = await call(who, { action: 'solved', with: 'office', yes });
    setBusy(false);
    if (r.ok) setThread(r.j.thread);
  };
  const cur = contacts.find((c) => c.with === open);

  if (needSignIn && !who) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8" data-messages-signin>
        <h1 className="text-2xl font-extrabold">💬 Messages</h1>
        <p className="text-sm text-white/70">Students: sign in first (the Sign in button at the top), then open Messages again.</p>
        <TeacherSignIn onIn={(a) => { setNeedSignIn(false); setWho({ kind: 'teacher', auth: a }); }} />
      </div>
    );
  }
  if (!who) return <p className="px-4 py-8 text-white/60">Loading…</p>;

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-[280px_minmax(0,1fr)]" data-messages-app>
      <aside className="space-y-2">
        <h1 className="text-xl font-extrabold">💬 Messages</h1>
        {me && <p className="text-xs text-white/50">{me.role === 'teacher' ? 'Teacher' : 'Student'} · {me.name}{me.code ? ` · ${me.code}` : ''}</p>}
        <div className="space-y-1" data-contacts>
          {contacts.map((c, i) => (
            <div key={c.with}>
              {i === 1 && <p className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-white/40">{me?.role === 'teacher' ? 'My students' : 'My teacher'}</p>}
              <button onClick={() => { if (open !== c.with) { setThread(null); setCategory(null); setNotice(''); setNoteOpen(false); setOpen(c.with); } }} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${open === c.with ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 hover:bg-white/5'}`} data-contact={c.with}>
                <span className="text-lg">{c.with === 'office' ? '🏫' : me?.role === 'teacher' ? '🎒' : '👩‍🏫'}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.name}</span>{c.code && <span className="block text-[11px] text-white/45">{c.code}</span>}</span>
                {c.unread > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold" data-unread>{c.unread}</span>}
              </button>
            </div>
          ))}
          {me?.role === 'teacher' && contacts.length === 1 && <p className="px-1 text-xs text-white/45">Students who join your class with its code appear here.</p>}
        </div>
        {who.kind === 'teacher' && <button onClick={() => { saveTeacherAuth(null); window.location.reload(); }} className="text-xs text-white/40 underline">Sign out</button>}
      </aside>
      <section className="flex min-h-[60vh] flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3" data-chat>
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <span className="font-bold">{cur?.name ?? '…'}</span>
          {office && <span className="text-xs text-white/50">The AI Guru helper answers first; the office replies to the rest.</span>}
          {!office && me?.role === 'student' && <span className="text-xs text-white/50">Messages with your teacher can be seen by the AI Guru office.</span>}
          {!office && me?.role === 'teacher' && <span className="text-xs text-white/50">The AI Guru office can see messages between teachers and students.</span>}
        </div>
        <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: '55vh' }}>
          {office && (
            <div className="mb-2 flex justify-start">
              <div className="max-w-[85%] space-y-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm" data-bot-greeting>
                <div className="text-[10px] font-bold text-white/60">🤖 AI Guru helper</div>
                <div>Hello{me ? ` ${me.name.split(' ')[0]}` : ''}! What is your message about? </div>
                <CategoryPicker value={category} onPick={setCategory} />
              </div>
            </div>
          )}
          {thread && <Bubbles messages={thread.messages} me={me?.role ?? 'student'} onSolved={office ? (y) => void solved(y) : undefined} busy={busy} />}
        </div>
        {err && <p className="text-xs text-rose-300">{err}</p>}
        {notice && <p className="text-xs text-emerald-300" data-note-notice>{notice}</p>}
        {who.kind === 'teacher' && !office && open && (noteOpen
          ? <NoteSender who={who} studentId={open} studentName={cur?.name ?? 'this student'} studentCount={Math.max(0, contacts.length - 1)} onClose={() => setNoteOpen(false)}
              onSent={(r, all) => { setNoteOpen(false); if (r.thread) setThread(r.thread); else void loadThread(); setNotice(all ? `Note sent to ${r.sent} students.` : 'Note sent.'); void loadContacts(); }} />
          : <button onClick={() => { setNotice(''); setNoteOpen(true); }} className="self-start rounded-lg border border-amber-300/50 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-300/10" data-note-open>📝 Send a note</button>)}
        {office && category && <p className="text-xs" style={{ color: CATEGORY_INFO[category].color }}>{CATEGORY_INFO[category].icon} {CATEGORY_INFO[category].en} — now write your message.</p>}
        <Composer onSend={send} busy={busy} placeholder={office ? 'Write your message to the AI Guru office…' : `Write to ${cur?.name ?? ''}…`} />
      </section>
    </div>
  );
}
