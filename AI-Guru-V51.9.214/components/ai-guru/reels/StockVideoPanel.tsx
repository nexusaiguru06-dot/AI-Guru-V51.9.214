'use client';

/**
 * V51.9.157 — Way 4: "Stock video background". The student finds a free clip on Pexels or Pixabay, downloads it, and
 * uploads it here; it plays behind the reel (board, captions and title on top, shaded so the lesson stays readable).
 * The clip stays on this device: it is never sent to the AI Guru server, and the phone builds the MP4 by itself.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_CLIP_MB, SHADE_DEFAULT, SHADE_MAX, bgTime, clampShade, type BgVideoDraw } from '@/lib/ai-guru/reels/motion/bg-video';

export interface StockClip {
  url: string;
  name: string;
  mb: number;
  el: HTMLVideoElement;
  duration: number;
  width: number;
  height: number;
  /** Seconds into the clip where the reel starts. */
  start: number;
  shade: number;
}

/** The uploaded clip and a counter that changes whenever a new frame of it is ready (to redraw the preview). */
export function useStockClip() {
  const [clip, setClip] = useState<StockClip | null>(null);
  const [tick, setTick] = useState(0);
  const cur = useRef<StockClip | null>(null);
  useEffect(() => { cur.current = clip; }, [clip]);
  useEffect(() => () => { const c = cur.current; if (c) { c.el.pause(); URL.revokeObjectURL(c.url); } }, []);

  const load = useCallback(async (f: File): Promise<string | null> => {
    if (!f.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v)$/i.test(f.name)) return 'Please choose a video file (MP4).';
    const mb = f.size / 1048576;
    if (mb > MAX_CLIP_MB) return `This clip is ${mb.toFixed(0)} MB. Download a smaller size (720p or "SD") — it should be under ${MAX_CLIP_MB} MB.`;
    const url = URL.createObjectURL(f);
    const el = document.createElement('video');
    el.muted = true; el.playsInline = true; el.preload = 'auto'; el.loop = true; el.src = url;
    const ok = await new Promise<boolean>((res) => {
      const t = setTimeout(() => res(false), 20000);
      el.addEventListener('loadeddata', () => { clearTimeout(t); res(true); }, { once: true });
      el.addEventListener('error', () => { clearTimeout(t); res(false); }, { once: true });
    });
    if (!ok || !(el.duration > 0) || !el.videoWidth) { URL.revokeObjectURL(url); return 'This video could not be opened in this browser. Download the MP4 version and try again.'; }
    const bump = () => setTick((n) => n + 1);
    el.addEventListener('seeked', bump);
    el.addEventListener('timeupdate', bump);
    setClip((old) => { if (old) { old.el.pause(); URL.revokeObjectURL(old.url); } return { url, name: f.name, mb, el, duration: el.duration, width: el.videoWidth, height: el.videoHeight, start: 0, shade: SHADE_DEFAULT }; });
    bump();
    return null;
  }, []);
  const set = useCallback((p: Partial<Pick<StockClip, 'start' | 'shade'>>) => setClip((c) => (c ? { ...c, ...p, ...(p.shade !== undefined ? { shade: clampShade(p.shade) } : {}) } : c)), []);
  const remove = useCallback(() => setClip((c) => { if (c) { c.el.pause(); URL.revokeObjectURL(c.url); } return null; }), []);
  return { clip, tick, load, set, remove };
}

/**
 * The clip's frame for the preview at reel time `t` (ms). Playing: the video runs and is nudged back when it drifts
 * from the reel's clock; still: it seeks to the exact moment (the preview redraws when the frame is ready).
 */
export function stockFrame(clip: StockClip | null, t: number, playing: boolean): BgVideoDraw | null {
  if (!clip) return null;
  const v = clip.el, want = bgTime(t, clip.start, clip.duration);
  if (playing) {
    if (v.paused) void v.play().catch(() => undefined);
    if (Math.abs(v.currentTime - want) > 0.35) v.currentTime = want;
  } else {
    if (!v.paused) v.pause();
    if (Math.abs(v.currentTime - want) > 0.04) v.currentTime = want;
  }
  return { frame: v.readyState >= 2 ? v : null, width: clip.width, height: clip.height, shade: clip.shade };
}

const TOPICS = ['river', 'forest', 'ocean waves', 'space stars', 'planet earth', 'rain', 'sunrise', 'mountains', 'clouds timelapse', 'Kerala backwaters', 'plants growing', 'volcano'];
const pexels = (q: string) => `https://www.pexels.com/search/videos/${encodeURIComponent(q.trim() || 'nature')}/?orientation=portrait`;
const pixabay = (q: string) => `https://pixabay.com/videos/search/${encodeURIComponent(q.trim() || 'nature')}/`;

