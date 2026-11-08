'use client';

/**
 * V51.9.121 — "see it before you post it": the finished MP4 plays here first; then 📱 Share (the phone's share menu:
 * WhatsApp, Instagram, YouTube …), ⬇ Download, or ✏️ Change it (back to editing / to the Reel Studio).
 * Used by the class whiteboard (📱 Share reel) and the Reel Studio (👁 Preview, ⬇ Download, 📱 Share).
 */
import { useEffect, useState } from 'react';
import { checkSummary, type ReelCheck } from '@/lib/ai-guru/reels/motion/self-check';
import { canShareVideo, saveFile, shareReel } from '@/lib/ai-guru/reels/share-reel';

export type PreviewState =
  | { phase: 'choose' }
  | { phase: 'making'; progress: number; note?: string }
  | { phase: 'ready'; url: string; blob: Blob; name: string; check?: ReelCheck | null; seconds?: number }
  | { phase: 'error'; message: string };

export function ReelPreviewDialog({ state, title, caption, onClose, onEdit, editLabel = '✏️ Change it', chooser, onMake, makeLabel = '🎬 Make my reel' }: {
  state: PreviewState; title: string; caption: string; onClose: () => void; onEdit?: () => void; editLabel?: string;
  /** Choices before making (language …), shown in the 'choose' phase. */
  chooser?: React.ReactNode; onMake?: () => void; makeLabel?: string;
}) {
  const [note, setNote] = useState('');
  const [anyway, setAnyway] = useState(false);
  const share = canShareVideo();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && state.phase !== 'making') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, state.phase]);

  const ready = state.phase === 'ready' ? state : null;
  const problem = !!ready?.check && ready.check.checked && !ready.check.ok;
  const doShare = async () => {
    if (!ready) return;
    if (problem && !anyway) { setAnyway(true); setNote('The check found a problem (see above). Tap again to share it anyway.'); return; }
    const r = await shareReel(ready.blob, ready.name, caption, title);
    setNote(r === 'shared' ? '✓ Shared.' : r === 'downloaded' ? 'Saved the MP4 and copied the caption: post the video and paste the caption.' : '');
  };

  return (
    <div className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Reel preview" data-reel-preview>
      <div className="flex max-h-[96vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl border border-white/15 bg-[#0a1424] p-4 text-white shadow-2xl">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-base font-extrabold">{state.phase === 'ready' ? '👁 Your reel — check it before you post' : '🎬 ' + title}</h2>
          <button onClick={onClose} disabled={state.phase === 'making'} className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10 disabled:opacity-30" aria-label="Close">✕</button>
        </div>

        {state.phase === 'choose' && <>
          {chooser}
          {onMake && <button onClick={onMake} className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-extrabold">{makeLabel}</button>}
        </>}

        {state.phase === 'making' && (
          <div className="space-y-2 py-6 text-center">
            <p className="text-sm text-white/80">Making the video… {Math.round(state.progress * 100)}%</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${Math.round(state.progress * 100)}%` }} /></div>
            {state.note && <p className="text-xs text-white/50">{state.note}</p>}
          </div>
        )}

        {state.phase === 'error' && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{state.message}</p>}

        {ready && <>
          <video src={ready.url} controls autoPlay playsInline className="ag-keep-dark mx-auto max-h-[60vh] w-auto max-w-full rounded-xl bg-black" data-preview-video />
          {ready.check && <p className={`text-xs ${problem ? 'text-amber-300' : 'text-emerald-300'}`}>{ready.check.checked ? (ready.check.ok ? '✓ Checked: sound, voice and picture are fine.' : `⚠ ${checkSummary(ready.check)}`) : checkSummary(ready.check)}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => void doShare()} className="col-span-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-extrabold text-[#04121f]">
              {problem && anyway ? '📱 Share anyway' : share ? '📱 Share (WhatsApp, Instagram …)' : '📱 Share: save MP4 + copy caption'}
            </button>
            <button onClick={() => { saveFile(ready.blob, ready.name); setNote(`Saved ${ready.name}.`); }} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">⬇ Download</button>
            {onEdit ? <button onClick={onEdit} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">{editLabel}</button> : <button onClick={onClose} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">← Back</button>}
          </div>
          <details className="text-xs text-white/60"><summary className="cursor-pointer">Caption to post with it</summary><textarea readOnly value={caption} className="mt-1 h-20 w-full rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs" /></details>
        </>}
        {note && <p role="status" className="text-xs text-cyan-200">{note}</p>}
      </div>
    </div>
  );
}
