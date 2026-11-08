/**
 * V51.9.175 — Netlify Blobs as the file store, tested against Netlify's own local blobs server.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BlobsServer } from '@netlify/blobs/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: BlobsServer;
beforeAll(async () => {
  server = new BlobsServer({ directory: mkdtempSync(path.join(tmpdir(), 'nf-blobs-')), token: 'test-token', port: 0 });
  const { port } = await server.start();
  process.env.NETLIFY_SITE_ID = 'test-site';
  process.env.NETLIFY_BLOBS_TOKEN = 'test-token';
  process.env.NETLIFY_BLOBS_API_URL = `http://localhost:${port}`;
  process.env.AI_GURU_BLOBS = 'netlify';
  process.env.AI_GURU_DATA_ROOT = mkdtempSync(path.join(tmpdir(), 'nf-docs-')); // the avatar's meta.json (docs) stays local here
});
afterAll(async () => { await server.stop(); delete process.env.AI_GURU_BLOBS; });

describe('blobs: Netlify Blobs', () => {
  it('put / get / del / delPrefix, keys with ":" and folders, and null for nothing saved', async () => {
    const { blobs, storageMode } = await import('./index');
    expect(storageMode().blobs).toBe('netlify-blobs');
    const pdf = new Uint8Array(Array.from({ length: 3000 }, (_, i) => i % 256));
    await blobs.put('.data/ai-guru-material-studio/pdf/doc:abc.pdf', pdf, 'application/pdf');
    const back = await blobs.get('.data/ai-guru-material-studio/pdf/doc:abc.pdf');
    expect(back?.length).toBe(3000);
    expect([...back!.subarray(0, 5)]).toEqual([0, 1, 2, 3, 4]);
    expect(await blobs.get('nothing/here.pdf')).toBeNull();

    await blobs.put('data/ai-guru/teacher/avatars/t1/photo.jpg', new Uint8Array([1]), 'image/jpeg');
    await blobs.put('data/ai-guru/teacher/avatars/t1/voice.wav', new Uint8Array([2]), 'audio/wav');
    await blobs.put('data/ai-guru/teacher/avatars/t10/photo.jpg', new Uint8Array([3]), 'image/jpeg');
    // the avatar store deletes its files by name (Netlify's local test server cannot list by folder)
    const { deleteAvatar } = await import('../teacher/avatar-store');
    await deleteAvatar('t1');
    expect(await blobs.get('data/ai-guru/teacher/avatars/t1/photo.jpg')).toBeNull();
    expect(await blobs.get('data/ai-guru/teacher/avatars/t1/voice.wav')).toBeNull();
    expect([...(await blobs.get('data/ai-guru/teacher/avatars/t10/photo.jpg'))!]).toEqual([3]); // a neighbour stays

    await blobs.del('.data/ai-guru-material-studio/pdf/doc:abc.pdf');
    await blobs.del('already/gone.pdf');
    expect(await blobs.get('.data/ai-guru-material-studio/pdf/doc:abc.pdf')).toBeNull();
  });
  it('still refuses keys that could leave the folder', async () => {
    const { blobs } = await import('./index');
    await expect(blobs.put('../x', new Uint8Array([1]))).rejects.toThrow('Invalid storage key');
  });
});
