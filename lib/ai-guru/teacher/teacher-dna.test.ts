import { beforeEach, describe, expect, it } from 'vitest';
import { selectDna } from '../motion-class/dna/registry';
import { getLearned, removeLearned } from '../motion-class/dna/learned';
import { allPins, mergePins, pinKey, removePin, resetPins, setPin } from '../motion-class/dna/teacher-dna';
import { analyseFrames, cleanVideoStyle, draftToLearned, SEGMENT_DNAS } from './video-style';
import { cleanPins, cleanTemplates } from './dna-server';
import { problemBlock, selectionFor, splitProblems } from './make-video';
import { saveLearned } from '../motion-class/dna/learned';

const P = 'Find the HCF and LCM of 12 and 18.';
beforeEach(() => resetPins());

describe('teacher pins', () => {
  it('keys ignore case and spacing', () => expect(pinKey('Find  the HCF')).toBe(pinKey(' find the hcf ')));
  it('a pin wins over the automatic choice, and removing it restores it', () => {
    const auto = selectDna(problemBlock(P, 0));
    expect(auto.dna).not.toBe('square-identity');
    setPin(P, 'square-identity');
    const pinned = selectDna(problemBlock(`  ${P.toUpperCase()} `, 1));
    expect(pinned).toMatchObject({ dna: 'square-identity', score: 1, reason: 'chosen by the teacher' });
    expect(pinned.ranked.length).toBeGreaterThan(0); // the lab can still show how the rules scored it
    removePin(P);
    expect(selectDna(problemBlock(P, 0)).dna).toBe(auto.dna);
  });
  it('a pin on a template that no longer exists is ignored', () => {
    setPin(P, 'learned:gone');
    expect(selectDna(problemBlock(P, 0)).dna).not.toBe('learned:gone');
  });
  it('merge keeps the newer pin for the same problem', () => {
    mergePins([{ key: 'k', preview: 'p', dna: 'a', at: '2026-01-02' }]);
    mergePins([{ key: 'k', preview: 'p', dna: 'b', at: '2026-01-01' }]);
    expect(allPins()[0].dna).toBe('a');
  });
});

describe('video templates', () => {
  const ids = SEGMENT_DNAS.slice(0, 3).map((d) => d.id as string);
  const good = { name: 'Balance then solve', description: 'd', subject: 'algebra', keywords: ['equation', 'solve'], segments: [ids[0], 'not-a-dna', ids[0], ids[1]], stepsOutline: ['a', 'b'], pace: 'slow', styleNotes: 'Reveal one step at a time.' };
  it('keeps only real, distinct DNA ids', () => expect(cleanVideoStyle(good)?.segments).toEqual([ids[0], ids[1]]));
  it('refuses an answer with no usable part or no name', () => {
    expect(cleanVideoStyle({ ...good, segments: ['x'] })).toBeNull();
    expect(cleanVideoStyle({ ...good, name: '' })).toBeNull();
    expect(cleanVideoStyle('nope')).toBeNull();
  });
  it('analyseFrames retries once, then gives a draft', async () => {
    let n = 0;
    const d = await analyseFrames([], async () => (++n === 1 ? 'not json' : JSON.stringify(good)));
    expect(n).toBe(2);
    expect(d.pace).toBe('slow');
    await expect(analyseFrames([], async () => '{}')).rejects.toThrow(/Could not learn/);
  });
  it('a saved template is picked for a problem when chosen, and its prompt carries the video style', () => {
    const t = draftToLearned(cleanVideoStyle(good)!, 'lesson.mp4');
    expect(t).toMatchObject({ source: 'teacher-video', id: 'video-balance-then-solve' });
    saveLearned(t);
    const sel = selectionFor(problemBlock(P, 0), `learned:${t.id}`);
    expect(sel).toMatchObject({ dna: `learned:${t.id}`, needsAi: false });
    expect(getLearned(t.id)?.styleNotes).toMatch(/^slow pace\./);
    removeLearned(t.id);
  });
});

describe('server clean-up', () => {
  it('accepts only video templates and trims pins', () => {
    const t = cleanTemplates([{ id: 'video-a', source: 'teacher-video', name: 'A', segments: ['x'] }, { id: 'b', source: 'ai', segments: ['x'] }, { id: 'c', source: 'teacher-video', segments: [] }]);
    expect(t.map((x) => x.id)).toEqual(['video-a']);
    expect(cleanPins([{ key: 'k', dna: 'd' }, { dna: 'no key' }])).toHaveLength(1);
  });
});

describe('splitProblems', () => {
  it('splits on blank lines', () => expect(splitProblems('Solve x + 1 = 3.\n\nFind the HCF of 4 and 6.')).toHaveLength(2));
  it('splits numbered lines and drops the numbers', () => expect(splitProblems('1. Solve x + 1 = 3.\n2) Find the HCF of 4 and 6.\nQ3. Add 1/2 and 1/3 please')).toEqual(['Solve x + 1 = 3.', 'Find the HCF of 4 and 6.', 'Add 1/2 and 1/3 please']));
  it('ignores empty input and tiny fragments', () => { expect(splitProblems('  ')).toEqual([]); expect(splitProblems('a\n\nb')).toEqual([]); });
});
