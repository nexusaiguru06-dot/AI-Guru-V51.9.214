import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const item = (correct: boolean) => ({ id: 'q1', kind: 'twist', stem: 's', concept: 'c', chosen: 'A', answer: 'A', correct, toffees: 1, seconds: 3 });

describe('server store', () => {
  it('keeps both records when two quizzes finish at the same moment, and replaces a repeated id', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(mkdtempSync(path.join(tmpdir(), 'tq-')));
    const { addRecord, readAll } = await import('./server-store');
    await Promise.all([addRecord({ id: 'a', studentId: 's1', items: [item(true)] }), addRecord({ id: 'b', studentId: 's2', items: [item(false)] })]);
    await addRecord({ id: 'a', studentId: 's1', items: [item(false)] });
    const all = await readAll();
    expect(all.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(all.find((r) => r.id === 'a')!.pct).toBe(0);
    expect(await addRecord({ nonsense: true })).toBeNull();
  });
});
