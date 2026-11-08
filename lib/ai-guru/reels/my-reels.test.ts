import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { addPart, addVideo, deletePart, deleteVideo, getVideo, listParts, listVideos } from './my-reels';
import type { ClassClip } from './class-clip';

const clip = (nth: number, madeAt = `2026-10-27T0${nth}:00:00Z`): ClassClip => ({ v: 1, title: 'Pairs', kind: 'problem', nth, blocks: [], plans: {}, subject: {}, languages: ['en'], madeAt });

describe('my reels library (V51.9.152)', () => {
  it('keeps whiteboard parts, once each, newest first, and deletes them', async () => {
    await addPart(clip(1));
    await addPart(clip(2));
    await addPart(clip(1)); // the same part again
    const parts = await listParts();
    expect(parts.map((p) => p.nth)).toEqual([1, 2]);
    await deletePart(parts[1].id);
    expect((await listParts()).map((p) => p.nth)).toEqual([1]);
  });
  it('keeps videos by way, gives them back, and deletes them', async () => {
    const a = await addVideo({ title: 'P1', way: 'whiteboard', name: 'p1.mp4', blob: new Blob(['x'.repeat(10)], { type: 'video/mp4' }) });
    await addVideo({ title: 'Styled', way: 'style', name: 's.mp4', blob: new Blob(['y'], { type: 'video/mp4' }) });
    expect((await listVideos('whiteboard')).map((v) => v.title)).toEqual(['P1']);
    expect((await listVideos(['design', 'style', 'flow'])).map((v) => v.title)).toEqual(['Styled']);
    expect((await listVideos('whiteboard'))[0].size).toBe(10);
    expect((await getVideo(a))?.name).toBe('p1.mp4');
    await deleteVideo(a);
    expect(await listVideos('whiteboard')).toEqual([]);
  });
});
