import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { docs } from '../storage';
import { passageHash } from '../motion-class/plan-hash';
import { blocksOfSection, passageOf, planKeyOf, planStatus, planStep, readBoardPlan, type BoardPlanRecord } from './board-plan';
import type { StudyMaterial } from './types';

const TEXT = 'Let us start with a problem. There are 100 beads in a box. Ten more are black than white. How many are white? We can use algebra. Take the white beads as x. Then black is x plus 10. So 2x plus 10 is 100. Therefore x is 45. Check it: 45 plus 55 is 100.';
const material = { id: 'material:t1', documentId: 'doc:t1', title: 'Pairs of equations', sections: [{ id: 's1', heading: 'Beads', content: TEXT, sourceText: TEXT, sourceIds: [], visuals: [] }] } as unknown as StudyMaterial;

beforeAll(() => { process.env.AI_GURU_DATA_ROOT = mkdtempSync(path.join(tmpdir(), 'agbp-')); });

describe('V51.9.209 server lesson plans', () => {
  it('a new section has every block still to plan', async () => {
    const [st] = await planStatus(material);
    expect(st.blocks).toBeGreaterThan(1);
    expect(st.todo).toEqual(st.todo.map((_, i) => i));
    expect(st.complete).toBe(false);
  });
  it('a failing AI call is reported and nothing half-made is kept', async () => {
    await expect(planStep(material, 0, 'block', 0, 'k', async () => { throw new Error('quota'); })).rejects.toThrow();
    expect((await planStatus(material))[0].planned).toBe(0);
    await expect(planStep(material, 5, 'block', 0, 'k')).rejects.toThrow('No such section');
  });
  it('the classroom gets a plan only when every block and the subject step are done and the text is the same', async () => {
    const sec = material.sections[0];
    const blocks = blocksOfSection(sec);
    const h = passageHash(passageOf(sec));
    const rec: BoardPlanRecord = { v: 1, materialId: material.id, sectionId: 's1', passageHash: h, blockIds: blocks.map((b) => b.id), plans: { [blocks[0].id]: { x: 1 } as never }, madeAt: 'now' };
    await docs.put(planKeyOf(material.id, 's1'), rec);
    expect(await readBoardPlan(material, 's1', h)).toBeNull(); // blocks missing
    for (const b of blocks) rec.plans[b.id] = { x: 1 } as never;
    await docs.put(planKeyOf(material.id, 's1'), rec);
    expect(await readBoardPlan(material, 's1', h)).toBeNull(); // subject agents not yet
    rec.subjects = [];
    await docs.put(planKeyOf(material.id, 's1'), rec);
    const ok = await readBoardPlan(material, 's1', h);
    expect(ok?.plans.length).toBe(blocks.length);
    expect(await readBoardPlan(material, 's1', h + 1)).toBeNull(); // the text changed
    expect(await readBoardPlan(material, 'nope', h)).toBeNull();
    expect((await planStatus(material))[0].complete).toBe(true);
  });
});
