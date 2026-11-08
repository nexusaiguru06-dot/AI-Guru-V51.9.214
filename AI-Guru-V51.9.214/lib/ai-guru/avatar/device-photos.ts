/**
 * V51.9.104 — photos from this device (phone gallery, computer folders, a picture pasted or dropped in).
 *
 * Several photos can be chosen at once; each is checked, opened (EXIF rotation applied), scored like the stills from
 * "Use my own video" (sharp, well lit, a face in the middle) and the face is found, so the square crop starts on it.
 * The best come first; the person picks one. Nothing leaves the device until they save.
 *
 * The checks and the face finder are pure (tests use them); `openDevicePhotos` is browser-only.
 */

import { frameScore, skinLike } from '../teacher/own-video';

export const MAX_PHOTOS = 12;
export const MAX_PHOTO_BYTES = 30_000_000;

/** Why a file cannot be used as a photo (null = fine). */
export function photoFileProblem(f: { name: string; type: string; size: number }): string | null {
  const name = f.name.toLowerCase();
  const heic = /image\/hei[cf]/.test(f.type) || /\.(heic|heif)$/.test(name);
  if (!heic && !/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|bmp|avif)$/.test(name)) return `${f.name}: not a photo (use JPG, PNG or WebP).`;
  if (f.size > MAX_PHOTO_BYTES) return `${f.name}: larger than 30 MB.`;
  if (f.size === 0) return `${f.name}: the file is empty.`;
  return null;
}

/** The message when a HEIC (iPhone) photo cannot be opened by this browser. */
export const HEIC_HELP = 'iPhone photos (HEIC) do not open in this browser. Share the photo as JPG (Share → Options → Most Compatible), or set iPhone Settings → Camera → Formats → Most Compatible.';

export const isHeic = (f: { name: string; type: string }) => /image\/hei[cf]/.test(f.type) || /\.(heic|heif)$/i.test(f.name);

/**
 * Where the face is in a small RGBA picture: the centre of the largest band of skin-coloured pixels in the upper
 * four fifths, and its width and height (all as fractions of the picture's width / height). null when there is
 * hardly any skin.
 */
export interface FoundFace { x: number; y: number; fw: number; fh: number }
export function findFace(d: Uint8ClampedArray, w: number, h: number): FoundFace | null {
  const rows = new Float32Array(h), cols = new Float32Array(w);
  let n = 0;
  for (let y = 0; y < Math.floor(h * 0.8); y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (skinLike(d[i], d[i + 1], d[i + 2])) { rows[y]++; cols[x]++; n++; }
    }
  }
  if (n < w * h * 0.004) return null; // about a 1 % face in a photo still counts
  // the columns and rows that hold the middle 80 % of the skin
  const span = (a: Float32Array) => {
    const total = a.reduce((s, v) => s + v, 0);
    let acc = 0, lo = 0, hi = a.length - 1;
    for (let i = 0; i < a.length; i++) { acc += a[i]; if (acc >= total * 0.1) { lo = i; break; } }
    acc = 0;
    for (let i = a.length - 1; i >= 0; i--) { acc += a[i]; if (acc >= total * 0.1) { hi = i; break; } }
    return [lo, hi] as const;
  };
  const [x0, x1] = span(cols), [y0, y1] = span(rows);
  return { x: (x0 + x1 + 1) / 2 / w, y: (y0 + y1 + 1) / 2 / h, fw: (x1 - x0 + 1) / w, fh: (y1 - y0 + 1) / h };
}

/** The crop to start with: the face a little above the middle, filling about 60 % of the circle. */
export function startCrop(face: FoundFace | null, w: number, h: number): { zoom: number; cx: number; cy: number } {
  if (!face) return { zoom: 1, cx: 0.5, cy: h > w ? 0.4 : 0.5 };
  // the face's larger side in pixels, as a share of the picture's short side (the crop at zoom 1)
  const size = Math.max(face.fw * w, face.fh * h) / Math.min(w, h);
  const zoom = Math.max(1, Math.min(4, 0.6 / Math.max(0.05, size)));
  return { zoom: Math.round(zoom * 100) / 100, cx: face.x, cy: Math.max(0, face.y - 0.04) };
}

/* ---------------- browser ---------------- */

export interface DevicePhoto {
  name: string;
  img: CanvasImageSource;
  w: number;
  h: number;
  thumb: string;
  score: number;
  /** A face was found in the picture. */
  face: boolean;
  crop: { zoom: number; cx: number; cy: number };
}

/** Opens up to MAX_PHOTOS pictures, best first; problems (not a photo, HEIC, too big) come back as text. */
export async function openDevicePhotos(files: ArrayLike<File>, onProgress?: (done: number, of: number) => void): Promise<{ photos: DevicePhoto[]; problems: string[] }> {
  const { fileToImage } = await import('../student/photo-client');
  const list = Array.from(files).slice(0, MAX_PHOTOS);
  const problems: string[] = [];
  if (files.length > MAX_PHOTOS) problems.push(`Only the first ${MAX_PHOTOS} photos were opened.`);
  const photos: DevicePhoto[] = [];
  const small = document.createElement('canvas');
  small.width = 96; small.height = 96;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  const big = document.createElement('canvas');
  const bctx = big.getContext('2d', { willReadFrequently: true })!;
  const th = document.createElement('canvas');
  th.width = 160; th.height = 160;
  const tctx = th.getContext('2d')!;
  let heicFailed = false;
  for (let k = 0; k < list.length; k++) {
    const f = list[k];
    const p = photoFileProblem(f);
    if (p) { problems.push(p); onProgress?.(k + 1, list.length); continue; }
    try {
      const { img, w, h } = await fileToImage(f.type ? f : new File([f], f.name, { type: 'image/jpeg' }));
      // the whole picture at 240 px on its long side (its own shape), to find even a small face
      const aw = Math.max(8, Math.round((240 * w) / Math.max(w, h))), ah = Math.max(8, Math.round((240 * h) / Math.max(w, h)));
      big.width = aw; big.height = ah;
      bctx.drawImage(img, 0, 0, w, h, 0, 0, aw, ah);
      const face = findFace(bctx.getImageData(0, 0, aw, ah).data, aw, ah);
      const crop = startCrop(face, w, h);
      // score the square that will be cut, as with the video stills
      const side = Math.min(w, h) / crop.zoom;
      const sx = Math.max(0, Math.min(w - side, crop.cx * w - side / 2)), sy = Math.max(0, Math.min(h - side, crop.cy * h - side / 2));
      sctx.drawImage(img, sx, sy, side, side, 0, 0, 96, 96);
      const sc = frameScore(sctx.getImageData(0, 0, 96, 96).data, 96, 96);
      tctx.drawImage(img, sx, sy, side, side, 0, 0, 160, 160);
      // a face cut from few pixels looks soft in the 512 px avatar: rank it lower
      const detail = Math.min(1, side / 400);
      photos.push({ name: f.name, img, w, h, thumb: th.toDataURL('image/jpeg', 0.8), score: sc.total * detail, face: !!face && sc.face > 0.12, crop });
    } catch {
      if (isHeic(f)) heicFailed = true;
      else problems.push(`${f.name}: could not be opened.`);
    }
    onProgress?.(k + 1, list.length);
  }
  if (heicFailed) problems.push(HEIC_HELP);
  photos.sort((a, b) => Number(b.face) - Number(a.face) || b.score - a.score);
  return { photos, problems };
}
