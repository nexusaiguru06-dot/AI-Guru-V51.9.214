import { describe, expect, it } from 'vitest';
import {
  BRANCH_EXAMPLES,
  buildAddition,
  buildDivision,
  buildMultiplication,
  buildReel,
  buildSubtraction,
  CHAPTER_INTROS,
  evalItem,
  mixReelAudio,
  parseArithmetic,
  reelSubtitleCues,
  reelVoiceCues,
  speakable,
  toSrt,
  voiceScript,
  sceneStateAt,
  verifyDerivation,
  type MotionScene,
} from './index';

/** Deterministic pseudo-random integers. */
function rng(seed: number) {
  let s = seed;
  return (lo: number, hi: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return lo + (s % (hi - lo + 1));
  };
}

/** The text that the answer box ends up around = the result row, read left to right. */
function finalTexts(scene: MotionScene, idPrefix: RegExp): string {
  const t = scene.durationMs;
  return scene.items
    .filter((it) => idPrefix.test(it.id))
    .map((it) => evalItem(it, t))
    .filter((s) => s.alpha > 0.5)
    .sort((a, b) => a.x - b.x)
    .map((s) => s.text)
    .join('');
}

describe('arithmetic recipes produce the right answer on screen', () => {
  const r = rng(7);
  it('addition (2–4 numbers, carries)', () => {
    for (let i = 0; i < 60; i++) {
      const nums = Array.from({ length: r(2, 4) }, () => r(0, 99999));
      const scene = buildAddition(nums);
      const sum = nums.reduce((a, b) => a + b, 0);
      expect(finalTexts(scene, /^s(r\d+|r\d+c)$/)).toBe(String(sum));
      expect(scene.durationMs).toBeLessThan(90_000);
    }
  });
  it('subtraction (borrows through zeros, negative answers)', () => {
    for (const [a, b] of [[503, 278], [1000, 1], [52, 87], [700, 700], [90001, 9999], [45, 3]]) {
      const scene = buildSubtraction(a, b);
      const diff = Math.abs(a - b);
      const shown = finalTexts(scene, /^(r\d+|neg)$/);
      expect(shown).toBe(a < b ? `−${diff}` : String(diff));
    }
    for (let i = 0; i < 60; i++) buildSubtraction(r(0, 999999), r(0, 999999)); // throws on any mismatch
  });
  it('multiplication (single and multi-digit multipliers)', () => {
    for (let i = 0; i < 60; i++) {
      const a = r(0, 9999);
      const b = r(0, 999);
      buildMultiplication(a, b); // the recipe checks every partial row and the final sum
    }
    const scene = buildMultiplication(347, 26);
    expect(finalTexts(scene, /^fr\d+c?$/)).toBe('9022');
  });
  it('long division (zeros in the quotient, remainders)', () => {
    for (let i = 0; i < 60; i++) buildDivision(r(0, 999999), r(1, 99));
    expect(finalTexts(buildDivision(7385, 6), /^q\d+$/)).toBe('1230');
    expect(finalTexts(buildDivision(1260, 12), /^q\d+$/)).toBe('105');
  });
});

describe('branch catalogue', () => {
  it.each(BRANCH_EXAMPLES.map((e) => [e.id, e] as const))('every line of %s is mathematically true', (_id, ex) => {
    const checks = verifyDerivation(ex.input, ex.solutions);
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });
  it('the checker rejects a wrong line', () => {
    const ex = BRANCH_EXAMPLES.find((e) => e.id === 'linear-equation')!;
    const broken = structuredClone(ex.input);
    broken.lines[2].tokens = ['2', 'x', '=', '30'];
    expect(verifyDerivation(broken, ex.solutions).some((c) => !c.ok)).toBe(true);
    expect(() => buildReel({ kind: 'derivation', input: broken, solutions: ex.solutions })).toThrow(/Maths check failed/);
  });
  it('every branch builds a reel under 60 s in both languages', () => {
    for (const ex of BRANCH_EXAMPLES) {
      for (const lang of ['en', 'ml'] as const) {
        const reel = buildReel({ kind: 'branch', id: ex.id, lang });
        expect(reel.durationMs).toBeLessThan(60_000);
      }
    }
  });
});

describe('chapter intros', () => {
  it.each(CHAPTER_INTROS.map((c) => [c.id, c] as const))('%s builds in English and Malayalam', (_id, ch) => {
    for (const lang of ['en', 'ml'] as const) {
      const reel = buildReel({ kind: 'intro', intro: ch.intro[lang], example: { branchId: ch.exampleId, lang } });
      expect(reel.parts).toHaveLength(2);
      expect(reel.durationMs).toBeLessThan(75_000);
    }
  });
});

describe('engine', () => {
  it('is a pure function of time (scrub-safe, export = preview)', () => {
    const a = buildMultiplication(243, 3);
    const b = buildMultiplication(243, 3);
    for (const t of [0, 1234, 5000, 9876, a.durationMs]) {
      expect(sceneStateAt(a, t)).toEqual(sceneStateAt(b, t));
      expect(sceneStateAt(a, t)).toEqual(sceneStateAt(a, t));
    }
  });
  it('captions cover the whole reel without gaps', () => {
    const s = buildDivision(7385, 6);
    for (let i = 1; i < s.captions.length; i++) expect(s.captions[i].t0).toBe(s.captions[i - 1].t1);
    expect(s.captions[s.captions.length - 1].t1).toBe(s.durationMs);
  });
});

