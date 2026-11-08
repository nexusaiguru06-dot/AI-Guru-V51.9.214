'use client';

/**
 * V51.9.139 — what the class has already taught, above the live board: scroll up to see it.
 * V51.9.142 — like a chat: the earlier pages are the earlier "messages", one under another at full width, hidden
 * above the live board until the student scrolls up. No reel cards and no thumbnails: just each page as it was on the
 * board, with a thin line naming the part, and small Send / Download links on that line.
 */
import { useEffect, useRef, useState } from 'react';
import { drawReelFrame } from '@/lib/ai-guru/reels/motion';
import { lookById } from '@/lib/ai-guru/reels/motion/look';
import type { HistoryEntry } from '@/lib/ai-guru/motion-class/class-history';
import type { BoardLook } from '@/lib/ai-guru/motion-class/interactive-player';

export interface HistoryBusy { making?: number; saved?: string; sent?: boolean; error?: string }

const THUMBS = new Map<string, string>();
/** A page of a part as a picture (cached). Full = 1280 × 720, otherwise 640 × 360. */
function pageImage(e: HistoryEntry, t: number, look: BoardLook, full = false): string {
  const key = `${e.key}|${t}|${look}|${full ? 'f' : 's'}`;
  const hit = THUMBS.get(key);
  if (hit) return hit;
  const big = document.createElement('canvas');
  big.width = 1280;
  big.height = 720;
  const ctx = big.getContext('2d');
  if (!ctx) return '';
  try {
    drawReelFrame(ctx, e.tl.reel, t, { format: 'landscape', look: look === 'cinematic' ? lookById('cinematic') : null });
  } catch {
    return '';
  }
  let url: string;
  if (full) url = big.toDataURL('image/jpeg', 0.9);
  else {
    const small = document.createElement('canvas');
    small.width = 640;
    small.height = 360;
    small.getContext('2d')?.drawImage(big, 0, 0, 640, 360);
    url = small.toDataURL('image/jpeg', 0.82);
  }
  THUMBS.set(key, url);
  return url;
}

function PageView({ entry, t, look, n, onOpen }: { entry: HistoryEntry; t: number; look: BoardLook; n: number; onOpen: (url: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const make = () => { setTimeout(() => { if (live) setUrl(pageImage(entry, t, look, true)); }, 0); };
    if (typeof IntersectionObserver === 'undefined') { make(); return () => { live = false; }; }
    const io = new IntersectionObserver((xs) => { if (xs.some((x) => x.isIntersecting)) { io.disconnect(); make(); } }, { rootMargin: '600px' });
    io.observe(el);
    return () => { live = false; io.disconnect(); };
  }, [entry, t, look]);
  return (
    <button ref={ref} type="button" onClick={() => url && onOpen(url)} className="relative block w-full overflow-hidden rounded-xl border border-white/10 bg-black/40" style={{ aspectRatio: '16 / 9' }} title="See this page bigger" data-history-page>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={`Page ${n}`} className="h-full w-full object-contain" /> : <span className="absolute inset-0 flex items-center justify-center text-xs text-white/30">Page {n}</span>}
    </button>
  );
}

export function ClassHistoryFeed({ entries, liveKey, liveTime, section, look, busy, onWatch, onSend, onDownload, onDelete, onDeleteAll }: {
  entries: HistoryEntry[];
  /** The part playing now (its card shows only the pages already passed). */
  liveKey: string | null;
  liveTime: number;
  /** The section on screen now (its parts can be watched again). */
  section: string;
  look: BoardLook;
  busy: Record<string, HistoryBusy>;
  onWatch: (e: HistoryEntry) => void;
  onSend: (e: HistoryEntry) => void;
  onDownload: (e: HistoryEntry) => void;
  /** V51.9.146: delete one part / every earlier part (the part playing now stays). */
  onDelete: (e: HistoryEntry) => void;
  onDeleteAll: () => void;
}) {
  const [big, setBig] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null); // key of the part (or '*') waiting for "Delete? Yes / No"
  const confirm = (yes: () => void) => (
    <span className="flex items-center gap-1.5 text-rose-200" data-history-confirm>
      Delete?
      <button type="button" onClick={() => { setAsking(null); yes(); }} className="rounded bg-rose-600 px-1.5 py-0.5 font-semibold text-white hover:bg-rose-500" data-history-delete-yes>Yes</button>
      <button type="button" onClick={() => setAsking(null)} className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20">No</button>
    </span>
  );
  const cards = entries
    .map((e) => ({ e, pages: e.key === liveKey ? e.pages.filter((t) => t < liveTime - 300) : e.pages, live: e.key === liveKey }))
    .filter((c) => c.pages.length);
  if (!cards.length) return null;
  return (
    <div className="flex w-full max-w-4xl flex-col gap-4 pb-2" data-class-history>
      {cards.length > 0 && (
        <div className="flex justify-start pt-1 text-[11px] text-white/45">
          {asking === '*' ? confirm(onDeleteAll) : <button type="button" onClick={() => setAsking('*')} className="hover:text-rose-200" title="Delete every earlier page from this screen (the board keeps teaching)" data-history-delete-all>🗑 Delete all earlier classes</button>}
        </div>
      )}
      {cards.map(({ e, pages, live }, ci) => {
        const b = busy[e.key] ?? {};
        const head = ci === 0 || cards[ci - 1].e.section !== e.section; // the section's name above its first part
        return (
          <div key={e.key} className="space-y-2" data-history-card={e.key}>
            {head && <div className="pt-2 text-center text-[11px] font-semibold uppercase tracking-wider text-white/35">{e.chapter}{e.heading ? ` · ${e.heading}` : ''}</div>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 pb-1 text-[11px] text-white/55">
              <span className="font-semibold text-white/70">{e.kind === 'lecture' ? 'Lecture' : 'Problem'} {e.nth}</span>
              <span className="ml-auto flex flex-wrap items-center gap-3">
                {!live && e.section === section && <button type="button" onClick={() => onWatch(e)} className="hover:text-white">▶ Watch again</button>}
                {e.clip && <button type="button" onClick={() => onSend(e)} className="hover:text-white" data-history-send>{b.sent ? '✓ Sent to Reel Studio' : 'Send to Reel Studio'}</button>}
                <button type="button" onClick={() => onDownload(e)} disabled={b.making !== undefined} className="hover:text-white disabled:opacity-70" data-history-download>
                  {b.making !== undefined ? `Making video… ${Math.round(b.making * 100)}%` : b.saved ? '✓ Downloaded' : 'Download'}
                </button>
                {b.making === undefined && (asking === e.key ? confirm(() => onDelete(e)) : <button type="button" onClick={() => setAsking(e.key)} className="hover:text-rose-200" title="Delete this part from the screen" data-history-delete>🗑 Delete</button>)}
              </span>
            </div>
            {b.error && <p className="text-[11px] text-amber-200">{b.error}</p>}
            {pages.map((t, i) => <PageView key={t} entry={e} t={t} look={look} n={i + 1} onOpen={setBig} />)}
          </div>
        );
      })}
      {big && (
        <div className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/80 p-4" onClick={() => setBig(null)} role="dialog" aria-label="Page">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={big} alt="Page" className="max-h-full max-w-full rounded-xl shadow-2xl" />
          <button type="button" className="absolute right-4 top-4 rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white">✕ Close</button>
        </div>
      )}
    </div>
  );
}
