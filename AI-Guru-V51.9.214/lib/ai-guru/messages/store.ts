/**
 * V51.9.153 — messages (server only; V51.9.173: through lib/ai-guru/storage): data/ai-guru/messages/index.json (one summary per thread, for the
 * office's inbox), threads/<id>.json (the conversation) and kb.json (the bot's knowledge base). Writes go one at a time.
 */
import { docs } from '../storage';
import { SEED_KB, summaryOf, type KbEntry, type Thread, type ThreadSummary } from './core';

// V51.9.173: saved through lib/ai-guru/storage — files on localhost, PostgreSQL on Cloud Run.
const DIR = 'data/ai-guru/messages';
const safe = (id: string) => id.replace(/[^A-Za-z0-9_.:-]/g, '_').replace(/:/g, '~').replace(/^\.+/, '_').slice(0, 120) || '_';
const threadKey = (id: string) => `${DIR}/threads/${safe(id)}.json`;
const INDEX = `${DIR}/index.json`;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const v = await docs.get<T>(key);
  return v ?? fallback;
}

let chain: Promise<unknown> = Promise.resolve();
/** One change at a time in this server process (the index itself is also updated under a lock). */
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => undefined);
  return run;
}

export const readIndex = () => readJson<ThreadSummary[]>(INDEX, []);
export const readThread = (id: string) => readJson<Thread | null>(threadKey(id), null);

/** Saves a thread and its summary in the index. Call inside serial(). */
export async function saveThread(t: Thread): Promise<void> {
  await docs.put(threadKey(t.id), t);
  const s = summaryOf(t);
  await docs.update<ThreadSummary[], void>(INDEX, (cur) => {
    const idx = Array.isArray(cur) ? cur : [];
    const i = idx.findIndex((x) => x.id === t.id);
    if (i >= 0) idx[i] = s; else idx.push(s);
    return { value: idx, result: undefined };
  });
}

export async function readKb(): Promise<KbEntry[]> {
  const kb = await readJson<KbEntry[] | null>(`${DIR}/kb.json`, null);
  return kb ?? SEED_KB;
}
export const writeKb = (kb: KbEntry[]) => docs.put(`${DIR}/kb.json`, kb);

/** Rate limit: at most `max` messages per writer per hour (memory). */
const sent = new Map<string, number[]>();
export function tooMany(who: string, max = 30, now = Date.now()): boolean {
  const xs = (sent.get(who) ?? []).filter((t) => now - t < 3600_000);
  if (xs.length >= max) { sent.set(who, xs); return true; }
  xs.push(now); sent.set(who, xs);
  return false;
}
