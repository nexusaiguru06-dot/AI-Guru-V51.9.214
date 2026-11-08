import { describe, expect, it } from 'vitest';
import { compileClass } from './class';
import { prepareSegment } from './player';
import { buildClassTimeline } from './interactive-player';
import type { BlockPlan } from './dna/types';
import type { BookBlock } from './segment';
import { HL_SAMPLE_12_18 } from './samples/hcf-lcm';
import { BAL_TWO_STEP_SAMPLE } from './samples/balance-scale';
import { placeQuestions } from './interactive/questions';
import { offlinePackData, offlinePackHtml, packBitrate, scriptJson } from './offline-pack';

const block = (id: string, text: string): BookBlock => ({ id, kind: 'problem', page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const plan = (blockId: string, dna: string, teach: unknown): BlockPlan => ({ blockId, dna, teach, read: { en: 'Read </script> this.', ml: 'ഇത് വായിക്കുക.' }, source: 'offline' }) as unknown as BlockPlan;
const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;

async function sample() {
  const blocks = [block('h', 'HCF and LCM of 12 and 18'), block('s', 'Solve 2x + 5 = 25')];
  const plans = new Map([
    ['h', plan('h', 'hcf-lcm', HL_SAMPLE_12_18)],
    ['s', plan('s', 'balance-scale', BAL_TWO_STEP_SAMPLE)],
  ]);
  const segs = compileClass(blocks, plans, { title: 'T' });
  const tl = buildClassTimeline('T', await Promise.all(segs.map((s) => prepareSegment(s, false))));
  return { tl, qs: placeQuestions(tl, plans) };
}

describe('offline class pack', () => {
  it('carries every step, segment and question; tap targets are in video pixels', async () => {
    const { tl, qs } = await sample();
    const d = offlinePackData(tl, qs, { title: 'HCF <and> LCM', book: 'SCERT IX', chapter: 'Ch 1', section: '1.1' }, { ctx: noop, now: new Date('2026-10-13T00:00:00Z') });
    expect(d.steps.length).toBe(tl.steps.length);
    expect(d.segments.length).toBe(tl.segments.length);
    expect(d.durationMs).toBe(Math.round(tl.reel.durationMs));
    expect(d.questions.length).toBe(qs.length);
    const tap = d.questions.find((q) => q.kind === 'tap')!;
    expect(tap.targets!.length).toBeGreaterThan(0);
    for (const t of tap.targets!) {
      expect(t.x).toBeGreaterThan(0);
      expect(t.x).toBeLessThan(d.width);
      expect(t.y).toBeGreaterThan(0);
      expect(t.y).toBeLessThan(d.height);
    }
    for (const q of d.questions) expect(q.prompt.length).toBeGreaterThan(5);
    // Same class → same id (progress on the phone survives re-exports).
    const again = offlinePackData(tl, qs, { title: 'HCF <and> LCM', book: 'SCERT IX', chapter: 'Ch 1', section: '1.1' }, { ctx: noop });
    expect(again.id).toBe(d.id);
  });
  it('a tap question without a canvas to measure is left out rather than asked blind', async () => {
    const { tl, qs } = await sample();
    const d = offlinePackData(tl, qs, { title: 'T' });
    expect(d.questions.every((q) => q.kind === 'choice')).toBe(true);
  });
  it('the HTML is one self-contained document; nothing in the data can close the script tag', async () => {
    const { tl, qs } = await sample();
    const d = offlinePackData(tl, qs, { title: 'HCF <and> LCM', section: 'x</script><b>' }, { ctx: noop });
    const html = offlinePackHtml(d, 'AAAA');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>HCF &lt;and&gt; LCM</title>');
    expect(html.match(/<\/script>/g)!.length).toBe(3); // data, video, player — nothing else closes a script
    expect(html).not.toMatch(/src="https?:/); // no network
    expect(html).not.toMatch(/href="https?:/);
    const json = html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/)![1];
    expect(JSON.parse(json).steps.length).toBe(d.steps.length);
    const ls = String.fromCharCode(0x2028);
    const safe = scriptJson({ a: `</script>${ls}` });
    expect(safe).not.toContain('</');
    expect(safe).not.toContain(ls);
  });
  it('picks a phone-sized bitrate', () => {
    expect(packBitrate(60_000)).toBe(900_000);
    expect(packBitrate(20 * 60_000)).toBeLessThanOrEqual(250_000);
    const five = packBitrate(5 * 60_000);
    expect(((five + 96_000) * 300) / 8).toBeLessThanOrEqual(20_000_000 * 1.01);
    expect(packBitrate(60 * 60_000)).toBe(250_000); // quality floor for very long classes
  });
});
