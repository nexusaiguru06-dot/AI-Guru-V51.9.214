/**
 * V51.9.101 — extra camera moves for shared reels, on top of the scene's own camera (which the recipes set):
 *   steady  none (the class and the default)
 *   punch   a small punch-in at the start of every step, easing back
 *   drift   a slow push-in with a gentle sideways drift across each part
 *   focus   close-up: zooms toward whatever is being worked on (items with a focus halo), and back out after
 * Only the board moves; title, captions and footer stay put. Deterministic, so preview = MP4.
 */

import { sceneStateAt, type MotionScene } from './engine';

export type CameraKind = 'steady' | 'punch' | 'drift' | 'focus';
export const CAMERAS: readonly CameraKind[] = ['steady', 'punch', 'drift', 'focus'];

export interface BoardFx { scale: number; dx: number; dy: number }
const NONE: BoardFx = { scale: 1, dx: 0, dy: 0 };

export function boardFx(kind: CameraKind, scene: MotionScene, t: number): BoardFx {
  if (kind === 'steady') return NONE;
  if (kind === 'punch') {
    let since = Infinity;
    for (const c of scene.captions) if (t >= c.t0) since = t - c.t0;
    if (!Number.isFinite(since)) return NONE;
    const up = Math.min(1, since / 260);
    const down = Math.max(0, (since - 700) / 1400);
    const k = (1 - Math.pow(1 - up, 3)) * (1 - Math.min(1, down));
    return { scale: 1 + 0.055 * k, dx: 0, dy: 0 };
  }
  if (kind === 'drift') {
    const p = Math.min(1, t / Math.max(1, scene.durationMs));
    return { scale: 1 + 0.06 * p, dx: Math.sin(t / 3800) * 10, dy: 0 };
  }
  // focus: the strongest halo decides how far to zoom; the haloed items' centre decides where
  let w = 0, sx = 0, sy = 0, h = 0;
  for (const st of sceneStateAt(scene, t)) {
    if (st.halo > 0.05 && st.kind === 'text') {
      w += st.halo; sx += st.x * st.halo; sy += st.y * st.halo;
      h = Math.max(h, st.halo);
    }
    // V51.9.113: focused tokens are ringed (not haloed): a ring counts the same, at its centre
    else if (st.kind === 'poly' && st.id.startsWith('ring') && st.alpha > 0.05) {
      const k = st.alpha * Math.min(1, st.draw * 1.5);
      w += k; sx += st.x * k; sy += st.y * k;
      h = Math.max(h, k);
    }
  }
  if (!w) return NONE;
  const camX = scene.camX ? scene.camX.at(t) : scene.viewX;
  const camY = scene.camY.at(t);
  const cx = sx / w, cy = sy / w;
  return { scale: 1 + 0.16 * h, dx: (cx - camX) * 0.45 * h, dy: (cy - camY) * 0.45 * h };
}
