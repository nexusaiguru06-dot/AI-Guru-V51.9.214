'use client';
/**
 * V51.9.193 — the portal of a teacher at a contracted school (e.g. James, Physics, Std 8–10, St. Joseph's School).
 *  • Study materials: every AI material of their books, opened in full; "Edit" makes the school's own version (their
 *    students then see it instead of the AI one); "＋ New" adds one for a part. Every change is recorded for the office.
 *  • Exams: from an MCQ material (questions can be corrected), for one of their standards, with dates and a time limit;
 *    each student's score.
 *  • Students: their school's students in their standards.   • My record: what they did, as the office sees it.
 */
import { useCallback, useEffect, useState } from 'react';

type Sec = { id?: string; heading: string; content: string; options?: string[]; answer?: string };
interface Mat { id: string; type: string; title: string; part: number; sections: number; mine: boolean; teacher: string | null; basedOn: string | null; replaced: boolean; updatedAt: string }
interface Book { id: string; fileName: string; subject: string; grade: string; syllabus: string; pageCount: number; parts: Array<{ index: number; startPage: number; endPage: number; chapters: string[] }>; materials: Mat[] }
interface Me { teacher: { id: string; code: string; name: string; subject: string; standards: string[] }; school: { code: string; name: string }; books: Book[]; students: Array<{ id: string; studentCode: string; name: string; standard: string; joinedWithMe: boolean; joined: string }>; log: Array<{ id: string; at: string; action: string; what: string }> }
interface Q { id: string; q: string; options: string[]; answer: number }
interface ExamRow { id: string; title: string; standard: string; opens: string; closes: string; minutes: number; closed?: boolean; questions: Q[]; results: Array<{ studentId: string; name: string; code: string; score: number; total: number; submittedAt: string }> }

const TYPES: Record<string, string> = { 'whiteboard-notes': 'Whiteboard notes', mcq: 'MCQ', 'revision-notes': 'Revision notes', qa: 'Questions & answers', flashcards: 'Flashcards', worksheet: 'Worksheet', 'question-paper': 'Question paper', ppt: 'Slides', 'mind-map': 'Mind map', 'knowledge-base': 'Knowledge base', 'problems-formulae': 'Problems & formulae' };
const inp = 'mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const btn = 'rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50';
const ghost = 'rounded-xl border border-white/15 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/5 disabled:opacity-50';
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) }));

