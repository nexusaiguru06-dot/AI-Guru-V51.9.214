/**
 * V51.9.173 — where AI Guru keeps its saved data (server only).
 *
 * Every store used to write JSON and pictures into the app's own folders (data/…, .data/…). That works on a laptop,
 * but on Google Cloud Run the folder is wiped whenever the app restarts, and two copies of the app don't share it.
 * So the stores now go through two small interfaces, keyed by the same relative paths they always used:
 *
 *   docs  — JSON records.  Local files (default) or PostgreSQL (AI_GURU_STORE=postgres + DATABASE_URL).
 *   blobs — PDFs, photos, voice and video.  Local files (default), Cloud Storage (AI_GURU_BUCKET=<bucket>) or
 *           Netlify Blobs (AI_GURU_BLOBS=netlify; V51.9.175 — free file storage for a Netlify site).
 *
 * On localhost nothing changes: the same files in the same places. `docs.update()` is a locked read-change-write, so
 * two clicks (or two Cloud Run instances) never overwrite each other.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type Key = string;

/** A key is a relative path made of plain names: letters, digits and . _ - ~ : separated by '/'. No '..', no '/x'. */
export function checkKey(key: Key): Key {
  if (typeof key !== 'string' || key.length < 1 || key.length > 300) throw new Error('Invalid storage key');
  const parts = key.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || !/^[A-Za-z0-9._~:-]+$/.test(p))) throw new Error('Invalid storage key');
  return key;
}

export interface DocStore {
  get<T>(key: Key): Promise<T | null>;
  put(key: Key, value: unknown): Promise<void>;
  del(key: Key): Promise<void>;
  /** The keys directly or deeply under a folder prefix (e.g. ".data/x/materials/"). */
  keys(prefix: string): Promise<Key[]>;
  /** Every value under a folder prefix (one query in PostgreSQL). */
  values<T>(prefix: string): Promise<T[]>;
  /** Locked read → change → write. `fn` gets the current value (or null) and returns the new value and a result.
   *  V51.9.177: return `value: undefined` to write nothing (e.g. the record was deleted meanwhile). */
  update<T, R>(key: Key, fn: (cur: T | null) => Promise<{ value: T | undefined; result: R }> | { value: T | undefined; result: R }): Promise<R>;
  /** V51.9.178: several reads and writes under one named lock. In PostgreSQL they are one transaction (all or nothing);
   *  with local files they run one at a time per lock name. Do not call other `docs` methods inside — use `tx`. */
  transaction<R>(lock: string, fn: (tx: DocTx) => Promise<R>): Promise<R>;
  /** V51.9.178: a consistent read of several records (PostgreSQL: one REPEATABLE READ snapshot; never blocks writers). */
  snapshot<R>(fn: (tx: DocReader) => Promise<R>): Promise<R>;
}

export interface DocReader {
  get<T>(key: Key): Promise<T | null>;
  keys(prefix: string): Promise<Key[]>;
  /** Every value under a folder prefix, with its key. */
  entries<T>(prefix: string): Promise<Array<{ key: Key; value: T }>>;
}
export interface DocTx extends DocReader {
  put(key: Key, value: unknown): Promise<void>;
  del(key: Key): Promise<void>;
}

export interface BlobStore {
  get(key: Key): Promise<Buffer | null>;
  put(key: Key, bytes: Uint8Array, contentType?: string): Promise<void>;
  del(key: Key): Promise<void>;
  /** Removes every blob under a folder prefix. */
  delPrefix(prefix: string): Promise<void>;
  /** V51.9.179: size in bytes, or null when there is no such file. */
  size(key: Key): Promise<number | null>;
  /** V51.9.179: the file as a stream (large PDFs are sent without loading them into memory), or null. */
  stream(key: Key): Promise<ReadableStream<Uint8Array> | null>;
  /** V51.9.179: copies the file to a local path (for OCR tools); false when there is no such file. */
  toFile(key: Key, path: string): Promise<boolean>;
  /** V51.9.179: moves a file inside the store (Cloud Storage does it server side, no download). */
  move(from: Key, to: Key): Promise<void>;
  /** V51.9.179: a short-lived link the browser can PUT a file to directly (Cloud Storage only; undefined elsewhere). */
  uploadUrl?(key: Key, contentType: string, expiresSec?: number): Promise<{ url: string; headers: Record<string, string> }>;
}

// ---------------------------------------------------------------- local files (localhost; the old behaviour)

