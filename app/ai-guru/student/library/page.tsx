'use client';
/**
 * V51.9.95 — "Download your study materials". The first page after sign-up. Lists the textbooks of the student's syllabus
 * and standard in the AI Guru library (made by the admin or by other students), shows the first four pages so the student
 * can check it is their textbook, and downloads books one at a time: the text and then every study material, one by one,
 * into this device (so the classroom can open them even when the network drops) and into "My books".
 * Can't find the textbook? Create it with your own Gemini key in Material Studio (V51.9.187: students never use the school cloud).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

type Mat = { id: string; type: string; by: string };
type Part = { index: number; startPage: number; endPage: number; free: boolean; paid?: boolean; locked: boolean; materials: Mat[] };
interface Book { id: string; fileName: string; subject: string; grade: string; syllabus: string; medium: string; pageCount: number; by: string; own: boolean; inLibrary: boolean; matches: boolean; mediumMatch: boolean; parts: Part[]; materialCount: number }
interface Data { profile: { name: string; standard: string; syllabus: string; medium: string; full: boolean }; options: { syllabi: Array<[string, string]>; mediums: Array<[string, string]> }; books: Book[]; library: string[]; cloud: { allowed: boolean; dailyLimit: number; left: number } }
type Step = { label: string; state: 'waiting' | 'working' | 'done' | 'failed' };
interface Dl { bookId: string; steps: Step[]; done: boolean; error?: string }

const CACHE = 'ai-guru-library-v1';
const MAT: Record<string, string> = { 'whiteboard-notes': 'Whiteboard notes', mcq: 'MCQ', 'revision-notes': 'Revision notes', qa: 'Questions & answers', flashcards: 'Flashcards', worksheet: 'Worksheet', 'question-paper': 'Question paper', ppt: 'Slides', 'mind-map': 'Mind map', 'knowledge-base': 'Knowledge base', 'problems-formulae': 'Problems & formulae' };
const CLOUD_TYPES = ['whiteboard-notes', 'mcq', 'revision-notes', 'qa', 'flashcards', 'worksheet', 'question-paper', 'mind-map', 'problems-formulae'];
const btn = 'rounded-xl px-4 py-2 text-sm font-extrabold disabled:opacity-50';
const sel = 'mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400';
const label = (opts: Array<[string, string]>, v: string) => opts.find(([k]) => k === v)?.[1] ?? v;

/** Saves one response into the device's library cache (best effort: a private window may refuse). */
async function keep(url: string, res: Response) { try { const c = await caches.open(CACHE); await c.put(url, res); } catch { /* no cache in this browser: still in My books */ } }