function SignIn({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); const r = await post('/api/ai-guru/school-teacher/login', { code, password: pw });
    if (r.ok) { setBusy(false); onDone(); return; }
    // V51.9.210: the office signs in here too. Anything that is not a teacher ID (TS-…) is tried as the office sign-in, and the
    // admin portal opens; the box never says that an office sign-in exists (a wrong try gives the ordinary message).
    if (r.status !== 429 && !/^ts-?\d+-?\d+$/i.test(code.trim())) {
      const a = await post('/api/ai-guru/admin/login', { username: code.trim(), password: pw });
      if (a.ok) { window.location.href = '/ai-guru/admin'; return; }
    }
    setBusy(false); setErr(r.error ?? 'Could not sign in'); };
  return (
    <form onSubmit={go} className="mx-auto max-w-sm space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-5" data-teacher-signin>
      <h2 className="text-lg font-extrabold">Sign in</h2>
      <label className="block text-sm font-bold">Teacher ID<input className={`${inp} font-mono uppercase`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="TS-1-26" autoComplete="username" /></label>
      <label className="block text-sm font-bold">Password<input className={inp} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
      <button className={`${btn} w-full`} disabled={busy || !code || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>
      {err && <p role="alert" className="text-sm text-rose-300">{err}</p>}
      <p className="text-center text-sm text-slate-400">New teacher at a school with AI Guru? <a href="/ai-guru/school-teacher/join" className="font-bold text-cyan-300 underline">Sign up with your school ID</a></p>
    </form>
  );
}

function Editor({ book, start, onClose, onSaved }: { book: Book; start: { id?: string; part?: number; type: string; title: string; overview: string; sections: Sec[]; fromAi?: boolean }; onClose: () => void; onSaved: (msg: string) => void }) {
  const [m, setM] = useState(start), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const setSec = (i: number, s: Partial<Sec>) => setM({ ...m, sections: m.sections.map((x, k) => (k === i ? { ...x, ...s } : x)) });
  const save = async () => {
    setBusy(true); setErr('');
    const r = await post('/api/ai-guru/school-teacher/materials', { action: 'save', material: { ...m, documentId: book.id } });
    setBusy(false);
    if (r.ok) onSaved(`${start.fromAi ? `Saved as your school’s version of “${start.title}”. It replaces the AI one for your students.` : 'Saved.'} ${r.seenBy ?? ''}`.trim()); else setErr(r.error ?? 'Could not save');
  };
  return (
    <section className="space-y-3 rounded-2xl border border-cyan-300/30 bg-cyan-400/5 p-4" data-material-editor>
      <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-extrabold">{start.id ? (start.fromAi ? 'Make your school’s version' : 'Edit your version') : 'New study material'}</h3><button className={`${ghost} ml-auto`} onClick={onClose}>Close</button></div>
      {start.fromAi && <p className="text-xs text-slate-400">The AI material stays as it is for other schools. Your students see your corrected version.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-bold text-slate-300 sm:col-span-2">Title<input className={inp} value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} data-edit-title /></label>
        {!start.id ? <label className="block text-xs font-bold text-slate-300">Part<select className={inp} value={m.part ?? 1} onChange={(e) => setM({ ...m, part: Number(e.target.value) })}>{book.parts.map((p) => <option key={p.index} value={p.index}>Part {p.index} · pp. {p.startPage}–{p.endPage}</option>)}</select></label>
          : <p className="text-xs text-slate-400">{TYPES[m.type] ?? m.type}</p>}
        {!start.id && <label className="block text-xs font-bold text-slate-300">Type<select className={inp} value={m.type} onChange={(e) => setM({ ...m, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
      </div>
      <label className="block text-xs font-bold text-slate-300">Overview<textarea className={inp} rows={2} value={m.overview} onChange={(e) => setM({ ...m, overview: e.target.value })} /></label>
      <ol className="space-y-3">{m.sections.map((s, i) => (
        <li key={i} className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3" data-edit-section={i}>
          <div className="flex items-center gap-2"><b className="text-xs text-slate-400">{i + 1}.</b><input className={`${inp} mt-0 font-bold`} value={s.heading} onChange={(e) => setSec(i, { heading: e.target.value })} placeholder="Heading or question" /><button className="text-xs text-rose-300 underline" onClick={() => setM({ ...m, sections: m.sections.filter((_, k) => k !== i) })}>Remove</button></div>
          <textarea className={inp} rows={3} value={s.content} onChange={(e) => setSec(i, { content: e.target.value })} placeholder="Explanation / text" />
          {(m.type === 'mcq' || (s.options && s.options.length > 0)) && <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-300">Options (one a line)<textarea className={inp} rows={4} value={(s.options ?? []).join('\n')} onChange={(e) => setSec(i, { options: e.target.value.split('\n') })} /></label>
            <label className="block text-xs font-bold text-slate-300">Right answer (A, B … or the text)<input className={inp} value={s.answer ?? ''} onChange={(e) => setSec(i, { answer: e.target.value })} /></label></div>}
        </li>))}</ol>
      <button className={ghost} onClick={() => setM({ ...m, sections: [...m.sections, { heading: '', content: '', ...(m.type === 'mcq' ? { options: ['A) ', 'B) ', 'C) ', 'D) '], answer: 'A' } : {}) }] })}>＋ Add {m.type === 'mcq' ? 'a question' : 'a section'}</button>
      <div className="flex flex-wrap items-center gap-3"><button className={btn} disabled={busy} onClick={() => void save()} data-edit-save>{busy ? 'Saving…' : 'Save'}</button>{err && <span role="alert" className="text-sm text-rose-300">{err}</span>}</div>
    </section>
  );
}

function Exams({ me, mats }: { me: Me; mats: Array<Mat & { book: string }> }) {
  const [list, setList] = useState<ExamRow[]>([]), [from, setFrom] = useState(''), [qs, setQs] = useState<Q[]>([]), [f, setF] = useState({ title: '', standard: me.teacher.standards[0] ?? '', opens: today(), closes: today(), minutes: 30 }), [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => { const j = await fetch('/api/ai-guru/school-teacher/exams', { cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.ok) setList(j.exams); }, []);
  useEffect(() => { void load(); }, [load]);
  const pick = async (id: string) => { setFrom(id); if (!id) { setQs([]); return; } const j = await fetch(`/api/ai-guru/school-teacher/exams?from=${encodeURIComponent(id)}`).then((r) => r.json()); if (j.ok) { setQs(j.questions); setF((x) => ({ ...x, title: x.title || j.title })); } };
  const create = async () => { const r = await post('/api/ai-guru/school-teacher/exams', { action: 'create', ...f, questions: qs, materialId: from }); setNote({ ok: !!r.ok, text: r.ok ? `Exam “${f.title}” is set for Std ${f.standard}. Your students see it in My account.` : r.error }); if (r.ok) { setFrom(''); setQs([]); setF({ ...f, title: '' }); await load(); } };
  const mcqs = mats.filter((m) => m.type === 'mcq' || m.type === 'question-paper');
  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4" data-exam-new>
        <h3 className="text-lg font-extrabold">New exam</h3>
        <label className="block text-xs font-bold text-slate-300">Questions from<select className={inp} value={from} onChange={(e) => void pick(e.target.value)}><option value="">Choose an MCQ material…</option>{mcqs.map((m) => <option key={m.id} value={m.id}>{m.book} · Part {m.part} · {m.title}{m.mine ? ' (yours)' : ''}</option>)}</select></label>
        {qs.length > 0 && <>
          {/* V51.9.195 (review): the MCQ material itself shows its answers in the classroom */}
          <p className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100" data-exam-warning>⚠ Students can open this MCQ material in the classroom, and it shows the answers. For a fair exam, change the questions or their order here, or pick a material your students have not seen. The right answers are shown to students only after the exam closes.</p>
          <ol className="max-h-80 space-y-2 overflow-y-auto">{qs.map((q, i) => <li key={q.id} className="rounded-xl border border-white/10 p-2 text-sm"><input className={`${inp} mt-0`} value={q.q} onChange={(e) => setQs(qs.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))} />
            <div className="mt-1 flex flex-wrap gap-3">{q.options.map((o, k) => <label key={k} className="flex items-center gap-1 text-xs"><input type="radio" name={`a${i}`} checked={q.answer === k} onChange={() => setQs(qs.map((x, n) => (n === i ? { ...x, answer: k } : x)))} />{o}</label>)}<button className="text-xs text-rose-300 underline" onClick={() => setQs(qs.filter((_, k) => k !== i))}>Leave out</button></div></li>)}</ol>
          <div className="grid gap-3 sm:grid-cols-5">
            <label className="block text-xs font-bold text-slate-300 sm:col-span-2">Title<input className={inp} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
            <label className="block text-xs font-bold text-slate-300">Standard<select className={inp} value={f.standard} onChange={(e) => setF({ ...f, standard: e.target.value })}>{me.teacher.standards.map((s) => <option key={s} value={s}>Std {s}</option>)}</select></label>
            <label className="block text-xs font-bold text-slate-300">Opens<input type="date" className={inp} value={f.opens} onChange={(e) => setF({ ...f, opens: e.target.value })} /></label>
            <label className="block text-xs font-bold text-slate-300">Closes<input type="date" className={inp} value={f.closes} onChange={(e) => setF({ ...f, closes: e.target.value })} /></label>
            <label className="block text-xs font-bold text-slate-300">Minutes<input type="number" min={5} max={180} className={inp} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} /></label>
          </div>
          <button className={btn} onClick={() => void create()} data-exam-create>Set the exam ({qs.length} questions)</button></>}
        {from && !qs.length && <p className="text-sm text-amber-200">This material has no questions with options and a clear answer. Edit it first (Study materials → Edit).</p>}
        {note && <p role="status" className={`text-sm ${note.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{note.text}</p>}
      </section>
      {list.map((e) => <section key={e.id} className="space-y-2 rounded-2xl border border-white/10 bg-white/[.03] p-4" data-exam={e.id}>
        <div className="flex flex-wrap items-center gap-2"><b>{e.title}</b><span className="text-xs text-slate-400">Std {e.standard} · {e.questions.length} questions · {e.minutes} min · {e.opens} → {e.closes}{e.closed ? ' · closed' : ''}</span>{!e.closed && <button className={`${ghost} ml-auto`} onClick={async () => { await post('/api/ai-guru/school-teacher/exams', { action: 'close', id: e.id }); await load(); }}>Close now</button>}</div>
        {e.results.length === 0 ? <p className="text-sm text-slate-400">No one has handed it in yet.</p> : <table className="w-full text-sm"><tbody>{e.results.map((r) => <tr key={r.studentId} className="border-t border-white/10"><td className="py-1">{r.name} <span className="font-mono text-xs text-slate-400">{r.code}</span></td><td className="font-bold">{r.score}/{r.total}</td><td className="text-xs text-slate-400">{new Date(r.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>)}</tbody></table>}
      </section>)}
    </div>
  );
}

export function SchoolTeacherPortal() {
  const [me, setMe] = useState<Me | null | 'out'>(null);
  const [tab, setTab] = useState<'materials' | 'exams' | 'students' | 'record'>('materials');
  const [bookId, setBookId] = useState('');
  const [view, setView] = useState<{ title: string; overview: string; sections: Sec[] } | null>(null);
  const [edit, setEdit] = useState<Parameters<typeof Editor>[0]['start'] | null>(null);
  const [note, setNote] = useState('');
  const load = useCallback(async () => {
    const r = await fetch('/api/ai-guru/school-teacher/me', { cache: 'no-store' });
    if (r.status === 401) { setMe('out'); return; }
    const j = await r.json().catch(() => null);
    if (j?.ok) { setMe(j); setBookId((b) => b || j.books[0]?.id || ''); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (me === null) return <p className="text-slate-400">Loading…</p>;
  if (me === 'out') return <SignIn onDone={() => void load()} />;
  const book = me.books.find((b) => b.id === bookId);
  const open = async (id: string, asEdit: boolean) => {
    const j = await fetch(`/api/ai-guru/school-teacher/materials?id=${encodeURIComponent(id)}`).then((r) => r.json());
    if (!j.ok) return;
    const m = j.material, secs: Sec[] = m.sections.map((s: Sec) => ({ id: s.id, heading: s.heading ?? '', content: s.content ?? '', ...(s.options ? { options: s.options } : {}), ...(s.answer ? { answer: s.answer } : {}) }));
    if (asEdit) { setView(null); setEdit({ id, type: m.type, title: m.title, overview: m.overview ?? '', sections: secs, fromAi: !m.school }); } else { setEdit(null); setView({ title: m.title, overview: m.overview ?? '', sections: secs }); }
  };
  const signOut = async () => { await fetch('/api/ai-guru/teacher-portal/session', { method: 'DELETE' }); setMe('out'); };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <div><b className="text-lg">{me.teacher.name}</b> <span className="font-mono text-sm text-cyan-300">{me.teacher.code}</span><span className="block text-sm text-slate-400">{me.school.name} ({me.school.code}) · {me.teacher.subject} · Std {me.teacher.standards.join(', ')}</span></div>
        <button className={`${ghost} ml-auto`} onClick={() => void signOut()}>Sign out</button>
      </div>
      <p className="text-sm text-slate-300">Your students join with your teacher ID <b className="font-mono">{me.teacher.code}</b> (or the school ID <b className="font-mono">{me.school.code}</b>) in the code box when they sign up.</p>
      <nav className="flex flex-wrap gap-2">{([['materials', '📚 Study materials'], ['exams', '📝 Exams'], ['students', `👩‍🎓 Students (${me.students.length})`], ['record', '🗂 My record']] as const).map(([id, l]) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-extrabold ${tab === id ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-200'}`}>{l}</button>)}</nav>
      {note && <p role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">{note}</p>}

      {tab === 'materials' && (me.books.length === 0 ? <p className="text-slate-400">No {me.teacher.subject} textbook of Std {me.teacher.standards.join(', ')} is in the library yet. The school office adds them.</p> : <>
        <label className="block max-w-xl text-xs font-bold text-slate-300">Textbook<select className={inp} value={bookId} onChange={(e) => { setBookId(e.target.value); setView(null); setEdit(null); }}>{me.books.map((b) => <option key={b.id} value={b.id}>{b.subject} · Std {b.grade} · {b.fileName}</option>)}</select></label>
        {edit && book && <Editor key={edit.id ?? 'new'} book={book} start={edit} onClose={() => setEdit(null)} onSaved={(msg) => { setEdit(null); setNote(msg); void load(); }} />}
        {view && <section className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4" data-material-view><div className="flex items-center gap-2"><h3 className="text-lg font-extrabold">{view.title}</h3><button className={`${ghost} ml-auto`} onClick={() => setView(null)}>Close</button></div><p className="text-sm text-slate-300">{view.overview}</p>
          <ol className="space-y-2">{view.sections.map((s, i) => <li key={i} className="rounded-xl border border-white/10 p-3 text-sm"><b>{i + 1}. {s.heading}</b><p className="whitespace-pre-wrap text-slate-300">{s.content}</p>{s.options && <ul className="mt-1 text-xs text-slate-300">{s.options.map((o) => <li key={o}>{o}</li>)}</ul>}{s.answer && <p className="text-xs text-emerald-300">Answer: {s.answer}</p>}</li>)}</ol></section>}
        {book && book.parts.map((p) => { const ms = book.materials.filter((m) => m.part === p.index); return (
          <section key={p.index} className="space-y-2 rounded-2xl border border-white/10 bg-white/[.03] p-3" data-teacher-part={p.index}>
            <div className="flex flex-wrap items-center gap-2"><b>Part {p.index}</b><span className="text-xs text-slate-400">pp. {p.startPage}–{p.endPage}{p.chapters.length ? ` · ${p.chapters.join(', ')}` : ''}</span><button className={`${ghost} ml-auto`} onClick={() => { setView(null); setEdit({ part: p.index, type: 'revision-notes', title: '', overview: '', sections: [{ heading: '', content: '' }] }); }}>＋ New</button></div>
            {ms.length === 0 ? <p className="text-xs text-slate-500">No study materials for this part yet.</p> : <ul className="space-y-1">{ms.map((m) => <li key={m.id} className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1 text-sm ${m.replaced ? 'opacity-50' : ''}`} data-teacher-material={m.mine ? 'mine' : m.teacher ? 'school' : 'ai'}>
              <span className="rounded bg-white/10 px-1.5 text-[10px] font-bold">{TYPES[m.type] ?? m.type}</span><span className="min-w-0 flex-1 truncate">{m.title}</span>
              <span className="text-[11px] text-slate-400">{m.mine ? '✏️ your version' : m.teacher ? `✏️ ${m.teacher}` : m.replaced ? 'AI · replaced for your students' : 'AI'}</span>
              <button className={ghost} onClick={() => void open(m.id, false)}>Open</button>
              {(m.mine || !m.teacher) && !m.replaced && <button className={ghost} onClick={() => void open(m.id, true)} data-edit={m.id}>Edit</button>}
              {m.mine && <button className="text-xs text-rose-300 underline" onClick={async () => { if (!window.confirm('Remove your version? Your students see the AI material again.')) return; await post('/api/ai-guru/school-teacher/materials', { action: 'remove', id: m.id }); void load(); }}>Remove</button>}
            </li>)}</ul>}
          </section>); })}
      </>)}

      {tab === 'exams' && <Exams me={me} mats={me.books.flatMap((b) => b.materials.filter((m) => !m.replaced).map((m) => ({ ...m, book: `${b.subject} Std ${b.grade}` })))} />}

      {tab === 'students' && (me.students.length === 0 ? <p className="text-slate-400">No student has joined yet. Give them your teacher ID <b className="font-mono">{me.teacher.code}</b>.</p>
        : <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-400"><th>Student</th><th>ID</th><th>Std</th><th>Joined</th></tr></thead><tbody>{me.students.map((s) => <tr key={s.id} className="border-t border-white/10"><td className="py-1">{s.name}{s.joinedWithMe ? ' ⭐' : ''}</td><td className="font-mono text-xs">{s.studentCode}</td><td>{s.standard}</td><td className="text-xs text-slate-400">{s.joined}</td></tr>)}</tbody></table>)}

      {tab === 'record' && <ul className="space-y-1 text-sm" data-teacher-record>{me.log.map((e) => <li key={e.id} className="border-b border-white/5 py-1"><span className="text-xs text-slate-400">{new Date(e.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span> · {e.what}</li>)}</ul>}
    </div>
  );
}
