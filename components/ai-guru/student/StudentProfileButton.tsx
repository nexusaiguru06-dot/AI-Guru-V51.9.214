'use client';

/** A small button and form for the student's details (name, standard, school, place), written on the MP4s they make. */

import { useEffect, useState } from 'react';
import { cleanWhatsapp, loadProfile, saveProfile, profileIsEmpty, type StudentProfile } from '@/lib/ai-guru/student/profile';
import { loadLocalPhoto, saveLocalPhoto, showOnReels, type LocalPhoto } from '@/lib/ai-guru/student/photo';
import { PhotoEditor } from './PhotoEditor';

const FIELDS: Array<['name' | 'standard' | 'school' | 'place', string, string]> = [
  ['name', 'Name', 'Your name'],
  ['standard', 'Standard', 'e.g. 8'],
  ['school', 'Name of school', 'School name'],
  ['place', 'Place', 'Town or village'],
];

export function StudentProfileButton({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<StudentProfile>({ name: '', standard: '', school: '', place: '' });
  useEffect(() => setP(loadProfile()), []);
  // V51.9.99: the photo for the reels (kept in this browser; the student's page also keeps it on the account)
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  useEffect(() => setPhoto(loadLocalPhoto()), [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={inline ? 'rounded-md border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-400/20' : 'fixed bottom-20 left-3 z-40 rounded-full border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-900 shadow'}>
        {inline ? '👤 Details' : profileIsEmpty(p) ? 'My details' : p.name || 'My details'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <form
            className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              setP(saveProfile(p));
              setOpen(false);
            }}
          >
            <h2 className="text-lg font-bold text-indigo-950">My details</h2>
            <p className="text-xs text-slate-600">Written on the videos you download (not in the live class). They stay in this browser.</p>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
              {photo
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo.dataUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-indigo-300" />
                : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">👤</span>}
              <span className="flex-1 text-xs text-slate-600">{photo ? (showOnReels(photo) ? 'Your photo is shown on the reels you share.' : 'Photo saved — not shown on reels.') : 'Add your photo to show it on the reels you share.'}</span>
              <button type="button" onClick={() => setPhotoOpen(true)} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800">{photo ? 'Change' : '📷 Add photo'}</button>
            </div>
            {FIELDS.map(([k, label, ph]) => (
              <label key={k} className="block text-sm font-medium text-slate-800">
                {label}
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={p[k]} placeholder={ph} maxLength={k === 'school' ? 60 : 40} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
              </label>
            ))}
            {/* V51.9.125: a WhatsApp number for the reels' footer, shown only with a parent's OK (reels are public) */}
            <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
              <label className="block text-sm font-medium text-slate-800">
                WhatsApp number <span className="font-normal text-slate-500">(optional)</span>
                <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" inputMode="tel" value={p.whatsapp ?? ''} placeholder="+91 98470 12345" maxLength={20}
                  onChange={(e) => setP({ ...p, whatsapp: e.target.value, whatsappOnReels: e.target.value.trim() ? p.whatsappOnReels : false })} />
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input type="checkbox" className="mt-0.5" checked={!!p.whatsappOnReels} disabled={!(p.whatsapp ?? '').trim()} onChange={(e) => setP({ ...p, whatsappOnReels: e.target.checked })} />
                <span>Show it on the reels I share. <b>My parent or guardian agrees.</b> Anyone who sees the reel can message this number — a parent&apos;s number is safest.</span>
              </label>
              {(p.whatsapp ?? '').trim() !== '' && !cleanWhatsapp(p.whatsapp) && <p className="text-xs text-rose-600">Type 7 to 15 digits, for example +91 98470 12345.</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white">Save</button>
            </div>
          </form>
        </div>
      )}
      {photoOpen && (
        <PhotoEditor current={photo?.dataUrl ?? null} prefs={{ onReels: !!photo?.onReels, guardianOk: !!photo?.guardianOk }}
          onSave={async (image, prefs) => { const dataUrl = image ?? photo?.dataUrl; if (!dataUrl) return 'Add a photo first.'; if (!saveLocalPhoto({ dataUrl, ...prefs })) return 'This browser could not keep the photo.'; setPhoto(loadLocalPhoto()); }}
          onRemove={async () => { saveLocalPhoto({ dataUrl: null }); setPhoto(null); }}
          onClose={() => setPhotoOpen(false)} />
      )}
    </>
  );
}
