'use client';

/**
 * V51.9.207 — Raw reels.
 *   RawTray       — (Reel Studio front page) the student's raw reels: upload videos from the device (several at once,
 *                   or drag and drop) and the videos and parts sent from the whiteboard. Tick one or more, then press
 *                   one of the five ways above: the ticked reels move to that way's page (?raw=…).
 *   RawReelPanel  — (each way's page) the raw reels that were moved here: watch, download, and use them in this way.
 * Everything is kept in this browser (lib/ai-guru/reels/my-reels).
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ClassClip } from '@/lib/ai-guru/reels/class-clip';
import { deletePart, deleteVideo, getVideo, listParts, listVideos, type StoredPart, type VideoInfo } from '@/lib/ai-guru/reels/my-reels';
import { RAW_MAX_MB, addRawFiles, fitsWay, parseRaw, rawKindOf, type WayId } from '@/lib/ai-guru/reels/raw-reels';
import { DeleteButton, useList } from './MyReelsShelves';

type Item = { id: string; kind: 'video' | 'part'; title: string; source: string; thumb?: string; clip?: ClassClip; seconds?: number };

const SOURCE: Record<string, string> = { raw: 'From this device', whiteboard: 'From the whiteboard' };

function toItems(videos: VideoInfo[], parts: StoredPart[]): Item[] {
  const v: Item[] = videos.filter((x) => x.way === 'raw' || x.way === 'whiteboard').map((x) => ({ id: x.id, kind: 'video', title: x.title, source: SOURCE[x.way], thumb: x.thumb, seconds: x.seconds }));
  const p: Item[] = parts.map((x) => ({ id: x.id, kind: 'part', title: `${x.kind === 'problem' ? 'Problem' : 'Lecture'} ${x.nth} · ${x.title}`, source: 'From the whiteboard', clip: x.clip }));
  return [...v, ...p];
}

/** Starts a drag that Chrome can drop onto a desktop folder or another window as a file (best effort). */
function dragFile(e: React.DragEvent, blob: Blob, name: string) {
  try {
    const url = URL.createObjectURL(blob);
    e.dataTransfer.setData('DownloadURL', `${blob.type || 'video/mp4'}:${name}:${url}`);
    e.dataTransfer.effectAllowed = 'copy';
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch { /* the Download button always works */ }
}

export async function saveToDevice(id: string) {
  const full = await getVideo(id);
  if (!full) return;
  const u = URL.createObjectURL(full.blob);
  const a = document.createElement('a');
  a.href = u; a.download = full.name || 'reel.mp4';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}

/** A video from the library, playing from its own blob. */
function BlobVideo({ id, className = '' }: { id: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true; let made: string | null = null;
    void getVideo(id).then((v) => { if (live && v?.blob) { made = URL.createObjectURL(v.blob); setUrl(made); } });
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [id]);
  return url ? <video src={url} controls playsInline className={className} /> : <div className={`flex items-center justify-center text-xs text-white/40 ${className}`}>Loading…</div>;
}

/* ------------------------------------------------------------------ the tray (front page) */

export function RawTray({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const videos = useList<VideoInfo>(() => listVideos(['raw', 'whiteboard']), 'raw-videos');
  const parts = useList<StoredPart>(listParts, 'raw-parts');
  const items = toItems(videos.items, parts.items);
  const ready = videos.ready && parts.ready;
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [look, setLook] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // a reel that was deleted is no longer ticked
  useEffect(() => {
    if (!ready) return;
    const have = new Set(items.map((i) => i.id));
    const keep = selected.filter((id) => have.has(id));
    if (keep.length !== selected.length) onChange(keep);
  }, [ready, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const take = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setBusy(true); setNotes([]);
    const r = await addRawFiles(files);
    setBusy(false); setNotes(r.notes);
    if (r.ids.length) onChange([...new Set([...selected, ...r.ids])].slice(0, 8)); // the new ones are ticked
  }, [onChange, selected]);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(0, 8));

  return (
    <section className="space-y-3 rounded-2xl border border-sky-300/30 bg-sky-500/[0.05] p-4" data-raw-tray>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-extrabold">📼 Raw reels</h2>
        <span className="text-xs text-white/55">{ready ? `${items.length} here · ${selected.length} ticked` : '…'}</span>
        {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="ml-auto text-xs text-sky-200 underline" data-raw-clear>Untick all</button>}
      </div>
      <p className="text-sm text-white/70">Put your videos here, <b>tick one or more</b>, then press <b>Choose</b> on any of the five ways above. The ticked reels move to that page, where you can watch them, work on them and download the result.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void take(Array.from(e.dataTransfer.files)); }}
        className={`flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-sm ${over ? 'border-sky-300 bg-sky-400/15' : 'border-sky-300/40 bg-black/20'}`} data-raw-drop>
        <input ref={fileRef} type="file" accept="video/*,.mp4,.mov,.m4v,.webm" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void take(f); }} data-raw-file />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="rounded-lg bg-sky-600 px-3 py-2 font-bold hover:bg-sky-500 disabled:opacity-50" data-raw-upload>{busy ? 'Keeping…' : '⬆ Upload from this device'}</button>
        <span className="text-xs text-white/60">or drag videos here. You can add several. Up to {RAW_MAX_MB} MB each; they stay on this device.</span>
      </div>
      {notes.map((n) => <p key={n} className="text-xs text-amber-200" role="alert">{n}</p>)}
      {(videos.error || parts.error) && <p className="text-xs text-amber-200">{videos.error || parts.error}</p>}
      {ready && !items.length && <p className="text-xs text-white/55">Nothing yet. Upload a video above, or on the whiteboard press <b>⬇ MP4</b> / <b>🎬 Edit</b> / <b>Send to Reel Studio</b>: it appears here.</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-raw-items>
        {items.map((it) => {
          const on = selected.includes(it.id);
          return (
            <div key={it.id} className={`space-y-1.5 rounded-xl border p-2 ${on ? 'border-sky-300 bg-sky-500/15' : 'border-white/10 bg-white/[0.03]'}`} data-raw-item={it.kind}>
              <button type="button" onClick={() => toggle(it.id)} aria-pressed={on} className="relative block w-full overflow-hidden rounded-lg bg-black/40" style={{ aspectRatio: '9 / 12' }} title={on ? 'Untick' : 'Tick to move it to a way'} data-raw-toggle>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.thumb ? <img src={it.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-4xl">{it.kind === 'part' ? '🎬' : '🎞'}</span>}
                <span className={`absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border text-sm font-extrabold ${on ? 'border-sky-200 bg-sky-500 text-white' : 'border-white/50 bg-black/50 text-transparent'}`}>✓</span>
              </button>
              <div className="truncate text-xs font-semibold text-white/90" title={it.title}>{it.title}</div>
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-white/50">
                <span className="rounded bg-white/10 px-1">{it.source}</span>
                <span className="rounded bg-white/10 px-1">{it.kind === 'video' ? 'MP4' : 'Part'}</span>
              </div>
              <div className="flex items-center gap-1">
                {it.kind === 'video' && <button type="button" onClick={() => setLook(look === it.id ? null : it.id)} className="rounded-md bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20" data-raw-look>{look === it.id ? 'Close' : '▶ Watch'}</button>}
                <span className="ml-auto"><DeleteButton what="raw reel" onYes={() => void (it.kind === 'part' ? deletePart(it.id) : deleteVideo(it.id))} /></span>
              </div>
              {look === it.id && it.kind === 'video' && <BlobVideo id={it.id} className="ag-keep-dark aspect-[9/16] max-h-72 w-full rounded-md bg-black object-contain" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** What each way does with a raw reel, shown under its Choose button. */
export function RawFitNote({ way, selected }: { way: WayId; selected: string[] }) {
  if (!selected.length) return null;
  const fit = selected.filter((id) => fitsWay(rawKindOf(id), way));
  const miss = selected.length - fit.length;
  return (
    <p className={`text-center text-[11px] ${fit.length ? 'text-sky-200' : 'text-white/45'}`} data-raw-fit={way}>
      {fit.length ? `📼 ${fit.length} raw reel${fit.length === 1 ? '' : 's'} will open here` : (way === 'flow' || way === 'omni' ? `${way === 'omni' ? 'Google Omni' : 'Google Flow'} needs an MP4 (none ticked)` : 'Needs a whiteboard part (none ticked)')}
      {fit.length > 0 && miss > 0 ? ` · ${miss} ticked do${miss === 1 ? 'es' : ''} not fit this way` : ''}
    </p>
  );
}

/* ------------------------------------------------------------------ the panel (each way's page) */

const noSub = () => () => {};
const searchNow = () => window.location.search;

export function RawReelPanel({ way, onUsePart, onUseVideo, useVideoLabel = 'Use this video', side }: {
  way: WayId;
  onUsePart?: (clip: ClassClip) => void;
  onUseVideo?: (blob: Blob, name: string) => Promise<string | null> | string | null | void;
  useVideoLabel?: string;
  /** Shown to the right of the raw reel (Google Flow: the editable prompt). */
  side?: React.ReactNode;
}) {
  const search = useSyncExternalStore(noSub, searchNow, () => '');
  const ids = parseRaw(search);
  const key = ids.join(',');
  const [items, setItems] = useState<Item[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const auto = useRef('');
  useEffect(() => {
    let live = true;
    void Promise.all([listVideos(['raw', 'whiteboard']), listParts()]).then(([v, p]) => {
      if (!live) return;
      const all = toItems(v, p);
      setItems(ids.map((id) => all.find((x) => x.id === id)).filter((x): x is Item => Boolean(x)));
    }).catch((e) => { if (live) { setItems([]); setMsg((e as Error).message); } });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadVideo = useCallback(async (id: string) => {
    const v = await getVideo(id);
    if (!v || !onUseVideo) return;
    const r = await onUseVideo(v.blob, v.name || 'video.mp4');
    setMsg(typeof r === 'string' && r ? r : '');
  }, [onUseVideo]);

  // the first reel is opened by itself, so the page is ready the moment it appears
  useEffect(() => {
    if (!items || !items.length || auto.current === key) return;
    auto.current = key;
    const p = items.find((i) => i.kind === 'part' && i.clip);
    const v = items.find((i) => i.kind === 'video');
    const t = setTimeout(() => { if (p?.clip && onUsePart) onUsePart(p.clip); else if (v && onUseVideo) void loadVideo(v.id); }, 0);
    return () => clearTimeout(t);
  }, [items, key, onUsePart, onUseVideo, loadVideo]);

  const shown = (items ?? []).filter((i) => !hidden.includes(i.id));
  if (!ids.length) {
    return <p className="rounded-xl border border-dashed border-sky-300/30 bg-sky-500/[0.04] px-3 py-2 text-xs text-white/65" data-raw-none>📼 No raw reel here yet. Go back to <a href="/ai-guru/reels" className="underline">All ways</a>, tick a raw reel and press Choose on this way — or use your whiteboard parts and videos below.</p>;
  }
  const list = (
    <div className="space-y-3">
      {items === null && <p className="text-xs text-white/50">Loading your raw reels…</p>}
      {items !== null && !shown.length && <p className="text-xs text-white/55">The raw reel is not here any more (it was deleted). Go back to <a href="/ai-guru/reels" className="underline">All ways</a> and tick another.</p>}
      {shown.map((it) => (
        <div key={it.id} className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-2.5" data-raw-here={it.kind}>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-bold" title={it.title}>{it.kind === 'part' ? '🎬' : '🎞'} {it.title}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white/60">{it.source}</span>
            <button type="button" onClick={() => setHidden((h) => [...h, it.id])} className="rounded-md px-1.5 text-xs text-white/50 hover:bg-white/10" title="Take it off this page (it stays in the tray)" data-raw-remove>✕</button>
          </div>
          {it.kind === 'video' ? (
            <div draggable onDragStart={(e) => { const cached = blobCache.get(it.id); if (cached) dragFile(e, cached.blob, cached.name); }} onMouseEnter={() => void warm(it.id)} className="space-y-2" data-raw-draggable>
              <BlobVideo id={it.id} className="ag-keep-dark mx-auto aspect-[9/16] max-h-[420px] w-full rounded-lg bg-black object-contain" />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void saveToDevice(it.id)} className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/20" data-raw-download>⬇ Download the raw reel</button>
                {onUseVideo && <button type="button" onClick={() => void loadVideo(it.id)} className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-bold hover:bg-sky-500" data-raw-use>{useVideoLabel}</button>}
                <span className="text-[11px] text-white/40">Drag it onto a page that takes a file, or use Download.</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {onUsePart && it.clip
                ? <button type="button" onClick={() => onUsePart(it.clip!)} className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-bold hover:bg-sky-500" data-raw-use>Open it in the editor below</button>
                : <span className="text-xs text-white/55">This is a whiteboard part, not an MP4.</span>}
            </div>
          )}
        </div>
      ))}
      {msg && <p className="text-xs text-rose-300" role="alert">{msg}</p>}
    </div>
  );
  return (
    <section className="space-y-2 rounded-2xl border border-sky-300/35 bg-sky-500/[0.06] p-3" data-raw-panel={way}>
      <h2 className="text-base font-extrabold">📼 Your raw reel{ids.length === 1 ? '' : 's'} <span className="text-xs font-normal text-white/50">moved here from the tray</span></h2>
      {side ? <div className="grid gap-3 md:grid-cols-2"><div>{list}</div><div>{side}</div></div> : list}
    </section>
  );
}

// the drag needs the file ready before the drag starts, so it is fetched when the pointer comes near
const blobCache = new Map<string, { blob: Blob; name: string }>();
async function warm(id: string) {
  if (blobCache.has(id)) return;
  const v = await getVideo(id);
  if (v?.blob) blobCache.set(id, { blob: v.blob, name: v.name || 'reel.mp4' });
}
