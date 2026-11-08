import { describe, expect, it } from 'vitest';
import { beatKindOf, CAMERA_PRESETS, fitZoom, movesFor, pickBeatPresets, rawShot, safeShot, shotAt, type Box, type BeatKind, type ShotInput } from './camera-presets';

const view = { cx: 500, cy: 400, hw: 400, hh: 300 };
const line: Box = { l: 380, r: 620, t: 560, b: 620 };
const base = (over: Partial<ShotInput> = {}): ShotInput => ({ preset: 'push-in', flavour: 'whiteboard', p: 0, beatMs: 3000, focus: line, pen: null, sides: null, view, ...over });

/** The four corners of the shot's view, in design units. */
function inside(sh: ReturnType<typeof safeShot>, b: Box) {
  const hw = view.hw / sh.zoom, hh = view.hh / sh.zoom;
  return b.l >= sh.x - hw - 0.01 && b.r <= sh.x + hw + 0.01 && b.t >= sh.y - hh - 0.01 && b.b <= sh.y + hh + 0.01;
}

describe('camera presets', () => {
  it('has the 12 moves, two of them only for 3D', () => {
    expect(CAMERA_PRESETS).toHaveLength(12);
    expect(CAMERA_PRESETS.filter((p) => p.only3d).map((p) => p.id)).toEqual(['orbit-3d', 'top-down-drop']);
  });

  it('reads the kind of a step from its words (English and Malayalam)', () => {
    expect(beatKindOf('What is the value of x?', 0, 5)).toBe('question');
    expect(beatKindOf('Take 5 away from both sides', 1, 5)).toBe('step');
    expect(beatKindOf('So, x = 10', 3, 5)).toBe('result');
    expect(beatKindOf('അതിനാൽ, x = 10', 3, 5)).toBe('result');
    expect(beatKindOf('Check: 20 + 5 = 25', 4, 5)).toBe('recap');
    expect(beatKindOf('പരിശോധന: 20 + 5 = 25', 4, 5)).toBe('recap');
  });

  const kinds: BeatKind[] = ['question', 'step', 'step', 'step', 'step', 'step', 'result', 'step', 'result', 'recap'];

  it('never repeats a move on two steps in a row, and keeps the showy moves rare', () => {
    for (let seed = 1; seed < 200; seed++) {
      const plan = pickBeatPresets(kinds, 'lively', 'whiteboard', seed);
      plan.forEach((id, i) => { if (i) expect(id).not.toBe(plan[i - 1]); });
      expect(plan.filter((id) => id === 'crash-zoom').length).toBeLessThanOrEqual(2);
      expect(plan.filter((id) => id === 'whip-pan').length).toBeLessThanOrEqual(2);
      expect(plan[0]).not.toBe('whip-pan');
    }
  });

  it('is the same every time for the same seed (preview = MP4)', () => {
    expect(pickBeatPresets(kinds, 'lively', 'cinematic', 42)).toEqual(pickBeatPresets(kinds, 'lively', 'cinematic', 42));
  });

  it('keeps teaching calm and the cinematic board soft', () => {
    const showy = ['crash-zoom', 'whip-pan', 'dutch-tilt', 'rack-focus'];
    for (let seed = 1; seed < 100; seed++) {
      for (const f of ['cinematic', 'whiteboard'] as const) expect(pickBeatPresets(kinds, 'calm', f, seed).some((id) => showy.includes(id))).toBe(false);
      const cine = pickBeatPresets(kinds, 'lively', 'cinematic', seed);
      expect(cine).not.toContain('crash-zoom');
      expect(cine).not.toContain('whip-pan');
    }
  });

  it('keeps the new line on screen in every move, all the way through', () => {
    const sides: [Box, Box] = [{ l: 380, r: 470, t: 560, b: 620 }, { l: 530, r: 620, t: 560, b: 620 }];
    for (const p of CAMERA_PRESETS.filter((x) => !x.only3d && x.id !== 'whip-pan')) {
      for (const flavour of ['cinematic', 'whiteboard'] as const) {
        for (let k = 0; k <= 20; k++) {
          const sh = safeShot(rawShot(base({ preset: p.id, flavour, p: k / 20, sides, pen: { x: 500, y: 590 } })), view);
          expect(inside(sh, line), `${p.id} ${flavour} at ${k / 20}`).toBe(true);
          expect(sh.zoom).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('never shows past the edge of the board’s own view (except the whip pan’s swipe)', () => {
    const corner: Box = { l: 820, r: 900, t: 650, b: 700 };
    for (const p of CAMERA_PRESETS.filter((x) => !x.only3d)) {
      for (let k = 0; k <= 20; k++) {
        const sh = safeShot(rawShot(base({ preset: p.id, p: k / 20, focus: corner })), view);
        if (sh.sweep > 0) continue;
        const hw = view.hw / sh.zoom, hh = view.hh / sh.zoom;
        expect(sh.x - hw).toBeGreaterThanOrEqual(view.cx - view.hw - 0.01);
        expect(sh.x + hw).toBeLessThanOrEqual(view.cx + view.hw + 0.01);
        expect(sh.y - hh).toBeGreaterThanOrEqual(view.cy - view.hh - 0.01);
        expect(sh.y + hh).toBeLessThanOrEqual(view.cy + view.hh + 0.01);
      }
    }
  });

  it('does not zoom in so far that a long line no longer fits', () => {
    const wide: Box = { l: 140, r: 860, t: 380, b: 440 };
    expect(fitZoom(wide, view, 1.7)).toBeLessThan(1.0001);
    expect(safeShot(rawShot(base({ preset: 'crash-zoom', p: 0.9, focus: wide })), view).zoom).toBeCloseTo(1);
  });

  it('crash zoom waits for the line, then punches in; the tilt is small and comes back', () => {
    expect(rawShot(base({ preset: 'crash-zoom', p: 0.3 })).zoom).toBe(1);
    expect(rawShot(base({ preset: 'crash-zoom', p: 0.9 })).zoom).toBeGreaterThan(1.3);
    let max = 0;
    for (let k = 0; k <= 50; k++) max = Math.max(max, Math.abs(rawShot(base({ preset: 'dutch-tilt', p: k / 50 })).rot));
    expect(max).toBeLessThanOrEqual((4.01 * Math.PI) / 180);
    expect(rawShot(base({ preset: 'dutch-tilt', p: 1 })).rot).toBeCloseTo(0);
    let cmax = 0;
    for (let k = 0; k <= 50; k++) cmax = Math.max(cmax, Math.abs(rawShot(base({ preset: 'dutch-tilt', flavour: 'cinematic', p: k / 50 })).rot));
    expect(cmax).toBeLessThanOrEqual((2.01 * Math.PI) / 180);
  });

  it('flows from where the step before ended', () => {
    const prev = base({ preset: 'pull-out-reveal', p: 1 });
    const start = shotAt(base({ preset: 'push-in', p: 0 }), prev);
    const end = safeShot(rawShot({ ...prev, p: 1 }), view);
    expect(start.zoom).toBeCloseTo(end.zoom);
    expect(start.x).toBeCloseTo(end.x);
  });

  it('Auto is calm in class and lively in a video', () => {
    expect(movesFor('auto', false)).toBe('calm');
    expect(movesFor('auto', true)).toBe('lively');
    expect(movesFor('off', true)).toBe('off');
    expect(movesFor('lively', false)).toBe('lively');
  });
});
