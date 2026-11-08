'use client';

/**
 * V51.9.104 — "📁 Upload from this device": one or several photos from the phone's gallery or the computer's folders,
 * or dropped / pasted in. The best come first (a face, sharp, well lit) and the crop starts on the face.
 *
 * A hook so each screen places the button, the drop area and the row of choices where they fit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_PHOTOS, openDevicePhotos, type DevicePhoto } from '@/lib/ai-guru/avatar/device-photos';

export function useDevicePhotos(onPick: (p: DevicePhoto) => void, o: { btnClass: string; label?: string; enabled?: boolean } ) {
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<DevicePhoto[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const pickRef = useRef(onPick);
  useEffect(() => { pickRef.current = onPick; }, [onPick]);
  const enabled = o.enabled ?? true;

  const take = useCallback(async (files: ArrayLike<File> | null | undefined) => {
    if (!files?.length) return;
    setBusy('Opening your photos…'); setProblems([]);
    try {
      const r = await openDevicePhotos(files, (d, n) => setBusy(n > 1 ? `Opening your photos… ${d} of ${n}` : 'Opening your photo…'));
      setPhotos(r.photos);
      const notes = [...r.problems];
      if (r.photos.length && !r.photos[0].face) notes.push('No clear face was found. Pick a photo where you face the camera in good light, then move and zoom it.');
      setProblems(notes);
      if (r.photos[0]) { setPicked(0); pickRef.current(r.photos[0]); } else setPicked(null);
    } finally { setBusy(null); }
  }, []);

  // a picture pasted anywhere on the page (Ctrl+V of a copied photo) — not while typing in a box
  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); void take(files); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [take, enabled]);

  const dropProps = {
    onDragOver: (e: React.DragEvent) => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); setOver(true); } },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); void take(Array.from(e.dataTransfer.files)); },
  };

  const button = (
    <>
      <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className={o.btnClass} title={`One photo, or up to ${MAX_PHOTOS} to choose from`}>{o.label ?? '📁 Upload from this device'}</button>
      <input ref={input} type="file" accept="image/*,.heic,.heif" multiple className="hidden" aria-label="Photos from this device" onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void take(files); }} />
    </>
  );

  const tray = (busy || photos.length > 1 || problems.length > 0) ? (
    <div className="mt-3 space-y-2">
      {busy && <p className="text-xs text-cyan-200">{busy}</p>}
      {photos.length > 1 && (
        <>
          <p className="text-xs text-slate-300">Your photos, best first — tap one:</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <button key={`${p.name}-${i}`} type="button" onClick={() => { setPicked(i); onPick(p); }} title={p.name} className={`relative overflow-hidden rounded-xl border-2 ${picked === i ? 'border-cyan-400' : 'border-transparent'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt={p.name} className="h-16 w-16 object-cover" />
                {i === 0 && p.face && <span className="absolute left-0 top-0 rounded-br-md bg-cyan-400 px-1 text-[9px] font-bold text-[#04121f]">best</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {problems.map((t) => <p key={t} className="rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-100">{t}</p>)}
    </div>
  ) : null;

  /** A hint under the photo; the dashed outline shows while a file is dragged over. */
  const dropHint = <p className="mt-1 hidden text-[11px] text-slate-500 sm:block">…or drop photos here, or paste one (Ctrl+V).</p>;

  return { button, tray, dropProps, dropHint, over, take };
}
