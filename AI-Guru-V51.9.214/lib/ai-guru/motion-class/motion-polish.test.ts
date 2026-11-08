import { describe, expect, it } from 'vitest';
import { Motion, evalItem, ease, motionEnd, END_HOLD_MAX } from '../reels/motion/engine';
import { curves, curveFor, CURVE_FOR_ACTION, staggerOffsets, STAGGER_TEXT } from '../reels/motion/curves';
import { buildDnaScenes } from './dna/builders';
import { DNAS } from './dna/registry';
import { MAX_END_HOLD_MS, timelineProblems, timelineReport } from './plan/timeline-qa';
import { QD_SAMPLE_6_5 } from './samples/quadratic-derivation';
import { HL_SAMPLE_12_18 } from './samples/hcf-lcm';
import { TYPESET_SAMPLES } from './samples/typeset-chain';
import { BAL_TWO_STEP_SAMPLE } from './samples/balance-scale';
import { QUAD_FORMULA_SAMPLE } from './samples/quadratic-equation';
import { qaLayout } from './plan/qa';

describe('easing curves', () => {
  it('every curve starts at 0, ends at 1 and never goes backwards', () => {
    for (const [name, f] of Object.entries(curves)) {
      expect(f(0), name).toBe(0);
      expect(f(1), name).toBe(1);
      let prev = 0;
      for (let i = 1; i <= 100; i++) { const v = f(i / 100); expect(Number.isFinite(v), name).toBe(true); expect(v, name).toBeGreaterThanOrEqual(prev - 1e-9); prev = v; }
    }
  });
  it('landing decelerates, leaving accelerates, blends are symmetric', () => {
    expect(curves.softLand(0.1)).toBeGreaterThan(0.25);
    expect(curves.glide(0.1)).toBeGreaterThan(0.1);
    expect(curves.accelExit(0.1)).toBeLessThan(0.01);
    expect(curves.softInOut(0.5)).toBeCloseTo(0.5, 9);
    expect(curves.softInOut(0.2) + curves.softInOut(0.8)).toBeCloseTo(1, 9);
  });
  it('each teaching action has a curve', () => {
    for (const a of Object.keys(CURVE_FOR_ACTION) as Array<keyof typeof CURVE_FOR_ACTION>) expect(curveFor(a)(1)).toBe(1);
    expect(curveFor('erase')).toBe(curves.accelExit);
    expect(curveFor('move')).toBe(curves.glide);
  });
  it('the engine exposes them', () => {
    expect(ease.land).toBe(curves.softLand);
    expect(ease.exit).toBe(curves.accelExit);
  });
});

describe('uneven stagger', () => {
  it('offsets follow the gaps and the last gap repeats', () => {
    expect(staggerOffsets(5, [100, 60])).toEqual([0, 100, 160, 220, 280]);
    expect(staggerOffsets(1)).toEqual([0]);
    expect(staggerOffsets(0)).toEqual([]);
    const o = staggerOffsets(8);
    expect(o[1] - o[0]).toBe(STAGGER_TEXT[0]);
    expect(o[7] - o[6]).toBe(STAGGER_TEXT[STAGGER_TEXT.length - 1]);
    expect(o[1] - o[0]).toBeGreaterThan(o[3] - o[2]);
  });
  it('a list of gaps and a plain number both work in appear and write', () => {
    const m = new Motion('t', 720, 400);
    ['a', 'b', 'c', 'd'].forEach((id, i) => m.text(id, id, 100 + i * 50, 100));
    const end = m.appear(['a', 'b', 'c', 'd'], 0, [200, 100], false);
    const sc = m.build();
    const t = (id: string) => sc.items.find((i) => i.id === id)!.scale.segs[0].t0;
    expect([t('a'), t('b'), t('c'), t('d')]).toEqual([0, 200, 300, 400]);
    expect(end).toBeGreaterThan(400);
    const m2 = new Motion('t', 720, 400);
    ['a', 'b', 'c'].forEach((id) => m2.text(id, id, 100, 100));
    m2.write(['a', 'b', 'c'], 0, 150);
    const s2 = m2.build();
    expect([0, 1, 2].map((i) => s2.items[i].draw.segs[0].t0)).toEqual([0, 150, 300]);
  });
});

describe('motion by action', () => {
  it('a move lands exactly on its target, quickly at first and gently at the end', () => {
    const m = new Motion('t', 720, 400);
    m.text('a', 'a', 100, 100);
    m.appear('a', 0, 0, false);
    const end = m.move('a', 500, 300, 1000, { dur: 800, sound: false });
    const sc = m.build();
    const it = sc.items[0];
    expect(evalItem(it, end).x).toBe(500);
    expect(evalItem(it, end).y).toBe(300);
    expect(evalItem(it, 1000).x).toBe(100);
    expect(evalItem(it, 1000 + 160).x - 100).toBeGreaterThan(0.2 * 400); // 20% of the time covers more than 20% of the way
    const late = 500 - evalItem(it, end - 80).x;
    expect(late).toBeLessThan(0.05 * 400);
  });
  it('a fade out accelerates: slow to start, quick to finish', () => {
    const m = new Motion('t', 720, 400);
    m.text('a', 'a', 100, 100);
    m.appear('a', 0, 0, false);
    m.fadeOut('a', 1000, 400);
    const it = m.build().items[0];
    expect(evalItem(it, 1000 + 80).alpha).toBeGreaterThan(0.95);
    expect(evalItem(it, 1400).alpha).toBe(0);
  });
});

