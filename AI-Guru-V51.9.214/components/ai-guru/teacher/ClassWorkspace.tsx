'use client';
import { useCallback, useEffect, useState } from 'react';

interface Q { q: string; options: string[]; answer: number }
interface Item { id: string; kind: 'note' | 'template' | 'exam'; title: string; body: string; questions?: Q[]; minutes?: number; shared: boolean; open: boolean; live?: boolean; updatedAt: string; handedIn?: number }
interface Starter { id: string; kind: Item['kind']; title: string }
interface Results { title: string; rows: Array<{ serial: number | null; studentCode: string; name: string; done: boolean; score: number | null; total: number }>; handedIn: number; average: number | null }
const blankQ = (): Q => ({ q: '', options: ['', '', '', ''], answer: 0 });
const inp = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white';
const btn = 'rounded-lg bg-cyan-400 px-3 py-2 text-xs font-extrabold text-[#04121f] disabled:opacity-40';
const ghost = 'rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold';
const LABEL = { note: 'Notes', template: 'Templates', exam: 'Exams' } as const;
const HINT = {
  note: 'Notes your students can read. Only students of your class see them.',
  template: 'Your own blueprints (worksheets, lesson plans). Private until you choose to show one to the class. “Use” makes a copy you can turn into notes or an exam.',
  exam: 'Multiple-choice exams. “Send into regular class” makes the exam pop up for your students while they learn in the app. Students hand in once; you see every mark with their roll number and student number.',
} as const;

