/**
 * V51.9.88: pre-rendered intro clips (HyperFrames, one short WebM per heading). The class plays them as a video element and the
 * canvas copies the current frame. A clip that is missing, still loading or broken returns null, and the caller draws the
 * three.js / 2D intro instead, so a heading never shows a blank. The MP4 export does not use clips (frames are drawn faster than
 * real time there): it calls setClipPlayback(false) around the export and gets the three.js intro.
 */
const vids = new Map<string, HTMLVideoElement>();
const bad = new Set<string>();
let enabled = true;

export const setClipPlayback = (on: boolean): void => { enabled = on; };

/** Starts loading a clip so its first frames are ready when the heading comes up. */
export function preloadClip(src: string): void {
  if (typeof document === 'undefined' || vids.has(src) || bad.has(src)) return;
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.onerror = () => { bad.add(src); vids.delete(src); };
  v.src = src;
  v.load();
  vids.set(src, v);
}

/** The clip's picture at tMs from the start of the intro, or null when it cannot be shown. */
export function clipFrame(src: string, tMs: number): CanvasImageSource | null {
  if (!enabled || typeof document === 'undefined' || bad.has(src)) return null;
  preloadClip(src);
  const v = vids.get(src);
  if (!v || v.readyState < 2) return null;
  const want = Math.max(0, Math.min(tMs / 1000, (v.duration || 5) - 0.05));
  if (Math.abs(v.currentTime - want) > 0.3) v.currentTime = want; // started late, scrubbed or paused for long: catch up
  if (v.paused && tMs < (v.duration || 5) * 1000 - 50) void v.play().catch(() => {});
  return v;
}

/** Pauses every clip (the class stopped). */
export function pauseClips(): void { vids.forEach((v) => { if (!v.paused) v.pause(); }); }
