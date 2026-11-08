'use client';

/**
 * V51.9.135 — ✦ Style library: Opus-inspired styles for any reel.
 *
 * The student picks a style; the reel keeps its own content (the sum, the class part, the story …) and takes the
 * style's look, camera, pace, music, sounds and fonts. Any choice the student makes by hand under "More choices"
 * still wins over the style. In a class part (or an explainer) the style can also write an explainer script from
 * the lesson with the student's AI, in that style.
 *
 * The library lives on the server (/api/ai-guru/reel-styles); the phone loads one page of cards at a time.
 */
import { useEffect, useRef, useState } from 'react';
import { ALL_LOOKS } from '@/lib/ai-guru/reels/motion/look';
import { TemplateSwatch } from './TemplateSwatch';
import { OPUS_CATEGORIES, OPUS_CATEGORY_NAME, type OpusCard, type OpusCategory, type OpusRecipe, type StudioMode } from '@/lib/ai-guru/reels/opus/library';

const PAGE = 12;
const lookName = (id: string) => ALL_LOOKS.find((l) => l.id === id)?.name ?? id;
const chip = (on: boolean) => `rounded-lg px-2.5 py-1 text-xs font-semibold transition ${on ? 'bg-violet-600 text-white' : 'bg-white/[0.06] text-white/70 hover:bg-white/10'}`;

interface Page { total: number; items: OpusCard[]; counts?: { kept: number; recommended: number; upstream: number } }

