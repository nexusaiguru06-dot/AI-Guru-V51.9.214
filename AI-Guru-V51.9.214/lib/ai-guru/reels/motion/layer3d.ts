import { clipFrame } from './clip';
/**
 * A scene can carry a "3D layer": a spec the app can render with three.js as a full-frame picture, frame by frame
 * (the preview and the MP4 export both go through drawMotionFrame). three.js is NOT imported here: the renderer
 * installs itself with setLayer3dRenderer when it has loaded. If it never does (no WebGL, or not loaded yet) the
 * scene's ordinary 2D items are drawn instead, so the picture is never blank.
 */
export interface Layer3d {
  kind: 'heading';
  heading: string;
  sub?: string;
  /** The chapter's key expression shown flying in, e.g. "P(x) = 3x⁴ − 2x³ + 5x − 7". */
  expr?: string;
  /** Symbols and formulas that stream past in the 3D tunnel. */
  symbols: string[];
  accent: string;
  /** Makes the tunnel the same every time this heading is drawn. */
  seed: number;
  lang: 'en' | 'ml';
  /** Which of the six looks to use (0–5); the class gives neighbouring headings different ones. */
  variant?: number;
  /** V51.9.88: a pre-rendered HyperFrames clip for this heading; played instead of the three.js look while it is ready. */
  clip?: { src: string; ms: number };
}
export type Layer3dRenderer = (spec: Layer3d, tMs: number, width: number, height: number) => CanvasImageSource | null;

let renderer: Layer3dRenderer | null = null;
export const setLayer3dRenderer = (r: Layer3dRenderer | null): void => { renderer = r; };
export const getLayer3dRenderer = (): Layer3dRenderer | null => renderer;

/** Draws the layer full frame; false when no renderer is installed (the caller then draws the 2D scene). */
export function drawLayer3d(ctx: CanvasRenderingContext2D, spec: Layer3d, tMs: number, w: number, h: number): boolean {
  if (spec.clip) {
    const f = clipFrame(spec.clip.src, tMs);
    if (f) { ctx.drawImage(f, 0, 0, w, h); return true; }
  }
  if (!renderer) return false;
  let img: CanvasImageSource | null = null;
  try { img = renderer(spec, tMs, w, h); } catch { img = null; }
  if (!img) return false;
  ctx.drawImage(img, 0, 0, w, h);
  return true;
}
