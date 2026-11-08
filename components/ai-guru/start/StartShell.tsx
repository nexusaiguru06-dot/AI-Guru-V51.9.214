/**
 * V51.9.198 — the "Get started" steps: one card per choice, a back arrow on every step.
 * Server component (plain links), so it works on any phone.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { TrailMark } from './Trail';

export interface Choice { href: string; icon: string; title: string; text: string; external?: boolean; id?: string }

export function StartShell({ back, backLabel, title, sub, children }: { back: string; backLabel: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="ag-home relative min-h-screen text-[color:var(--ag-text)]">
      <TrailMark />
      <main className="relative z-[1] mx-auto max-w-[760px] px-4 pb-16 pt-5 sm:px-6">
        <Link href={back} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[color:var(--ag-line)] bg-[color:var(--ag-tile)] px-4 text-sm font-semibold" data-back>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          {backLabel}
        </Link>
        <div className="mt-6 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aiguru-logo.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
          <div><h1 className="m-0 text-[clamp(26px,4vw,38px)] font-extrabold leading-tight">{title}</h1>{sub && <p className="m-0 mt-1 text-[color:var(--ag-muted)]">{sub}</p>}</div>
        </div>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

export function ChoiceList({ items, numbered = false }: { items: Choice[]; numbered?: boolean }) {
  return (
    <ol className="m-0 grid list-none gap-3 p-0">
      {items.map((c, i) => {
        const body = (
          <>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--ag-accent-soft)] text-2xl" aria-hidden="true">{c.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold" style={{ fontFamily: 'var(--ag-font-head)' }}>{numbered ? `${i + 1}. ` : ''}{c.title}</span>
              <span className="block text-sm leading-relaxed text-[color:var(--ag-muted)]">{c.text}</span>
            </span>
            <span aria-hidden="true" className="text-xl text-[color:var(--ag-accent-ink)]">{c.external ? '↗' : '→'}</span>
          </>
        );
        const cls = 'flex min-h-[76px] items-center gap-4 rounded-[20px] border border-[color:var(--ag-line)] bg-[color:var(--ag-panel)] p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--ag-shadow)]';
        return <li key={c.href + c.title}>{c.external
          ? <a href={c.href} target="_blank" rel="noreferrer" className={cls} data-choice={c.id}>{body}</a>
          : <Link href={c.href} className={cls} data-choice={c.id}>{body}</Link>}</li>;
      })}
    </ol>
  );
}
