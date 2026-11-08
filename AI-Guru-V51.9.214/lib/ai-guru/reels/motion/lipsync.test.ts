// @vitest-environment node
/** V51.9.100: the avatar's mouth follows the reel's own voice, frame by frame. */
import { describe, it, expect } from 'vitest';
import { blinkAt, BLINK_MS, mouthAt, mouthTrack, reelMouthTrack, reelVoiceTrack, TRACK_RATE } from './lipsync';
import { buildReel, clipMs, reelVoiceCues, voiceScript } from './index';
import { SFX_RATE } from './sfx';
import { setMeasurer } from './metrics';

const tone = (sec: number, f: number, amp: number, rate: number) => Float32Array.from({ length: Math.round(sec * rate) }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / rate));

describe('mouth track', () => {
  it('stays shut in silence, opens with speech, and closes again', () => {
    const rate = 16_000;
    const sig = new Float32Array(rate * 3);
    sig.set(tone(1, 160, 0.3, rate), rate); // speech-like from 1 s to 2 s
    const tr = mouthTrack(sig, rate, 30);
    expect(tr.open.length).toBe(90);
    expect(Math.max(...tr.open.slice(0, 25))).toBe(0);
    expect(Math.min(...tr.open.slice(36, 55))).toBeGreaterThan(0.5);
    expect(Math.max(...tr.open.slice(70))).toBeLessThan(0.05);
    // opens fast (attack) …
    expect(tr.open[32]).toBeGreaterThan(0.4);
  });

  it('tells "ee/s" sounds (many crossings) from "oo" sounds (low energy)', () => {
    const rate = 16_000;
    const hiss = mouthTrack(tone(1, 3200, 0.2, rate), rate, 30);
    const hum = mouthTrack(tone(1, 150, 0.2, rate), rate, 30);
    expect(hiss.wide[15]).toBeGreaterThan(0.8);
    expect(hum.wide[15]).toBeLessThan(0.1);
    expect(hum.round[15]).toBeGreaterThan(0.5);
    expect(hiss.round[15]).toBeLessThan(0.1);
  });

  it('louder speech opens the mouth wider', () => {
    const rate = 16_000;
    const soft = mouthTrack(tone(1, 200, 0.03, rate), rate, 30);
    const loud = mouthTrack(tone(1, 200, 0.4, rate), rate, 30);
    expect(loud.open[15]).toBeGreaterThan(soft.open[15] + 0.2);
  });

  it('reads between frames and outside the track safely', () => {
    const tr = mouthTrack(tone(1, 200, 0.3, 16_000), 16_000, 10);
    expect(mouthAt(null, 100)).toMatchObject({ open: 0 });
    expect(mouthAt(tr, -5).open).toBe(0);
    expect(mouthAt(tr, 99_999).open).toBe(0);
    const a = mouthAt(tr, 300).open, b = mouthAt(tr, 400).open, mid = mouthAt(tr, 350).open;
    expect(mid).toBeCloseTo((a + b) / 2, 5);
  });
});

describe('the reel clock', () => {
  setMeasurer((text, px) => text.length * px * 0.55);
  it('puts each voice clip where the mix puts it, so the lips move exactly while that step is spoken', () => {
    const silent = buildReel({ kind: 'arithmetic', text: '478 + 356', lang: 'en' });
    const script = voiceScript(silent);
    const clips = new Map(script.map((s, i) => [s, tone(0.6 + (i % 3) * 0.2, 180, 0.25, SFX_RATE)] as const));
    const reel = buildReel({ kind: 'arithmetic', text: '478 + 356', lang: 'en' }, { voiceMs: (t) => (clips.has(t) ? clipMs(clips.get(t)!) : undefined) });
    const track = reelVoiceTrack(reel, clips);
    expect(track.length).toBe(Math.ceil((reel.durationMs / 1000) * TRACK_RATE));
    const mouth = reelMouthTrack(reel, clips, 30)!;
    for (const c of reelVoiceCues(reel).filter((x) => clips.has(x.say)).slice(0, 4)) {
      expect(mouthAt(mouth, c.t + 250).open).toBeGreaterThan(0.3); // speaking
      if (c.t > 400) expect(mouthAt(mouth, c.t - 300).open).toBeLessThan(0.6); // before the step: closing / closed
    }
    expect(reelMouthTrack(reel, null)).toBeNull();
  });
});

describe('blinks', () => {
  it('are short, deterministic, and every few seconds', () => {
    const shut: number[] = [];
    for (let t = 0; t < 30_000; t += 10) if (blinkAt(t, 3) > 0.9) shut.push(t);
    const starts = shut.filter((t, i) => i === 0 || t - shut[i - 1] > 50);
    expect(starts.length).toBeGreaterThanOrEqual(5);
    expect(starts.length).toBeLessThanOrEqual(14);
    expect(blinkAt(12_345, 3)).toBe(blinkAt(12_345, 3));
    expect(blinkAt(-1)).toBe(0);
    // each blink lasts BLINK_MS
    const t0 = starts[1];
    let n = 0;
    for (let t = t0 - BLINK_MS; t < t0 + BLINK_MS; t += 5) if (blinkAt(t, 3) > 0) n++;
    expect(n * 5).toBeLessThanOrEqual(BLINK_MS + 10);
  });
});
