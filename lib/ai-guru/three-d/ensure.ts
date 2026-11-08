import { getLayer3dRenderer } from '../reels/motion/layer3d';

/** Loads three.js and installs the heading-intro renderer. Resolves true when 3D is ready, false when it cannot run here (the 2D title card is used then). */
export async function ensureHeadingIntro3d(): Promise<boolean> {
  if (getLayer3dRenderer()) return true;
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return false;
    const m = await import('./heading-intro-render');
    m.installHeadingIntro3d();
    return true;
  } catch { return false; }
}
