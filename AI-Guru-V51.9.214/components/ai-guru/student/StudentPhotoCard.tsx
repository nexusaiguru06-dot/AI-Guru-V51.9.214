'use client';

/**
 * V51.9.99 — the photo on the student's page: shows it, opens the editor, and keeps this browser's
 * copy (what the reel maker uses) in step with the one on the server:
 *   - server has a newer photo → copied to this browser;
 *   - server has none but this browser has one the student made earlier (e.g. in "My details"
 *     before signing in) and nobody removed a photo since → sent to the server;
 *   - the photo was removed (by the student elsewhere, or by the office) → this browser drops it too.
 */

import { useCallback, useEffect, useState } from 'react';
import { PhotoEditor } from './PhotoEditor';
import { loadLocalPhoto, saveLocalPhoto, showOnReels, type PhotoMeta, type PhotoPrefs } from '@/lib/ai-guru/student/photo';

interface Props {
  name: string;
  photo?: PhotoMeta;
  photoRemoved?: { at: string; by: 'student' | 'admin' };
  /** Set when the admin is viewing this student's page: nothing is copied to this browser then. */
  asId?: string | null;
  onChanged?: () => void;
}

const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res(String(r.result)); r.onerror = () => rej(new Error('read')); r.readAsDataURL(b); });

export function StudentPhotoCard({ name, photo, photoRemoved, asId, onChanged }: Props) {
  const q = asId ? `?as=${encodeURIComponent(asId)}` : '';
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  const sync = useCallback(async () => {
    const local = asId ? null : loadLocalPhoto();
    if (photo) {
      if (local && local.at === photo.at) {
        setUrl(local.dataUrl);
        if (local.onReels !== photo.onReels || local.guardianOk !== photo.guardianOk) saveLocalPhoto({ ...local, onReels: photo.onReels, guardianOk: photo.guardianOk }, local.at);
        return;
      }
      if (local && local.at > photo.at) {
        // changed on this device (e.g. in "My details" on a board) since the account's copy: send it up
        setUrl(local.dataUrl);
        const r = await fetch('/api/ai-guru/student-portal/photo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: local.dataUrl, onReels: local.onReels, guardianOk: local.guardianOk }) }).catch(() => null);
        const j = r?.ok ? await r.json().catch(() => null) : null;
        if (j?.photo?.at) { saveLocalPhoto(local, j.photo.at); onChanged?.(); }
        return;
      }
      const r = await fetch(`/api/ai-guru/student-portal/photo${q}`, { cache: 'no-store' }).catch(() => null);
      if (!r?.ok) return;
      const dataUrl = await toDataUrl(await r.blob());
      setUrl(dataUrl);
      if (!asId) saveLocalPhoto({ dataUrl, onReels: photo.onReels, guardianOk: photo.guardianOk }, photo.at);
      return;
    }
    if (!local) { setUrl(null); return; }
    if (photoRemoved && photoRemoved.at >= local.at) {
      saveLocalPhoto({ dataUrl: null });
      setUrl(null);
      if (photoRemoved.by === 'admin') setNote('The school office removed your photo.');
      return;
    }
    // a photo made on this device before the account had one: keep it on the account too
    const r = await fetch('/api/ai-guru/student-portal/photo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: local.dataUrl, onReels: local.onReels, guardianOk: local.guardianOk }) }).catch(() => null);
    setUrl(local.dataUrl);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (j?.photo?.at) { saveLocalPhoto(local, j.photo.at); onChanged?.(); }
  }, [asId, photo, photoRemoved, q, onChanged]);

  useEffect(() => { void sync(); }, [sync]);

  const save = async (image: string | undefined, prefs: PhotoPrefs): Promise<string | void> => {
    const r = await fetch(`/api/ai-guru/student-portal/photo${q}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...(image ? { image } : {}), ...prefs }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return j.error || 'Could not save the photo. Try again.';
    if (!asId) {
      const cur = loadLocalPhoto();
      const dataUrl = image ?? cur?.dataUrl ?? url;
      if (dataUrl) saveLocalPhoto({ dataUrl, ...prefs }, j.photo?.at);
    }
    if (image) setUrl(image);
    setNote('');
    onChanged?.();
  };

  const remove = async (): Promise<string | void> => {
    const r = await fetch(`/api/ai-guru/student-portal/photo${q}`, { method: 'DELETE' });
    if (!r.ok) return 'Could not remove the photo.';
    if (!asId) saveLocalPhoto({ dataUrl: null });
    setUrl(null);
    onChanged?.();
  };

  const prefs: PhotoPrefs = { onReels: !!photo?.onReels, guardianOk: !!photo?.guardianOk };
  return (
    <>
      <button onClick={() => setOpen(true)} className="group relative shrink-0" title={url ? 'Change photo' : 'Add your photo'}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-16 w-16 rounded-full border-2 border-white object-cover shadow-lg ring-2 ring-cyan-400/60" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-cyan-300/60 bg-cyan-400/10 text-2xl">📷</span>
        )}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#04121f] px-2 py-0.5 text-[10px] font-bold text-cyan-200 ring-1 ring-cyan-400/40">
          {url ? (showOnReels(photo) ? '🎬 on reels' : 'Change') : 'Add photo'}
        </span>
      </button>
      {note && <span className="text-xs text-amber-300">{note}</span>}
      {open && <PhotoEditor current={url} prefs={prefs} name={name} onSave={save} onRemove={url ? remove : undefined} onClose={() => setOpen(false)} />}
    </>
  );
}
