import { describe, expect, it } from 'vitest';
import type { VisualAction } from '../lesson/types';
import { estimateSpeechMs, fitTiming, formatIssues, verifyVisualActions } from './verify';

const line = (id: string, o: Partial<Extract<VisualAction, { type: 'line' }>> = {}): VisualAction => ({ type: 'line', id, startX: 100, startY: 100, endX: 300, endY: 300, ...o });
const codes = (a: unknown, o = {}) => verifyVisualActions(a, o).issues.map((i) => i.code);

describe('dry-run verification', () => {
  it('accepts a valid set', () => {
    expect(verifyVisualActions([line('a'), { type: 'write', id: 'b', content: 'x', x: 500, y: 300, placement: 'absolute' } as VisualAction]).ok).toBe(true);
  });
  it('catches everything that would break on the board', () => {
    expect(codes('nope')).toContain('NOT_ARRAY');
    expect(codes([line('a'), line('a')])).toContain('DUPLICATE_ID');
    expect(codes([{ type: 'spiral', id: 's' }])).toContain('UNKNOWN_TYPE');
    expect(codes([line('a', { endX: 5000 })])).toContain('OUT_OF_BOARD');
    expect(codes([line('a', { endX: NaN })])).toContain('MISSING_FIELD');
    expect(codes([{ type: 'write', id: 'w', content: '  ', x: 1, y: 1 }])).toContain('EMPTY_TEXT');
    expect(codes([{ type: 'shape', id: 's', shape: 'circle', x: 10, y: 10, width: -4, height: 4 }])).toContain('BAD_SIZE');
    expect(codes([{ type: 'chart', id: 'c', chartType: 'bar', x: 0, y: 0, width: 1, height: 1, data: { labels: [], legends: [], series: [['a']] } }])).toContain('BAD_CHART_DATA');
    expect(codes([line('a', { durationMs: -1 })])).toContain('BAD_DURATION');
    expect(codes([{ type: 'write', id: 'w', content: 'x', x: 1, y: 1, placement: 'absolute' }, { type: 'pause', id: '' }])).toContain('MISSING_ID');
  });
  it('warns (does not fail) about softer problems', () => {
    const r = verifyVisualActions([line('a', { startX: 10 }), { type: 'highlight', id: 'h', targetId: 'ghost' } as VisualAction]);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['OUTSIDE_SAFE_AREA', 'DANGLING_TARGET']));
  });
  it('resolves targets against ids already on the board', () => {
    expect(codes([{ type: 'erase', id: 'e', targetId: 'earlier' }], { knownIds: ['earlier'] })).not.toContain('DANGLING_TARGET');
  });
  it('flags overlapping labels', () => {
    const t = (id: string, c: string) => ({ type: 'write', id, content: c, x: 400, y: 300, placement: 'absolute' }) as VisualAction;
    expect(codes([t('a', '3'), t('b', '4')])).toContain('OVERLAPPING_LABELS');
  });
  it('formats issues for retry prompts', () => {
    expect(formatIssues(verifyVisualActions([line('a', { endX: 9000 })]).issues)).toMatch(/OUT_OF_BOARD \(a\)/);
  });
});

describe('timing contract', () => {
  const acts = [line('a'), line('b'), { type: 'pause', id: 'p', durationMs: 500 } as VisualAction, { type: 'write', id: 'w', content: 'x', x: 5, y: 5 } as VisualAction];
  it('makes the animation last as long as the narration', () => {
    const out = fitTiming(acts, 6000);
    const total = out.reduce((s, a) => s + ((a as { durationMs?: number }).durationMs ?? 0), 0);
    expect(Math.abs(total - 6000)).toBeLessThan(10);
    expect(out.find((a) => a.type === 'pause')).toMatchObject({ durationMs: 500 });
  });
  it('keeps every action within sane bounds', () => {
    for (const total of [200, 60000]) for (const a of fitTiming(acts, total)) if (a.type !== 'pause') expect((a as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(120), expect((a as { durationMs: number }).durationMs).toBeLessThanOrEqual(4000);
  });
  it('estimates speech length, Malayalam slower', () => {
    expect(estimateSpeechMs('one two three four five')).toBe(2000);
    expect(estimateSpeechMs('one two three four five', 'malayalam')).toBeGreaterThan(2000);
  });
});
