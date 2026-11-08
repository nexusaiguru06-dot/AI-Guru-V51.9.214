/** V51.9.99 — students' photos (server only): data/ai-guru/admin/photos/<studentId>.jpg|png.
 *  V51.9.173: through lib/ai-guru/storage — files on localhost, Cloud Storage on Cloud Run. */
import { blobs } from '../storage';

const DIR = 'data/ai-guru/admin/photos';
const safe = (id: string) => /^[A-Za-z0-9_-]{1,80}$/.test(id);

export async function savePhoto(studentId: string, bytes: Uint8Array, kind: 'jpeg' | 'png'): Promise<void> {
  if (!safe(studentId)) throw new Error('bad id');
  await deletePhoto(studentId);
  await blobs.put(`${DIR}/${studentId}.${kind === 'png' ? 'png' : 'jpg'}`, bytes, kind === 'png' ? 'image/png' : 'image/jpeg');
}

export async function readPhoto(studentId: string): Promise<{ bytes: Buffer; type: string } | null> {
  if (!safe(studentId)) return null;
  for (const [ext, type] of [['jpg', 'image/jpeg'], ['png', 'image/png']] as const) {
    const bytes = await blobs.get(`${DIR}/${studentId}.${ext}`);
    if (bytes) return { bytes, type };
  }
  return null;
}

export async function deletePhoto(studentId: string): Promise<void> {
  if (!safe(studentId)) return;
  for (const ext of ['jpg', 'png']) await blobs.del(`${DIR}/${studentId}.${ext}`);
}

/** The picture as an HTTP response (never cached by shared caches: it is a child's photo). */
export function photoResponse(p: { bytes: Buffer; type: string }): Response {
  return new Response(new Uint8Array(p.bytes), { headers: { 'content-type': p.type, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}
