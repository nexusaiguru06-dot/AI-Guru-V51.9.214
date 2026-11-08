import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LESSONS } from '@/lib/ai-guru/public/lessons';
import { revisePack } from '@/lib/ai-guru/public/revise';
import { PrintButton } from '@/components/ai-guru/public/PrintButton';

type P = { params: Promise<{ slug: string }> };
export const generateStaticParams = () => LESSONS.map((l) => ({ slug: l.slug }));
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params; const l = LESSONS.find((x) => x.slug === slug); if (!l) return {};
  return { title: `Revise in 10 minutes: ${l.title.en}`, description: `One-page revision for Class ${l.cls}: ${l.summary.en}`, alternates: { canonical: `/ai-guru/learn/revise/${l.slug}` } };
}

export default async function RevisePage({ params }: P) {
  const { slug } = await params; const l = LESSONS.find((x) => x.slug === slug); if (!l) notFound();
  const r = revisePack(l);
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-10 text-slate-100 sm:px-8 print:bg-white print:text-black"><div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center gap-3 print:hidden"><a href="/ai-guru/learn/revise" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold">← All chapters</a><PrintButton /></header>
      <div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Revise in 10 minutes · Class {l.cls} {l.subject}</p><h1 className="text-3xl font-extrabold">{r.title.en}</h1><p className="text-slate-300">{r.title.ml}</p></div>
      <section><h2 className="text-xl font-extrabold">Your 10 minutes</h2><ol className="mt-2 list-decimal space-y-1 pl-6">{r.minutes.map((m) => <li key={m.what}><b>{m.min} min</b> — {m.what}</li>)}</ol></section>
      <section><h2 className="text-xl font-extrabold">Key points</h2><ul className="mt-2 space-y-3">{r.points.map((s, i) => <li key={i} className="rounded-xl border border-white/10 bg-white/[.04] p-4 print:border-slate-300 print:bg-white"><b>{s.h.en}</b> · {s.h.ml}<p>{s.p.en}</p><p className="text-slate-300">{s.p.ml}</p></li>)}</ul></section>
      <section><h2 className="text-xl font-extrabold">Worked examples · try first, then tap</h2><ol className="mt-2 space-y-3">{r.examples.map((e, i) => <li key={i} className="rounded-xl border border-white/10 bg-white/[.04] p-4 print:border-slate-300 print:bg-white"><p className="font-bold">{e.q}</p><details className="mt-1"><summary className="cursor-pointer text-cyan-300 print:text-black">Answer</summary><p><b>{e.a}</b> — {e.why}</p></details></li>)}</ol></section>
      <p className="print:hidden"><a href={`/ai-guru/learn/${l.slug}`} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f]">Take the quiz on this chapter</a></p>
    </div></main>
  );
}