/** Teacher portal: this teacher's notes, templates and exams. Every call carries the class code and key, and the server keeps each item with that class only. */
export function ClassWorkspace({ code, keyText }: { code: string; keyText: string }) {
  const [tab, setTab] = useState<Item['kind']>('note');
  const [items, setItems] = useState<Item[]>([]); const [starters, setStarters] = useState<Starter[]>([]);
  const [edit, setEdit] = useState<(Partial<Item> & { kind: Item['kind'] }) | null>(null);
  const [res, setRes] = useState<Results | null>(null); const [msg, setMsg] = useState('');
  const call = useCallback(async (body: object) => { const r = await fetch('/api/ai-guru/teacher-content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, key: keyText, ...body }) }); return r.json().catch(() => ({ ok: false, error: 'No answer' })); }, [code, keyText]);
  const load = useCallback(async () => { const j = await call({ action: 'list' }); if (j.ok) { setItems(j.items); setStarters(j.starters); } }, [call]);
  useEffect(() => { void load(); }, [load]);
  const mine = items.filter((i) => i.kind === tab);
  const save = async () => {
    if (!edit) return; setMsg('');
    const j = await call({ action: 'save', item: edit });
    if (!j.ok) return setMsg(j.error || 'Could not save');
    setEdit(null); setMsg('Saved'); await load();
  };
  const act = async (body: object, then?: () => void) => { const j = await call(body); if (!j.ok) setMsg(j.error || 'Could not do that'); else { setMsg(''); then?.(); } await load(); return j; };
  const setQ = (i: number, f: Partial<Q>) => setEdit((e) => e && { ...e, questions: (e.questions ?? []).map((q, k) => (k === i ? { ...q, ...f } : q)) });
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4" aria-label="My notes, templates and exams">
      <h3 className="font-extrabold">Notes, templates and exams</h3>
      <div role="tablist" className="mt-2 flex gap-2">{(['note', 'template', 'exam'] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setEdit(null); setRes(null); }} className={`rounded-full px-3 py-1 text-xs font-bold ${tab === k ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15'}`}>{LABEL[k]} ({items.filter((i) => i.kind === k).length})</button>)}</div>
      <p className="mt-2 text-xs text-slate-400">{HINT[tab]}</p>
      {msg && <p role="status" className="mt-2 text-sm text-amber-200">{msg}</p>}
      {!edit && <div className="mt-3 flex flex-wrap gap-2">
        <button className={btn} onClick={() => setEdit({ kind: tab, title: '', body: '', questions: tab === 'exam' ? [blankQ()] : undefined, minutes: tab === 'exam' ? 20 : undefined })}>+ New {LABEL[tab].toLowerCase().replace(/s$/, '')}</button>
        {starters.filter((s) => s.kind === tab || (tab === 'note' && s.kind === 'template')).map((s) => <button key={s.id} className={ghost} onClick={() => void act({ action: 'use', id: s.id, kind: tab })}>Start from: {s.title.replace(/<.*?>/g, '').replace(/:\s*$/, '')}</button>)}
      </div>}
      {edit && (
        <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <label className="block text-xs font-bold text-slate-300">Title<input className={inp} value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={120} /></label>
          <label className="block text-xs font-bold text-slate-300">{edit.kind === 'exam' ? 'Instructions for students' : 'Text'}<textarea className={`${inp} min-h-[8rem]`} value={edit.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></label>
          {edit.kind === 'exam' && <>
            <label className="block text-xs font-bold text-slate-300">Minutes (for the student’s information)<input className={`${inp} max-w-[8rem]`} type="number" min={1} max={300} value={edit.minutes ?? ''} onChange={(e) => setEdit({ ...edit, minutes: Number(e.target.value) || undefined })} /></label>
            {(edit.questions ?? []).map((q, i) => (
              <fieldset key={i} className="rounded-lg border border-white/10 p-2">
                <legend className="px-1 text-xs font-bold text-slate-300">Question {i + 1}</legend>
                <input className={inp} placeholder="Question" value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} aria-label={`Question ${i + 1}`} />
                {q.options.map((o, k) => <div key={k} className="mt-1 flex items-center gap-2"><input type="radio" name={`ans${i}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} aria-label={`Answer ${k + 1} is right`} /><input className={inp + ' !mt-0'} placeholder={`Answer ${k + 1}${k > 1 ? ' (optional)' : ''}`} value={o} onChange={(e) => setQ(i, { options: q.options.map((x, n) => (n === k ? e.target.value : x)) })} aria-label={`Question ${i + 1} answer ${k + 1}`} /></div>)}
                <button className={`${ghost} mt-2`} onClick={() => setEdit({ ...edit, questions: (edit.questions ?? []).filter((_, n) => n !== i) })}>Remove question</button>
              </fieldset>
            ))}
            <button className={ghost} onClick={() => setEdit({ ...edit, questions: [...(edit.questions ?? []), blankQ()] })}>+ Add question</button>
          </>}
          <div className="flex gap-2"><button className={btn} onClick={() => void save()}>Save</button><button className={ghost} onClick={() => { setEdit(null); setMsg(''); }}>Cancel</button></div>
        </div>
      )}
      <ul className="mt-3 space-y-2">
        {mine.map((it) => (
          <li key={it.id} className="rounded-xl bg-black/20 p-3">
            <div className="flex flex-wrap items-center gap-2"><b>{it.title}</b>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${it.shared ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-slate-300'}`}>{it.shared ? 'Shown to my class' : 'Private'}</span>
              {it.kind === 'exam' && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${it.open ? 'bg-amber-300/20 text-amber-200' : 'bg-white/10 text-slate-300'}`}>{it.live ? 'In the regular class · ' : ''}{it.open ? 'Open' : 'Closed'} · {it.questions?.length ?? 0} questions · {it.handedIn ?? 0} handed in</span>}
            </div>
            {it.kind !== 'exam' && <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-slate-400">{it.body}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={ghost} onClick={() => { setEdit(it); setRes(null); }}>Edit</button>
              <button className={ghost} onClick={() => void act({ action: 'toggle', id: it.id, field: 'shared' })}>{it.shared ? 'Hide from class' : 'Show to class'}</button>
              {it.kind === 'exam' && <><button className={`${ghost} ${it.live ? 'border-rose-400/60 text-rose-200' : 'border-cyan-400/50 text-cyan-200'}`} title="Pops up for your students while they learn in the regular class" onClick={() => void act({ action: 'toggle', id: it.id, field: 'live' })}>{it.live ? 'Stop sending to class' : 'Send into regular class'}</button><button className={ghost} onClick={() => void act({ action: 'toggle', id: it.id, field: 'open' })}>{it.open ? 'Close exam' : 'Open exam'}</button><button className={ghost} onClick={async () => { const j = await call({ action: 'results', id: it.id }); if (j.ok) setRes(j); }}>Results</button></>}
              {it.kind === 'template' && <><button className={ghost} onClick={() => void act({ action: 'use', id: it.id, kind: 'note' })}>Use as note</button><button className={ghost} onClick={() => void act({ action: 'use', id: it.id, kind: 'exam' })}>Use as exam</button></>}
              {it.kind !== 'template' && <button className={ghost} onClick={() => void act({ action: 'use', id: it.id, kind: it.kind })}>Copy</button>}
              <button className={`${ghost} text-rose-300`} onClick={() => { if (window.confirm(`Delete “${it.title}”?${it.kind === 'exam' ? ' Students’ marks for it are deleted too.' : ''}`)) void act({ action: 'delete', id: it.id }); }}>Delete</button>
            </div>
          </li>
        ))}
        {!mine.length && !edit && <li className="text-sm text-slate-400">Nothing here yet.</li>}
      </ul>
      {res && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between"><h4 className="font-extrabold">{res.title}: {res.handedIn} handed in{res.average !== null ? ` · class average ${res.average}%` : ''}</h4><button className={ghost} onClick={() => setRes(null)}>Close</button></div>
          <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="py-1">Roll</th><th>Student no.</th><th>Name</th><th>Mark</th></tr></thead>
            <tbody>{res.rows.map((r) => <tr key={r.studentCode + r.name} className="border-t border-white/5"><td className="py-1 font-mono">{r.serial ?? '—'}</td><td className="font-mono text-xs text-cyan-300">{r.studentCode}</td><td>{r.name}</td><td>{r.done ? <b className="text-amber-300">{r.score}/{r.total}</b> : <span className="text-slate-500">not yet</span>}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </section>
  );
}
