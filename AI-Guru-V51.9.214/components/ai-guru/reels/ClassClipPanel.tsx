'use client';

/**
 * V51.9.120 — Reel Studio "🎓 From class": a part of a class sent from the whiteboard (🎬 Edit as reel) or opened from
 * a class file (⬇ Class file). The same maths animation is built again here; the student chooses the language and the
 * parts to keep, changes the words the teacher says, and then designs it on the preview like any reel.
 */
import { useMemo, useRef, useState } from 'react';
import { cleanClip, clipCaptions, clipLang, clipSegments, downloadClip, keptSegments, segmentName, type ClassClip } from '@/lib/ai-guru/reels/class-clip';
import type { Lang } from '@/lib/ai-guru/reels/motion';

const btn = 'rounded-lg border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10 disabled:opacity-40';

export function ClassClipPanel({ clip, onChange }: { clip: ClassClip | null; onChange: (c: ClassClip | null) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState('');
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const segs = useMemo(() => { try { return clip ? clipSegments(clip) : []; } catch { return []; } }, [clip]);
  const kept = useMemo(() => (clip ? new Set(keptSegments(clip, segs).map((s) => s.id)) : new Set<string>()), [clip, segs]);
  const captions = useMemo(() => { try { return clip ? clipCaptions(clip) : []; } catch { return []; } }, [clip]);
  const lang = clip ? clipLang(clip) : 'en';
  const words = draft ?? clip?.words ?? {};
  const wordsChanged = draft !== null && JSON.stringify(draft) !== JSON.stringify(clip?.words ?? {});

  const open = async (f: File | undefined) => {
    if (!f) return;
    setProblem('');
    try { onChange(cleanClip(await f.text())); setDraft(null); } catch (e) { setProblem(e instanceof Error ? e.message : 'Could not open that file.'); }
  };
  const openBtn = (
    <>
      <button className={btn} onClick={() => file.current?.click()}>📂 Open a class file</button>
      <input ref={file} type="file" accept=".json,application/json" className="hidden" aria-label="Class file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void open(f); }} />
    </>
  );

  if (!clip) {
    return (
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm" data-class-clip>
        <p className="text-white/70">Take any part of a class into the Reel Studio: on the class whiteboard press <b>🎬 Edit as reel</b> (it opens here in a new tab while the class goes on), or <b>⬇ Class file</b> to save it and open it here later.</p>
        <div className="flex flex-wrap gap-2">{openBtn}</div>
        {problem && <p className="text-xs text-rose-300">{problem}</p>}
      </div>
    );
  }

  const langs = [...new Set(segs.map((s) => s.lang))] as Lang[];
  const inLang = segs.filter((s) => s.lang === lang);
  const toggle = (id: string) => {
    const next = new Set(kept);
    if (next.has(id)) next.delete(id); else next.add(id);
    if (!next.size) return; // at least one part
    onChange({ ...clip, keep: inLang.filter((s) => next.has(s.id)).map((s) => s.id) });
  };
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3" data-class-clip>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-bold">{clip.kind === 'problem' ? '✏️ Problem' : '📖 Lecture'} {clip.nth} · {clip.title}</span>
        {clip.chapter && clip.chapter !== clip.title && <span className="text-xs text-white/45">{clip.chapter}</span>}
      </div>
      {langs.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-white/50">Reel language</span>
          {langs.map((l) => <button key={l} className={`${btn} ${l === lang ? 'border-cyan-300 bg-cyan-400/20' : ''}`} onClick={() => onChange({ ...clip, lang: l, keep: undefined })}>{l === 'ml' ? 'Malayalam' : 'English'}</button>)}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs text-white/50">Parts in the reel (untick what you do not want):</p>
        <div className="flex flex-wrap gap-1.5">
          {inLang.map((s) => (
            <label key={s.id} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${kept.has(s.id) ? 'border-violet-400 bg-violet-500/20' : 'border-white/10 text-white/50'}`}>
              <input type="checkbox" checked={kept.has(s.id)} onChange={() => toggle(s.id)} />{clip.blocks.length > 1 ? `${clip.blocks.findIndex((b) => b.id === s.blockId) + 1}. ` : ''}{segmentName(s)}
            </label>
          ))}
        </div>
      </div>
      <details className="rounded-lg border border-white/10">
        <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold">✍ Words the teacher says ({captions.length}) {Object.keys(clip.words ?? {}).length ? `· ${Object.keys(clip.words ?? {}).length} changed` : ''}</summary>
        <div className="max-h-80 space-y-1.5 overflow-y-auto p-2">
          <p className="text-[11px] text-white/45">Change any line; the voice says your words. The maths on the board stays as it is.</p>
          {captions.map((c) => (
            <textarea key={c} rows={1} value={words[c] ?? c} onChange={(e) => setDraft({ ...words, [c]: e.target.value })}
              className={`w-full rounded-md border bg-white/[0.04] px-2 py-1 text-xs outline-none focus:border-violet-400 ${words[c] !== undefined && words[c] !== c ? 'border-amber-300/50' : 'border-white/10'}`} aria-label="Teacher's words" />
          ))}
          <div className="sticky bottom-0 flex gap-1.5 bg-[#04101c]/90 py-1">
            <button className="rounded-lg bg-cyan-400 px-3 py-1 text-xs font-extrabold text-[#04121f] disabled:opacity-40" disabled={!wordsChanged}
              onClick={() => { const w: Record<string, string> = {}; for (const [k, v] of Object.entries(draft ?? {})) if (v.trim() && v !== k) w[k] = v; onChange({ ...clip, words: w }); setDraft(null); }}>▶ Use these words</button>
            <button className={btn} disabled={!Object.keys(clip.words ?? {}).length && !draft} onClick={() => { setDraft(null); onChange({ ...clip, words: {} }); }}>↺ Original words</button>
          </div>
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={() => downloadClip(clip)} title="Save with your choices, to open again later">⬇ Save as class file</button>
        {openBtn}
        <button className={btn} onClick={() => onChange(null)}>✕ Close</button>
      </div>
      {problem && <p className="text-xs text-rose-300">{problem}</p>}
      <p className="text-[11px] text-white/45">Now design it on the preview — drag, resize, colours, stickers — then ⬇ Download MP4.</p>
    </div>
  );
}
