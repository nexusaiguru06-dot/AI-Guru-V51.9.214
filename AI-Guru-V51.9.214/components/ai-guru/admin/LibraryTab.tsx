'use client';
/**
 * V51.9.95 — Admin: the study-material library. Create materials (upload a textbook in Material Studio, or create on the
 * AI Guru cloud with the school's key), and look after everything in the library — books and materials made by the
 * admin or by students: fix a book's syllabus / standard / medium (students find books by these), hide, delete.
 */
import { useCallback, useEffect, useState } from 'react';

type Owner = { kind: 'admin' | 'student' | 'guest'; id?: string; name?: string; via?: 'studio' | 'cloud' };
interface Mat { id: string; type: string; title: string; owner: Owner; hidden: boolean; score: number | null; createdAt: string }
interface Book { id: string; fileName: string; subject: string; grade: string; syllabus: string; medium: string; pageCount: number; indexedAt: string; owner: Owner; hidden: boolean; downloads: number; parts: Array<{ index: number; startPage: number; endPage: number; readable: boolean; materials: Mat[] }> }
interface Settings { cloudKey: string; hasEnvKey: boolean; studentsMayCreate: boolean; dailyLimit: number; reviewStudentWork: boolean; autoFreeParts?: boolean; trialDoubts?: { days: number; perDay: number; minutes: number } }
interface Job { id: string; documentId: string; part: number; type: string; status: string; error?: string; by: Owner; createdAt: string }
type Say = (ok: boolean, t: string) => void;

const MAT: Record<string, string> = { 'whiteboard-notes': 'Whiteboard notes', mcq: 'MCQ', 'revision-notes': 'Revision', qa: 'Q&A', flashcards: 'Flashcards', worksheet: 'Worksheet', 'question-paper': 'Question paper', ppt: 'Slides', 'mind-map': 'Mind map', 'knowledge-base': 'Knowledge base', 'problems-formulae': 'Problems & formulae' };
const api = async (url: string, body?: unknown) => { const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); const j = await r.json().catch(() => ({})); return { ok: !!j.ok, j }; };
const inp = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const btn = 'rounded-lg bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50';
const ghost = 'rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/5';
const who = (o: Owner) => (o.kind === 'admin' ? 'Admin' : o.kind === 'guest' ? `Guest (not signed in)${o.name ? ` · ${o.name}` : ''} · private` : `Student · ${o.name ?? '?'}`) + (o.via === 'cloud' ? ' · cloud' : '');

