'use client';

/**
 * AI Guru camera events -> manim-web 2D camera.
 *
 * Design: ONE timeline animation spans the whole scene and sets the camera from
 * `createRuntimeSnapshot(scene, t).camera` on every update. The runtime snapshot is
 * a pure function of time, so scrubbing backwards/forwards, replays, and frame-by-frame
 * export all give the same camera as the SVG board (same easing, same defaults:
 * zoom/focus -> scale 1.35, target = node centre, camera follows a moving target).
 *
 * Why not MovingCamera.animateTo / frame.animate per event?
 *  - MovingCamera advances from update(dt): it cannot scrub backwards.
 *  - Per-event animations capture their start state when they begin, which breaks
 *    when the user seeks into the middle of a timeline or drags backwards.
 *  A single stateless function of time has neither problem.
 *
 * Zoom is applied by shrinking the camera frame (zoom 2x -> frame is half as big),
 * then re-fitting to the canvas aspect via Camera2D.setAspectRatio so letterboxing
 * keeps working exactly as it did before.
 */

import { Dot, UpdateFromAlphaFunc, type Animation, type Scene } from 'manim-web';
import type { UniversalMathScene } from '../universal/types';
import { createRuntimeSnapshot } from '../animation/runtime';

export interface CameraTrackOptions {
  /** AI Guru Scene IR (source of camera events + node positions). */
  scene: UniversalMathScene;
  /** manim-web scene whose camera is driven. */
  engine: Pick<Scene, 'camera' | 'getWidth' | 'getHeight'>;
  /** Board px -> manim world units (same mapping the renderer uses for nodes). */
  toWorld: (x: number, y: number) => [number, number, number];
  /** Un-zoomed frame size in world units (renderer's FRAME_W / FRAME_H). */
  frameWidth: number;
  frameHeight: number;
  /** Whole-scene duration in seconds (camera may keep following a moving target). */
  durationSec: number;
}

const linear = (t: number) => t;
const MIN_SCALE = 0.05;

/** Apply one camera state to a manim-web camera. Exported for tests / the exporter. */
export function applyCameraState(
  opts: Pick<CameraTrackOptions, 'engine' | 'toWorld' | 'frameWidth' | 'frameHeight'>,
  cam: { x: number; y: number; scale: number },
): void {
  const camera = opts.engine.camera;
  const scale = Number.isFinite(cam.scale) ? Math.max(MIN_SCALE, cam.scale) : 1;
  const [wx, wy] = opts.toWorld(
    Number.isFinite(cam.x) ? cam.x : 500,
    Number.isFinite(cam.y) ? cam.y : 350,
  );
  camera.moveTo([wx, wy, camera.position.z]);
  camera.frameWidth = opts.frameWidth / scale;
  camera.frameHeight = opts.frameHeight / scale;
  const w = opts.engine.getWidth();
  const h = opts.engine.getHeight();
  if (w > 0 && h > 0) camera.setAspectRatio(w / h);
}

/**
 * Returns the animation to add to the timeline at t = 0, or null when the scene has no
 * camera events (zero per-frame cost for those scenes).
 */
export function createCameraTrack(opts: CameraTrackOptions): Animation | null {
  if (!opts.scene.events.some((e) => e.kind === 'camera' && e.camera)) return null;

  const durationSec = Math.max(0.05, opts.durationSec);
  let lastMs = Number.NaN;
  let lastCam = { x: 500, y: 350, scale: 1 };

  // Invisible anchor: the animation system needs a mobject, but it is never added to the scene.
  const anchor = new Dot({ radius: 0.001, color: '#000000' });

  return new UpdateFromAlphaFunc(
    anchor,
    (_m, alpha) => {
      const ms = Math.round(Math.max(0, Math.min(1, alpha)) * durationSec * 1000);
      if (ms !== lastMs) {
        lastMs = ms;
        lastCam = createRuntimeSnapshot(opts.scene, ms).camera;
      }
      applyCameraState(opts, lastCam);
    },
    // Linear: alpha must equal elapsed/total so the camera matches the runtime clock.
    // (manim-web animations default to `smooth`, which would warp time.)
    { duration: durationSec, rateFunc: linear },
  );
}
