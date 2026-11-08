import { describe, expect, it } from 'vitest';
import { Camera2D, Timeline } from 'manim-web';
import { createCameraTrack } from './camera';
import { createRuntimeSnapshot } from '../animation/runtime';

const BOARD_W = 1000, BOARD_H = 700, FW = 14, FH = 8;
const toWorld = (x: number, y: number): [number, number, number] => [(x / BOARD_W - 0.5) * FW, (0.5 - y / BOARD_H) * FH, 0];

function setup() {
  const cam = new Camera2D({ frameWidth: FW, frameHeight: FH });
  cam.setAspectRatio(BOARD_W / BOARD_H);
  const engine: any = { camera: cam, getWidth: () => BOARD_W, getHeight: () => BOARD_H };
  const scene: any = {
    nodes: [
      { id: 'a', kind: 'shape', shape: 'rectangle', x: 700, y: 100, width: 100, height: 60 },
    ],
    events: [
      { id: 'c1', atMs: 1000, durationMs: 1000, kind: 'camera', targetId: 'a', camera: { action: 'focus' } },
      { id: 'c2', atMs: 3000, durationMs: 1000, kind: 'camera', camera: { action: 'pan', x: 200, y: 500 } },
      { id: 'c3', atMs: 5000, durationMs: 1000, kind: 'camera', camera: { action: 'zoom', x: 500, y: 350, scale: 1 } },
    ],
  };
  return { cam, engine, scene };
}

describe('manim-web camera track', () => {
  it('returns null (zero cost) when the scene has no camera events', () => {
    const { engine } = setup();
    expect(createCameraTrack({ scene: { nodes: [], events: [] } as any, engine, toWorld, frameWidth: FW, frameHeight: FH, durationSec: 1 })).toBeNull();
  });

  it('matches the runtime camera at every time, including backward scrubs', () => {
    const { cam, engine, scene } = setup();
    const track = createCameraTrack({ scene, engine, toWorld, frameWidth: FW, frameHeight: FH, durationSec: 6 })!;
    const tl = new Timeline();
    tl.add(track, 0);
    for (const ms of [0, 500, 1500, 2000, 3500, 4000, 5500, 6000, 1500, 0, 3500, 1000, 2000]) {
      tl.seek(ms / 1000);
      const exp = createRuntimeSnapshot(scene, ms).camera;
      const [wx, wy] = toWorld(exp.x, exp.y);
      expect(cam.position.x).toBeCloseTo(wx, 2);
      expect(cam.position.y).toBeCloseTo(wy, 2);
      expect(FH / cam.frameHeight).toBeCloseTo(exp.scale, 2);
      expect(cam.frameWidth / cam.frameHeight).toBeCloseTo(BOARD_W / BOARD_H, 2); // letterboxing preserved
    }
  });

  it('starts at the board centre with no zoom (identity camera)', () => {
    const { scene } = setup();
    const c = createRuntimeSnapshot(scene, 0).camera;
    expect(c).toMatchObject({ x: 500, y: 350, scale: 1 });
  });
});
