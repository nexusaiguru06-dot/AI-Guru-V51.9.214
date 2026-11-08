import type { Metadata } from 'next';
import { LESSONS } from '@/lib/ai-guru/public/lessons';

export const metadata: Metadata = { title: 'Revise in 10 minutes', description: 'One-page revision packs for exam season: key points, worked examples and a 10-minute plan, in English and Malayalam. Free.', alternates: { canonical: '/ai-guru/learn/revise' } };

export default function ReviseIndex() {
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-10 text-slate-100 sm:px-8"><div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-center gap-3"><a href="/ai-guru/learn" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold">← Free lessons</a></header>
      <h1 className="text-3xl font-extrabold">Revise in 10 minutes</h1><p className="mb-6 text-slate-400">Pick a chapter.</p>
      <ul className="grid gap-4 sm:grid-cols-2">{LESSONS.map((l) => <li key={l.slug}><a href={`/ai-guru/learn/revise/${l.slug}`} className="block h-full rounded-2xl border border-white/10 bg-white/[.04] p-5 hover:border-cyan-400"><span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Class {l.cls} · {l.subject}</span><h2 className="mt-1 text-xl font-extrabold">{l.title.en}</h2><p className="text-sm text-slate-300">{l.title.ml}</p></a></li>)}</ul>
    </div></main>
  );
}