describe('parseArithmetic', () => {
  it('reads what students type', () => {
    expect(parseArithmetic('478 + 356')).toEqual({ op: 'add', nums: [478, 356] });
    expect(parseArithmetic('503−278 =')).toEqual({ op: 'sub', a: 503, b: 278 });
    expect(parseArithmetic('347 x 26')).toEqual({ op: 'mul', a: 347, b: 26 });
    expect(parseArithmetic('1,260 / 12 = ?')).toEqual({ op: 'div', a: 1260, b: 12 });
    expect(parseArithmetic('2x + 5 = 25')).toBeNull();
  });
});


describe('voice-over', () => {
  it('reads maths aloud in English and Malayalam', () => {
    expect(speakable('25 − 5 = 20', 'en')).toBe('25 minus 5 equals 20');
    expect(speakable('Move +5 to the other side. It becomes −5.', 'en')).toBe('Move plus 5 to the other side. It becomes minus 5.');
    expect(speakable('In a right triangle, a² + b² = c².', 'en')).toBe('In a right triangle, A squared plus b squared equals c squared.');
    expect(speakable('1/2 + 1/3', 'en')).toBe('1 over 2 plus 1 over 3');
    expect(speakable('How many 12s in 12?', 'en')).toBe('How many 12s in 12?');
    expect(speakable('25 − 5 = 20', 'ml')).toBe('25 മൈനസ് 5 സമം 20');
    expect(speakable('ലക്ഷ്യം: x-നെ മാത്രം ഒരു വശത്ത് കിട്ടണം.', 'ml')).toBe('ലക്ഷ്യം: എക്സിനെ മാത്രം ഒരു വശത്ത് കിട്ടണം.');
    expect(speakable('(x + 2)(x + 3)', 'ml')).toBe('ബ്രാക്കറ്റ് എക്സ് പ്ലസ് 2, ഗുണം ബ്രാക്കറ്റ് എക്സ് പ്ലസ് 3');
  });

  it('every Malayalam reel is spoken in Malayalam (no English sentences)', () => {
    const reqs = [
      ...BRANCH_EXAMPLES.map((e) => ({ kind: 'branch' as const, id: e.id, lang: 'ml' as const })),
      ...['478 + 356', '503 - 278', '347 x 26', '7385 / 6'].map((text) => ({ kind: 'arithmetic' as const, text, lang: 'ml' as const })),
      ...CHAPTER_INTROS.map((c) => ({ kind: 'intro' as const, intro: c.intro.ml, lang: 'ml' as const, example: { branchId: c.exampleId } })),
    ];
    for (const r of reqs) {
      for (const line of voiceScript(buildReel(r))) expect(line, line).not.toMatch(/[A-Za-z]{3,}/);
    }
  });

  it('steps wait for their voice clip; clips never overlap', () => {
    const req = { kind: 'branch' as const, id: 'pair-of-equations', lang: 'en' as const };
    const silent = buildReel(req);
    const voiced = buildReel(req, { voiceMs: (t) => 1500 + t.length * 60 });
    const cues = reelVoiceCues(voiced);
    expect(cues.length).toBe(voiceScript(silent).length);
    for (let i = 1; i < cues.length; i++) expect(cues[i].t).toBeGreaterThanOrEqual(cues[i - 1].t + cues[i - 1].ms);
    expect(voiced.durationMs).toBeGreaterThan(silent.durationMs);
    expect(voiced.durationMs).toBeGreaterThanOrEqual(cues[cues.length - 1].t + cues[cues.length - 1].ms);
    // Every caption is on screen for its whole clip.
    for (const c of voiced.parts[0].captions) expect(c.t1).toBeGreaterThanOrEqual((c.voiceT0 ?? 0) + (c.voiceMs ?? 0));
  });

  it('second caption line in the other language + subtitle file', () => {
    const reel = buildReel({ kind: 'branch', id: 'pair-of-equations', lang: 'ml' }, { subtitleFrom: { kind: 'branch', id: 'pair-of-equations', lang: 'en' } });
    const caps = reel.parts[0].captions;
    expect(caps[0].sub).toBe('Two equations, two unknowns. First equation.');
    expect(caps[4].sub).toBeUndefined(); // "12 ÷ 2 = 6" is the same in both languages
    const srt = toSrt(reelSubtitleCues(reel));
    expect(srt.startsWith('1\n00:00:00,')).toBe(true);
    expect(srt).toContain('Two equations, two unknowns.');
  });

  it('mixes each clip at its cue', () => {
    const req = { kind: 'arithmetic' as const, text: '12 + 34', lang: 'en' as const };
    const script = voiceScript(buildReel(req));
    const clip = new Float32Array(48000).fill(0.5); // 1 s of "voice"
    const clips = new Map(script.map((t) => [t, clip]));
    const reel = buildReel(req, { voiceMs: () => 1000 });
    const audio = mixReelAudio(reel, clips, { music: false });
    const cue = reelVoiceCues(reel)[1];
    const at = Math.round(((cue.t + 500) / 1000) * 48000);
    expect(Math.abs(audio[at])).toBeGreaterThan(0.3);
  });
});
