import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LessonCta } from '@/components/ai-guru/public/LessonCta';
import { SampleQuiz } from '@/components/ai-guru/public/SampleQuiz';
import { LESSONS, lessonBySlug } from '@/lib/ai-guru/public/lessons';
import { SITE_NAME, SITE_URL } from '@/lib/ai-guru/site';

export const dynamicParams = false;
export function generateStaticParams() { return LESSONS.map((l) => ({ slug: l.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const l = lessonBySlug((await params).slug);
  if (!l) return {};
  const title = `${l.title.en} (Class ${l.cls} ${l.subject}) | ${l.title.ml}`;
  return {
    title, description: `${l.summary.en} ${l.summary.ml}`,
    alternates: { canonical: `/ai-guru/learn/${l.slug}` },
    openGraph: { type: 'article', title: l.title.en, description: l.summary.en },
    twitter: { card: 'summary_large_image', title: l.title.en, description: l.summary.en },
  };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const l = lessonBySlug((await params).slug);
  if (!l) notFound();
  const ld = {
    '@context': 'https://schema.org', '@type': 'LearningResource', name: l.title.en, alternateName: l.title.ml, description: l.summary.en,
    educationalLevel: `Class ${l.cls}`, about: l.subject, inLanguage: ['en', 'ml'], isAccessibleForFree: true, url: `${SITE_URL}/ai-guru/learn/${l.slug}`, provider: { '@type': 'Organization', name: SITE_NAME },
  };
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-10 text-slate-100 sm:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <article className="mx-auto max-w-3xl space-y-8">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-400"><a href="/ai-guru/learn" className="underline">All lessons</a> / Class {l.cls} {l.subject}</nav>
        <header>
          <h1 className="text-3xl font-extrabold">{l.title.en}</h1>
          <p className="mt-1 text-xl text-cyan-200">{l.title.ml}</p>
          <p className="mt-3 text-slate-300">{l.summary.en}</p>
          <p className="text-slate-300">{l.summary.ml}</p>
        </header>
        <ol className="space-y-4">
          {l.steps.map((s, i) => (
            <li key={i} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
              <h2 className="flex items-center gap-3 text-lg font-extrabold"><span className="grid h-8 w-8 place-items-center rounded-full bg-cyan-400 text-sm text-[#04121f]">{i + 1}</span>{s.h.en} <span className="text-base font-normal text-slate-400">· {s.h.ml}</span></h2>
              <p className="mt-2">{s.p.en}</p>
              <p className="mt-1 text-slate-300">{s.p.ml}</p>
            </li>))}
        </ol>
        <section className="space-y-3"><h2 className="text-2xl font-extrabold">Try it</h2><SampleQuiz quiz={l.quiz} /></section>
        <section className="space-y-3 rounded-3xl border border-cyan-400/25 bg-cyan-400/[.05] p-5"><h2 className="text-xl font-extrabold">Want the full classroom?</h2><p className="text-slate-300">Animated step-by-step lessons from your own textbook, quizzes, and reports for parents and teachers. Free to start.</p><LessonCta slug={l.slug} title={l.title.en} /></section>
      </article>
    </main>
  );
}
