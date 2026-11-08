'use client';

/**
 * V51.9.169 — AI Guru's front page: a rotating dotted globe on a see-through background and the headline.
 * V51.9.198 — for students everywhere: one button only, "Get started" (it asks Student / Teacher / Parent next). The menu
 * bar, the other buttons and the feature tiles are gone from this page; the languages on the globe are world languages.
 * V51.9.200 — the page tells what AI Guru does (how it works, what you get, for parents and teachers), with
 * "Get started" after each part. Every button on the page is "Get started"; the cards are not links.
 * V51.9.201 — the Day / Night switch is back in the top right corner.
 * The globe's continents come from the app's own coastline data (Natural Earth, public domain).
 */
import Link from 'next/link';
import { useEffect } from 'react';
import { rememberRef } from '@/lib/ai-guru/share/ref-keep';
import { TrailMark } from '../start/Trail';
import { ThemeToggle } from '../ThemeToggle';

const CHIPS: Array<{ text: string; cls: string; delay: string }> = [
  { text: 'English', cls: 'left-[4%] top-[12%]', delay: '0s' },
  { text: 'हिन्दी', cls: 'right-[2%] top-[26%]', delay: '-2s' },
  { text: 'Español', cls: 'bottom-[20%] left-[1%]', delay: '-4s' },
  { text: 'العربية', cls: 'bottom-[10%] right-[9%]', delay: '-1s' },
];

const STEPS: Array<{ n: string; title: string; text: string }> = [
  { n: '1', title: 'Get your study materials', text: 'Any syllabus, any class. AI Guru’s teachers prepare your textbook as whiteboard notes, MCQs and quick revision. Part 1 is free; the rest opens month by month.' },
  { n: '2', title: 'Ten parts, one for each month', text: 'Each book is split into ten parts that follow the school year, so you study a little every month.' },
  { n: '3', title: 'Your class begins', text: 'Your AI teacher explains every paragraph out loud, step by step, on a living whiteboard — as often as you need. Add your free API key for unlimited doubt clearing.' },
];

const FEATURES: Array<{ icon: string; title: string; text: string }> = [
  { icon: '🎬', title: 'A whiteboard that comes alive', text: 'Equations write themselves, diagrams draw step by step and every step is spoken — maths you can watch, not just read.' },
  { icon: '📸', title: 'Ask any doubt, any way', text: 'Point your camera at the page, speak, or type. Stuck on line 3 of your homework? Show it — AI Guru sees it and explains.' },
  { icon: '🍬', title: 'Quizzes that feel like a game', text: 'Right answers earn toffees, wrong ones a chilli you can win back. Streaks, badges and certificates keep you coming back.' },
  { icon: '🗣️', title: 'In the language you think in', text: 'Ask in your own language and hear the answer in it. Lessons in English, and in Malayalam for Kerala students.' },
  { icon: '🧪', title: 'See science in 3D', text: 'Turn atoms, molecules, solids and the solar system with your finger, and watch how they really work.' },
  { icon: '🎞️', title: 'Teach your friends', text: 'Turn a solved problem into a short reel with your name on it and share it — explaining is the best way to learn.' },
];

const CTA_CLS = 'ag-cta inline-flex min-h-[60px] items-center gap-3 rounded-2xl bg-[#F5B83D] px-8 text-lg font-bold text-[#1A1203] transition hover:brightness-105';

/** The one button on this page (it appears after each part). */
function GetStarted({ id, label = 'Get started' }: { id?: string; label?: string }) {
  return (
    <Link href="/ai-guru/start" data-get-started={id ?? ''} className={CTA_CLS} style={{ fontFamily: 'var(--ag-font-head)' }}>
      {label}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </Link>
  );
}

const card = 'rounded-[22px] border border-[color:var(--ag-line)] bg-[color:var(--ag-panel)] p-6';
const kicker = 'text-xs font-semibold uppercase tracking-[.16em] text-[color:var(--ag-accent-ink)]';
const h2 = 'm-0 mt-2 text-[clamp(28px,3.6vw,42px)] font-extrabold leading-tight tracking-[-1px]';

