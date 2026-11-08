import type { Metadata } from 'next';
import { LESSONS } from '@/lib/ai-guru/public/lessons';
import { publicStats, type PublicStats } from '@/lib/ai-guru/public/stats';
import { activeContests } from '@/lib/ai-guru/public/contests';
import { istToday } from '@/lib/ai-guru/public/daily';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Free sample lessons in Malayalam and English',
  description: 'Try AI Guru free: short Maths and Science lessons for Classes 4 to 7 in Malayalam and English, with a quiz that earns toffees. No sign-up needed.',
  alternates: { canonical: '/ai-guru/learn' },
};

const empty: PublicStats = { students: 0, quizzes: 0, toffees: 0, schools: 0, classes: 0, testimonials: [] };
const fmt = (n: number) => n.toLocaleString('en-IN');

export default async function LearnIndex() {
  const st = await publicStats().catch(() => empty);
  const contest = activeContests(istToday())[0];
  const tiles = ([['Students learning', st.students], ['Quizzes taken', st.quizzes], ['Toffees earned', st.toffees], ['Schools', st.schools]] as const).filter(([, v]) => v > 0);
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aiguru-logo.png" alt="AI Guru" width={48} height={48} className="h-12 w-12 object-contain" />
          <div><h1 className="text-3xl font-extrabold">Free sample lessons</h1><p className="text-slate-400">No sign-up needed</p></div>
          <a href="/ai-guru" className="ml-auto rounded-lg border border-white/15 px-3 py-2 text-xs font-bold">Open the classroom</a>
        </header>
        <nav aria-label="More ways to learn" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a href="/ai-guru/learn/daily" className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 hover:border-amber-300"><b>🔥 Daily 5-minute challenge</b><span className="block text-sm text-slate-300">Five questions a day. Keep your streak.</span></a>
          <a href="/ai-guru/learn/revise" className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 hover:border-cyan-300"><b>📝 Revise in 10 minutes</b><span className="block text-sm text-slate-300">One-page exam revision for each chapter.</span></a>
          <a href="/ai-guru/lab3d" className="rounded-2xl border border-violet-400/30 bg-violet-400/10 p-4 hover:border-violet-300"><b>🧊 3D Lab</b><span className="block text-sm text-slate-300">Turn solids, build atoms, watch planets.</span></a>
          <a href="/ai-guru/learn/contest" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 hover:border-emerald-300"><b>{contest ? `${contest.emoji} ${contest.title.en} is on!` : '🎉 Festival quizzes'}</b><span className="block text-sm text-slate-300">{contest ? 'Bonus toffees right now.' : 'Onam, Children’s Day, Christmas, Republic Day.'}</span></a>
        </nav>
        {tiles.length > 0 && <ul aria-label="AI Guru in numbers" className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">{tiles.map(([k, v]) => <li key={k} className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-center"><b className="block text-3xl font-extrabold text-cyan-300">{fmt(v)}</b><span className="text-xs text-slate-400">{k}</span></li>)}</ul>}
        <ul className="grid gap-4 sm:grid-cols-2">
          {LESSONS.map((l) => (
            <li key={l.slug}>
              <a href={`/ai-guru/learn/${l.slug}`} className="block h-full rounded-2xl border border-white/10 bg-white/[.04] p-5 transition hover:border-cyan-400">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Class {l.cls} · {l.subject}</span>
                <h2 className="mt-1 text-xl font-extrabold">{l.title.en}</h2>
                <p className="text-sm text-slate-300">{l.title.ml}</p>
                <p className="mt-2 text-sm text-slate-400">{l.summary.en}</p>
              </a>
            </li>))}
        </ul>
        {st.testimonials.length > 0 && <section className="mt-10"><h2 className="mb-3 text-xl font-extrabold">What teachers say</h2><div className="grid gap-4 sm:grid-cols-2">{st.testimonials.map((t) => <blockquote key={t.by} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><p>“{t.text}”</p><footer className="mt-2 text-sm text-slate-400">— {t.by}</footer></blockquote>)}</div></section>}
        <p className="mt-10 text-sm text-slate-400"><a className="underline" href="/ai-guru/safety">How your child’s data is kept safe</a></p>
      </div>
    </main>
  );
}
