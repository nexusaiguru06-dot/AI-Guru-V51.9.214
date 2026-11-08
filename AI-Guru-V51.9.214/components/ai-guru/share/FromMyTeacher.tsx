'use client';
import { useEffect, useState } from 'react';
import { ExamRunner, type ExamItem } from './ExamRunner';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';
import { JoinClassBox } from './JoinClassBox';

interface Item extends ExamItem { kind: 'note' | 'template' | 'exam'; isNew?: boolean; sharedAt?: string; createdAt?: string }
type Data = { class: { name: string; teacher: string; serial: number | null } | null; items: Item[] };

/** The "Teachers Notes" page body: what my own teacher shared with my class. Nothing from other classes ever arrives here. */
export function FromMyTeacher() {
  const [d, setD] = useState<Data | null>(null); const [auth, setAuth] = useState<boolean | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/class-content', { cache: 'no-store' }).then(async (r) => {
      if (r.status === 401) return setAuth(false);
      const j = await r.json(); setAuth(true); setD(j);
      // the red dot on the menu clears once the student has looked
      await fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/class-content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'seen' }) }).catch(() => {});
      window.dispatchEvent(new Event('aig-teacher-seen'));
    }).catch(() => setAuth(false));
  }, []);
  if (auth === null) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!auth) return <p className="rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm text-slate-200">Please <a className="font-bold text-cyan-300 underline" href="/ai-guru/student">sign in as a student</a> to see what your teacher sent.</p>;
  // V51.9.182 (newcomer review): the class code can be typed right here (before, this page only said "ask your teacher")
  if (!d?.class) return <div className="space-y-3"><p className="rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm text-slate-200">You have not joined a teacher’s class yet. Type the class code your teacher gave you.</p><JoinClassBox onJoined={() => window.location.reload()} /></div>;
  const kindLabel = (k: Item['kind']) => (k === 'exam' ? 'Exam' : k === 'template' ? 'Worksheet' : 'Notes');
  return (
    <section aria-label="Teachers Notes">
      <p className="text-xs text-slate-400">From {d.class.teacher || 'your teacher'} · {d.class.name}{d.class.serial ? ` · your roll number is ${d.class.serial}` : ''}. Only students of this class can see these.</p>
      <ul className="mt-3 space-y-2">
        {d.items.map((it) => (
          <li key={it.id} className="rounded-xl bg-black/20 p-3">
            <button className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={openId === it.id} onClick={() => setOpenId(openId === it.id ? null : it.id)}>
              <span><b>{it.title}</b> <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">{kindLabel(it.kind)}</span>{it.isNew && <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">New</span>}</span>
              {it.kind === 'exam' && (it.attempt ? <span className="text-sm font-extrabold text-amber-300">{it.attempt.score}/{it.attempt.total}</span> : <span className={`text-xs font-bold ${it.open ? 'text-emerald-300' : 'text-slate-500'}`}>{it.open ? 'Open' : 'Closed'}</span>)}
            </button>
            {openId === it.id && (it.kind === 'exam' ? <ExamRunner item={it} /> : <p className="mt-2 whitespace-pre-line text-sm text-slate-200">{it.body}</p>)}
          </li>
        ))}
        {!d.items.length && <li className="text-sm text-slate-400">Your teacher has not sent anything yet.</li>}
      </ul>
    </section>
  );
}