export function HomePage() {
  // a friend's link (?ref=CODE) is kept on this device, as the menu bar used to do on every page
  useEffect(() => { rememberRef(window.location.search); }, []);
  return (
    <div className="ag-home relative min-h-screen overflow-hidden text-[color:var(--ag-text)]">
      <TrailMark />
      <header className="relative z-[2] mx-auto flex max-w-[1240px] items-center gap-2 px-5 py-4 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/aiguru-logo.png" alt="" width={40} height={40} className="h-10 w-10 object-contain drop-shadow-[0_0_10px_rgba(245,184,61,.35)]" />
        <span className="text-[26px] leading-none" style={{ fontFamily: 'Kalam, cursive', fontWeight: 700 }}>AI Guru</span>
        {/* V51.9.201: Day / Night switch back on the front page */}
        <span className="ml-auto"><ThemeToggle /></span>
      </header>
      <main className="relative z-[1] mx-auto max-w-[1240px] px-5 pb-16 pt-4 sm:px-6 lg:pt-10">
        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div className="flex max-w-[600px] flex-col gap-6">
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-[color:var(--ag-line)] bg-[color:var(--ag-tile)] px-3.5 py-2 text-[13px] font-semibold text-[color:var(--ag-muted)]">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#F5B83D]" />
              Maths &amp; science · Class 1 to 12 · Any syllabus
            </span>
            <h1 className="m-0 text-[clamp(38px,5.2vw,64px)] font-extrabold leading-[1.05] tracking-[-1.5px]">
              Every chapter, taught by your own <span className="text-[color:var(--ag-accent-ink)]">AI teacher.</span>
            </h1>
            <p className="m-0 text-lg leading-relaxed text-[color:var(--ag-muted)]">
              Bring your textbook. AI Guru reads it, plans each paragraph and teaches it on an animated whiteboard, with a voice,
              doubt-clearing and quizzes — at your own pace.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <GetStarted id="hero" />
              <span className="text-sm text-[color:var(--ag-muted)]">Free to start · works on any phone</span>
            </div>
          </div>

          <div aria-hidden="true" className="relative mx-auto flex aspect-square w-full max-w-[580px] items-center justify-center">
            <div className="ag-globe-halo absolute inset-[-4%] rounded-full" />
            <div className="ag-orbit absolute inset-[3%] rounded-full border border-dashed" />
            <div className="ag-ring absolute left-[-6%] right-[-6%] top-[30%] h-[42%] rounded-[50%] border" />
            <div className="ag-globe relative aspect-square w-[90%] overflow-hidden rounded-full">
              <div className="ag-globe-map absolute inset-0" />
              <div className="ag-globe-shade absolute inset-0 rounded-full" />
            </div>
            {CHIPS.map((c) => (
              <span key={c.text} className={`ag-chip pointer-events-none absolute rounded-2xl border border-[color:var(--ag-line)] bg-[color:var(--ag-panel)] px-4 py-2.5 text-[15px] font-bold shadow-[var(--ag-shadow)] ${c.cls}`} style={{ fontFamily: "'Noto Sans', sans-serif", animationDelay: c.delay }}>{c.text}</span>
            ))}
          </div>
        </section>

        {/* how it works */}
        <section className="mt-20" aria-labelledby="how">
          <p className={kicker}>How it works</p>
          <h2 id="how" className={h2}>From your textbook to your own class in three steps.</h2>
          <ol className="m-0 mt-8 grid list-none gap-4 p-0 md:grid-cols-3">
            {STEPS.map((x) => (
              <li key={x.n} className={card}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F5B83D] text-lg font-extrabold text-[#1A1203]" aria-hidden="true">{x.n}</span>
                <h3 className="mb-1 mt-4 text-xl font-bold">{x.title}</h3>
                <p className="m-0 leading-relaxed text-[color:var(--ag-muted)]">{x.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8"><GetStarted id="how" /></div>
        </section>

        {/* what you get */}
        <section className="mt-20" aria-labelledby="features">
          <p className={kicker}>What you get</p>
          <h2 id="features" className={h2}>A teacher who never gets tired of your questions.</h2>
          <ul className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className={card}>
                <span className="text-3xl" aria-hidden="true">{f.icon}</span>
                <h3 className="mb-1 mt-3 text-lg font-bold">{f.title}</h3>
                <p className="m-0 text-sm leading-relaxed text-[color:var(--ag-muted)]">{f.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8"><GetStarted id="features" label="Start learning" /></div>
        </section>

        {/* parents and teachers */}
        <section className="mt-20 grid gap-4 md:grid-cols-2" aria-label="For parents and teachers">
          <div className={card}>
            <p className={kicker}>For parents</p>
            <h3 className="mb-2 mt-2 text-2xl font-extrabold">See your child grow, every week.</h3>
            <p className="m-0 leading-relaxed text-[color:var(--ag-muted)]">Classes taken, quiz scores and the topics that need a little more practice — in a short weekly report you can read in a minute.</p>
          </div>
          <div className={card}>
            <p className={kicker}>For teachers and schools</p>
            <h3 className="mb-2 mt-2 text-2xl font-extrabold">Your class, with an AI assistant.</h3>
            <p className="m-0 leading-relaxed text-[color:var(--ag-muted)]">Edit the study materials for your students, set exams with scores in seconds, and see who needs help before the test.</p>
          </div>
        </section>

        {/* the last word */}
        <section className="mt-20 rounded-[28px] border border-[color:var(--ag-line)] bg-[color:var(--ag-tile)] px-6 py-12 text-center" aria-labelledby="last">
          <h2 id="last" className={`${h2} mx-auto max-w-[760px]`}>Every student deserves a patient teacher. Now every student can have one.</h2>
          <p className="mx-auto mb-8 mt-3 max-w-[620px] text-lg text-[color:var(--ag-muted)]">Start with the first part of every book free. All you need is your textbook and a phone.</p>
          <GetStarted id="end" />
        </section>
      </main>
    </div>
  );
}

export default HomePage;
