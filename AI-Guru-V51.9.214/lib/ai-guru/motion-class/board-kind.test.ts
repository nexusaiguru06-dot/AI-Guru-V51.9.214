import { describe, expect, it } from 'vitest';
import { passageBlocks } from './passage';
import { selectDna } from './dna/registry';
import { offlinePlan } from './plan/offline';
import { splitRuns, boardKindOf } from './board-kind';
import type { BlockPlan } from './dna/types';

const TEXT = `Pairs of Equations. Mental math and algebra. Let's start with a problem: There are 100 beads, black and white, in a box; 10 more black than white. How many black and how many white? This can be thought out in different ways. Taking the number of black beads as x, the number of white is x - 10. Since there are 100 altogether, x + (x - 10) = 100. We can extract x from this: 2x - 10 = 100, 2x = 110, x = 55.`;

describe('board kind (lecture vs problem)', () => {
  const blocks = passageBlocks(TEXT, 'Pairs of Equations', 'bk');
  const plans = new Map<string, BlockPlan>();
  for (const b of blocks) plans.set(b.id, offlinePlan(b, 'Pairs of Equations', 'Pairs of Equations', selectDna(b, 'Pairs of Equations')));

  it('splits into runs that keep the order and lose no block', () => {
    const runs = splitRuns(blocks, plans);
    expect(runs.flatMap((r) => r.blocks).map((b) => b.id)).toEqual(blocks.map((b) => b.id));
    for (let i = 1; i < runs.length; i++) expect(runs[i].kind).not.toBe(runs[i - 1].kind);
  });

  it('a worked equation goes to the problem board, plain talk to the lecture board', () => {
    const kinds = blocks.map((b) => boardKindOf(plans.get(b.id)));
    expect(kinds).toContain('problem');
    expect(boardKindOf(undefined)).toBe('lecture');
  });

  it('a bridge sentence follows the board of the block after it', () => {
    const runs = splitRuns(blocks, plans);
    for (const r of runs) {
      const last = r.blocks[r.blocks.length - 1];
      if (plans.get(last.id)?.dna === 'bridge' && r !== runs[runs.length - 1]) throw new Error('a run ends on a bridge');
    }
  });
});
