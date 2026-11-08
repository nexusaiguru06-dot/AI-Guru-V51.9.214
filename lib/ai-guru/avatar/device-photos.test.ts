import { describe, expect, it } from 'vitest';
import { findFace, isHeic, photoFileProblem, startCrop } from './device-photos';
import { cropSquare } from '../student/photo';

const pic = (w: number, h: number, face: { x: number; y: number; r: number } | null) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const inFace = face && (x - face.x * w) ** 2 + (y - face.y * h) ** 2 < face.r ** 2;
    const [r, g, b] = inFace ? [200, 145, 115] : [70, 110, 160];
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  return d;
};

describe('V51.9.104 photos from this device', () => {
  it('accepts photos, names the problem with anything else', () => {
    expect(photoFileProblem({ name: 'me.jpg', type: 'image/jpeg', size: 2e6 })).toBeNull();
    expect(photoFileProblem({ name: 'IMG_0001.HEIC', type: '', size: 2e6 })).toBeNull(); // tried; explained if it fails
    expect(photoFileProblem({ name: 'photo.png', type: '', size: 1e5 })).toBeNull(); // some phones send no type
    expect(photoFileProblem({ name: 'notes.pdf', type: 'application/pdf', size: 1e5 })).toMatch(/not a photo/);
    expect(photoFileProblem({ name: 'huge.jpg', type: 'image/jpeg', size: 40e6 })).toMatch(/30 MB/);
    expect(photoFileProblem({ name: 'empty.jpg', type: 'image/jpeg', size: 0 })).toMatch(/empty/);
    expect(isHeic({ name: 'a.heic', type: '' })).toBe(true);
    expect(isHeic({ name: 'a.jpg', type: 'image/heif' })).toBe(true);
  });
  it('finds the face and starts the crop on it', () => {
    const f = findFace(pic(96, 96, { x: 0.7, y: 0.3, r: 12 }), 96, 96)!;
    expect(f.x).toBeCloseTo(0.7, 1);
    expect(f.y).toBeCloseTo(0.3, 1);
    expect(f.fw).toBeGreaterThan(0.15);
    expect(findFace(pic(96, 96, null), 96, 96)).toBeNull();
    // a small face in a wide 4000 × 3000 photo: zoomed in, and the face is inside the square cut
    const c = startCrop(f, 4000, 3000);
    expect(c.zoom).toBeGreaterThan(1.5);
    const { sx, sy, size } = cropSquare(4000, 3000, c.zoom, c.cx, c.cy);
    expect(0.7 * 4000).toBeGreaterThan(sx); expect(0.7 * 4000).toBeLessThan(sx + size);
    expect(0.3 * 3000).toBeGreaterThan(sy); expect(0.3 * 3000).toBeLessThan(sy + size);
    // no face: the whole picture, a little above the middle on a tall photo
    expect(startCrop(null, 3000, 4000)).toEqual({ zoom: 1, cx: 0.5, cy: 0.4 });
    // a face that fills the picture is never zoomed out below 1
    expect(startCrop({ x: 0.5, y: 0.5, fw: 1, fh: 1 }, 500, 500).zoom).toBe(1);
  });
});