export function StockVideoPanel({ api, suggest }: { api: ReturnType<typeof useStockClip>; suggest?: string }) {
  const [q, setQ] = useState(suggest && /[a-z]/i.test(suggest) && !/^[\d\s+\-×÷=?.x*/()]+$/i.test(suggest) ? suggest.slice(0, 40) : 'river');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const c = api.clip;
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr('');
    const e = await api.load(f);
    setBusy(false);
    if (e) setErr(e);
  };
  const link = 'rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold text-[#04101c] hover:bg-white/90';
  return (
    <section className="space-y-3 rounded-xl border border-amber-300/40 bg-amber-400/[0.06] p-3" data-stock-panel>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-base font-extrabold">🎞 Stock video background</h2>
        <span className="text-xs text-white/55">A real video plays behind your lesson.</span>
      </div>

      <div className="space-y-2 rounded-lg bg-black/20 p-3" data-stock-step="find">
        <p className="text-sm font-bold">1. Find a free clip</p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What should the video show?" aria-label="Search word" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0b1426] px-3 py-1.5 text-sm outline-none focus:border-amber-300" data-stock-q />
          <a href={pexels(q)} target="_blank" rel="noreferrer" className={link} data-stock-pexels>Search Pexels ↗</a>
          <a href={pixabay(q)} target="_blank" rel="noreferrer" className={link} data-stock-pixabay>Search Pixabay ↗</a>
        </div>
        <div className="flex flex-wrap gap-1">{TOPICS.map((t) => <button key={t} type="button" onClick={() => setQ(t)} className={`rounded-full px-2 py-0.5 text-[11px] ${q === t ? 'bg-amber-300 text-[#1a1200]' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}>{t}</button>)}</div>
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-white/70" data-stock-tips>
          <li><b>Choose a clip without people</b> — nature, space, science, monuments, maps. Your reel invites friends to AI Guru, and the people in stock videos must not look as if they recommend it.</li>
          <li>On the clip’s page press <b>Free download</b> and choose a <b>small size</b> (720p / SD, a few MB). A tall (portrait) clip fits a reel best.</li>
          <li><b>10–20 seconds</b> is enough: the clip repeats if your lesson is longer.</li>
          <li>Ask a parent or teacher to help you search. These are open video sites, not made for children. Pixabay may ask you to sign in before downloading.</li>
          <li>Pexels and Pixabay videos are free to use; you do not need to pay or write a credit.</li>
        </ul>
      </div>

      <div className="space-y-2 rounded-lg bg-black/20 p-3" data-stock-step="upload">
        <p className="text-sm font-bold">2. Upload it here</p>
        <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pick(f); }} data-stock-file />
        {!c ? (
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-extrabold text-[#1a1200] disabled:opacity-50" data-stock-upload>{busy ? 'Opening…' : '⬆ Upload the video'}</button>
        ) : (
          <div className="space-y-2" data-stock-loaded>
            <p className="text-xs text-white/75">✓ <b>{c.name}</b> · {c.duration.toFixed(1)} s · {c.width}×{c.height} · {c.mb.toFixed(1)} MB{c.width > c.height ? ' · wide clip: the sides are cropped to fit' : ''}</p>
            <label className="block text-xs text-white/70">Start the clip at <b>{c.start.toFixed(1)} s</b>
              <input type="range" min={0} max={Math.max(0, c.duration - 0.5)} step={0.1} value={c.start} onChange={(e) => api.set({ start: Number(e.target.value) })} className="block w-full" data-stock-start />
            </label>
            <label className="block text-xs text-white/70">Video ↔ lesson: <b>{Math.round((c.shade / SHADE_MAX) * 100)}%</b> shade <span className="text-white/45">(more shade = numbers and captions clearer)</span>
              <input type="range" min={0} max={SHADE_MAX} step={0.05} value={c.shade} onChange={(e) => api.set({ shade: Number(e.target.value) })} className="block w-full" data-stock-shade />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">Change video</button>
              <button type="button" onClick={api.remove} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs" data-stock-remove>Remove</button>
            </div>
          </div>
        )}
        {err && <p className="text-xs text-rose-300" role="alert">{err}</p>}
        <p className="text-[11px] text-white/45">The video stays on this phone or computer: it is not sent to AI Guru. Your reel is made here, with your link and QR code as always.</p>
      </div>
      <p className="text-sm font-bold">3. Open your lesson below, check the preview, then 👁 Preview &amp; post.</p>
    </section>
  );
}
