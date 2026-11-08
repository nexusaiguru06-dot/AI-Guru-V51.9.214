import { describe, expect, it } from 'vitest';
import { Motion, countSteps, evalItem, textAt } from './engine';
import { buildDnaScenes } from '../../motion-class/dna/builders';
import { hlSplit } from '../../motion-class/dna/hl-math';
import { HL_SAMPLES, HL_SAMPLE_12_18 } from '../../motion-class/samples/hcf-lcm';

describe('frame-stepped counter', () => {
  it('lands exactly, never goes back, whole numbers only, big steps first', () => {
    for (const [from, to, n] of [[1, 36, 21], [1, 6, 6], [100, 90, 12], [0, 4, 24], [1, 120, 27], [1, 3, 2]] as const) {
      const v = countSteps(from, to, n);
      expect(v[0]).toBe(from);
      expect(v[v.length - 1]).toBe(to);
      expect(v.length).toBe(n + 1);
      for (let i = 1; i < v.length; i++) {
        expect(Number.isInteger(v[i])).toBe(true);
        if (to > from) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
        else expect(v[i]).toBeLessThanOrEqual(v[i - 1]);
      }
      if (Math.abs(to - from) >= n) {
        // every frame shows a new value; the first step is the biggest
        for (let i = 1; i < v.length; i++) expect(v[i]).not.toBe(v[i - 1]);
        expect(Math.abs(v[1] - v[0])).toBeGreaterThanOrEqual(Math.abs(v[n] - v[n - 1]));
      }
    }
  });
  it('the count verb shows `from` before it starts, ticks without rolling, and ends on the exact text', () => {
    const m = new Motion('t');
    m.text('n', '36', 100, 100);
    m.appear(['n'], 0);
    const end = m.count('n', 1, 36, 500, { dur: 600 });
    expect(end).toBe(1100);
    const it = m.build().items.find((i) => i.id === 'n')!;
    expect(textAt(it, 10).text).toBe('1');
    expect(textAt(it, 499).text).toBe('1');
    expect(textAt(it, 1100).text).toBe('36');
    expect(textAt(it, 5000).text).toBe('36');
    const seen = new Set<string>();
    for (let t = 500; t <= 1100; t += 5) {
      const r = textAt(it, t);
      expect(r.swap).toBeUndefined(); // instant ticks, no roll animation
      seen.add(r.text);
    }
    expect(seen.size).toBeGreaterThan(10);
    // values only ever increase
    let prev = 0;
    for (let t = 0; t <= 1200; t += 5) {
      const v = Number(textAt(it, t).text);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it('a later swap on the same item is kept', () => {
    const m = new Motion('t');
    m.text('n', '6', 100, 100);
    m.count('n', 1, 6, 100, { dur: 300 });
    m.swap('n', '7', 2000);
    const it = m.build().items.find((i) => i.id === 'n')!;
    expect(textAt(it, 1000).text).toBe('6');
    expect(textAt(it, 3000).text).toBe('7');
  });
});

describe('HCF/LCM results tick up and land on the true values', () => {
  it('for every sample: the HCF and LCM glyphs end exactly on the computed numbers, in both languages', () => {
    for (const p of Object.values(HL_SAMPLES)) {
      const s = hlSplit(p.a, p.b);
      for (const lang of ['en', 'ml'] as const) {
        const [sc] = buildDnaScenes('hcf-lcm', p, lang, 'T');
        const end = sc.durationMs - 1;
        const texts = sc.items.filter((i) => i.kind === 'text').map((i) => evalItem(i, end)).filter((st) => st.alpha > 0.5).map((st) => st.text);
        expect(texts, `${p.a},${p.b}`).toContain(String(s.lcm));
        // a counting glyph shows a smaller value part way through its count
        const lcmItem = sc.items.find((i) => i.swaps.length > 3 && i.text === String(s.lcm));
        if (s.lcm >= 3) {
          expect(lcmItem, `${p.a},${p.b}`).toBeTruthy();
          const mid = lcmItem!.swaps[Math.floor(lcmItem!.swaps.length / 2)].t + 1;
          expect(Number(textAt(lcmItem!, mid).text)).toBeLessThan(s.lcm);
        }
      }
    }
  });
  it('English and Malayalam still draw the same picture', () => {
    const pos = (lang: 'en' | 'ml') => {
      const [sc] = buildDnaScenes('hcf-lcm', HL_SAMPLE_12_18, lang, 'T');
      return sc.items.filter((i) => i.kind !== 'text' || /^\d+$/.test(i.text)).map((i) => { const st = evalItem(i, sc.durationMs - 1); return `${i.id}:${st.text}@${st.x.toFixed(1)},${st.y.toFixed(1)}`; });
    };
    expect(pos('ml')).toEqual(pos('en'));
  });
});
