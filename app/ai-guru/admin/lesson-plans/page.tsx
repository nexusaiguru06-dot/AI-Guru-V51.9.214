'use client';

/**
 * V51.9.209 — Office › Lesson plans. Makes the whiteboard lesson plans on the AI Guru server (with the server's Gemini
 * key) so students need no AI key: the classroom plays at once. Keep this page open while it works; you can stop, close
 * it and carry on later — finished blocks are kept. Each step is one short request, so it works on Netlify too.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type Mat = { id: string; title: string; type: string; sections: number };
type Book = { id: string; name: string; grade?: string | number; subject?: string; materials: Mat[] };
type Sec = { index: number; id: string; heading: string; blocks: number; planned: number; todo: number[]; subjects: boolean; complete: boolean };

const btn = 'rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20 disabled:opacity-40';
const API = '/api/ai-guru/admin/board-plan';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function LessonPlansPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [hasKey, setHasKey] = useState(true);
  const [denied, setDenied] = useState(false);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState('');
  const [speed, setSpeed] = useState(3);
  const stop = useRef(false);

  const load = useCallback(async () => {
    const r = await fetch(API, { cache: 'no-store' });
    if (!r.ok) { setDenied(true); return; }
    const j = await r.json();
    setBooks(j.books); setHasKey(!!j.hasKey);
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const status = async (m: Mat): Promise<Sec[]> => {
    const r = await fetch(`${API}?materialId=${encodeURIComponent(m.id)}`, { cache: 'no-store' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Could not read the plan status');
    return j.sections as Sec[];
  };
  const step = async (m: Mat, s: Sec, kind: 'block' | 'subjects', blockIndex: number): Promise<Sec> => {
    let last = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (stop.current) throw new Error('Stopped');
      try {
        const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ materialId: m.id, sectionIndex: s.index, step: kind, blockIndex }) });
        const text = await r.text();
        let j: { ok?: boolean; status?: Sec; error?: string } = {};
        try { j = JSON.parse(text); } catch { last = r.status === 504 ? 'the server took too long (60 s)' : `server reply ${r.status}`; }
        if (j.ok && j.status) return j.status;
        if (j.error) last = j.error;
        if (r.status === 400 && /No server AI key/.test(last)) throw new Error(last);
      } catch (e) { if ((e as Error).message === 'Stopped' || /No server AI key/.test((e as Error).message)) throw e; last = (e as Error).message; }
      await sleep(1500 * attempt);
    }
    throw new Error(`Section “${s.heading || s.id}”: ${last}`);
  };

  const prepare = async (m: Mat) => {
    setBusy(m.id); stop.current = false; setLog('');
    try {
      const secs = await status(m);
      const total = secs.reduce((n, s) => n + s.blocks + 1, 0);
      let done = secs.reduce((n, s) => n + s.planned + (s.subjects ? 1 : 0), 0);
      const tick = () => setProgress((p) => ({ ...p, [m.id]: { done, total } }));
      tick();
      for (const s0 of secs) {
        let s = s0;
        while (!s.complete) {
          if (stop.current) throw new Error('Stopped');
          if (s.todo.length) {
            const batch = s.todo.slice(0, Math.max(1, speed));
            const results = await Promise.all(batch.map((b) => step(m, s, 'block', b)));
            done += batch.length;
            s = results[results.length - 1];
            s = { ...s, todo: s.todo.filter((b) => !batch.includes(b)) }; // the server's last answer may lag the other blocks
          } else { s = await step(m, s, 'subjects', 0); done += 1; }
          tick();
          setLog(`“${s.heading || s.id}”: ${s.planned}/${s.blocks}`);
        }
      }
      setLog('✓ Done: every section of this material has a lesson plan on the server.');
    } catch (e) { setLog((e as Error).message === 'Stopped' ? 'Stopped. What is finished is kept; press Prepare to carry on.' : `⚠ ${(e as Error).message}`); }
    setBusy(null);
  };

  if (denied) return <main className="min-h-screen bg-[#06101c] p-8 text-slate-300">Sign in to the <a className="underline" href="/ai-guru/admin">Admin portal</a> first, then open this page again.</main>;
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <a href="/ai-guru/admin" className="text-sm text-slate-400 hover:text-white">◀ Admin portal</a>
        <h1 className="text-2xl font-extrabold">Lesson plans on the server</h1>
        <p className="text-sm text-slate-300">The whiteboard class is planned by the AI once, here, with the <b>server’s own key</b>. After that every student opens the class and it plays at once — <b>no AI key and no waiting on the student’s side</b>. The plan is also kept on each student’s device after the first open.</p>
        {!hasKey && <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 p-3 text-sm text-rose-100" data-no-key>No server AI key yet. Add one in Study materials → Cloud settings, or set <code>GEMINI_API_KEY</code> on the server (Netlify → Environment variables), then reload.</p>}
        <label className="flex items-center gap-2 text-sm text-slate-300">Blocks at once
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-lg border border-white/15 bg-[#0b1017] px-2 py-1"><option value={1}>1 (gentle)</option><option value={2}>2</option><option value={3}>3</option><option value={5}>5 (fast; may hit Gemini limits)</option></select>
        </label>
        {log && <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" role="status" data-plan-log>{log}</p>}
        {busy && <button className={btn} onClick={() => { stop.current = true; }} data-plan-stop>⏹ Stop</button>}
        {books === null && <p className="text-slate-400">Loading…</p>}
        {books?.length === 0 && <p className="text-slate-400">No study materials yet. Make some in Material Studio first.</p>}
        {books?.map((b) => (
          <section key={b.id} className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="font-bold">{b.name} <span className="text-xs font-normal text-slate-400">{[b.subject, b.grade && `Class ${b.grade}`].filter(Boolean).join(' · ')}</span></h2>
            {b.materials.map((m) => {
              const p = progress[m.id];
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 px-3 py-2" data-plan-material>
                  <span className="min-w-0 flex-1 truncate text-sm">{m.title} <span className="text-xs text-slate-400">· {m.type} · {m.sections} sections</span></span>
                  {p && <span className="text-xs text-slate-300">{Math.round((p.done / Math.max(1, p.total)) * 100)}%</span>}
                  <button className={btn} disabled={!!busy || !hasKey} onClick={() => void prepare(m)} data-plan-start>{busy === m.id ? 'Working…' : p?.done === p?.total && p ? '✓ Done' : 'Prepare lesson plans'}</button>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </main>
  );
}