const root = () => process.env.AI_GURU_DATA_ROOT || process.cwd();
/** V51.9.206: Windows cannot have ':' in a file name (the book ids look like "doc:3SAq…"), so there the ':' is saved as
 *  "%3A" on disk and turned back when listing. On other systems nothing changes. */
const onDisk = (p: string) => (process.platform === 'win32' ? p.replace(/:/g, '%3A') : p);
const fromDisk = (p: string) => (process.platform === 'win32' ? p.replace(/%3A/g, ':') : p);
const fileOf = (key: Key) => path.join(root(), onDisk(checkKey(key)));
const prefixDir = (prefix: string) => {
  const p = prefix.replace(/\/+$/, '');
  return path.join(root(), onDisk(checkKey(p)));
};

async function writeAtomic(file: string, bytes: Uint8Array | string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmp, bytes);
  await fs.rename(tmp, file);
}

async function walk(dir: string, rel: string, out: string[]) {
  let entries: import('node:fs').Dirent[] = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch (e) { if (notThere(e)) return; throw e; }
  for (const e of entries) {
    if (e.name.endsWith('.tmp')) continue;
    const r = rel ? `${rel}/${fromDisk(e.name)}` : fromDisk(e.name);
    if (e.isDirectory()) await walk(path.join(dir, e.name), r, out);
    else out.push(r);
  }
}

/** V51.9.176 (data safety): only "no such file" means "nothing saved". Any other error (no permission, too many open
 *  files, a Windows antivirus lock) is thrown, so a change can never start from an empty record and save it over the
 *  real one. */
const notThere = (e: unknown) => (e as { code?: string })?.code === 'ENOENT' || (e as { code?: string })?.code === 'ENOTDIR';

const chains = new Map<string, Promise<unknown>>();
function serialFor<R>(key: string, fn: () => Promise<R>): Promise<R> {
  const run = (chains.get(key) ?? Promise.resolve()).then(fn);
  const tail = run.catch(() => undefined);
  chains.set(key, tail);
  void tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
  return run;
}

export const localDocs: DocStore = {
  async get<T>(key: Key) {
    let text: string;
    try { text = await fs.readFile(fileOf(key), 'utf8'); } catch (e) { if (notThere(e)) return null; throw e; }
    try { return JSON.parse(text) as T; } catch { throw new Error(`Saved record ${key} is not valid JSON; it was not changed.`); }
  },
  async put(key, value) { await writeAtomic(fileOf(key), JSON.stringify(value)); },
  async del(key) { await fs.rm(fileOf(key), { force: true }); },
  async keys(prefix) {
    const base = prefix.replace(/\/+$/, '');
    const out: string[] = [];
    await walk(prefixDir(base), '', out);
    return out.map((r) => `${base}/${r}`).sort();
  },
  async values<T>(prefix: string) {
    const ks = (await this.keys(prefix)).filter((k) => k.endsWith('.json'));
    return (await Promise.all(ks.map((k) => this.get<T>(k)))).filter((x): x is Awaited<T> => x !== null) as T[];
  },
  update<T, R>(key: Key, fn: (cur: T | null) => Promise<{ value: T | undefined; result: R }> | { value: T | undefined; result: R }) {
    checkKey(key);
    return serialFor(key, async () => {
      const cur = await localDocs.get<T>(key);
      const { value, result } = await fn(cur);
      if (value !== undefined) await localDocs.put(key, value);
      return result;
    });
  },
  transaction<R>(lock: string, fn: (tx: DocTx) => Promise<R>): Promise<R> {
    return serialFor(`tx:${lock}`, () => fn(localTx));
  },
  snapshot<R>(fn: (tx: DocReader) => Promise<R>): Promise<R> {
    return fn(localTx);
  },
};

const localTx: DocTx = {
  get: (k) => localDocs.get(k),
  keys: (p) => localDocs.keys(p),
  async entries<T>(prefix: string) {
    const ks = (await localDocs.keys(prefix)).filter((k) => k.endsWith('.json'));
    const out: Array<{ key: Key; value: T }> = [];
    for (const key of ks) { const value = await localDocs.get<T>(key); if (value !== null) out.push({ key, value }); }
    return out;
  },
  put: (k, v) => localDocs.put(k, v),
  del: (k) => localDocs.del(k),
};

