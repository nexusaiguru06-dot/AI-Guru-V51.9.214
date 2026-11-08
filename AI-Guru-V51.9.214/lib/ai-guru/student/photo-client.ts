'use client';

/** V51.9.99 — browser side of the student's photo: cutting a square, and the decoded picture for reels. */

import { cropSquare, PHOTO_SIZE, reelPhotoUrl } from './photo';

/** Cuts the square (zoom, centre) out of a picture and returns a 512 × 512 JPEG data URL. */
export function squareJpeg(src: CanvasImageSource, w: number, h: number, zoom = 1, cx = 0.5, cy = 0.5, mirror = false): string {
  const { sx, sy, size } = cropSquare(w, h, zoom, cx, cy);
  const c = document.createElement('canvas');
  c.width = PHOTO_SIZE;
  c.height = PHOTO_SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.imageSmoothingQuality = 'high';
  if (mirror) { ctx.translate(PHOTO_SIZE, 0); ctx.scale(-1, 1); }
  ctx.drawImage(src, sx, sy, size, size, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  return c.toDataURL('image/jpeg', 0.86);
}

export function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open that picture.'));
    img.src = url;
  });
}

/** A picture file (EXIF rotation applied) → an image the crop editor can draw. */
export async function fileToImage(file: File): Promise<{ img: CanvasImageSource; w: number; h: number }> {
  if (!/^image\//.test(file.type)) throw new Error('Choose a photo (JPG or PNG).');
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    return { img: bmp, w: bmp.width, h: bmp.height };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await decodeImage(url);
      return { img, w: img.naturalWidth, h: img.naturalHeight };
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }
}

let cache: { url: string; img: HTMLImageElement } | null = null;

/** The decoded photo for reels (null when there is none or a switch is off). Cached until the photo changes. */
export async function reelPhoto(): Promise<HTMLImageElement | null> {
  const url = reelPhotoUrl();
  if (!url) return null;
  if (cache?.url === url) return cache.img;
  try {
    const img = await decodeImage(url);
    cache = { url, img };
    return img;
  } catch {
    return null;
  }
}
