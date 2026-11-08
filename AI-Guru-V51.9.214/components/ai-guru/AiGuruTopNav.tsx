'use client';

/**
 * V51.9.170: 15 tabs — Whiteboard Lab (an old maths test page, the classroom does this now) and Local TTS (inside Settings)
 * are no longer in the menu; both pages still open from their links.
 * V51.9.169 — the main menu, grouped: Learn · Create · Me & portals, plus My Textbooks, Messages, the Day / Night switch
 * and Sign in. On a phone it opens as a sheet with the same groups. Every tab still opens its own page (NAV_ITEMS).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PortalSignIn } from './PortalSignIn';
import { TeacherNotesBadge } from './share/TeacherNotesBadge';
import { SubscribersBadge } from './share/SubscribersBadge';
import { useEffect, useRef, useState } from 'react';
import { rememberRef } from '../../lib/ai-guru/share/ref-keep';
import { ThemeToggle } from './ThemeToggle';
import { goBack, useTrail } from './start/Trail';

type Item = { href: string; label: string; match?: string; about?: string };

// Every tab opens a real page (V51.9.115). The groups only decide where a tab sits in the menu.
export const NAV_ITEMS: Array<Item> = [
  { href: '/ai-guru/classroom', label: 'Classroom', match: '/ai-guru/classroom', about: 'Animated whiteboard class with voice' },
  { href: '/ai-guru/student/paper', label: 'Ask my paper', match: '/ai-guru/student/paper', about: 'Show your notebook, get help' },
  { href: '/ai-guru/visuals', label: 'Pictures', match: '/ai-guru/visuals', about: 'Diagrams, maps and simulations' },
  { href: '/ai-guru/reels', label: 'Reel Studio', match: '/ai-guru/reels', about: 'Turn a solved problem into a reel' },
  { href: '/ai-guru/subscribers', label: '👥 Subscribers', match: '/ai-guru/subscribers', about: 'Friends who joined with your link' },
  { href: '/ai-guru/teacher-notes', label: 'Teachers Notes', match: '/ai-guru/teacher-notes', about: 'Notes your teacher shared' },
  { href: '/ai-guru/student/library', label: 'My Textbooks', match: '/ai-guru/student/library', about: 'Your books and study materials' },
  { href: '/ai-guru/learn', label: 'Quizzes & Exams', match: '/ai-guru/learn', about: 'Practice and earn toffees' },
  { href: '/ai-guru/lab3d', label: '3D Lab', match: '/ai-guru/lab3d', about: 'Solids, atoms and planets in 3D' },
  { href: '/ai-guru/student', label: 'Progress', match: '/ai-guru/student', about: 'Your progress and toffees' },
  { href: '/ai-guru/messages', label: '💬 Messages', match: '/ai-guru/messages', about: 'Talk to your teacher and the office' },
  { href: '/ai-guru/teacher', label: 'Teacher Portal', match: '/ai-guru/teacher', about: 'Classes, attendance, questions' },
  { href: '/ai-guru/school-teacher', label: 'School Teacher', match: '/ai-guru/school-teacher', about: 'Teachers of partner schools: materials, exams' },
  { href: '/ai-guru/parent', label: 'Parent Portal', match: '/ai-guru/parent', about: 'Your child’s study progress' },
  { href: '/ai-guru/settings/gemini', label: 'Settings', match: '/ai-guru/settings', about: 'AI keys and teacher voices' },
];

const GROUPS: Array<{ id: string; label: string; items: string[] }> = [
  { id: 'learn', label: 'Learn', items: ['Classroom', 'Ask my paper', 'Quizzes & Exams', '3D Lab', 'Pictures'] },
  { id: 'create', label: 'Create', items: ['Reel Studio', 'Teachers Notes', '👥 Subscribers'] },
  { id: 'me', label: 'Portals', items: ['Progress', 'Teacher Portal', 'School Teacher', 'Parent Portal', 'Settings'] },
];
const byLabel = (l: string) => NAV_ITEMS.find((i) => i.label === l)!;
const clean = (l: string) => l.replace(/^[^\p{L}\p{N}]+/u, '');

/** The path is this tab's page or below it (a whole path segment: "/ai-guru/teacher" is not "/ai-guru/teacher-notes"),
 *  and not a page that has its own tab ("/ai-guru/student/library" belongs to My Textbooks, not Progress). */
export function matches(pathname: string, match: string): boolean {
  if (!(pathname === match || pathname.startsWith(`${match}/`))) return false;
  return !NAV_ITEMS.some((o) => o.match && o.match !== match && o.match.startsWith(`${match}/`) && (pathname === o.match || pathname.startsWith(`${o.match}/`)));
}

function isActive(item: Item, pathname: string, activeLabel?: string): boolean {
  return activeLabel === item.label ||
    (item.label === 'Classroom' && ['RAG Classroom', 'Motion Class', 'Live Class', 'Dashboard'].includes(activeLabel ?? '')) ||
    (item.match ? matches(pathname, item.match) : false);
}

const Chevron = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;

