'use client';

/**
 * V51.9.99 — add or change the student's photo: a selfie with the front camera or a photo from the
 * phone, cut to a square (drag to move, slider to zoom), and the two switches for shared reels.
 * Used by the student's page, the "My details" box on the boards, and the admin's student list.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cropSquare, showOnReels, type PhotoPrefs } from '@/lib/ai-guru/student/photo';
import { squareJpeg } from '@/lib/ai-guru/student/photo-client';
import { useDevicePhotos } from '@/components/ai-guru/avatar/DevicePhotos';

export interface PhotoEditorProps {
  /** The current photo (data URL or a URL the browser can show), or null. */
  current: string | null;
  prefs: PhotoPrefs;
  /** 'student' talks to the student; 'admin' to the office. */
  who?: 'student' | 'admin';
  name?: string;
  /** image: a new 512 × 512 JPEG, or undefined when only the switches changed. Return an error text to stay open. */
  onSave: (image: string | undefined, prefs: PhotoPrefs) => Promise<string | void>;
  onRemove?: () => Promise<string | void>;
  onClose: () => void;
}

type Pic = { img: CanvasImageSource; w: number; h: number; mirror: boolean };
const VIEW = 260;

export function PhotoEditor({ current, prefs: prefs0, who = 'student', name, onSave, onRemove, onClose }: PhotoEditorProps) {
  const [pic, setPic] = useState<Pic | null>(null);
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState({ x: 0.5, y: 0.4 }); // faces sit a little above the middle
  const [prefs, setPrefs] = useState<PhotoPrefs>(prefs0);
  const [cam, setCam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const view = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const student = who === 'student';

  const stopCam = useCallback(() => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setCam(false); }, []);
  useEffect(() => () => stopCam(), [stopCam]);

  // draw the crop preview
  useEffect(() => {
    const c = view.current;
    if (!c || !pic) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const { sx, sy, size } = cropSquare(pic.w, pic.h, zoom, centre.x, centre.y);
    ctx.save();
    ctx.clearRect(0, 0, VIEW, VIEW);
    if (pic.mirror) { ctx.translate(VIEW, 0); ctx.scale(-1, 1); }
    ctx.drawImage(pic.img, sx, sy, size, size, 0, 0, VIEW, VIEW);
    ctx.restore();
  }, [pic, zoom, centre]);

  const openCamera = async () => {
    setErr('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      stream.current = s;
      setCam(true);
      requestAnimationFrame(() => { if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => {}); } });
    } catch {
      setErr(student ? 'Allow the camera to take a selfie — or use a photo from your phone.' : 'Allow the camera, or upload a photo from this device.');
    }
  };

  const snap = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    setPic({ img: c, w: c.width, h: c.height, mirror: true }); // selfies are shown as in a mirror
    setZoom(1.3);
    setCentre({ x: 0.5, y: 0.45 });
    stopCam();
  };

  // V51.9.104: photos from this phone / computer (several at once, best first, the crop starts on the face)
  const device = useDevicePhotos((p) => {
    setErr('');
    setPic({ img: p.img, w: p.w, h: p.h, mirror: false });
    setZoom(p.crop.zoom);
    setCentre({ x: p.crop.cx, y: p.crop.cy });
  }, { btnClass: 'rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold', label: student ? '📁 From my phone' : '📁 Upload from this device' });

  const onDown = (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx: centre.x, cy: centre.y }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !pic) return;
    const { size } = cropSquare(pic.w, pic.h, zoom, d.cx, d.cy);
    const k = size / VIEW; // picture pixels per screen pixel
    const dx = ((e.clientX - d.x) * k * (pic.mirror ? -1 : 1)) / pic.w;
    const dy = ((e.clientY - d.y) * k) / pic.h;
    setCentre({ x: Math.min(1, Math.max(0, d.cx - dx)), y: Math.min(1, Math.max(0, d.cy - dy)) });
  };
  const onUp = () => { drag.current = null; };

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const image = pic ? squareJpeg(pic.img, pic.w, pic.h, zoom, centre.x, centre.y, pic.mirror) : undefined;
      const e = await onSave(image, { onReels: prefs.onReels && prefs.guardianOk, guardianOk: prefs.guardianOk });
      if (e) setErr(e); else onClose();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!onRemove) return;
    if (!window.confirm(student ? 'Remove your photo?' : `Remove ${name || 'this student'}'s photo?`)) return;
    setBusy(true);
    const e = await onRemove().catch((x: Error) => x.message);
    setBusy(false);
    if (e) setErr(e); else onClose();
  };

  const hasPhoto = !!pic || !!current;
  const box = 'flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-200';

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div className={`max-h-[94vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#0b1220] p-5 text-white shadow-2xl ${device.over ? 'outline-dashed outline-2 outline-cyan-400' : ''}`} onClick={(e) => e.stopPropagation()} {...device.dropProps}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{student ? 'My photo' : `Photo${name ? ` — ${name}` : ''}`}</h2>
          <button onClick={onClose} className="rounded-lg px-2 text-xl text-slate-400 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="flex flex-col items-center gap-3">
          {cam ? (
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <video ref={video} playsInline muted autoPlay className="h-[260px] w-[260px] -scale-x-100 object-cover" />
              <div className="pointer-events-none absolute inset-3 rounded-full border-2 border-dashed border-white/70" />
            </div>
          ) : pic ? (
            <div className="relative h-[260px] w-[260px] cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-slate-800 active:cursor-grabbing"
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <canvas ref={view} width={VIEW} height={VIEW} className="h-full w-full" />
              <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 129px, rgba(0,0,0,0.55) 130px)' }} />
              <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80" />
            </div>
          ) : current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current} alt="" className="h-40 w-40 rounded-full border-4 border-white object-cover shadow-lg" />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-full border-2 border-dashed border-white/30 text-6xl text-white/40">👤</div>
          )}

          {pic && !cam && (
            <label className="flex w-[260px] items-center gap-2 text-xs text-slate-300">
              <span>🔍</span>
              <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
              <span className="w-24 text-right text-[11px] text-slate-400">drag to move</span>
            </label>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            {cam ? (
              <>
                <button onClick={snap} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f]">📸 Take photo</button>
                <button onClick={stopCam} className="rounded-xl bg-white/10 px-4 py-2 text-sm">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={openCamera} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold">📷 {student ? 'Take a selfie' : 'Camera'}</button>
                {device.button}
              </>
            )}
          </div>
          {!cam && device.dropHint}
          <div className="w-full">{device.tray}</div>
        </div>

        <div className="mt-4 space-y-2">
          <label className={box}>
            <input type="checkbox" className="mt-1" checked={prefs.guardianOk} onChange={(e) => setPrefs({ guardianOk: e.target.checked, onReels: e.target.checked && prefs.onReels })} />
            <span>{student ? 'My parent or guardian agrees to my photo being shown on reels I share.' : 'The parent or guardian agreed to the photo being shown on reels the student shares.'}
              </span>
          </label>
          <label className={`${box} ${prefs.guardianOk ? '' : 'opacity-50'}`}>
            <input type="checkbox" className="mt-1" disabled={!prefs.guardianOk} checked={prefs.onReels && prefs.guardianOk} onChange={(e) => setPrefs({ ...prefs, onReels: e.target.checked })} />
            <span>{student ? 'Show my photo on the reels I share' : 'Show the photo on the reels this student shares'}
              <span className="block text-xs text-slate-400">Next to your name at the bottom, and “Shared by” on the last cards. Everyone who watches the reel will see it.</span></span>
          </label>
          {!showOnReels(prefs) && hasPhoto && <p className="text-xs text-slate-400">{student ? 'Your photo stays on your profile only.' : 'The photo stays on the profile only.'}</p>}
        </div>

        {err && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{err}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {current && onRemove && <button onClick={remove} disabled={busy} className="mr-auto rounded-lg px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10">Remove photo</button>}
          <button onClick={onClose} className="ml-auto rounded-xl bg-white/10 px-4 py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={busy || cam || (!pic && !current)} className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-5 py-2 text-sm font-extrabold disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
