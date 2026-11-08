'use client';
import type { SessionRecord } from '@/lib/ai-guru/quiz/records';
import { chilliesOf } from '@/lib/ai-guru/quiz/records';
import { rewardEvents } from '@/lib/ai-guru/quiz/reward-feed';
import { Chilli } from './Chilli';
import { Toffee } from './Toffee';
import { PortalSignIn } from '../PortalSignIn';
import { AVATARS } from '@/lib/ai-guru/features';

export const tierColour = (pct: number) => (pct >= 90 ? 'text-emerald-300' : pct >= 70 ? 'text-amber-300' : 'text-rose-300');
export const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };

const TEACHER_LINKS = [['results', '/ai-guru/teacher', 'Results'], ['attendance', '/ai-guru/teacher/attendance', 'Attendance'], ['questions', '/ai-guru/teacher/questions', 'Questions & toffees'], ['dna', '/ai-guru/teacher/dna', 'Templates & videos'], ['classes', '/ai-guru/teacher/classes', 'My class code'], ['avatar', '/ai-guru/teacher/avatar', 'My avatar'], ['messages', '/ai-guru/messages?as=teacher', '💬 Messages']] as const;
export type TeacherPage = (typeof TEACHER_LINKS)[number][0];

/** The teacher portal's menu, shown on every teacher page. */
export function TeacherNav({ current }: { current: TeacherPage }) {
  return (
    <nav aria-label="Teacher portal" className="mb-6 flex flex-wrap gap-2">
      {TEACHER_LINKS.filter(([id]) => AVATARS || id !== 'avatar').map(([id, href, label]) => <a key={id} href={href} aria-current={current === id ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-extrabold ${current === id ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-200 hover:bg-white/5'}`}>{label}</a>)}
    </nav>
  );
}

export function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center gap-3">
          <img src="/aiguru-logo.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
          <div><h1 className="text-2xl font-extrabold">{title}</h1><p className="text-sm text-slate-400">{sub}</p></div>
          <a href="/ai-guru" className="ml-auto rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5">AI Guru</a>
          <PortalSignIn />
        </header>
        {children}
      </div>
    </main>
  );
}

export function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 flex items-center gap-2 text-3xl font-black">{children}</div></div>;
}

export function ToffeeCount({ n }: { n: number }) { return <><Toffee size={34} />{n}</>; }
export function ChilliCount({ n }: { n: number }) { return <><Chilli size={34} />{n}</>; }

/** One finished quiz, expandable to the questions (what was asked, what the student chose, the right answer). */
export function SessionCard({ r, showName }: { r: SessionRecord; showName?: boolean }) {
  return (
    <details className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-extrabold">{showName ? `${r.studentName} · ` : ''}{r.section || r.chapter || 'Lesson'}</span>
        <span className="text-xs text-slate-400">{when(r.at)}</span>
        <span className={`ml-auto font-extrabold ${tierColour(r.pct)}`}>{r.correct}/{r.total} · {r.pct}%</span>
        <span className="flex items-center gap-1 font-bold text-amber-300"><Toffee size={24} />{r.toffees}</span>
        <span className="flex items-center gap-1 font-bold text-rose-300"><Chilli size={24} />{chilliesOf(r)}</span>
      </summary>
      <ol className="mt-3 space-y-2 border-t border-white/10 pt-3 text-sm">
        {r.items.map((i, k) => (
          <li key={i.id + k} className="flex gap-3">
            <span className={i.correct ? 'text-emerald-300' : 'text-rose-300'}>{i.correct ? <Toffee size={22} title="toffee" /> : <Chilli size={22} title="chilli" />}</span>
            <span className="flex-1"><span className="text-slate-200">{i.stem}</span><span className="block text-xs text-slate-400">{i.concept} · chose {i.chosen ?? '—'}{i.correct ? '' : ` · right answer ${i.answer}`} · {i.seconds}s</span></span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * V51.9.117 — every toffee and chilli, newest first: who, when, in class or in a quiz, the question, what was chosen
 * and the right answer. The teacher sees all students (refreshing with the page), the parent their child.
 */
export function RewardFeed({ records, showName, title = 'Toffees and chillies' }: { records: SessionRecord[]; showName?: boolean; title?: string }) {
  const ev = rewardEvents(records, 40);
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-lg font-extrabold">{title}</h2>
      {ev.length === 0 ? <p className="text-sm text-slate-400">No toffee or chilli yet.</p> : (
        <ol className="space-y-1.5" data-reward-feed>
          {ev.map((e) => (
            <li key={e.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm ${e.kind === 'chilli' ? 'border-rose-400/25 bg-rose-500/[.06]' : 'border-amber-300/25 bg-amber-400/[.06]'}`}>
              <span className="mt-0.5 flex w-9 shrink-0 justify-center">{e.kind === 'chilli' ? <Chilli size={26} title="chilli" /> : <Toffee size={30} title="toffee" />}</span>
              <span className="min-w-0 flex-1">
                <span className="font-bold">{showName ? `${e.studentName} ` : ''}{e.kind === 'chilli' ? 'got a chilli' : e.kind === 'redeem' ? `turned ${e.count === 1 ? 'a chilli' : `${e.count} chillies`} into toffees` : `got ${e.count === 1 ? 'a toffee' : `${e.count} toffees`}`}</span>
                <span className="text-slate-400"> · {e.where === 'class' ? 'in class' : 'in a quiz'}{e.chapter ? ` · ${e.chapter}` : ''}</span>
                <span className="block truncate text-slate-300" title={e.question}>{e.question}</span>
                {e.kind === 'chilli' && (e.chosen || e.right) && <span className="block text-xs text-slate-400">{e.chosen ? <>Chose <b className="text-rose-300">{e.chosen}</b></> : null}{e.chosen && e.right ? ' · ' : ''}{e.right ? <>right answer <b className="text-emerald-300">{e.right}</b></> : null}</span>}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{when(e.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