export function AiGuruTopNav({ activeLabel }: { activeLabel?: string }) {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  // V51.9.155: a friend's code in any AI Guru link (?ref=CODE) is kept on this device, so it fills the sign-up form later
  useEffect(() => { rememberRef(window.location.search); }, [pathname]);
  useEffect(() => { setOpen(null); setSheet(false); }, [pathname]);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setSheet(false); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, []);

  const badge = (label: string) => <>{label === 'Teachers Notes' && <TeacherNotesBadge />}{label === '👥 Subscribers' && <SubscribersBadge />}</>;
  const pill = 'flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition';
  const idle = 'text-[color:var(--ag-text)] hover:bg-[color:var(--ag-tile)]';
  const on = 'bg-[color:var(--ag-accent-soft)] text-[color:var(--ag-accent-ink)]';

  useTrail(); // V51.9.198: for the back arrow

  return (
    <header ref={barRef} className="ag-topnav sticky top-0 z-50 border-b border-[color:var(--ag-line)] bg-[color:var(--ag-bar)] text-[color:var(--ag-text)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-2 lg:px-6">
        {/* V51.9.198: a back arrow on every page — to the page before, or the main page */}
        {pathname !== '/' && <button type="button" onClick={goBack} aria-label="Back" title="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:var(--ag-line)] hover:bg-[color:var(--ag-tile)]" data-nav-back>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        </button>}
        <Link href="/" className="mr-2 flex shrink-0 items-center gap-2" aria-label="AI Guru home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aiguru-logo.png" alt="" width={38} height={38} className="h-[38px] w-[38px] shrink-0 object-contain drop-shadow-[0_0_10px_rgba(245,184,61,.35)]" />
          <span className="hidden text-[24px] leading-none sm:inline" style={{ fontFamily: 'Kalam, cursive', fontWeight: 700 }}>AI Guru</span>
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
          {GROUPS.map((g) => {
            const items = g.items.map(byLabel);
            const groupOn = items.some((i) => isActive(i, pathname, activeLabel));
            return (
              <div key={g.id} className="relative">
                <button type="button" onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id} aria-haspopup="true"
                  className={`${pill} ${groupOn ? on : idle} ${open === g.id && !groupOn ? 'bg-[color:var(--ag-tile)]' : ''}`}>
                  {g.label} <Chevron />
                </button>
                {open === g.id && (
                  <div className={`absolute left-0 top-[52px] z-[60] grid gap-1.5 rounded-2xl border border-[color:var(--ag-line)] bg-[color:var(--ag-panel)] p-3 shadow-[var(--ag-shadow)] ${items.length > 4 ? 'w-[540px] grid-cols-2' : 'w-[320px] grid-cols-1'}`}>
                    {items.map((i) => {
                      const act = isActive(i, pathname, activeLabel);
                      return (
                        <Link key={i.label} href={i.href} className={`flex items-start gap-3 rounded-xl p-3 transition hover:bg-[color:var(--ag-tile)] ${act ? 'bg-[color:var(--ag-accent-soft)]' : ''}`}>
                          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--ag-accent-soft)] text-[13px] font-bold text-[color:var(--ag-accent-ink)]" style={{ fontFamily: 'var(--ag-font-head)' }}>{clean(i.label).slice(0, i.label === '3D Lab' ? 2 : 1)}</span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="flex items-center gap-1 text-sm font-semibold text-[color:var(--ag-text)]">{clean(i.label)}{badge(i.label)}</span>
                            <span className="text-xs leading-snug text-[color:var(--ag-muted)]">{i.about}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {(['My Textbooks'] as const).map((l) => { const i = byLabel(l); return <Link key={l} href={i.href} className={`${pill} ${isActive(i, pathname, activeLabel) ? on : idle}`}>{l}</Link>; })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Link href="/ai-guru/messages" aria-label="Messages" title="Messages" className={`hidden h-11 w-11 items-center justify-center rounded-xl sm:flex ${isActive(byLabel('💬 Messages'), pathname, activeLabel) ? on : idle}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
          </Link>
          <ThemeToggle />
          <PortalSignIn />
          <button type="button" onClick={() => setSheet((v) => !v)} aria-expanded={sheet} aria-label={sheet ? 'Close menu' : 'Open menu'}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--ag-accent)] text-[#1A1203] lg:hidden">
            {sheet
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>}
          </button>
        </div>
      </div>

      {sheet && (
        <div className="max-h-[calc(100vh-64px)] overflow-y-auto border-t border-[color:var(--ag-line)] bg-[color:var(--ag-panel)] px-4 pb-5 pt-3 lg:hidden">
          {[...GROUPS, { id: 'more', label: 'More', items: ['My Textbooks', '💬 Messages'] }].map((g) => (
            <div key={g.id} className="mt-3">
              <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-[color:var(--ag-muted)]">{g.label}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {g.items.map(byLabel).map((i) => (
                  <Link key={i.label} href={i.href} className={`flex min-h-[48px] items-center gap-1 rounded-xl border border-[color:var(--ag-line)] px-3 text-sm font-semibold ${isActive(i, pathname, activeLabel) ? on : 'bg-[color:var(--ag-tile)] text-[color:var(--ag-text)]'}`}>
                    {clean(i.label)}{badge(i.label)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

export default AiGuruTopNav;