export function LibraryTab({ say }: { say: Say }) {
  const [set, setSet] = useState<Settings | null>(null);
  const [key, setKey] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [opts, setOpts] = useState<{ syllabi: Array<[string, string]>; mediums: Array<[string, string]> }>({ syllabi: [], mediums: [] });
  const [tot, setTot] = useState<Record<string, number>>({});
  const [mk, setMk] = useState<{ documentId: string; part: number; types: string[] }>({ documentId: '', part: 1, types: ['whiteboard-notes', 'mcq', 'revision-notes'] });
  const [q, setQ] = useState('');
  const load = useCallback(async () => { const r = await api('/api/ai-guru/admin/library'); if (r.ok) { setSet(r.j.settings); setBooks(r.j.books); setJobs(r.j.jobs); setOpts(r.j.options); setTot(r.j.totals); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!jobs.some((j) => j.status === 'queued' || j.status === 'running')) return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [jobs, load]);
  if (!set) return <p className="text-slate-400">Loading…</p>;

  const act = async (body: Record<string, unknown>, ok: string) => { const r = await api('/api/ai-guru/admin/library', body); say(r.ok, r.ok ? ok : r.j.error ?? 'Could not do that'); if (r.ok) await load(); };
  const saveSet = async () => { const r = await api('/api/ai-guru/admin/library', { action: 'settings', library: { ...set, cloudKey: key.trim() ? key.trim() : undefined } }); say(r.ok, r.ok ? 'Cloud settings saved.' : r.j.error ?? 'Could not save'); if (r.ok) { setKey(''); await load(); } };
  const create = async () => {
    const r = await api('/api/ai-guru/library/jobs', mk);
    if (!r.ok) return say(false, r.j.error ?? 'Could not start');
    const made = r.j.results.filter((x: { job?: unknown }) => x.job).length, have = r.j.results.filter((x: { existing?: string }) => x.existing).map((x: { type: string }) => MAT[x.type] ?? x.type);
    say(true, `${made} material(s) being made on the cloud (a few minutes each).${have.length ? ` Already in the library: ${have.join(', ')}.` : ''}`); await load();
  };
  const book = books.find((b) => b.id === mk.documentId);
  const shown = books.filter((b) => !q.trim() || `${b.fileName} ${b.subject} ${b.grade} ${b.syllabus} ${b.owner.name ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const studio = (id?: string) => { try { if (id) localStorage.setItem('ai-guru:material-document', id); } catch { /* ignore */ } window.open('/ai-guru/material-studio', '_blank'); };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{([['Books', tot.books], ['Materials', tot.materials], ['Made by students', tot.byStudents], ['Hidden', tot.hidden], ['Students', tot.students], ['Students with books', tot.studentsWithBooks]] as const).map(([l, v]) => <div key={l} className="rounded-2xl border border-white/10 bg-white/[.04] p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{l}</div><div className="mt-1 text-2xl font-black">{v ?? 0}</div></div>)}</div>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h2 className="text-lg font-extrabold">Create study materials</h2>
        <div className="flex flex-wrap gap-2"><button className={btn} onClick={() => studio()}>Upload a textbook PDF (Material Studio)</button><span className="self-center text-xs text-slate-400">Opens Material Studio signed in as admin: the book and its materials go into the library as “AI Guru”. The same PDF is never indexed twice.</span></div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <h3 className="font-bold">Create on the AI Guru cloud <span className="text-xs font-normal text-slate-400">with the cloud key · no browser key needed</span></h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-slate-300 sm:col-span-2">Book<select className={inp} value={mk.documentId} onChange={(e) => setMk({ ...mk, documentId: e.target.value, part: 1 })}><option value="">Choose…</option>{books.map((b) => <option key={b.id} value={b.id}>{b.subject} · Std {b.grade} · {b.syllabus} · {b.fileName}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-300">Part<select className={inp} value={mk.part} onChange={(e) => setMk({ ...mk, part: Number(e.target.value) })}>{(book?.parts ?? [1, 2, 3, 4, 5].map((i) => ({ index: i, startPage: 0, endPage: 0, readable: true, materials: [] as Mat[] }))).map((p) => <option key={p.index} value={p.index} disabled={!p.readable}>Part {p.index}{p.startPage ? ` · pp. ${p.startPage}–${p.endPage}` : ''}</option>)}</select></label>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">{Object.keys(MAT).map((t) => { const have = book?.parts.find((p) => p.index === mk.part)?.materials.some((m) => m.type === t && !m.hidden); const on = mk.types.includes(t); return <button key={t} disabled={have} aria-pressed={on} onClick={() => setMk({ ...mk, types: on ? mk.types.filter((x) => x !== t) : [...mk.types, t] })} className={`rounded-full px-3 py-1 text-xs font-bold ${have ? 'bg-emerald-400/10 text-emerald-300' : on ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-300'}`}>{MAT[t]}{have ? ' ✓' : ''}</button>; })}</div>
          <button className={`${btn} mt-3`} disabled={!mk.documentId || !mk.types.length || (!set.cloudKey && !set.hasEnvKey)} onClick={create}>Create on cloud</button>
          {!set.cloudKey && !set.hasEnvKey && <p className="mt-1 text-xs text-amber-200">Add a cloud key below first.</p>}
          {jobs.length > 0 && <ul className="mt-3 max-h-48 space-y-0.5 overflow-y-auto text-xs">{jobs.map((j) => { const b = books.find((x) => x.id === j.documentId); return <li key={j.id} className="text-slate-300">☁ {b ? `${b.subject} Std ${b.grade}` : j.documentId} · Part {j.part} · {MAT[j.type] ?? j.type} · {who(j.by)} — <b className={j.status === 'done' ? 'text-emerald-300' : j.status === 'failed' ? 'text-rose-300' : 'text-amber-200'}>{j.status}</b>{j.error ? ` (${j.error})` : ''}</li>; })}</ul>}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h2 className="text-lg font-extrabold">Cloud settings</h2>
        <label className="block max-w-lg text-xs font-bold text-slate-300">Cloud Gemini key {set.cloudKey ? <span className="font-mono text-emerald-300">({set.cloudKey} saved)</span> : set.hasEnvKey ? <span className="text-slate-400">(using GEMINI_API_KEY from the server)</span> : <span className="text-amber-200">(none)</span>}
          <input className={inp} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={set.cloudKey ? 'Paste a new key to replace it' : 'AIza…'} /><span className="font-normal text-slate-500">Kept on the server only; never sent to a browser. Used for creating on the cloud and for reading uploads made without a key.</span></label>
        {set.cloudKey && <button className="text-xs text-rose-300 underline" onClick={async () => { const r = await api('/api/ai-guru/admin/library', { action: 'settings', library: { ...set, cloudKey: null } }); say(r.ok, r.ok ? 'Cloud key removed.' : 'Could not remove'); await load(); }}>Remove saved key</button>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={set.autoFreeParts !== false} onChange={(e) => setSet({ ...set, autoFreeParts: e.target.checked })} data-auto-free-parts />Make the free part in full on upload: every study-material type (notes, PPT, MCQ, revision and the rest) for each new textbook’s free part, on the cloud key</label>
        {/* V51.9.187: the cloud key makes only the common study materials; students use their own key for everything else */}
        <p className="text-sm text-slate-300" data-key-policy>The cloud key makes the <b>common study materials</b> (your uploads and each book’s free part), and gives <b>free doubt clearing in the trial</b> within the limits below. Otherwise students use <b>their own free Gemini key</b>, both for making study materials and for doubts. Students without a key get “🔑 Add your free Gemini key” reminders in Messages and on screen, and tapping one opens Settings.</p>
        <p className="text-sm text-slate-400" data-doubt-settings-link>Free doubt clearing (trial days, sessions a day, minutes) and every other office setting: <a href="/ai-guru/admin/settings#doubts" className="font-bold text-cyan-300 underline">⚙ Settings</a>.</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={set.reviewStudentWork} onChange={(e) => setSet({ ...set, reviewStudentWork: e.target.checked })} /><span>Check students’ books and materials before others see them <span className="block text-xs text-slate-400">New uploads and materials by students stay hidden until you show them below. Off: shared at once (every material still passes the QA gate).</span></span></label>
        <button className={btn} onClick={saveSet}>Save cloud settings</button>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold">Library</h2><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search book, subject, standard, uploader" aria-label="Search the library" className={`${inp} mt-0 ml-auto max-w-xs`} /></div>
        {shown.length === 0 && <p className="text-sm text-slate-400">No books yet.</p>}
        {shown.map((b) => (
          <article key={b.id} className={`rounded-2xl border p-4 ${b.hidden ? 'border-amber-300/30 bg-amber-300/5' : 'border-white/10 bg-white/[.04]'}`}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1"><h3 className="font-extrabold">{b.subject || b.fileName} <span className="text-sm font-normal text-slate-400">Std {b.grade}</span>{b.hidden && <span className="ml-2 rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">HIDDEN</span>}</h3>
                <p className="truncate text-xs text-slate-400">{b.fileName} · {b.pageCount} pages · {who(b.owner)} · {b.indexedAt.slice(0, 10)} · downloaded by {b.downloads}</p></div>
              <div className="flex flex-wrap gap-1.5">
                <a className={ghost} href={`/ai-guru/classroom?materialDocument=${encodeURIComponent(b.id)}`} target="_blank" rel="noreferrer">Open in classroom</a>
                <button className={ghost} onClick={() => studio(b.id)}>Material Studio</button>
                <button className={ghost} onClick={() => act({ action: 'book', id: b.id, hidden: !b.hidden }, b.hidden ? 'Book shown to students.' : 'Book hidden from students.')}>{b.hidden ? 'Show' : 'Hide'}</button>
                <button className={ghost} onClick={() => { if (confirm(`Delete ${b.fileName} with its PDF and all ${b.parts.reduce((a, p) => a + p.materials.length, 0)} materials? Students lose it from My books.`)) void act({ action: 'deleteBook', id: b.id }, 'Book deleted.'); }}>Delete</button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">{/* students find books by these */}
              <label className="font-bold text-slate-300">Syllabus<select className={`${inp} w-44`} value={b.syllabus} onChange={(e) => act({ action: 'book', id: b.id, syllabus: e.target.value }, 'Syllabus updated.')}>{!opts.syllabi.some(([v]) => v === b.syllabus) && <option value={b.syllabus}>{b.syllabus || '—'}</option>}{opts.syllabi.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="font-bold text-slate-300">Standard<input className={`${inp} w-20`} defaultValue={b.grade} onBlur={(e) => { if (e.target.value !== b.grade) void act({ action: 'book', id: b.id, grade: e.target.value }, 'Standard updated.'); }} /></label>
              <label className="font-bold text-slate-300">Medium<select className={`${inp} w-44`} value={b.medium} onChange={(e) => act({ action: 'book', id: b.id, medium: e.target.value }, 'Medium updated.')}>{!opts.mediums.some(([v]) => v === b.medium) && <option value={b.medium}>{b.medium || '—'}</option>}{opts.mediums.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">{b.parts.map((p) => (
              <div key={p.index} className="rounded-xl border border-white/10 bg-black/20 p-2 text-[11px]">
                <div className="flex justify-between"><b>Part {p.index}</b><span className="text-slate-500">pp. {p.startPage}–{p.endPage}</span></div>
                {p.materials.length === 0 && <div className="mt-1 text-slate-500">no materials</div>}
                <ul className="mt-1 space-y-1">{p.materials.map((m) => <li key={m.id} className={m.hidden ? 'text-amber-200' : ''}><b>{MAT[m.type] ?? m.type}</b>{m.score != null && <span className="text-slate-500"> · QA {m.score}</span>}<div className="text-slate-500">{who(m.owner)}</div>
                  <button className="mr-2 text-cyan-300 underline" onClick={() => act({ action: 'material', id: m.id, hidden: !m.hidden }, m.hidden ? 'Material shown.' : 'Material hidden.')}>{m.hidden ? 'show' : 'hide'}</button><button className="text-rose-300 underline" onClick={() => { if (confirm(`Delete ${MAT[m.type] ?? m.type} of Part ${p.index}?`)) void act({ action: 'deleteMaterial', id: m.id }, 'Material deleted.'); }}>delete</button></li>)}</ul>
              </div>))}</div>
          </article>))}
      </section>
    </div>
  );
}
