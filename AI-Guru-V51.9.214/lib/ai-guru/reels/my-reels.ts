/**
 * V51.9.152 — the student's own reel library, kept in this browser (IndexedDB, so videos fit):
 *   parts   — class parts uploaded from the whiteboard (🎬 Edit / Send to Reel Studio), to design or style in the Reel Studio
 *   videos  — MP4s: made on the whiteboard (⬇ Download / ⬇ MP4, for Google Flow) and reels finished in the Reel Studio
 * Everything can be previewed and deleted. Nothing leaves the device.
 */
import type { ClassClip } from './class-clip';

export type ReelWay = 'design' | 'style' | 'stock' | 'flow' | 'omni' | 'whiteboard' | 'raw';
export interface StoredPart { id: string; title: string; kind: ClassClip['kind']; nth: number; addedAt: number; clip: ClassClip }
export interface StoredVideo { id: string; title: string; way: ReelWay; addedAt: number; seconds?: number; name: string; thumb?: string; blob: Blob }
export type VideoInfo = Omit<StoredVideo, 'blob'> & { size: number };

const DB = 'aiguru-my-reels';
const VERSION = 1;
const MAX_PARTS = 40;
const MAX_VIDEOS = 40;

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('This browser cannot keep reels.')); return; }
    const r = indexedDB.open(DB, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('parts')) db.createObjectStore('parts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('videos')) db.createObjectStore('videos', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('Could not open the reel library.'));
  });
}
function run<T>(store: 'parts' | 'videos', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((res, rej) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    let out: T | undefined;
    if (req) req.onsuccess = () => { out = req.result; };
    tx.oncomplete = () => { db.close(); res(out); };
    tx.onerror = () => { db.close(); rej(tx.error ?? new Error('The reel library could not be changed.')); };
    tx.onabort = () => { db.close(); rej(tx.error ?? new Error('The reel library is full: delete some reels.')); };
  }));
}

/* ---- change notifications (this tab and other tabs) ---- */
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
function bc(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel('aiguru-my-reels');
  channel.onmessage = () => listeners.forEach((f) => f());
  return channel;
}
function changed() { listeners.forEach((f) => f()); try { bc()?.postMessage('changed'); } catch { /* ignore */ } }
export function subscribeMyReels(f: () => void): () => void { listeners.add(f); bc(); return () => listeners.delete(f); }

const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ---- parts from the whiteboard ---- */
export async function addPart(clip: ClassClip): Promise<string> {
  const all = await listParts();
  // the same part sent twice is kept once (newest wins)
  const same = all.find((p) => p.clip.madeAt === clip.madeAt && p.title === clip.title && p.nth === clip.nth && p.kind === clip.kind);
  const id = same?.id ?? newId('p');
  await run('parts', 'readwrite', (s) => s.put({ id, title: clip.title, kind: clip.kind, nth: clip.nth, addedAt: Date.now(), clip } satisfies StoredPart));
  for (const old of all.filter((p) => p.id !== id).slice(MAX_PARTS - 1)) await run('parts', 'readwrite', (s) => s.delete(old.id));
  changed();
  return id;
}
export async function listParts(): Promise<StoredPart[]> {
  const xs = (await run<StoredPart[]>('parts', 'readonly', (s) => s.getAll() as IDBRequest<StoredPart[]>)) ?? [];
  return xs.sort((a, b) => b.addedAt - a.addedAt);
}
export async function deletePart(id: string): Promise<void> { await run('parts', 'readwrite', (s) => s.delete(id)); changed(); }

/* ---- videos ---- */
export async function addVideo(v: Omit<StoredVideo, 'id' | 'addedAt'>): Promise<string> {
  const id = newId('v');
  await run('videos', 'readwrite', (s) => s.put({ ...v, id, addedAt: Date.now() } satisfies StoredVideo));
  const all = await listVideos();
  for (const old of all.slice(MAX_VIDEOS)) await run('videos', 'readwrite', (s) => s.delete(old.id));
  changed();
  return id;
}
export async function listVideos(way?: ReelWay | ReelWay[]): Promise<VideoInfo[]> {
  const xs = (await run<StoredVideo[]>('videos', 'readonly', (s) => s.getAll() as IDBRequest<StoredVideo[]>)) ?? [];
  const ways = way ? (Array.isArray(way) ? way : [way]) : null;
  return xs
    .filter((v) => !ways || ways.includes(v.way))
    .sort((a, b) => b.addedAt - a.addedAt)
    .map(({ blob, ...rest }) => ({ ...rest, size: blob?.size ?? 0 }));
}
export async function getVideo(id: string): Promise<StoredVideo | undefined> { return run<StoredVideo>('videos', 'readonly', (s) => s.get(id) as IDBRequest<StoredVideo>); }
export async function deleteVideo(id: string): Promise<void> { await run('videos', 'readwrite', (s) => s.delete(id)); changed(); }

/** A small picture of a video's first look (from a canvas the caller drew), for the gallery. */
export function thumbOf(canvas: HTMLCanvasElement, w = 180): string {
  const k = w / canvas.width;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = Math.round(canvas.height * k);
  c.getContext('2d')?.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

/** A thumbnail from a video blob (a frame ~1 s in); '' when the browser cannot decode it. */
export function thumbFromBlob(blob: Blob, w = 180): Promise<string> {
  return new Promise((res) => {
    if (typeof document === 'undefined') { res(''); return; }
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const done = (s: string) => { URL.revokeObjectURL(url); res(s); };
    const timer = setTimeout(() => done(''), 6000);
    v.onloadeddata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 3); } catch { clearTimeout(timer); done(''); } };
    v.onseeked = () => {
      clearTimeout(timer);
      try {
        const c = document.createElement('canvas');
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d')?.drawImage(v, 0, 0);
        done(thumbOf(c, w));
      } catch { done(''); }
    };
    v.onerror = () => { clearTimeout(timer); done(''); };
  });
}
