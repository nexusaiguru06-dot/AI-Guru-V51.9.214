'use client';

/**
 * V51.9.152 — the shelves every Reel Studio page shows:
 *   WhiteboardParts   — class parts uploaded from the whiteboard (open one to design or style it; delete)
 *   VideoShelf        — MP4s (from the whiteboard, or finished reels): preview, download, delete
 * All kept in this browser (lib/ai-guru/reels/my-reels).
 */
import { useEffect, useRef, useState } from 'react';
import type { ClassClip } from '@/lib/ai-guru/reels/class-clip';
import { deletePart, deleteVideo, getVideo, listParts, listVideos, subscribeMyReels, type ReelWay, type StoredPart, type VideoInfo } from '@/lib/ai-guru/reels/my-reels';

const WAY_NAME: Record<ReelWay, string> = { raw: 'Raw reel', whiteboard: 'From the whiteboard', design: 'Designed', style: 'Styled', stock: 'Stock video', flow: 'Google Flow', omni: 'Google Omni 1.2' };
const when = (ms: number) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function useList<T>(load: () => Promise<T[]>, key: string): { items: T[]; ready: boolean; error: string } {
  const [state, setState] = useState<{ items: T[]; ready: boolean; error: string }>({ items: [], ready: false, error: '' });
  const ref = useRef(load);
  useEffect(() => { ref.current = load; });
  useEffect(() => {
    let live = true;
    const go = () => ref.current().then((items) => { if (live) setState({ items, ready: true, error: '' }); }).catch((e) => { if (live) setState({ items: [], ready: true, error: (e as Error).message }); });
    go();
    const off = subscribeMyReels(go);
    return () => { live = false; off(); };
  }, [key]);
  return state;
}

export function DeleteButton({ onYes, what }: { onYes: () => void; what: string }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" onClick={() => setAsk(true)} className="rounded-md px-1.5 py-0.5 text-xs text-white/50 hover:bg-rose-500/20 hover:text-rose-200" title={`Delete this ${what}`} data-shelf-delete>🗑</button>;
  return (
    <span className="flex items-center gap-1 text-xs text-rose-200" data-shelf-confirm>
      Delete?
      <button type="button" onClick={() => { setAsk(false); onYes(); }} className="rounded bg-rose-600 px-1.5 py-0.5 font-semibold text-white" data-shelf-delete-yes>Yes</button>
      <button type="button" onClick={() => setAsk(false)} className="rounded bg-white/10 px-1.5 py-0.5">No</button>
    </span>
  );
}

/** Class parts uploaded from the whiteboard. */
export function WhiteboardParts({ onOpen, openTitle = 'Open', activeMadeAt, compact = false }: { onOpen?: (clip: ClassClip) => void; openTitle?: string; activeMadeAt?: string; compact?: boolean }) {
  const { items, ready, error } = useList<StoredPart>(listParts, 'parts');
  return (
    <div className="space-y-2 rounded-xl border border-emerald-300/25 bg-emerald-500/[0.05] p-3" data-whiteboard-parts>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold">📥 From the whiteboard</span>
        <span className="text-xs text-white/50">{ready ? `${items.length} part${items.length === 1 ? '' : 's'}` : '…'}</span>
      </div>
      {error && <p className="text-xs text-amber-200">{error}</p>}
      {ready && !items.length && <p className="text-xs text-white/55">Nothing yet. In the class, press <b>🎬 Edit</b> on the board or <b>Send to Reel Studio</b> after a solution: the part appears here.</p>}
      <div className={`grid gap-1.5 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {items.map((p) => (
          <div key={p.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${activeMadeAt && p.clip.madeAt === activeMadeAt ? 'border-emerald-300/60 bg-emerald-500/15' : 'border-white/10 bg-white/[0.03]'}`} data-whiteboard-part>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-white/90">{p.kind === 'problem' ? '✏️ Problem' : '📖 Lecture'} {p.nth} · {p.title}</span>
              <span className="text-white/45">{when(p.addedAt)}</span>
            </span>
            {onOpen && <button type="button" onClick={() => onOpen(p.clip)} className="shrink-0 rounded-md bg-emerald-600/80 px-2 py-1 font-semibold text-white hover:bg-emerald-500" data-whiteboard-open>{activeMadeAt && p.clip.madeAt === activeMadeAt ? '✓ Open' : openTitle}</button>}
            <DeleteButton what="part" onYes={() => void deletePart(p.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoCard({ v }: { v: VideoInfo }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const load = async () => { const full = await getVideo(v.id); if (full?.blob) setUrl(URL.createObjectURL(full.blob)); return full; };
  const download = async () => {
    const full = await getVideo(v.id);
    if (!full) return;
    const u = URL.createObjectURL(full.blob);
    const a = document.createElement('a');
    a.href = u; a.download = full.name || 'reel.mp4';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 10000);
  };
  return (
    <div className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-2" data-video-card>
      <div className="ag-keep-dark relative overflow-hidden rounded-md bg-black/50" style={{ aspectRatio: '9 / 16', maxHeight: 260 }}>
        {url ? (
          <video src={url} controls autoPlay playsInline className="h-full w-full object-contain" />
        ) : (
          <button type="button" onClick={() => void load()} className="group absolute inset-0 flex items-center justify-center" title="Watch" data-video-play>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {v.thumb ? <img src={v.thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 group-hover:opacity-100" /> : null}
            <span className="relative rounded-full bg-black/60 px-3 py-2 text-lg">▶</span>
          </button>
        )}
      </div>
      <div className="truncate text-xs font-semibold text-white/85" title={v.title}>{v.title}</div>
      <div className="flex items-center gap-1 text-[11px] text-white/45">
        <span className="rounded bg-white/10 px-1">{WAY_NAME[v.way]}</span>
        <span className="truncate">{when(v.addedAt)}{v.seconds ? ` · ${Math.round(v.seconds)} s` : ''}</span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => void download()} className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20" data-video-download>⬇ Download</button>
        <span className="ml-auto"><DeleteButton what="video" onYes={() => void deleteVideo(v.id)} /></span>
      </div>
    </div>
  );
}

/** MP4s kept on this device: whiteboard videos (for Google Flow) or finished reels ("My reels"). */
export function VideoShelf({ ways, title, empty, testId }: { ways?: ReelWay[]; title: string; empty: React.ReactNode; testId?: string }) {
  const { items, ready, error } = useList<VideoInfo>(() => listVideos(ways), (ways ?? []).join(','));
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3" data-video-shelf={testId ?? ''}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs text-white/50">{ready ? `${items.length} video${items.length === 1 ? '' : 's'}` : '…'}</span>
        <span className="ml-auto text-[11px] text-white/35">kept on this device</span>
      </div>
      {error && <p className="text-xs text-amber-200">{error}</p>}
      {ready && !items.length && <p className="text-xs text-white/55">{empty}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((v) => <VideoCard key={v.id} v={v} />)}
      </div>
    </div>
  );
}
