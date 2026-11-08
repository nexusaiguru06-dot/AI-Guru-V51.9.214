/**
 * V51.9.177 — study-material jobs are saved records, shared by every copy of the app (Cloud Run runs several):
 * a job is run once, a job whose copy of the app went away is picked up again, and a second failure ends it clearly.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  process.env.AI_GURU_DATA_ROOT = mkdtempSync(path.join(tmpdir(), 'jobs-'));
  // the store follows the environment: local files by default, PostgreSQL when AI_GURU_STORE=postgres
});

const KEY = (id: string) => `data/ai-guru/library/jobs/${id}.json`;
const job = (id: string, extra: Record<string, unknown> = {}) => ({ id, documentId: 'doc:none', part: 1, type: 'mcq', status: 'queued', by: { kind: 'admin', via: 'cloud' }, createdAt: new Date().toISOString(), attempts: 0, ...extra });
const settle = async (get: () => Promise<any>, ok: (j: any) => boolean) => { for (let i = 0; i < 100; i++) { const j = await get(); if (ok(j)) return j; await new Promise((r) => setTimeout(r, 20)); } return get(); };

describe('shared study-material jobs', () => {
  it('two copies of the app looking at the queue at once run a job only once', async () => {
    const { docs } = await import('../storage');
    await docs.put(KEY('job_a1'), job('job_a1'));
    const calls: string[] = [];
    // two separate module instances = two copies of the app sharing one store
    const one = await import('./cloud');
    vi.resetModules();
    const two = await import('./cloud');
    const gen = async () => { calls.push('run'); throw new Error('stop here'); };
    one.setGenerator(gen as never); two.setGenerator(gen as never);
    await Promise.all([one.pump(), two.pump(), one.pump(), two.pump()]);
    const done = await settle(() => one.getJob('job_a1'), (j) => j?.status === 'failed');
    expect(done.status).toBe('failed'); // 'Book not found' — the point is that it ran once
    expect(done.attempts).toBe(1);
  });

  it('a job whose copy of the app stopped (no heartbeat for 3 minutes) is started again', async () => {
    const { docs } = await import('../storage');
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    await docs.put(KEY('job_b1'), job('job_b1', { status: 'running', runner: 'gone', heartbeatAt: old, attempts: 1 }));
    const cloud = await import('./cloud');
    await cloud.pump();
    const j = await settle(() => cloud.getJob('job_b1'), (x) => x?.status !== 'running');
    expect(j.attempts).toBe(2);
    expect(j.runner).not.toBe('gone');
  });

  it('after the second stop the job ends with a clear message instead of looping', async () => {
    const { docs } = await import('../storage');
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    await docs.put(KEY('job_c1'), job('job_c1', { status: 'running', runner: 'gone', heartbeatAt: old, attempts: 2 }));
    const cloud = await import('./cloud');
    await cloud.pump();
    const j = await cloud.getJob('job_c1');
    expect(j).toMatchObject({ status: 'failed', error: expect.stringMatching(/stopped/) });
  });

  it('a job with a fresh heartbeat is left alone; finished jobs older than 7 days are removed', async () => {
    const { docs } = await import('../storage');
    await docs.put(KEY('job_d1'), job('job_d1', { status: 'running', runner: 'other', heartbeatAt: new Date().toISOString(), attempts: 1 }));
    await docs.put(KEY('job_d2'), job('job_d2', { status: 'done', finishedAt: new Date(Date.now() - 8 * 86_400_000).toISOString() }));
    const cloud = await import('./cloud');
    await cloud.pump();
    expect((await cloud.getJob('job_d1'))?.runner).toBe('other');
    expect(await cloud.getJob('job_d2')).toBeNull();
  });
});

afterAll(async () => {
  const { docs } = await import('../storage');
  for (const k of await docs.keys('data/ai-guru/library/jobs')) await docs.del(k);
});
