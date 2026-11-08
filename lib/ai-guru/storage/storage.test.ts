/**
 * V51.9.173 — the storage layer. Local files always; PostgreSQL too when TEST_DATABASE_URL is set, e.g.
 *   TEST_DATABASE_URL=postgresql://postgres@localhost:5433/aiguru npx vitest run lib/ai-guru/storage
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkKey, localBlobs, localDocs, pgDocs, pgPool, type DocStore } from './index';

describe('storage keys', () => {
  it('accepts the app’s own paths', () => {
    for (const k of ['data/ai-guru/admin/records.json', '.data/ai-guru-material-studio/materials/material:abc_1.json', 'data/ai-guru/messages/threads/t~1.json']) expect(checkKey(k)).toBe(k);
  });
  it('refuses anything that could leave the folder', () => {
    for (const k of ['../x', 'a/../b', '/etc/passwd', 'a//b', 'a/./b', '', 'a\\b', 'a b', 'x'.repeat(301)]) expect(() => checkKey(k)).toThrow('Invalid storage key');
  });
});

function suite(name: string, store: () => DocStore, enabled = true) {
  describe.skipIf(!enabled)(`docs: ${name}`, () => {
    const p = `test/${name}-${Date.now()}`;
    it('put / get / del, and null for nothing saved', async () => {
      const s = store();
      expect(await s.get(`${p}/none.json`)).toBeNull();
      await s.put(`${p}/a.json`, { n: 1, ml: 'മലയാളം', list: [1, 2] });
      expect(await s.get(`${p}/a.json`)).toEqual({ n: 1, ml: 'മലയാളം', list: [1, 2] });
      await s.put(`${p}/top.json`, [1, 2, 3]);
      expect(await s.get(`${p}/top.json`)).toEqual([1, 2, 3]);
      await s.del(`${p}/a.json`);
      expect(await s.get(`${p}/a.json`)).toBeNull();
    });
    it('lists keys and values under a folder only', async () => {
      const s = store();
      await s.put(`${p}/m/x1.json`, { id: 'x1' });
      await s.put(`${p}/m/x2.json`, { id: 'x2' });
      await s.put(`${p}/mm/x3.json`, { id: 'x3' }); // a sibling folder that starts with the same letters
      expect(await s.keys(`${p}/m`)).toEqual([`${p}/m/x1.json`, `${p}/m/x2.json`]);
      expect((await s.values<{ id: string }>(`${p}/m/`)).map((v) => v.id).sort()).toEqual(['x1', 'x2']);
      expect(await s.values(`${p}/nothing`)).toEqual([]);
    });
    it('update is locked: 40 changes at once lose nothing', async () => {
      const s = store();
      const k = `${p}/counter.json`;
      await Promise.all(Array.from({ length: 40 }, () => s.update<{ n: number }, void>(k, (cur) => ({ value: { n: (cur?.n ?? 0) + 1 }, result: undefined }))));
      expect(await s.get(k)).toEqual({ n: 40 });
    });
    it('a failed change writes nothing', async () => {
      const s = store();
      const k = `${p}/safe.json`;
      await s.put(k, { v: 'kept' });
      await expect(s.update(k, () => { throw new Error('boom'); })).rejects.toThrow('boom');
      expect(await s.get(k)).toEqual({ v: 'kept' });
    });
  });
}

const root = mkdtempSync(path.join(tmpdir(), 'ag-store-'));
beforeAll(() => { process.env.AI_GURU_DATA_ROOT = root; });
suite('files', () => localDocs);

const PG = process.env.TEST_DATABASE_URL;
if (PG) process.env.DATABASE_URL = PG;
suite('postgres', () => pgDocs, !!PG);

describe.skipIf(!PG)('postgres across two servers', () => {
  it('two separate connection pools (two Cloud Run instances) still never overwrite each other', async () => {
    const { Pool } = await import('pg');
    const other = new Pool({ connectionString: PG });
    const k = `test/two-${Date.now()}/n.json`;
    await pgDocs.put(k, { n: 0 });
    const viaOther = async () => {
      const c = await other.connect();
      try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 7))', [k]);
        const r = await c.query('SELECT value FROM ai_guru_docs WHERE key = $1', [k]);
        await new Promise((res) => setTimeout(res, 5));
        await c.query('UPDATE ai_guru_docs SET value = $2::jsonb WHERE key = $1', [k, JSON.stringify({ n: r.rows[0].value.n + 1 })]);
        await c.query('COMMIT');
      } finally { c.release(); }
    };
    await Promise.all([
      ...Array.from({ length: 15 }, () => pgDocs.update<{ n: number }, void>(k, (cur) => ({ value: { n: (cur?.n ?? 0) + 1 }, result: undefined }))),
      ...Array.from({ length: 15 }, viaOther),
    ]);
    expect(await pgDocs.get(k)).toEqual({ n: 30 });
    await other.end();
  });
  afterAll(async () => { await (await pgPool()).query("DELETE FROM ai_guru_docs WHERE key LIKE 'test/%'"); });
});

describe('blobs: files', () => {
  it('put / get / delPrefix', async () => {
    await localBlobs.put('t/b/one.pdf', new Uint8Array([1, 2, 3]));
    expect([...(await localBlobs.get('t/b/one.pdf'))!]).toEqual([1, 2, 3]);
    await localBlobs.delPrefix('t/b');
    expect(await localBlobs.get('t/b/one.pdf')).toBeNull();
  });
});

describe('V51.9.206 Windows file names', () => {
  it('saves a key with ":" under a Windows-safe name and lists it back', async () => {
    const fs = await import('node:fs/promises'); const os = await import('node:os'); const path = await import('node:path');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agwin-'));
    const old = Object.getOwnPropertyDescriptor(process, 'platform');
    const prev = process.env.AI_GURU_DATA_ROOT; process.env.AI_GURU_DATA_ROOT = dir;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const { localBlobs } = await import('./index');
      await localBlobs.put('pdf/doc:abc.pdf', new Uint8Array([1, 2, 3]));
      expect(await fs.readdir(path.join(dir, 'pdf'))).toEqual(['doc%3Aabc.pdf']);
      expect((await localBlobs.get('pdf/doc:abc.pdf'))?.length).toBe(3);
    } finally {
      Object.defineProperty(process, 'platform', old!); if (prev === undefined) delete process.env.AI_GURU_DATA_ROOT; else process.env.AI_GURU_DATA_ROOT = prev;
    }
  });
});
