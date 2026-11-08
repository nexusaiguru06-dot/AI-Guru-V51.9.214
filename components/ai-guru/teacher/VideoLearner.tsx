'use client';
import { openRouter } from '@/lib/ai-guru/openrouter';
import { useRef, useState } from 'react';
import { callGeminiClientImages, studentKey } from '@/lib/student-key';
import { saveLearned } from '@/lib/ai-guru/motion-class/dna/learned';
import { pushTeacherDna } from '@/lib/ai-guru/teacher/sync';
import { analyseFrames, dnaName, draftToLearned, extractFrames, SEGMENT_DNAS, type TemplateDraft, type VideoFrame } from '@/lib/ai-guru/teacher/video-style';

const MAX_MB = 400;

/** Upload a teaching video; the app learns how it teaches and saves that as a template. */
export function VideoLearner({ onSaved }: { onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const run = async (f: File) => {
    setErr(''); setDone(''); setDraft(null); setFrames([]); setFile(f);
    if (!f.type.startsWith('video/')) { setErr('Please choose a video file (MP4 or WebM).'); return; }
    if (f.size > MAX_MB * 1048576) { setErr(`That video is larger than ${MAX_MB} MB. Cut a shorter part (one problem) and try again.`); return; }
    if (!studentKey.hasValidatedKey() && !openRouter.hasUsable()) { setErr('Learning from a video needs a Gemini or OpenRouter key. Add one in AI Guru → Settings → Gemini.'); return; }
    try {
      setBusy('Looking through the video…');
      const { frames: fr } = await extractFrames(f, 10, (n) => setBusy(`Looking through the video… ${n}/10`));
      setFrames(fr);
      setBusy('Learning how it teaches…');
      const d = await analyseFrames(fr, (system, user, frs) => callGeminiClientImages(system, user, frs.map((x) => ({ base64: x.base64, mimeType: 'image/jpeg' }))));
      setDraft(d);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  };

  const save = async () => {
    if (!draft || !file) return;
    saveLearned(draftToLearned(draft, file.name));
    const ok = await pushTeacherDna();
    setDone(ok ? `Saved “${draft.name}”. Students’ classes can use it now.` : `Saved “${draft.name}” on this computer. It will reach the classroom when the server is reachable.`);
    setDraft(null); onSaved();
  };

  const set = <K extends keyof TemplateDraft>(k: K, v: TemplateDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-dashed border-white/25 p-6 text-center" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void run(f); }}>
        <p className="text-slate-300">Upload a video of how you like to teach a problem.</p>
        <p className="mt-1 text-xs text-slate-500">The app learns its steps, pace and layout, then teaches your other problems the same way with its own pictures. The video’s own pictures and voice are not copied, and the file is not kept.</p>
        <button onClick={() => input.current?.click()} disabled={!!busy} className="mt-4 rounded-xl bg-cyan-400 px-5 py-2.5 font-extrabold text-[#04121f] disabled:opacity-50">Choose a video</button>
        <input ref={input} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f); e.target.value = ''; }} />
        {file && <p className="mt-3 text-sm text-slate-400">{file.name} · {(file.size / 1048576).toFixed(1)} MB</p>}
      </div>
      {busy && <p role="status" className="text-center text-cyan-200">{busy}</p>}
      {err && <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</p>}
      {done && <p role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{done}</p>}
      {frames.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1">{frames.map((f) => <img key={f.t} src={`data:image/jpeg;base64,${f.base64}`} alt={`Video at ${Math.round(f.t)} seconds`} className="h-20 shrink-0 rounded-lg border border-white/10" />)}</div>}

      {draft && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[.04] p-5">
          <h3 className="text-lg font-extrabold">What the app learned — check it and save</h3>
          <label className="block text-sm font-bold">Template name<input value={draft.name} onChange={(e) => set('name', e.target.value.slice(0, 60))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-normal outline-none focus:border-cyan-400" /></label>
          <label className="block text-sm font-bold">About<textarea value={draft.description} onChange={(e) => set('description', e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-normal outline-none focus:border-cyan-400" /></label>
          <div>
            <div className="text-sm font-bold">Drawn with (in order)</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {draft.segments.map((s, i) => <span key={s} className="flex items-center gap-1 rounded-full bg-violet-400/15 py-1 pl-3 pr-1 text-sm text-violet-100">{i + 1}. {dnaName(s)}<button onClick={() => set('segments', draft.segments.filter((x) => x !== s))} disabled={draft.segments.length < 2} aria-label={`Remove ${dnaName(s)}`} className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30">✕</button></span>)}
              <select value="" onChange={(e) => e.target.value && set('segments', [...draft.segments, e.target.value].slice(0, 5))} aria-label="Add a part" className="rounded-xl border border-white/15 bg-[#0b1426] px-2 py-1.5 text-sm"><option value="">+ add a part</option>{SEGMENT_DNAS.filter((d) => !draft.segments.includes(d.id as string)).map((d) => <option key={d.id as string} value={d.id as string}>{d.name.slice(0, 60)}</option>)}</select>
            </div>
          </div>
          {draft.stepsOutline.length > 0 && <div><div className="text-sm font-bold">Steps of the video</div><ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-300">{draft.stepsOutline.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
          <label className="block text-sm font-bold">How it teaches ({draft.pace} pace)<textarea value={draft.styleNotes} onChange={(e) => set('styleNotes', e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-normal outline-none focus:border-cyan-400" /></label>
          <label className="block text-sm font-bold">Words that tell the app when to use it (separated by commas)<input value={draft.keywords.join(', ')} onChange={(e) => set('keywords', e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10))} className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-normal outline-none focus:border-cyan-400" /></label>
          <div className="flex gap-3"><button onClick={save} className="rounded-xl bg-cyan-400 px-5 py-2.5 font-extrabold text-[#04121f]">Save template</button><button onClick={() => setDraft(null)} className="rounded-xl border border-white/20 px-5 py-2.5 font-bold">Discard</button></div>
        </div>
      )}
    </div>
  );
}