export const localBlobs: BlobStore = {
  async get(key) { try { return await fs.readFile(fileOf(key)); } catch (e) { if (notThere(e)) return null; throw e; } },
  async put(key, bytes) { await writeAtomic(fileOf(key), bytes); },
  async del(key) { await fs.rm(fileOf(key), { force: true }); },
  async delPrefix(prefix) { await fs.rm(prefixDir(prefix), { recursive: true, force: true }); },
  async size(key) { try { return (await fs.stat(fileOf(key))).size; } catch (e) { if (notThere(e)) return null; throw e; } },
  async stream(key) {
    const f = fileOf(key);
    try { await fs.access(f); } catch (e) { if (notThere(e)) return null; throw e; }
    const { createReadStream } = await import('node:fs');
    const { Readable } = await import('node:stream');
    return Readable.toWeb(createReadStream(f)) as unknown as ReadableStream<Uint8Array>;
  },
  async toFile(key, dest) { try { await fs.copyFile(fileOf(key), dest); return true; } catch (e) { if (notThere(e)) return false; throw e; } },
  async move(from, to) { const t = fileOf(to); await fs.mkdir(path.dirname(t), { recursive: true }); await fs.rename(fileOf(from), t); },
};

// ---------------------------------------------------------------- PostgreSQL (Cloud SQL)

type PgPool = import('pg').Pool;
let poolP: Promise<PgPool> | null = null;

/** One pool per server process. Cloud SQL from Cloud Run: DATABASE_URL=postgresql://USER:PASS@/DB?host=/cloudsql/PROJECT:REGION:INSTANCE */
export function pgPool(): Promise<PgPool> {
  if (!poolP) {
    poolP = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('AI_GURU_STORE=postgres needs DATABASE_URL');
      const { Pool } = await import('pg');
      // V51.9.177: connections per copy of the app. The smallest Cloud SQL size (db-f1-micro) allows about 25 in total,
      // and Cloud Run may run up to 5 copies, so 3 each (15) leaves room for the Cloud SQL proxy and the copy script.
      // A request waits at most 10 s for a free connection and then fails with a clear error instead of hanging.
      const max = Math.max(1, Number(process.env.AI_GURU_PG_POOL || 3));
      const pool = new Pool({ connectionString: url, max, idleTimeoutMillis: 30_000, connectionTimeoutMillis: Number(process.env.AI_GURU_PG_WAIT_MS || 10_000) });
      pool.on('error', (e) => console.error('[storage] postgres pool error', e.message));
      await pool.query(`CREATE TABLE IF NOT EXISTS ai_guru_docs (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS ai_guru_docs_prefix ON ai_guru_docs (key text_pattern_ops)`);
      return pool;
    })();
    poolP.catch(() => { poolP = null; });
  }
  return poolP;
}

const likePrefix = (prefix: string) => `${prefix.replace(/\/+$/, '').replace(/[\\%_]/g, (c) => `\\${c}`)}/%`;
/** jsonb cannot hold the \u0000 character. V51.9.178: strip it from the strings themselves (stripping it from the finished
 *  JSON text broke records whose text contained a literal backslash followed by "u0000"). */
const toJson = (v: unknown) => JSON.stringify(v ?? null, (_k, x) => (typeof x === 'string' && x.includes('\u0000') ? x.replace(/\u0000/g, '') : x));

export const pgDocs: DocStore = {
  async get<T>(key: Key) {
    const r = await (await pgPool()).query('SELECT value FROM ai_guru_docs WHERE key = $1', [checkKey(key)]);
    return r.rowCount ? (r.rows[0].value as T) : null;
  },
  async put(key, value) {
    await (await pgPool()).query(
      'INSERT INTO ai_guru_docs (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
      [checkKey(key), toJson(value)],
    );
  },
  async del(key) { await (await pgPool()).query('DELETE FROM ai_guru_docs WHERE key = $1', [checkKey(key)]); },
  async keys(prefix) {
    checkKey(prefix.replace(/\/+$/, ''));
    const r = await (await pgPool()).query("SELECT key FROM ai_guru_docs WHERE key LIKE $1 ESCAPE '\\' ORDER BY key", [likePrefix(prefix)]);
    return r.rows.map((x) => x.key as string);
  },
  async values<T>(prefix: string) {
    checkKey(prefix.replace(/\/+$/, ''));
    const r = await (await pgPool()).query("SELECT value FROM ai_guru_docs WHERE key LIKE $1 ESCAPE '\\' AND key LIKE '%.json' ORDER BY key", [likePrefix(prefix)]);
    return r.rows.map((x) => x.value as T);
  },
  async update<T, R>(key: Key, fn: (cur: T | null) => Promise<{ value: T | undefined; result: R }> | { value: T | undefined; result: R }) {
    checkKey(key);
    const client = await (await pgPool()).connect();
    try {
      await client.query('BEGIN');
      // a transaction-long lock on this key, also when the row does not exist yet
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 7))', [key]);
      const r = await client.query('SELECT value FROM ai_guru_docs WHERE key = $1', [key]);
      const { value, result } = await fn(r.rowCount ? (r.rows[0].value as T) : null);
      if (value !== undefined) {
        await client.query(
          'INSERT INTO ai_guru_docs (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
          [key, toJson(value)],
        );
      }
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  },
  async transaction<R>(lock: string, fn: (tx: DocTx) => Promise<R>): Promise<R> {
    const client = await (await pgPool()).connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 7))', [`tx:${lock}`]);
      const result = await fn(pgTx(client));
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  },
  async snapshot<R>(fn: (tx: DocReader) => Promise<R>): Promise<R> {
    const client = await (await pgPool()).connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result = await fn(pgTx(client));
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  },
};

