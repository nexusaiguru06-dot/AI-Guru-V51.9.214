/**
 * V51.9.178 — the school records are one row per item (M2) and quiz history / attendance keep every record (M3).
 * Runs on local files, and on PostgreSQL when AI_GURU_STORE=postgres + DATABASE_URL are set.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const PG = process.env.AI_GURU_STORE === 'postgres';
beforeEach(async () => {
  vi.resetModules();
  process.env.AI_GURU_DATA_ROOT = mkdtempSync(path.join(tmpdir(), 'rows-'));
  if (PG) { const { pgPool } = await import('../storage'); await (await pgPool()).query("DELETE FROM ai_guru_docs WHERE key LIKE 'data/ai-guru/%'"); }
});
afterAll(async () => { if (PG) { const { pgPool } = await import('../storage'); await (await pgPool()).query("DELETE FROM ai_guru_docs WHERE key LIKE 'data/ai-guru/%'"); } });

const student = (id: string, name: string) => ({ id, name, standard: '9' }) as never;

describe('M2 — school records as rows', () => {
  it('each student is its own row, and a change writes only what changed', async () => {
    const { docs } = await import('../storage');
    const store = await import('./store');
    await store.update((d) => { for (let i = 1; i <= 50; i++) d.students.push(student(`st_${i}`, `Student ${i}`)); d.school.name = 'GHS'; });
    const keys = await docs.keys('data/ai-guru/admin/students');
    expect(keys).toHaveLength(50);

    const puts: string[] = [];
    const storage = await import('../storage');
    const target = PG ? storage.pgDocs : storage.localDocs; // the real store behind the docs switch
    const real = target.transaction.bind(target);
    const spy = vi.spyOn(target, 'transaction').mockImplementation(((lock: string, fn: (tx: any) => Promise<unknown>) =>
      real(lock, (tx) => fn({ ...tx, put: (k: string, v: unknown) => { puts.push(k); return tx.put(k, v); } }))) as never);
    await store.update((d) => { d.students.find((s) => s.id === 'st_7')!.name = 'Renamed'; });
    spy.mockRestore();
    expect(puts).toEqual(['data/ai-guru/admin/students/st_7.json']); // one student written, not the whole school

    const d = await store.readData();
    expect(d.students.map((s) => s.id).slice(0, 3)).toEqual(['st_1', 'st_2', 'st_3']); // order kept
    expect(d.students.find((s) => s.id === 'st_7')!.name).toBe('Renamed');
    expect(d.school.name).toBe('GHS');
  });

  it('removing an item deletes its row; two coupons with the same code both survive', async () => {
    const { docs } = await import('../storage');
    const store = await import('./store');
    await store.update((d) => { d.students.push(student('st_a', 'A'), student('st_b', 'B')); d.coupons.push({ code: 'SAME', percent: 10 } as never, { code: 'SAME', percent: 20 } as never); });
    await store.update((d) => { d.students = d.students.filter((s) => s.id !== 'st_a'); });
    expect(await docs.get('data/ai-guru/admin/students/st_a.json')).toBeNull();
    const d = await store.readData();
    expect(d.students.map((s) => s.id)).toEqual(['st_b']);
    expect(d.coupons.map((c: any) => c.percent)).toEqual([10, 20]);
  });

  it('an old single-file records.json is split into rows once, and kept as a backup', async () => {
    const { docs } = await import('../storage');
    await docs.put('data/ai-guru/admin/records.json', { students: [{ id: 'old_1', name: 'Old' }], invoices: [{ id: 'inv_1', studentId: 'old_1', items: [], payments: [] }], school: { name: 'Old School' }, receiptCounter: 7 });
    const store = await import('./store');
    const d = await store.readData();
    expect(d.students.map((s) => s.id)).toEqual(['old_1']);
    expect(d.invoices.map((i) => i.id)).toEqual(['inv_1']);
    expect(d.school.name).toBe('Old School');
    expect(d.receiptCounter).toBe(7);
    expect(await docs.get('data/ai-guru/admin/records.json')).toBeNull();
    expect(await docs.get('data/ai-guru/admin/records.migrated.json')).not.toBeNull();
    expect(await docs.get('data/ai-guru/admin/students/old_1.json')).toMatchObject({ name: 'Old' });
  });

  it('40 changes at once lose nothing (PostgreSQL: from two copies of the app)', async () => {
    const store = await import('./store');
    if (PG) vi.resetModules(); // a laptop runs one copy; on PostgreSQL also check two copies sharing the database
    const other = PG ? await import('./store') : store;
    await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? store : other).update((d) => { d.students.push(student(`p_${i}`, `P${i}`)); d.receiptCounter += 1; })));
    const d = await store.readData();
    expect(d.students).toHaveLength(40);
    expect(d.receiptCounter).toBe(40);
  });

  it('a failed change writes nothing', async () => {
    const store = await import('./store');
    await store.update((d) => { d.students.push(student('keep', 'Keep')); });
    await expect(store.update((d) => { d.students.push(student('lost', 'Lost')); throw new Error('stop'); })).rejects.toThrow('stop');
    if (PG) expect((await store.readData()).students.map((s) => s.id)).toEqual(['keep']); // PostgreSQL: one transaction
  });
});

describe('M3 — quiz history and attendance keep every record', () => {
  const rec = (i: number, studentId = 'student:s1') => ({ id: `r${i}`, studentId, studentName: 'Anu', at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(), toffees: 1, items: [{ id: 'q1', kind: 'concept', stem: 'x', concept: 'c', chosen: 'a', answer: 'a', correct: true, toffees: 1, seconds: 5 }] });

  it('more than the old 5,000 cap is kept (checked with 5,050 records split over students)', async () => {
    const { docs } = await import('../storage');
    // write rows directly (fast); the store reads them all back
    const { rowKey, rowName } = await import('../storage/rows');
    await docs.transaction('t', async (tx) => { for (let i = 0; i < 5050; i++) { const r = rec(i, `student:s${i % 10}`); await tx.put(rowKey(`data/ai-guru/progress/records/${rowName(r.studentId)}`, r.id), r); } });
    const q = await import('../quiz/server-store');
    const all = await q.readAll();
    expect(all).toHaveLength(5050);
    expect(all[0].id).toBe('r0'); // oldest first
    expect(await q.readForStudent('student:s3')).toHaveLength(505);
  }, 60_000);

  it('addRecord saves one row; the same id replaces it', async () => {
    const q = await import('../quiz/server-store');
    const a = await q.addRecord(rec(1));
    expect(a?.id).toBe('r1');
    await q.addRecord({ ...rec(1), items: [{ ...rec(1).items[0], chosen: 'b', correct: false }] });
    const mine = await q.readForStudent('student:s1');
    expect(mine).toHaveLength(1);
    expect(mine[0].pct).toBe(0); // replaced, not added
  });

  it('old progress/sessions.json and attendance/sessions.json move into rows', async () => {
    const { docs } = await import('../storage');
    await docs.put('data/ai-guru/progress/sessions.json', [rec(1), rec(2, 'student:s2')]);
    await docs.put('data/ai-guru/attendance/sessions.json', [{ id: 'v1', studentId: 'st_1', studentName: 'A', enteredAt: '2026-01-01T00:00:00.000Z', lastSeenAt: '2026-01-01T00:10:00.000Z', activeSeconds: 600 }]);
    const q = await import('../quiz/server-store');
    const at = await import('../attendance/server-store');
    expect((await q.readAll()).map((r) => r.id)).toEqual(['r1', 'r2']);
    expect((await at.readSessions()).map((s) => s.id)).toEqual(['v1']);
    expect(await docs.get('data/ai-guru/progress/sessions.json')).toBeNull();
    expect(await docs.get('data/ai-guru/progress/sessions.migrated.json')).not.toBeNull();
  });

  it('attendance: start, beat and end update one visit row', async () => {
    const at = await import('../attendance/server-store');
    const t0 = Date.UTC(2026, 0, 1, 9);
    await at.recordEvent({ type: 'start', sessionId: 'v9', studentId: 'st_9', studentName: 'Ravi' }, t0);
    await at.recordEvent({ type: 'beat', sessionId: 'v9', studentId: 'st_9' }, t0 + 30_000);
    await at.recordEvent({ type: 'end', sessionId: 'v9', studentId: 'st_9' }, t0 + 60_000);
    await at.recordEvent({ type: 'end', sessionId: 'nope', studentId: 'st_9' }, t0); // nothing to close: nothing written
    const all = await at.readSessions();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 'v9', studentName: 'Ravi' });
    expect(all[0].exitedAt).toBeTruthy();
  });
});
