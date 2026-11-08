/**
 * V51.9.100 — teachers' avatars (server only):
 *   data/ai-guru/teacher/avatars/<id>/meta.json, photo.jpg|png, voice.wav, face.mp4|webm
 * V51.9.173: meta.json is a record (files or PostgreSQL); the photo, voice and video are files (local or Cloud Storage).
 */
import { blobs, docs } from '../storage';
import { safeAvatarId, type AvatarMeta } from './avatar';

const ROOT = 'data/ai-guru/teacher/avatars';
function dirOf(id: string): string {
  if (!safeAvatarId(id)) throw new Error('bad avatar id');
  return `${ROOT}/${id}`;
}

export async function readMeta(id: string): Promise<AvatarMeta | null> {
  if (!safeAvatarId(id)) return null;
  return docs.get<AvatarMeta>(`${dirOf(id)}/meta.json`);
}

export const writeMeta = (m: AvatarMeta) => docs.put(`${dirOf(m.id)}/meta.json`, m);

export async function savePhoto(id: string, bytes: Uint8Array, kind: 'jpeg' | 'png') {
  const d = dirOf(id);
  await blobs.del(`${d}/photo.jpg`);
  await blobs.del(`${d}/photo.png`);
  await blobs.put(`${d}/${kind === 'png' ? 'photo.png' : 'photo.jpg'}`, bytes, kind === 'png' ? 'image/png' : 'image/jpeg');
}

export async function readPhoto(id: string): Promise<{ bytes: Buffer; type: string } | null> {
  if (!safeAvatarId(id)) return null;
  for (const [f, type] of [['photo.jpg', 'image/jpeg'], ['photo.png', 'image/png']] as const) {
    const bytes = await blobs.get(`${dirOf(id)}/${f}`);
    if (bytes) return { bytes, type };
  }
  return null;
}

export const saveVoice = (id: string, bytes: Uint8Array) => blobs.put(`${dirOf(id)}/voice.wav`, bytes, 'audio/wav');
export async function readVoice(id: string): Promise<Buffer | null> {
  if (!safeAvatarId(id)) return null;
  return blobs.get(`${dirOf(id)}/voice.wav`);
}
export async function deleteVoice(id: string) { if (safeAvatarId(id)) await blobs.del(`${dirOf(id)}/voice.wav`); }

export async function saveVideo(id: string, bytes: Uint8Array, kind: 'mp4' | 'webm') {
  const d = dirOf(id);
  await blobs.del(`${d}/face.mp4`);
  await blobs.del(`${d}/face.webm`);
  await blobs.put(`${d}/face.${kind}`, bytes, kind === 'mp4' ? 'video/mp4' : 'video/webm');
}
export async function readVideo(id: string): Promise<{ bytes: Buffer; type: 'mp4' | 'webm' } | null> {
  if (!safeAvatarId(id)) return null;
  for (const k of ['mp4', 'webm'] as const) {
    const bytes = await blobs.get(`${dirOf(id)}/face.${k}`);
    if (bytes) return { bytes, type: k };
  }
  return null;
}
export async function deleteVideo(id: string) {
  if (!safeAvatarId(id)) return;
  for (const k of ['mp4', 'webm']) await blobs.del(`${dirOf(id)}/face.${k}`);
}

/** Removes the whole avatar (photo, voice, video, settings). */
export async function deleteAvatar(id: string) {
  if (!safeAvatarId(id)) return;
  const d = dirOf(id);
  await docs.del(`${d}/meta.json`);
  // V51.9.175: delete the known files by name (works the same on every file store), then anything else left in the folder
  await Promise.all(['photo.jpg', 'photo.png', 'voice.wav', 'face.mp4', 'face.webm'].map((f) => blobs.del(`${d}/${f}`)));
  await blobs.delPrefix(d).catch(() => undefined);
}