type PgClient = import('pg').PoolClient;
function pgTx(client: PgClient): DocTx {
  return {
    async get<T>(key: Key) {
      const r = await client.query('SELECT value FROM ai_guru_docs WHERE key = $1', [checkKey(key)]);
      return r.rowCount ? (r.rows[0].value as T) : null;
    },
    async keys(prefix) {
      checkKey(prefix.replace(/\/+$/, ''));
      const r = await client.query("SELECT key FROM ai_guru_docs WHERE key LIKE $1 ESCAPE '\\' ORDER BY key", [likePrefix(prefix)]);
      return r.rows.map((x) => x.key as string);
    },
    async entries<T>(prefix: string) {
      checkKey(prefix.replace(/\/+$/, ''));
      const r = await client.query("SELECT key, value FROM ai_guru_docs WHERE key LIKE $1 ESCAPE '\\' AND key LIKE '%.json' ORDER BY key", [likePrefix(prefix)]);
      return r.rows.map((x) => ({ key: x.key as string, value: x.value as T }));
    },
    async put(key, value) {
      await client.query(
        'INSERT INTO ai_guru_docs (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
        [checkKey(key), toJson(value)],
      );
    },
    async del(key) { await client.query('DELETE FROM ai_guru_docs WHERE key = $1', [checkKey(key)]); },
  };
}

// ---------------------------------------------------------------- Cloud Storage

type Bucket = import('@google-cloud/storage').Bucket;
let bucketP: Promise<Bucket> | null = null;
function bucket(): Promise<Bucket> {
  if (!bucketP) {
    bucketP = (async () => {
      const { Storage } = await import('@google-cloud/storage');
      return new Storage().bucket(process.env.AI_GURU_BUCKET as string);
    })();
    bucketP.catch(() => { bucketP = null; });
  }
  return bucketP;
}
const notFound = (e: unknown) => (e as { code?: number })?.code === 404;

export const gcsBlobs: BlobStore = {
  async get(key) {
    try { const [b] = await (await bucket()).file(checkKey(key)).download(); return b; } catch (e) { if (notFound(e)) return null; throw e; }
  },
  async put(key, bytes, contentType) {
    await (await bucket()).file(checkKey(key)).save(Buffer.from(bytes), { resumable: bytes.byteLength > 8 * 1024 * 1024, contentType, metadata: { cacheControl: 'private, no-store' } });
  },
  async del(key) {
    try { await (await bucket()).file(checkKey(key)).delete(); } catch (e) { if (!notFound(e)) throw e; }
  },
  async delPrefix(prefix) {
    const p = `${checkKey(prefix.replace(/\/+$/, ''))}/`;
    await (await bucket()).deleteFiles({ prefix: p, force: true });
  },
  async size(key) {
    try { const [m] = await (await bucket()).file(checkKey(key)).getMetadata(); return Number(m.size ?? 0); } catch (e) { if (notFound(e)) return null; throw e; }
  },
  async stream(key) {
    const f = (await bucket()).file(checkKey(key));
    const [exists] = await f.exists();
    if (!exists) return null;
    const { Readable } = await import('node:stream');
    return Readable.toWeb(f.createReadStream()) as unknown as ReadableStream<Uint8Array>;
  },
  async toFile(key, dest) {
    try { await (await bucket()).file(checkKey(key)).download({ destination: dest }); return true; } catch (e) { if (notFound(e)) return false; throw e; }
  },
  async move(from, to) { await (await bucket()).file(checkKey(from)).move(checkKey(to)); },
  async uploadUrl(key, contentType, expiresSec = 900) {
    const [url] = await (await bucket()).file(checkKey(key)).getSignedUrl({ version: 'v4', action: 'write', expires: Date.now() + expiresSec * 1000, contentType });
    return { url, headers: { 'content-type': contentType } };
  },
};

