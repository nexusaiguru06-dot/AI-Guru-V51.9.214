/** V51.9.99 — shared by the student's and the admin's photo routes. */
import { NextResponse } from 'next/server';
import { update } from './store';
import { deletePhoto, savePhoto } from './photo-store';
import { cleanPrefs, photoBytes, type PhotoMeta } from '../student/photo';

/**
 * Body: { image?: dataUrl, onReels?, guardianOk? }. With an image the photo is replaced; without one only the
 * switches change (there must already be a photo). Returns the new photo info.
 */
export async function savePhotoFor(studentId: string, body: Record<string, unknown>, by: PhotoMeta['by']): Promise<Response> {
  const prefs = cleanPrefs(body);
  if (body.image !== undefined) {
    const p = photoBytes(body.image);
    if ('error' in p) return NextResponse.json({ ok: false, error: p.error }, { status: 400 });
    const found = await update((d) => d.students.some((s) => s.id === studentId));
    if (!found) return NextResponse.json({ ok: false, error: 'Student not found' }, { status: 404 });
    await savePhoto(studentId, p.bytes, p.kind);
  }
  const r = await update((d) => {
    const st = d.students.find((s) => s.id === studentId);
    if (!st) return 'none';
    if (body.image === undefined && !st.photo) return 'nophoto';
    delete st.photoRemoved;
    st.photo = { ...prefs, at: body.image !== undefined ? new Date().toISOString() : st.photo!.at, by: body.image !== undefined ? by : st.photo!.by };
    return st.photo;
  });
  if (r === 'none') return NextResponse.json({ ok: false, error: 'Student not found' }, { status: 404 });
  if (r === 'nophoto') return NextResponse.json({ ok: false, error: 'Add a photo first' }, { status: 400 });
  return NextResponse.json({ ok: true, photo: r });
}

export async function removePhotoFor(studentId: string, by: PhotoMeta['by']): Promise<Response> {
  await deletePhoto(studentId);
  await update((d) => { const st = d.students.find((s) => s.id === studentId); if (st) { delete st.photo; st.photoRemoved = { at: new Date().toISOString(), by }; } });
  return NextResponse.json({ ok: true });
}