export default function StudentLibrary() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [all, setAll] = useState(false);
  const [prof, setProf] = useState({ syllabus: '', medium: '' });
  const [preview, setPreview] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [dl, setDl] = useState<Record<string, Dl>>({});
  const [cloudFor, setCloudFor] = useState<{ book: Book; part: number; types: string[] } | null>(null);
  const [jobs, setJobs] = useState<Array<{ id: string; documentId: string; part: number; type: string; status: string; error?: string }>>([]);
  const busy = useRef(false);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => { setWelcome(new URLSearchParams(window.location.search).has('welcome')); }, []);

  const load = useCallback(async () => {
    const r = await fetchIfSignedIn(['student', 'admin'], `/api/ai-guru/student-portal/library${all ? '?all=1' : ''}`, { cache: 'no-store' });
    if (r.status === 401) { window.location.href = '/ai-guru/student'; return; }
    const j = await r.json().catch(() => null);
    if (!j?.ok) { setErr('Could not load the library.'); return; }
    setD(j); setProf({ syllabus: j.profile.syllabus, medium: j.profile.medium });
  }, [all]);
  useEffect(() => { void load(); }, [load]);
  const loadJobs = useCallback(async () => { const j = await fetchIfSignedIn(['student', 'admin'], '/api/ai-guru/library/jobs', { cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.ok) setJobs(j.jobs); return j?.jobs ?? []; }, []);
  useEffect(() => { void loadJobs(); }, [loadJobs]);
  useEffect(() => { // while a cloud job runs, check every 10 s
    if (!jobs.some((j) => j.status === 'queued' || j.status === 'running')) return;
    const t = setInterval(async () => { const js = await loadJobs(); if (!js.some((j: { status: string }) => j.status === 'queued' || j.status === 'running')) void load(); }, 10_000);
    return () => clearInterval(t);
  }, [jobs, loadJobs, load]);

  // Downloads run one book at a time, and inside a book one item at a time.
  useEffect(() => {
    if (busy.current || !queue.length || !d) return;
    const bookId = queue[0];
    const book = d.books.find((b) => b.id === bookId);
    if (!book) { setQueue((q) => q.slice(1)); return; }
    busy.current = true;
    void (async () => {
      const mats = book.parts.flatMap((p) => (p.locked ? [] : p.materials.map((m) => ({ ...m, part: p.index }))));
      const steps: Step[] = [{ label: 'Textbook text', state: 'waiting' }, ...mats.map((m) => ({ label: `Part ${m.part} · ${MAT[m.type] ?? m.type}`, state: 'waiting' as const }))];
      const set = (i: number, state: Step['state']) => { steps[i] = { ...steps[i], state }; setDl((x) => ({ ...x, [bookId]: { bookId, steps: [...steps], done: false } })); };
      setDl((x) => ({ ...x, [bookId]: { bookId, steps: [...steps], done: false } }));
      try {
        const add = await fetch('/api/ai-guru/student-portal/library', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', documentId: bookId }) });
        if (!add.ok) throw new Error('Could not add the book');
        set(0, 'working');
        const srcUrl = `/api/ai-guru/material-studio/sources/${encodeURIComponent(bookId)}`;
        const src = await fetch(srcUrl, { cache: 'no-store' });
        if (!src.ok) throw new Error('Could not download the textbook text');
        await keep(srcUrl, src.clone()); set(0, 'done');
        const listUrl = `/api/ai-guru/material-studio/materials?documentId=${encodeURIComponent(bookId)}`;
        const list = await fetch(listUrl, { cache: 'no-store' });
        const lj = await list.clone().json().catch(() => ({ materials: [] }));
        await keep(listUrl, list);
        for (let i = 0; i < mats.length; i++) {
          set(i + 1, 'working');
          const m = (lj.materials as Array<{ id: string }>).find((x) => x.id === mats[i].id);
          if (m) await keep(`/ai-guru-offline/material/${encodeURIComponent(m.id)}`, new Response(JSON.stringify(m), { headers: { 'content-type': 'application/json' } }));
          await new Promise((r) => setTimeout(r, 120)); // one by one, visibly
          set(i + 1, m ? 'done' : 'failed');
        }
        setDl((x) => ({ ...x, [bookId]: { bookId, steps: [...steps], done: true } }));
      } catch (e) {
        setDl((x) => ({ ...x, [bookId]: { bookId, steps: [...steps], done: true, error: e instanceof Error ? e.message : 'Download failed' } }));
      } finally {
        busy.current = false; setQueue((q) => q.slice(1)); void load();
      }
    })();
  }, [queue, d, load]);

  const saveProfile = async () => {
    const r = await fetch('/api/ai-guru/student-portal/library', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'profile', ...prof }) });
    if (r.ok) await load(); else setErr((await r.json().catch(() => ({}))).error ?? 'Could not save');
  };
  const remove = async (b: Book) => {
    await fetch('/api/ai-guru/student-portal/library', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', documentId: b.id }) });
    try { const c = await caches.open(CACHE); await c.delete(`/api/ai-guru/material-studio/sources/${encodeURIComponent(b.id)}`); } catch { /* ignore */ }
    await load();
  };
  const askCloud = async () => {
    if (!cloudFor) return;
    const r = await fetch('/api/ai-guru/library/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ documentId: cloudFor.book.id, part: cloudFor.part, types: cloudFor.types }) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) { setErr(j.error ?? 'Could not start'); return; }
    const made = j.results.filter((x: { job?: unknown }) => x.job).length, have = j.results.filter((x: { existing?: string }) => x.existing).length, limit = j.results.find((x: { error?: string }) => x.error)?.error;
    setErr(''); setCloudFor(null); await loadJobs();
    setNote(`${made ? `${made} material(s) are being made on the AI Guru cloud. This page updates when they are ready (a few minutes each).` : ''}${have ? ` ${have} already in the library: just download the book again.` : ''}${limit ? ` ${limit}.` : ''}`.trim());
  };

  if (!d) return <main className="min-h-screen bg-[#06101c] p-8 text-slate-300">{err || 'Loading…'}</main>;
  const p = d.profile;
  const needProfile = !p.syllabus || !p.medium;
  const myBooks = d.books.filter((b) => b.inLibrary);
  const others = d.books.filter((b) => !b.inLibrary);
  const prev = d.books.find((b) => b.id === preview);

  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <a href="/ai-guru/student" className="text-xs text-slate-400">← My account</a>
          <a href="/ai-guru/classroom" className="ml-auto rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold">Classroom →</a>
        </header>
        <div>
          <h1 className="text-2xl font-extrabold">Download your study materials</h1>
          
        </div>
        {welcome && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">Welcome, {p.name.split(' ')[0]}! Pick your textbooks below and download them one by one. Check the first pages to be sure it is your book.</p>}
        {note && <p role="status" className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">{note}</p>}
        {err && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm text-rose-200">{err}</p>}

        <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
          {needProfile ? (
            <div className="space-y-3"><p className="text-sm font-bold">Tell us your syllabus and medium, so we show your textbooks.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-bold text-slate-300">Syllabus<select className={sel} value={prof.syllabus} onChange={(e) => setProf({ ...prof, syllabus: e.target.value })}><option value="">Choose…</option>{d.options.syllabi.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-300">Medium<select className={sel} value={prof.medium} onChange={(e) => setProf({ ...prof, medium: e.target.value })}><option value="">Choose…</option>{d.options.mediums.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <button className={`${btn} mt-5 bg-cyan-400 text-[#04121f]`} disabled={!prof.syllabus || !prof.medium} onClick={saveProfile}>Show my books</button>
              </div></div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-400">Showing books for</span><b>{label(d.options.syllabi, p.syllabus)}</b><span>·</span><b>Std {p.standard}</b><span>·</span><b>{label(d.options.mediums, p.medium)}</b>
              <button className="ml-auto text-xs text-cyan-300 underline" onClick={() => setProf({ syllabus: '', medium: '' })}>change</button>
              <label className="flex items-center gap-1.5 text-xs text-slate-400"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />show every syllabus</label></div>
          )}
          {!needProfile && !prof.syllabus && <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-slate-300">Syllabus<select className={sel} value={prof.syllabus} onChange={(e) => setProf({ ...prof, syllabus: e.target.value })}><option value="">Choose…</option>{d.options.syllabi.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-300">Medium<select className={sel} value={prof.medium} onChange={(e) => setProf({ ...prof, medium: e.target.value })}><option value="">Choose…</option>{d.options.mediums.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <button className={`${btn} mt-5 bg-cyan-400 text-[#04121f]`} disabled={!prof.syllabus || !prof.medium} onClick={saveProfile}>Save</button></div>}
        </section>

        {myBooks.length > 0 && <section className="space-y-3"><h2 className="text-lg font-extrabold">My books </h2>
          {myBooks.map((b) => <BookCard key={b.id} b={b} dl={dl[b.id]} queued={queue.includes(b.id)} onPreview={() => setPreview(b.id)} onDownload={() => setQueue((q) => (q.includes(b.id) ? q : [...q, b.id]))} onRemove={() => remove(b)} onCloud={d.cloud.allowed ? (part) => setCloudFor({ book: b, part, types: [] }) : undefined} jobs={jobs.filter((j) => j.documentId === b.id)} />)}</section>}

        <section className="space-y-3"><h2 className="text-lg font-extrabold">{needProfile ? 'Books in the library' : 'Your textbooks in the library'}</h2>
          {others.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm text-slate-400">{myBooks.length ? 'You have downloaded every book that matches.' : 'No textbook of your syllabus and standard is in the library yet. Create it below — the next student of your class will find it here.'}</p>}
          {others.map((b) => <BookCard key={b.id} b={b} dl={dl[b.id]} queued={queue.includes(b.id)} onPreview={() => setPreview(b.id)} onDownload={() => setPreview(b.id)} jobs={jobs.filter((j) => j.documentId === b.id)} />)}
        </section>

        <section className="space-y-2 rounded-2xl border border-white/10 bg-white/[.04] p-4" data-from-office>
          <h2 className="text-lg font-extrabold">Can’t find your textbook?</h2>
          <p className="text-sm text-slate-400">Textbooks and their study materials are prepared by AI Guru’s teachers in the admin portal. If yours is missing, tell your teacher or the office through <a className="font-bold text-cyan-300 underline" href="/ai-guru/messages">Messages</a> and it will be added.</p>
        </section>
      </div>

      {prev && (
        <div role="dialog" aria-modal="true" aria-label="Check the first pages" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0a1a2b] p-4">
            <h3 className="text-lg font-extrabold">Is this your textbook?</h3>
            <p className="text-sm text-slate-400">{prev.subject} · Std {prev.grade} · {label(d.options.mediums, prev.medium)} · {prev.pageCount} pages · {prev.fileName}</p>
            
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[1, 2, 3, 4].filter((n) => n <= Math.max(1, prev.pageCount)).map((n) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={n} loading="lazy" src={`/api/ai-guru/material-studio/page-image/${encodeURIComponent(prev.id)}?page=${n}`} alt={`Page ${n}`} className="aspect-[3/4] w-full rounded-lg bg-white object-contain" />))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={`${btn} bg-cyan-400 text-[#04121f]`} onClick={() => { setQueue((q) => (q.includes(prev.id) ? q : [...q, prev.id])); setPreview(null); }}>Yes, download it</button>
              <button className={`${btn} border border-white/15`} onClick={() => setPreview(null)}>No, not my book</button>
            </div>
          </div>
        </div>)}

      {cloudFor && (
        <div role="dialog" aria-modal="true" aria-label="Create on the cloud" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3">
          <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/15 bg-[#0a1a2b] p-4">
            <h3 className="font-extrabold">Create on the AI Guru cloud</h3>
            <p className="text-sm text-slate-400">{cloudFor.book.subject} · Part {cloudFor.part}. Materials already in the library are not made again. {d.cloud.left} left today.</p>
            <div className="flex flex-wrap gap-1.5">{CLOUD_TYPES.map((t) => { const have = cloudFor.book.parts.find((x) => x.index === cloudFor.part)?.materials.some((m) => m.type === t); const on = cloudFor.types.includes(t); return <button key={t} disabled={have} aria-pressed={on} onClick={() => setCloudFor({ ...cloudFor, types: on ? cloudFor.types.filter((x) => x !== t) : [...cloudFor.types, t] })} className={`rounded-full px-3 py-1 text-xs font-bold ${have ? 'bg-emerald-400/10 text-emerald-300' : on ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-300'}`}>{MAT[t]}{have ? ' ✓' : ''}</button>; })}</div>
            <div className="flex gap-2"><button className={`${btn} bg-cyan-400 text-[#04121f]`} disabled={!cloudFor.types.length || d.cloud.left <= 0} onClick={askCloud}>Create</button><button className={`${btn} border border-white/15`} onClick={() => setCloudFor(null)}>Cancel</button></div>
          </div>
        </div>)}
    </main>
  );
}

function BookCard({ b, dl, queued, jobs, onPreview, onDownload, onRemove, onCloud }: { b: Book; dl?: Dl; queued: boolean; jobs: Array<{ id: string; part: number; type: string; status: string; error?: string }>; onPreview: () => void; onDownload: () => void; onRemove?: () => void; onCloud?: (part: number) => void }) {
  const working = dl && !dl.done;
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1"><h3 className="font-extrabold">{b.subject || b.fileName} <span className="text-sm font-normal text-slate-400">Std {b.grade}</span></h3>
          <p className="truncate text-xs text-slate-400">{b.fileName} · {b.pageCount} pages · {b.by}{b.mediumMatch ? ' · your medium' : b.medium ? ` · ${b.medium} medium` : ''}</p></div>
        <div className="flex flex-wrap gap-1.5">
          <button className={`${btn} border border-white/15 text-xs`} onClick={onPreview}>First pages</button>
          {b.inLibrary ? <>
            <a href={`/ai-guru/classroom?materialDocument=${encodeURIComponent(b.id)}`} className={`${btn} bg-violet-600 text-xs`}>Open in classroom</a>
            <button className={`${btn} border border-white/15 text-xs`} disabled={!!working || queued} onClick={onDownload}>{queued && !working ? 'Waiting…' : 'Download again'}</button>
            {onRemove && <button className="text-xs text-slate-400 underline" onClick={onRemove}>Remove</button>}
          </> : <button className={`${btn} bg-cyan-400 text-xs text-[#04121f]`} disabled={!!working || queued} onClick={onDownload}>{queued ? 'Waiting…' : 'Download'}</button>}
        </div>
      </div>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-5">{b.parts.map((p) => (
        <div key={p.index} className={`rounded-lg border p-2 text-[11px] ${p.locked ? 'border-white/10 bg-black/20 text-slate-400' : 'border-emerald-400/25 bg-emerald-400/5'}`}>
          <div className="flex justify-between"><b>Part {p.index}</b><span>{p.locked ? '🔒' : p.paid ? 'paid ✓' : p.free ? 'free' : '✓'}</span></div>
          <div className="text-slate-500">pp. {p.startPage}–{p.endPage}</div>
          <div className="mt-0.5">{p.materials.length ? [...new Set(p.materials.map((m) => MAT[m.type] ?? m.type))].join(', ') : 'no materials yet'}</div>
          {onCloud && !p.locked && <button className="mt-1 text-cyan-300 underline" onClick={() => onCloud(p.index)}>Create on cloud</button>}
        </div>))}</div>
      {jobs.length > 0 && <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">{jobs.slice(0, 6).map((j) => <li key={j.id}>☁ Part {j.part} · {MAT[j.type] ?? j.type}: <b className={j.status === 'done' ? 'text-emerald-300' : j.status === 'failed' ? 'text-rose-300' : 'text-amber-200'}>{j.status === 'queued' ? 'waiting' : j.status === 'running' ? 'being made…' : j.status === 'done' ? 'ready — download again' : `failed (${j.error ?? ''})`}</b></li>)}</ul>}
      {dl && <div className="mt-3 rounded-xl bg-black/30 p-3 text-xs" role="status">
        <div className="mb-1 font-bold">{dl.done ? (dl.error ? `✗ ${dl.error}` : '✓ Downloaded to this device and My books') : 'Downloading one by one…'}</div>
        <ol className="grid gap-0.5 sm:grid-cols-2">{dl.steps.map((s, i) => <li key={i} className={s.state === 'done' ? 'text-emerald-300' : s.state === 'failed' ? 'text-rose-300' : s.state === 'working' ? 'text-amber-200' : 'text-slate-500'}>{s.state === 'done' ? '✓' : s.state === 'failed' ? '✗' : s.state === 'working' ? '⟳' : '·'} {s.label}</li>)}</ol>
        {b.parts.some((p) => p.locked && p.materials.length) && <p className="mt-1 text-slate-500">🔒 Locked parts download as soon as you pay for them.</p>}
      </div>}
    </article>
  );
}