// ---------------------------------------------------------------- Netlify Blobs (V51.9.175)

type NfStore = import('@netlify/blobs').Store;
let nfP: Promise<NfStore> | null = null;
/** On a Netlify site the store needs no keys (Netlify passes them to the functions). Elsewhere (e.g. a test or a copy
 *  script) set NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN (a Netlify personal access token). */
function nfStore(): Promise<NfStore> {
  if (!nfP) {
    nfP = (async () => {
      const { getStore } = await import('@netlify/blobs');
      const name = process.env.AI_GURU_BLOBS_STORE || 'ai-guru-files';
      const siteID = process.env.NETLIFY_SITE_ID;
      const token = process.env.NETLIFY_BLOBS_TOKEN;
      const apiURL = process.env.NETLIFY_BLOBS_API_URL; // only for tests against a local blobs server
      return siteID && token
        ? getStore({ name, siteID, token, consistency: 'strong', ...(apiURL ? { apiURL } : {}) })
        : getStore({ name, consistency: 'strong' });
    })();
    nfP.catch(() => { nfP = null; });
  }
  return nfP;
}

export const netlifyBlobs: BlobStore = {
  async get(key) {
    const ab = await (await nfStore()).get(checkKey(key), { type: 'arrayBuffer', consistency: 'strong' });
    return ab ? Buffer.from(ab) : null;
  },
  async put(key, bytes, contentType) {
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await (await nfStore()).set(checkKey(key), ab, { metadata: contentType ? { contentType } : {} });
  },
  async del(key) { await (await nfStore()).delete(checkKey(key)); },
  async delPrefix(prefix) {
    const st = await nfStore();
    const base = checkKey(prefix.replace(/\/+$/, ''));
    // list by the folder name, then keep only what is inside it ("t1/…", not "t10/…")
    const { blobs } = await st.list({ prefix: base });
    await Promise.all(blobs.filter((b) => b.key.startsWith(`${base}/`)).map((b) => st.delete(b.key)));
  },
  // Netlify Blobs has no partial reads or server-side moves; files there are small (Netlify caps uploads at ~4.5 MB)
  async size(key) { const b = await netlifyBlobs.get(key); return b ? b.length : null; },
  async stream(key) {
    const b = await netlifyBlobs.get(key);
    return b ? new Blob([new Uint8Array(b)]).stream() : null;
  },
  async toFile(key, dest) { const b = await netlifyBlobs.get(key); if (!b) return false; await fs.writeFile(dest, b); return true; },
  async move(from, to) { const b = await netlifyBlobs.get(from); if (!b) throw new Error(`No file ${from}`); await netlifyBlobs.put(to, b); await netlifyBlobs.del(from); },
};

// ---------------------------------------------------------------- the choice

export const storageMode = () => ({
  docs: process.env.AI_GURU_STORE === 'postgres' ? 'postgres' : 'files',
  blobs: process.env.AI_GURU_BLOBS === 'netlify' ? 'netlify-blobs' : process.env.AI_GURU_BUCKET ? 'cloud-storage' : 'files',
} as const);

/** JSON records: PostgreSQL when AI_GURU_STORE=postgres, else local files. */
export const docs: DocStore = new Proxy({} as DocStore, {
  get: (_t, p) => {
    const s = storageMode().docs === 'postgres' ? pgDocs : localDocs;
    const v = (s as unknown as Record<string | symbol, unknown>)[p];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(s) : v;
  },
});

/** Files (PDFs, photos, voice, video): Netlify Blobs (AI_GURU_BLOBS=netlify), Cloud Storage (AI_GURU_BUCKET), else local files. */
export const blobs: BlobStore = new Proxy({} as BlobStore, {
  get: (_t, p) => {
    const m = storageMode().blobs;
    const s = m === 'netlify-blobs' ? netlifyBlobs : m === 'cloud-storage' ? gcsBlobs : localBlobs;
    const v = (s as unknown as Record<string | symbol, unknown>)[p];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(s) : v;
  },
});

/** Small helper: a locked change of a JSON record that keeps the default when nothing is saved yet. */
export function change<T, R>(key: Key, fallback: () => T, fn: (cur: T) => R | Promise<R>): Promise<R> {
  return docs.update<T, R>(key, async (cur) => {
    const v = cur ?? fallback();
    const result = await fn(v);
    return { value: v, result };
  });
}
