import { describe, expect, it } from 'vitest';
import { orderSectionsBySource } from './section-order';

const src = ['S1_1', 'S1_2', 'S1_3', 'S2_1'].map(id => ({ id }));
describe('orderSectionsBySource', () => {
  it('restores source order and is stable', () => {
    const out = orderSectionsBySource([
      { h: 'c', sourceIds: ['S1_3'] }, { h: 'a', sourceIds: ['S1_1'] }, { h: 'b2', sourceIds: ['S1_2'] }, { h: 'b1', sourceIds: ['S1_2'] }, { h: 'd', sourceIds: ['S2_1'] },
    ], src);
    expect(out.map(s => s.h)).toEqual(['a', 'b2', 'b1', 'c', 'd']);
  });
  it('a section citing nothing valid stays beside the one before it', () => {
    const out = orderSectionsBySource([{ h: 'a', sourceIds: ['S1_1'] }, { h: 'x', sourceIds: ['nope'] }, { h: 'b', sourceIds: ['S1_2'] }], src);
    expect(out.map(s => s.h)).toEqual(['a', 'x', 'b']);
  });
});