export function StyleLibraryPanel({ mode, active, onChoose, onWriteExplainer, writeBusy, writeNote, defaultOpen = true }: {
  /** V51.9.152: open at first (students did not notice the folded library). */
  defaultOpen?: boolean;
  mode: StudioMode;
  active: OpusCard | null;
  onChoose: (card: OpusCard | null) => void;
  /** Shown when the reel's content can be rewritten as an explainer in the chosen style. */
  onWriteExplainer?: (card: OpusCard) => void;
  writeBusy?: boolean;
  writeNote?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'recommended' | 'all'>('recommended');
  const [category, setCategory] = useState<OpusCategory | 'all'>('all');
  const [fitsMode, setFitsMode] = useState(false);
  const [page, setPage] = useState<Page>({ total: 0, items: [] });
  const [counts, setCounts] = useState<Page['counts']>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState<OpusRecipe | null>(null);
  const reqId = useRef(0);

  // the search waits for a short pause in typing
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = async (offset: number) => {
    const id = ++reqId.current;
    setLoading(true);
    setError('');
    try {
      const sp = new URLSearchParams({ view, category, offset: String(offset), limit: String(PAGE) });
      if (query) sp.set('q', query);
      if (fitsMode) sp.set('mode', mode);
      const r = await fetch(`/api/ai-guru/reel-styles?${sp}`);
      const j = await r.json();
      if (id !== reqId.current) return;
      if (!j.ok) throw new Error(j.error || 'The style library did not answer.');
      setCounts(j.counts);
      setPage((p) => ({ total: j.total, items: offset ? [...p.items, ...j.items] : j.items }));
    } catch (e) {
      if (id === reqId.current) setError((e as Error).message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };
  useEffect(() => {
    if (open) void Promise.resolve().then(() => load(0));
  }, [open, view, category, query, fitsMode, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const showDetails = async (c: OpusCard) => {
    if (details?.id === c.id) { setDetails(null); return; }
    try {
      const j = await (await fetch(`/api/ai-guru/reel-styles?id=${encodeURIComponent(c.id)}`)).json();
      if (j.ok) setDetails(j.recipe);
    } catch { /* details are optional */ }
  };

  return (
    <details className="group rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/[0.04]" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} data-style-library>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
        <span className="font-bold">✦ Style library</span>
        <span className="text-xs text-white/50">{active ? <>Using <b className="text-fuchsia-200">{active.name}</b></> : `Opus-inspired styles${counts ? ` · ${counts.recommended} for lessons, ${counts.kept} ideas` : ''}`}</span>
        <span className="ml-auto text-xs text-white/40 group-open:hidden">Show ▾</span><span className="ml-auto hidden text-xs text-white/40 group-open:inline">Hide ▴</span>
      </summary>
      <div className="space-y-3 border-t border-white/10 p-3">
        {active && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-xs" data-style-active>
            <span>✓ <b>{active.name}</b> — {lookName(active.choices.look)} · camera {active.choices.camera} · {active.choices.pace} · {active.choices.music} music</span>
            <span className="text-white/50">Your own picks under More choices still win.</span>
            {onWriteExplainer && (
              <button disabled={writeBusy} onClick={() => onWriteExplainer(active)} className="rounded-lg bg-fuchsia-600 px-2.5 py-1 font-bold disabled:opacity-50" title="Your AI writes an explainer script from this lesson, in this style (the facts stay the lesson's)">
                {writeBusy ? 'Writing…' : '✨ Make an explainer in this style'}
              </button>
            )}
            <button onClick={() => onChoose(null)} className="ml-auto rounded-lg bg-white/10 px-2.5 py-1">Remove style</button>
          </div>
        )}
        {writeNote && <p className="text-xs text-fuchsia-100/80">{writeNote}</p>}
        <p className="text-xs text-white/55">Pick a style: your reel keeps its own content and takes the style’s look, camera, pace, music and fonts. <b className="text-white/75">🎬 Pro templates</b> come first: bold titles, moving backgrounds and new transitions after the open-source <a className="underline" href="https://github.com/heygen-com/hyperframes" target="_blank" rel="noreferrer">HyperFrames</a> designs, made on your phone. The other ideas come from the open <a className="underline" href="https://github.com/yihui-dev/awesome-opus5-5-videos" target="_blank" rel="noreferrer">awesome-opus5-5-videos</a> collection; each card credits its creator.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search styles: space, history, chalk, proof…" aria-label="Search styles" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1426] px-3 py-2 text-xs outline-none focus:border-fuchsia-400" />
          <div className="flex gap-1.5">
            <button className={chip(view === 'recommended')} onClick={() => setView('recommended')}>For lessons{counts ? ` (${counts.recommended})` : ''}</button>
            <button className={chip(view === 'all')} onClick={() => setView('all')}>All ideas{counts ? ` (${counts.kept})` : ''}</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={chip(category === 'all')} onClick={() => setCategory('all')}>All</button>
          {OPUS_CATEGORIES.map((c) => <button key={c} className={chip(category === c)} onClick={() => setCategory(c)}>{OPUS_CATEGORY_NAME[c]}</button>)}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-white/60"><input type="checkbox" checked={fitsMode} onChange={(e) => setFitsMode(e.target.checked)} /> Best for this reel</label>
        </div>
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2" data-style-grid>
          {page.items.map((c) => {
            const on = active?.id === c.id;
            return (
              <div key={c.id} className={`overflow-hidden rounded-xl border ${on ? 'border-fuchsia-400 bg-fuchsia-500/10' : 'border-white/10 bg-white/[0.03]'}`} data-style-card={c.id}>
                {c.category === 'pro' && <TemplateSwatch lookId={c.choices.look} />}
                {c.credit.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.credit.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full bg-black/30 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                )}
                <div className="space-y-1.5 p-2.5">
                  <div className="text-sm font-bold leading-tight">{c.name}</div>
                  {c.hint && <div className="text-[11px] text-white/50">Original idea: {c.hint}</div>}
                  <div className="flex flex-wrap gap-1 text-[10px] text-white/60">
                    <span className="rounded bg-white/10 px-1.5 py-0.5">{OPUS_CATEGORY_NAME[c.category]}</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5">{lookName(c.choices.look)}</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5">{c.choices.camera} camera</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5">{c.choices.music}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => onChoose(on ? null : c)} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${on ? 'bg-fuchsia-500 text-white' : 'bg-violet-600 text-white hover:bg-violet-500'}`}>{on ? '✓ In use' : 'Use this style'}</button>
                    <button onClick={() => void showDetails(c)} className="text-xs text-cyan-300 underline">{details?.id === c.id ? 'Hide idea' : 'The idea'}</button>
                    <span className="ml-auto truncate text-[10px] text-white/45">by {c.credit.authorUrl ? <a href={c.credit.authorUrl} target="_blank" rel="noreferrer" className="underline">@{c.credit.author}</a> : `@${c.credit.author}`}</span>
                  </div>
                  {details?.id === c.id && (
                    <div className="space-y-1 rounded-lg bg-black/25 p-2 text-[11px] text-white/65">
                      <p>“{details.inspiration}{details.inspiration.length >= 280 ? '…' : ''}”</p>
                      <p className="text-white/45">Only the style is used. Your lesson stays the content.</p>
                      <div className="flex gap-3">
                        {details.credit.exampleUrl && <a href={details.credit.exampleUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline">Watch the original</a>}
                        {details.credit.postUrl && <a href={details.credit.postUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline">Creator’s post</a>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!loading && !error && page.items.length === 0 && <p className="text-xs text-white/50">No style matches. Try another word, or “All ideas”.</p>}
        <div className="flex items-center gap-2">
          {page.items.length < page.total && <button disabled={loading} onClick={() => void load(page.items.length)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-40">Show more ({page.total - page.items.length} left)</button>}
          {loading && <span className="text-xs text-white/50">Loading styles…</span>}
        </div>
      </div>
    </details>
  );
}
