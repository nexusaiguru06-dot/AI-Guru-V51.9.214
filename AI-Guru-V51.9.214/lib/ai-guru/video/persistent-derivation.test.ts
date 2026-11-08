import { describe, expect, it } from 'vitest';
import { buildPersistentDerivation } from './persistent-derivation';
import { ncertClass10QuadraticLesson } from '../e2e/ncert-class10';

describe('persistent derivation', () => {
  it('keeps every completed step and places the next step below it', () => {
    const lines = buildPersistentDerivation(['3x + 4 = 17', '3x = 17 − 4', '3x = 13', 'x = 13/3']);
    expect(lines.map(l => l.id)).toEqual(['derivation-1','derivation-2','derivation-3','derivation-4']);
    expect(lines.map(l => l.y)).toEqual([100,205,310,415]);
    expect(lines[1].derivedFromId).toBe('derivation-1');
    expect(lines.every(l => l.persistent)).toBe(true);
  });

  it('marks the NCERT transformations as cumulative rather than replacement transforms', () => {
    const visuals = ncertClass10QuadraticLesson.paragraphs[0].english.visuals;
    const transforms = visuals.filter(v => v.type === 'transform');
    expect(transforms).toHaveLength(3);
    expect(transforms.every(v => v.type === 'transform' && v.retainFrom === true)).toBe(true);
    expect(transforms.map(v => v.derivedLineIndex)).toEqual([1,2,3]);
  });
});


it('uses a persistent caption beside every visible derivation line', () => {
  const lines = buildPersistentDerivation(['3x + 4 = 17', '3x = 17 − 4', '3x = 13']);
  expect(lines).toHaveLength(3);
  expect(lines.every(line => line.persistent)).toBe(true);
  expect(lines.map(line => line.y)).toEqual([100, 205, 310]);
});
