'use client';
import { useState } from 'react';
import { generateMcqs, type McqItem } from '@/lib/ai-guru/quiz/mcq';
import { draftProblem, draftToItem, emptyDraft, itemToDraft, MAX_ITEMS, type Draft, type QuestionSet } from '@/lib/ai-guru/quiz/sets';
import { aiLlm, hasAnyAiKey } from '@/lib/ai-guru/teacher/ai';

const inp = 'mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-normal outline-none focus:border-cyan-400';

/** Write, edit, order and publish a set of multiple-choice questions. */
export function QuestionEditor({ initial, onSaved, onCancel }: { initial: QuestionSet | null; onSaved: (s: QuestionSet) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [grade, setGrade] = useState(initial?.grade ?? '');
  const [chapter, setChapter] = useState(initial?.chapter ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [items, setItems] = useState<McqItem[]>(initial?.items ?? []);
  const [d, setD] = useState<Draft>(emptyDraft());
  const [editing, setEditing] = useState<number | null>(null);
  const [lesson, setLesson] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const problem = draftProblem(d);
  const addOrUpdate = () => {
    const it = draftToItem(d, editing ?? items.length);
    if (!it) return;
    setItems((l) => (editing === null ? [...l, it] : l.map((x, i) => (i === editing ? it : x))));
    setD(emptyDraft()); setEditing(null);
  };
  const move = (i: number, by: -1 | 1) => setItems((l) => { const j = i + by; if (j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const aiDraft = async () => {
    setBusy('Writing questions…'); setMsg('');
    try {
      const qs = await generateMcqs(aiLlm, { chapter: chapter || name || 'Lesson', section: name || chapter || 'Lesson', text: lesson, count: 5, language: 'english', grade: grade || 10 });
      setItems((l) => [...l, ...qs.map((q) => ({ ...q, golden: false }))].slice(0, MAX_ITEMS));
      setMsg(`Added ${qs.length} questions. Read each one and fix anything that is not right before you publish.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  };

  const save = async () => {
    setBusy('Saving…'); setMsg('');
    try {
      const body = { id: initial?.id, name, grade, chapter, active, items, createdAt: initial?.createdAt };
      const r = await fetch('/api/ai-guru/question-sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ set: body }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Could not save.');
      onSaved(j.set as QuestionSet);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); setBusy(''); }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr]">
        <label className="text-sm font-bold">Name of the quiz<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Pairs of equations — test 1" className={inp} /></label>
        <label className="text-sm font-bold">Class<input value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={10} placeholder="10" className={inp} /></label>
        <label className="text-sm font-bold">Chapter (optional)<input value={chapter} onChange={(e) => setChapter(e.target.value)} maxLength={120} className={inp} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" /> Students can take this quiz now (it appears when they press Quiz)</label>

      <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h3 className="font-extrabold">{editing === null ? 'Add a question' : `Edit question ${editing + 1}`}</h3>
        <label className="mt-3 block text-sm font-bold">Question<textarea value={d.stem} onChange={(e) => setD({ ...d, stem: e.target.value })} rows={2} className={inp} /></label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{d.options.map((o, i) => (
          <label key={i} className="flex items-center gap-2 text-sm">
            <input type="radio" name="right" checked={d.answer === i} onChange={() => setD({ ...d, answer: i as Draft['answer'] })} aria-label={`Answer ${'ABCD'[i]} is right`} className="h-4 w-4 shrink-0" />
            <span className="w-5 font-extrabold">{'ABCD'[i]}</span>
            <input value={o} onChange={(e) => { const n = [...d.options] as Draft['options']; n[i] = e.target.value; setD({ ...d, options: n }); }} className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 outline-none focus:border-cyan-400" />
          </label>))}</div>
        <p className="mt-1 text-xs text-slate-500">Tick the round button of the right answer.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="text-sm font-bold">Why it is right (students read this after answering)<input value={d.why} onChange={(e) => setD({ ...d, why: e.target.value })} className={inp} /></label>
          <label className="text-sm font-bold">Topic<input value={d.concept} onChange={(e) => setD({ ...d, concept: e.target.value })} maxLength={40} placeholder="cross multiplication" className={inp} /></label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={d.golden} onChange={(e) => setD({ ...d, golden: e.target.checked })} className="h-4 w-4" /> ✨ Golden question (worth 2 toffees)</label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={addOrUpdate} disabled={!!problem || items.length >= MAX_ITEMS && editing === null} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-40">{editing === null ? 'Add to quiz' : 'Update question'}</button>
          {editing !== null && <button onClick={() => { setD(emptyDraft()); setEditing(null); }} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold">Cancel edit</button>}
          {problem && (d.stem || d.options.some(Boolean)) && <span className="text-xs text-amber-300">{problem}</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h3 className="font-extrabold">Let the AI draft some <span className="text-sm font-normal text-slate-400">(you check them)</span></h3>
        <textarea value={lesson} onChange={(e) => setLesson(e.target.value)} rows={3} placeholder="Paste the lesson text the questions should come from…" className={`${inp} text-sm`} />
        <button onClick={aiDraft} disabled={!!busy || lesson.trim().length < 80 || !hasAnyAiKey()} className="mt-2 rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-200 disabled:opacity-40">Draft 5 questions</button>
        {!hasAnyAiKey() && <span className="ml-3 text-xs text-slate-500">Needs an AI key in Settings.</span>}
      </section>

      <section>
        <h3 className="mb-2 font-extrabold">Questions in this quiz ({items.length})</h3>
        {items.length === 0 && <p className="text-sm text-slate-400">None yet.</p>}
        <ol className="space-y-2">{items.map((q, i) => (
          <li key={q.id + i} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 text-sm">
            <span className="font-extrabold text-slate-400">{i + 1}</span>
            <div className="min-w-0 flex-1"><div className="font-bold">{q.stem}{q.golden && <span className="ml-2 text-amber-300">✨</span>}</div>
              <div className="mt-1 grid gap-x-4 text-xs text-slate-300 sm:grid-cols-2">{q.options.map((o) => <span key={o.id} className={o.id === q.answer ? 'font-bold text-emerald-300' : ''}>{o.id}. {o.text}</span>)}</div></div>
            <div className="flex shrink-0 flex-col gap-1 text-xs">
              <button onClick={() => { setD(itemToDraft(q)); setEditing(i); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-cyan-300 hover:underline">Edit</button>
              <button onClick={() => move(i, -1)} aria-label="Move up" className="text-slate-400 hover:text-white">↑</button><button onClick={() => move(i, 1)} aria-label="Move down" className="text-slate-400 hover:text-white">↓</button>
              <button onClick={() => { setItems((l) => l.filter((_, k) => k !== i)); setEditing(null); }} className="text-rose-300 hover:underline">Delete</button>
            </div>
          </li>))}</ol>
      </section>

      {(busy || msg) && <p role="status" className="text-sm text-cyan-200">{busy || msg}</p>}
      <div className="flex gap-3"><button onClick={save} disabled={!!busy || !name.trim() || items.length === 0} className="rounded-xl bg-cyan-400 px-6 py-3 font-extrabold text-[#04121f] disabled:opacity-40">Save quiz</button><button onClick={onCancel} className="rounded-xl border border-white/20 px-6 py-3 font-bold">Back</button></div>
    </div>
  );
}
