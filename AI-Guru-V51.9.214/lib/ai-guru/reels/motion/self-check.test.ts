import { describe, expect, it } from 'vitest';
import { integratedLufs, kWeightingFilters, levelClip, limitPeaks, normaliseLoudness, peakOf } from './loudness';
import { checkAudio, checkDuration, checkFrames, checkSummary, finishCheck, frameSample, frameTimes, SIG_H, SIG_W, type CheckExpect, type FrameSample } from './self-check';
import { buildReel, mixReelAudio, reelVoiceCues, unvoicedSteps, voiceScript } from './index';

const R = 48000;
const sine = (sec: number, amp: number, hz = 997, rate = R) => {
  const x = new Float32Array(Math.round(sec * rate));
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * hz * i) / rate);
  return x;
};

describe('loudness (BS.1770)', () => {
  it('uses the published K-weighting coefficients at 48 kHz', () => {
    const [shelf, hp] = kWeightingFilters(48000);
    expect(shelf.b0).toBeCloseTo(1.53512485958697, 6);
    expect(shelf.b1).toBeCloseTo(-2.69169618940638, 6);
    expect(shelf.b2).toBeCloseTo(1.19839281085285, 6);
    expect(shelf.a1).toBeCloseTo(-1.69065929318241, 6);
    expect(shelf.a2).toBeCloseTo(0.73248077421585, 6);
    expect(hp.a1).toBeCloseTo(-1.99004745483398, 6);
    expect(hp.a2).toBeCloseTo(0.99007225036621, 6);
  });

  it('reads a full-scale 997 Hz sine as −3.01 LUFS, and −20 dB lower as −23 LUFS', () => {
    expect(integratedLufs(sine(3, 1), R)).toBeCloseTo(-3.01, 1);
    expect(integratedLufs(sine(3, 0.1), R)).toBeCloseTo(-23.01, 1);
    expect(integratedLufs(sine(3, 0.1, 997, 24000), 24000)).toBeCloseTo(-23.01, 1);
  });

  it('gates out silence: a tone with long silence around it measures as the tone', () => {
    const x = new Float32Array(R * 10);
    x.set(sine(3, 0.1), R * 4);
    expect(integratedLufs(x, R)).toBeCloseTo(-23.01, 0);
    expect(integratedLufs(new Float32Array(R), R)).toBe(-Infinity);
  });

  it('normalises to −14 LUFS and keeps every peak under −1 dBFS', () => {
    const x = sine(4, 0.02);
    x[R] = 0.9; // a click that would clip after the boost
    const r = normaliseLoudness(x, R);
    expect(r.after).toBeGreaterThan(-14.6);
    expect(r.after).toBeLessThan(-13.4);
    expect(peakOf(x)).toBeLessThanOrEqual(Math.pow(10, -1 / 20) + 1e-6);
  });

  it('the limiter only touches what is over the ceiling', () => {
    const x = sine(1, 0.5);
    const before = x.slice();
    limitPeaks(x, R);
    expect(Array.from(x)).toEqual(Array.from(before));
  });

  it('levels voice clips from different engines to the same loudness', () => {
    const loud = levelClip(sine(2, 0.8, 300), R);
    const soft = levelClip(sine(2, 0.05, 300), R);
    expect(integratedLufs(loud, R)).toBeCloseTo(integratedLufs(soft, R), 1);
  });

  it('the reel soundtrack comes out at −14 LUFS, voiced or music-only', () => {
    const req = { kind: 'arithmetic' as const, text: '12 + 34', lang: 'en' as const };
    const clip = levelClip(sine(1, 0.3, 220), R);
    const clips = new Map(voiceScript(buildReel(req)).map((t) => [t, clip]));
    const reel = buildReel(req, { voiceMs: () => 1000 });
    const report: { after?: number } = {};
    const voiced = mixReelAudio(reel, clips, { report });
    expect(report.after!).toBeGreaterThan(-15);
    expect(report.after!).toBeLessThan(-13);
    expect(peakOf(voiced)).toBeLessThan(0.9);
    const musicOnly = mixReelAudio(buildReel(req), null);
    expect(integratedLufs(musicOnly, R)).toBeGreaterThan(-17); // the boost is capped at +24 dB, so a soft music bed lands near −16
    // raw mix still available
    const raw = mixReelAudio(reel, clips, { loudness: false });
    expect(integratedLufs(raw, R)).not.toBeCloseTo(-14, 0);
  });
});

const expectOf = (o: Partial<CheckExpect> = {}): CheckExpect => ({ durationMs: 10000, audio: true, voices: [], ...o });

