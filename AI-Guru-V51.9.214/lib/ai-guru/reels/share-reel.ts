/**
 * V51.9.121 — getting a finished reel to the student's friends: the phone's share menu (WhatsApp, Instagram,
 * YouTube …) when the browser can share files, otherwise the MP4 is saved and the caption is copied to paste.
 * And: the one-language reel of a class part (the class plays English and Malayalam; a reel is in one language).
 */
import { makeReel, type MotionReel } from './motion/reel';
import type { Lang } from './motion/captions';

export type ShareResult = 'shared' | 'cancelled' | 'downloaded';

/** Saves a file on this device (browser). */
export function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Can this browser hand a video file to the phone's share menu? */
export function canShareVideo(): boolean {
  try {
    if (typeof navigator === 'undefined' || !navigator.canShare) return false;
    return navigator.canShare({ files: [new File([new Uint8Array(8)], 'x.mp4', { type: 'video/mp4' })] });
  } catch { return false; }
}

/** Shares the MP4 with its caption; where sharing files is not possible, saves it and copies the caption. */
export async function shareReel(blob: Blob, name: string, caption: string, title: string): Promise<ShareResult> {
  const file = new File([blob], name, { type: 'video/mp4' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: caption, title });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'cancelled';
  }
  saveFile(blob, name);
  try { await navigator.clipboard?.writeText(caption); } catch { /* clipboard blocked */ }
  return 'downloaded';
}

/** The languages a class reel has (from its segment marks). */
export const reelLanguages = (segments: Array<{ lang: Lang }>): Lang[] => [...new Set(segments.map((s) => s.lang))];

/**
 * Only the parts of a class reel in `lang` (a class part plays its English and its Malayalam lesson one after the
 * other; a reel to post is in one language). Parts are matched to segments by their group (the segment's id).
 */
export function reelInLanguage(reel: MotionReel, segments: Array<{ id: string; lang: Lang }>, lang: Lang): MotionReel {
  const ids = new Set(segments.filter((s) => s.lang === lang).map((s) => s.id));
  const parts = reel.parts.filter((p) => p.group && ids.has(p.group));
  return parts.length ? makeReel(reel.title, parts) : reel;
}

export const reelFileName = (title: string, lang: Lang, extra = '') => `${(title || 'reel').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'reel'}${extra ? `-${extra}` : ''}-${lang}.mp4`;
