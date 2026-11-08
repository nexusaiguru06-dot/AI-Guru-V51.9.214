'use client';

/**
 * V51.9.152 — the Reel Studio's front page: the five ways to make a reel beautiful (V51.9.157: + stock video), how each works, and the student's
 * uploads from the whiteboard and finished reels (preview, download, delete).
 */
import Link from 'next/link';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AiGuruTopNav } from '../AiGuruTopNav';
import { VideoShelf, WhiteboardParts } from './MyReelsShelves';
import { RawFitNote, RawTray } from './RawReels';
import { parseRaw, wayLink } from '@/lib/ai-guru/reels/raw-reels';

export const WAYS = [
  {
    id: 'design', href: '/ai-guru/reels/design', icon: '🖐', name: 'Design it yourself', ml: 'സ്വയം ഡിസൈൻ ചെയ്യാം',
    uses: 'a part sent from the whiteboard',
    steps: ['Open a part from the whiteboard', 'Right-click anything on the preview: colours, bigger / smaller, background, cards', 'Add text, stickers and shapes; drag to move', 'Preview & post, or download'],
    best: 'Your own look, exactly as you want it. Free, works on any computer.',
    color: 'border-emerald-300/40 bg-emerald-500/[0.07]',
  },
  {
    id: 'style', href: '/ai-guru/reels/style', icon: '✦', name: 'Pick a style', ml: 'ഒരു സ്റ്റൈൽ തിരഞ്ഞെടുക്കാം',
    uses: 'a part sent from the whiteboard',
    steps: ['Open a part from the whiteboard', 'Choose a ready style from the library (Opus-inspired ideas)', 'The look, camera, pace, music and fonts change at once', 'Preview & post, or download'],
    best: 'A beautiful reel in one click. Free.',
    color: 'border-fuchsia-300/40 bg-fuchsia-500/[0.07]',
  },
  {
    id: 'flow', href: '/ai-guru/reels/flow', icon: '✨', name: 'Google Flow (AI video)', ml: 'Google Flow',
    uses: 'an MP4 downloaded from the whiteboard',
    steps: ['Download the MP4 on the whiteboard (it is kept here)', 'Copy the ready prompt', 'Upload the MP4 in Google Flow and paste the prompt', 'Check every number, then keep the new video here'],
    best: 'Real AI video effects. Needs a parent or teacher (18+, a Google AI plan).',
    color: 'border-cyan-300/40 bg-cyan-500/[0.07]',
  },
  {
    // V51.9.213: Google's newest AI video model (Gemini Omni 1.2 Flash, 5 Nov 2026)
    id: 'omni', href: '/ai-guru/reels/omni', icon: '🎬', name: 'Google Omni 1.2 (AI video)', ml: 'Google Omni 1.2',
    uses: 'an MP4 downloaded from the whiteboard (or a picture of it)',
    steps: ['Download the MP4 on the whiteboard (it is kept here)', 'Copy the ready prompt', 'Give the MP4 or a picture to Google Omni 1.2 (Flow, Google Vids or AI Studio) with the prompt', 'Check every number, then keep the new video here'],
    best: 'Google’s newest AI video model: 3–15 s clips in 9:16 with its own sound. Needs a parent or teacher; free in Google Vids (3 a month).',
    color: 'border-violet-300/40 bg-violet-500/[0.07]',
  },
  {
    // V51.9.157
    id: 'stock', href: '/ai-guru/reels/stock', icon: '🎞', name: 'Stock video background', ml: 'വീഡിയോ പശ്ചാത്തലം',
    uses: 'a part sent from the whiteboard + a free clip',
    steps: ['Search a free clip on Pexels or Pixabay (links on the page)', 'Download a small size and upload it here', 'Your lesson plays over the video; set the shade so the numbers stay clear', 'Preview & post, or download'],
    best: 'Real filmed scenes behind your lesson: rivers, forests, space. Free.',
    color: 'border-amber-300/40 bg-amber-500/[0.07]',
  },
] as const;

export function WayTabs({ active }: { active: 'design' | 'style' | 'flow' | 'omni' | 'stock' }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5" aria-label="Ways to make a reel" data-way-tabs>
      <Link href="/ai-guru/reels" className="rounded-lg px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/10" data-way-all>◀ All ways</Link>
      {WAYS.map((w) => (
        <Link key={w.id} href={w.href} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${w.id === active ? 'border-white/40 bg-white/15 text-white' : 'border-white/10 text-white/65 hover:bg-white/10'}`} data-way-tab={w.id} aria-current={w.id === active ? 'page' : undefined}>
          {w.icon} {w.name}
        </Link>
      ))}
    </nav>
  );
}

export default function ReelsHub() {
  const fromClass = useSyncExternalStore(() => () => {}, () => new URLSearchParams(window.location.search).get('from') === 'class', () => false);
  // V51.9.207: the raw reels ticked in the tray below (kept for this visit, so ◀ Back from a way finds them still ticked)
  const [raw, setRawNow] = useState<string[]>([]);
  const setRaw = useCallback((ids: string[]) => { setRawNow(ids); try { sessionStorage.setItem('aig_raw_sel', ids.join(',')); } catch { /* ignore */ } }, []);
  useEffect(() => {
    const t = setTimeout(() => { try { setRawNow(parseRaw(`?raw=${sessionStorage.getItem('aig_raw_sel') || ''}`)); } catch { /* ignore */ } }, 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen bg-[#04101c] text-white">
      <AiGuruTopNav activeLabel="Reel Studio" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6" data-reels-hub>
        <div>
          <h1 className="text-2xl font-extrabold">Reel Studio</h1>
          <p className="text-sm text-white/65">Make a reel from your class beautiful — choose one of five ways. </p>
        </div>
        {fromClass && <p className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100" data-from-class-note>📥 Your part from the whiteboard is here. Choose a way to make it beautiful.</p>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" data-ways>
          {WAYS.map((w, i) => (
            <div key={w.id} className={`flex flex-col gap-2 rounded-2xl border p-4 ${w.color}`} data-way={w.id}>
              <div className="flex items-center gap-2"><span className="text-3xl">{w.icon}</span><span><span className="block text-xs font-bold text-white/50">WAY {i + 1}</span><span className="block text-lg font-extrabold leading-tight">{w.name}</span></span></div>
              <p className="text-xs text-white/60">Uses <b className="text-white/80">{w.uses}</b>.</p>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-white/75">{w.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              <p className="text-xs text-white/55">{w.best}</p>
              <Link href={wayLink(w.href, w.id, raw, fromClass)} className="mt-auto rounded-xl bg-white px-3 py-2 text-center text-sm font-extrabold text-[#04101c] hover:bg-white/90" data-way-choose={w.id}>Choose {w.name} →</Link>
              <RawFitNote way={w.id} selected={raw} />
            </div>
          ))}
        </div>
        <RawTray selected={raw} onChange={setRaw} />
        <WhiteboardParts compact={false} />
        <VideoShelf ways={['whiteboard']} title="🎞 Videos downloaded on the whiteboard" testId="whiteboard" empty={<>None yet. On the whiteboard press <b>⬇ MP4</b> or <b>⬇ Download</b>: the video is kept here too (use it for Google Flow).</>} />
        <VideoShelf ways={['design', 'style', 'stock', 'flow', 'omni']} title="⭐ My reels" testId="mine" empty="Your finished reels appear here: preview them, download them again, or delete them." />
        <p className="text-xs text-white/40">Or <Link href="/ai-guru/reels/design" className="underline">make a reel from a lesson or a sum</Link> instead of a class part.</p>
      </main>
    </div>
  );
}