describe('self-check of a finished video', () => {
  it('length must match the reel', () => {
    expect(checkDuration(10033, expectOf())).toEqual([]);
    expect(checkDuration(6000, expectOf())[0].kind).toBe('duration');
    expect(checkDuration(NaN, expectOf())[0].severity).toBe('error');
  });

  it('finds a missing sound track and a silent video', () => {
    expect(checkAudio(null, R, expectOf()).problems[0].kind).toBe('no-audio');
    expect(checkAudio(new Float32Array(R * 10), R, expectOf()).problems[0].kind).toBe('silent');
    expect(checkAudio(null, R, expectOf({ audio: false })).problems).toEqual([]);
  });

  it('says where a voice step is missing', () => {
    const x = new Float32Array(R * 10);
    x.set(sine(2, 0.2, 200), R * 1); // voice 1 s – 3 s is there
    x.set(sine(10, 0.003, 300).subarray(0, R * 6), R * 3.5); // quiet music bed after it
    const f = checkAudio(x, R, expectOf({ voices: [[1000, 3000], [5000, 7000]] }));
    const p = f.problems.find((q) => q.kind === 'voice-missing')!;
    expect(p.message).toBe('Voice missing at 0:05.');
    expect(p.atMs).toBe(5000);
    // an empty clip under a ducked music bed: not silent, but far below the other voice steps
    const y = sine(10, 0.03, 300);
    for (const s of [1, 3, 7]) y.set(sine(1.5, 0.25, 200), R * s);
    const h = checkAudio(y, R, expectOf({ voices: [[1000, 2500], [3000, 4500], [5000, 6500], [7000, 8500]] }));
    expect(h.problems.find((q) => q.kind === 'voice-missing')!.message).toBe('Voice missing at 0:05.');
    // steps whose clip never arrived are listed too
    const g = checkAudio(x, R, expectOf({ voices: [[1000, 3000]], unvoiced: [8200] }));
    expect(g.problems.find((q) => q.kind === 'voice-missing')!.message).toBe('Voice missing at 0:08.');
  });

  it('a well-made soundtrack passes', () => {
    const x = sine(10, 0.2, 220);
    normaliseLoudness(x, R);
    const f = checkAudio(x, R, expectOf({ voices: [[1000, 3000], [5000, 7000]] }));
    expect(f.problems).toEqual([]);
    expect(f.lufs).toBeCloseTo(-14, 0);
  });

  it('warns about long silence, clipping and quiet sound', () => {
    const x = sine(10, 0.2, 220);
    x.fill(0, R * 3, R * 8);
    expect(checkAudio(x, R, expectOf()).problems.some((p) => p.kind === 'gap' && p.message.startsWith('5 s of silence from 0:03'))).toBe(true);
    const hot = sine(10, 1.5, 220).map((v) => Math.max(-1, Math.min(1, v)));
    expect(checkAudio(hot, R, expectOf()).problems.some((p) => p.kind === 'clipping')).toBe(true);
    expect(checkAudio(sine(10, 0.01, 220), R, expectOf()).problems.some((p) => p.kind === 'quiet')).toBe(true);
  });

  const W = 64, H = 36;
  const flat = (t: number, v = 255) => frameSample(t, new Uint8ClampedArray(W * H * 4).fill(v), W, H);
  const drawn = (t: number, seed: number) => {
    const px = new Uint8ClampedArray(W * H * 4).fill(255);
    for (let i = 0; i < 300; i++) {
      const k = ((seed * 7919 + i * 104729) % (W * H)) * 4;
      px[k] = px[k + 1] = px[k + 2] = 20;
    }
    return frameSample(t, px, W, H);
  };

  it('frame samples: flat frames have no spread; signatures are 32 × 18', () => {
    expect(flat(0).spread).toBeCloseTo(0, 3);
    expect(flat(0).sig.length).toBe(SIG_W * SIG_H);
    expect(drawn(0, 1).spread).toBeGreaterThan(10);
  });

  it('finds blank pictures and a stuck video, and leaves a moving one alone', () => {
    const times = frameTimes(10000, 90);
    expect(times.length).toBe(10);
    const moving: FrameSample[] = times.map((t, i) => drawn(t, i + 1));
    expect(checkFrames(moving, expectOf())).toEqual([]);
    const withBlank = moving.map((f, i) => (i === 4 ? flat(f.t) : f));
    expect(checkFrames(withBlank, expectOf())[0]).toMatchObject({ kind: 'blank', severity: 'error', message: 'Blank picture at 0:04.' });
    const stuck = times.map((t) => drawn(t, 3));
    expect(checkFrames(stuck, expectOf())[0]).toMatchObject({ kind: 'frozen', severity: 'error' });
    const long = frameTimes(60000);
    const holds = long.map((t, i) => drawn(t, i >= 20 && i < 32 ? 99 : i + 1)); // 12 s still in the middle
    expect(checkFrames(holds, expectOf({ durationMs: 60000 }))[0]).toMatchObject({ kind: 'frozen', severity: 'warn', message: 'The picture does not change from 0:20 to 0:31.' });
  });

  it('summary line: errors first, then a clean pass', () => {
    const bad = finishCheck({ durationMs: 10000, problems: [{ kind: 'gap', severity: 'warn', message: '5 s of silence from 0:03.' }, { kind: 'voice-missing', severity: 'error', atMs: 5000, message: 'Voice missing at 0:05.' }] });
    expect(bad.ok).toBe(false);
    expect(bad.problems[0].kind).toBe('voice-missing');
    expect(checkSummary(bad)).toBe('⚠ Problem found: Voice missing at 0:05. Also: 5 s of silence from 0:03.');
    expect(checkSummary(finishCheck({ durationMs: 42300, lufs: -14.2, problems: [] }))).toBe('Checked ✓ 42.3 s · sound -14 LUFS');
    expect(checkSummary({ checked: false, ok: true, reason: 'no decoder', problems: [] })).toBe('Not checked (no decoder).');
  });

  it('knows which steps lost their voice', () => {
    const req = { kind: 'arithmetic' as const, text: '12 + 34', lang: 'en' as const };
    const script = voiceScript(buildReel(req));
    const clips = new Map(script.slice(1).map((t) => [t, new Float32Array(R)]));
    const reel = buildReel(req, { voiceMs: (t) => (clips.has(t) ? 1000 : undefined) });
    const lost = unvoicedSteps(reel, clips);
    expect(lost.length).toBeGreaterThanOrEqual(1);
    expect(reelVoiceCues(reel).every((c) => clips.has(c.say))).toBe(true);
    expect(unvoicedSteps(reel, null)).toEqual([]);
  });
});