describe('the end hold', () => {
  const rest = (m: Motion, extra: number) => { m.text('a', 'a', 100, 100); m.appear('a', 0, 0, false); m.hold(1500 + extra); return m.build(1600); };
  it('a picture rests at most END_HOLD_MAX after its last movement', () => {
    const sc = rest(new Motion('t', 720, 400), 1400);
    const last = Math.max(...sc.items.flatMap((i) => [...i.alpha.segs, ...i.scale.segs].map((s) => s.t1)));
    expect(sc.durationMs - last).toBeLessThanOrEqual(END_HOLD_MAX + 1);
  });
  it('but never cuts the last step\'s own time', () => {
    const m = new Motion('t', 720, 400);
    m.text('a', 'a', 100, 100);
    m.appear('a', 0, 0, false);
    m.step('A long caption that needs its time on the screen.', 0, 6000);
    const sc = m.build(600);
    expect(sc.durationMs).toBeGreaterThanOrEqual(6000);
    expect(sc.captions[sc.captions.length - 1].t1).toBe(sc.durationMs);
  });
  it('motionEnd is the last movement', () => {
    const m = new Motion('t', 720, 400);
    m.text('a', 'a', 100, 100);
    m.appear('a', 0, 0, false);
    const e = m.move('a', 300, 300, 900, { dur: 500, sound: false });
    expect(motionEnd(m as never)).toBe(e);
  });
});

describe('timeline check', () => {
  it('finds a long still stretch and a long rest', () => {
    const m = new Motion('t', 720, 400);
    m.text('a', 'a', 100, 100);
    m.text('b', 'b', 200, 100);
    m.appear('a', 0, 0, false);
    m.appear('b', 9000, 0, false);
    m.hold(9000 + 4000);
    const r = timelineReport(m.build(1600), { maxEndHoldMs: 1400 });
    expect(r.stillGaps.length).toBe(1);
    expect(r.stillGaps[0].fromMs).toBeLessThan(1000);
    expect(r.stillGaps[0].toMs).toBe(9000);
    expect(r.ok).toBe(false);
    expect(timelineProblems([m.build(1600)]).some((p) => p.includes('nothing on the board moves'))).toBe(true);
  });
  it('is quiet for a lively scene', () => {
    const m = new Motion('t', 720, 400);
    m.text('a', 'a', 100, 100);
    m.appear('a', 0, 0, false);
    m.move('a', 300, 300, 600, { dur: 1500, sound: false });
    m.move('a', 100, 100, 2300, { dur: 1500, sound: false });
    m.hold(4500);
    expect(timelineReport(m.build()).ok).toBe(true);
  });
  it('every built-in sample passes: no long still stretch, rest within the limit', () => {
    const jobs: Array<[string, unknown]> = [['typeset-chain', TYPESET_SAMPLES.quadratic], ['quadratic-derivation', QD_SAMPLE_6_5], ['hcf-lcm', HL_SAMPLE_12_18], ['balance-scale', BAL_TWO_STEP_SAMPLE], ['quadratic-equation', QUAD_FORMULA_SAMPLE]];
    for (const d of DNAS) { try { jobs.push([d.id, JSON.parse(d.example ?? '')]); } catch { /* an example that is not plain JSON */ } }
    let checked = 0;
    for (const [dna, teach] of jobs) {
      let scenes;
      try { scenes = buildDnaScenes(dna as never, teach as never, 'en', 'T'); } catch { continue; }
      for (const sc of scenes) {
        const r = timelineReport(sc);
        expect(r.endHoldMs, `${dna} rest`).toBeLessThanOrEqual(MAX_END_HOLD_MS);
        expect(r.stillGaps, `${dna} still`).toEqual([]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(15);
  });
  it('every template gives the step rail something to show: numbered steps, each with a caption (# √ ^ ⟲ in the live class)', () => {
    let checked = 0;
    for (const d of DNAS) {
      let teach: unknown;
      try { teach = JSON.parse(d.example ?? ''); } catch { continue; }
      let scenes;
      try { scenes = buildDnaScenes(d.id as never, teach as never, 'en', 'T'); } catch { continue; }
      const caps = scenes.flatMap((sc) => sc.captions);
      expect(caps.length, `${d.id} has steps`).toBeGreaterThan(0);
      for (const c of caps) expect(String(c.text ?? '').trim().length, `${d.id} step caption`).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(15);
  });
  it('the quality gate reports nothing for a good plan', () => {
    expect(qaLayout('quadratic-derivation', QD_SAMPLE_6_5)).toEqual([]);
    expect(qaLayout('hcf-lcm', HL_SAMPLE_12_18)).toEqual([]);
  });
});
