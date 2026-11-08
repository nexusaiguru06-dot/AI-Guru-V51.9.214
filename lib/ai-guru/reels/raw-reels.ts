/**
 * V51.9.207 — "Raw reels": videos and whiteboard parts the student puts in one tray (upload from the device, or sent
 * from the whiteboard), selects, and moves to any of the five ways (?raw=id1,id2). Ids starting with "v" are videos,
 * ids starting with "p" are whiteboard parts (see my-reels.ts). Everything stays in this browser.
 */
import { addVideo, thumbFromBlob, type ReelWay } from './my-reels';

export const RAW_MAX_MB = 300;
export type RawKind = 'video' | 'part';
export type WayId = 'design' | 'style' | 'flow' | 'omni' | 'stock';

export const rawKindOf = (id: string): RawKind => (id.startsWith('p') ? 'part' : 'video');

/** The raw reel ids in a URL query ("?raw=v1,p2"): only well-formed ids, no repeats, at most 8. */
export function parseRaw(search: string): string[] {
  const v = new URLSearchParams(search).get('raw') || '';
  return [...new Set(v.split(',').filter((x) => /^[pv][a-z0-9]{6,40}$/.test(x)))].slice(0, 8);
}

/** Which ways can use which kind: Google Flow and Google Omni edit an MP4; Design and Style work on a whiteboard part;
 *  the stock-video way takes a whiteboard part, and an MP4 as the video behind it. */
export function fitsWay(kind: RawKind, way: WayId): boolean {
  if (kind === 'video') return way === 'flow' || way === 'omni' || way === 'stock';
  return way !== 'flow' && way !== 'omni';
}

/** The link to a way's page with the raw reels that fit it (and ?from=class when asked). */
export function wayLink(href: string, way: WayId, ids: string[], fromClass = false): string {
  const q = new URLSearchParams();
  const fit = ids.filter((id) => fitsWay(rawKindOf(id), way));
  if (fit.length) q.set('raw', fit.join(','));
  if (fromClass && way !== 'flow' && way !== 'omni') q.set('from', 'class');
  const s = q.toString().replace(/%2C/g, ',');
  return s ? `${href}?${s}` : href;
}

export const isVideoFile = (f: { type: string; name: string }) => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name);

/** Keeps the chosen files as raw reels (way "raw"). Returns the new ids and a note for every file that was refused. */
export async function addRawFiles(files: File[]): Promise<{ ids: string[]; notes: string[] }> {
  const ids: string[] = [];
  const notes: string[] = [];
  for (const f of files) {
    if (!isVideoFile(f)) { notes.push(`${f.name}: not a video (choose an .mp4).`); continue; }
    if (f.size > RAW_MAX_MB * 1048576) { notes.push(`${f.name}: over ${RAW_MAX_MB} MB, too big to keep here.`); continue; }
    try {
      const thumb = await thumbFromBlob(f);
      ids.push(await addVideo({ title: f.name.replace(/\.[^.]+$/, ''), way: 'raw' satisfies ReelWay, name: f.name, blob: f, thumb }));
    } catch (e) { notes.push(`${f.name}: ${(e as Error).message}`); }
  }
  return { ids, notes };
}
