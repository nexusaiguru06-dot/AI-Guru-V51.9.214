'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { learnedDnas } from '@/lib/ai-guru/motion-class/dna/learned';
import { aiLlm, hasAnyAiKey } from '@/lib/ai-guru/teacher/ai';
import { checkSummary } from '@/lib/ai-guru/reels/motion/self-check';
import { makeProblemVideo, selectionFor, problemBlock, splitProblems, type MadeVideo, type VideoLang } from '@/lib/ai-guru/teacher/make-video';
import { dnaLabel } from './SelectionLab';
import { AVATAR_EVENT, loadLocalAvatar, type AvatarForReel } from '@/lib/ai-guru/teacher/avatar';
import { preparedAvatar } from '@/lib/ai-guru/teacher/avatar-client';
import { AVATARS } from '@/lib/ai-guru/features';

interface Job { text: string; state: 'wait' | 'run' | 'done' | 'fail'; stage: string; pct: number; error?: string; video?: MadeVideo; url?: string; chosen: string }

function save(j: Job) {
  if (!j.video || !j.url) return;
  const a = document.createElement('a'); a.href = j.url; a.download = j.video.name; document.body.appendChild(a); a.click(); a.remove();
}

/** Pick problems, pick a template (yours from a video, or automatic), get one MP4 per problem. */
export function VideoMaker({ version }: { version: number }) {
  const [raw, setRaw] = useState('');
  const [tpl, setTpl] = useState('');
  const [lang, setLang] = useState<VideoLang>('en');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  // V51.9.100: the teacher's avatar (set up in My avatar on this computer) in the corner of each video
  const [avatar, setAvatar] = useState<AvatarForReel | null>(null);
  const [faceOn, setFaceOn] = useState(true);
  useEffect(() => { const sync = () => setAvatar(loadLocalAvatar()); sync(); window.addEventListener(AVATAR_EVENT, sync); return () => window.removeEventListener(AVATAR_EVENT, sync); }, []);
  const stop = useRef(false);
  const urls = useRef<string[]>([]);
  const mine = useMemo(() => learnedDnas().filter((l) => l.source === 'teacher-video'), [version]);
  const problems = useMemo(() => splitProblems(raw), [raw]);
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const patch = (i: number, p: Partial<Job>) => setJobs((js) => js.map((j, k) => (k === i ? { ...j, ...p } : j)));

  const start = async () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = [];
    stop.current = false; setRunning(true);
    const llm = hasAnyAiKey() ? aiLlm : null;
    const face = AVATARS && avatar && faceOn ? await preparedAvatar({ ...avatar, style: avatar.style === 'ai' ? 'lipsync' : avatar.style }).catch(() => null) : null;
    setJobs(problems.map((text, i) => ({ text, state: 'wait', stage: '', pct: 0, chosen: dnaLabel(selectionFor(problemBlock(text, i), tpl || null).dna) })));
    for (let i = 0; i < problems.length; i++) {
      if (stop.current) break;
      patch(i, { state: 'run', stage: 'Starting' });
      try {
        const video = await makeProblemVideo(problems[i], i, { title: 'Problem', templateId: tpl || null, language: lang, llm, onStage: (stage) => patch(i, { stage }), onProgress: (pct) => patch(i, { pct }), teacher: face ? { avatar: face, track: null } : null });
        const url = URL.createObjectURL(video.blob); urls.current.push(url);
        patch(i, { state: 'done', video, url, pct: 1, stage: 'Ready' });
      } catch (e) { patch(i, { state: 'fail', error: e instanceof Error ? e.message : String(e) }); }
    }
    setRunning(false);
  };

  const ready = jobs.filter((j) => j.state === 'done');
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section className="space-y-3">
        <label className="block text-sm font-bold text-slate-300">Your problems <span className="font-normal text-slate-500">(leave a blank line between them, or number them 1. 2. 3.)</span>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} placeholder={'1. Solve 2x + 3y = 12 and x − y = 1.\n\n2. Find the HCF of 36 and 48.'} className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-base outline-none focus:border-cyan-400" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">Teach like
            <select value={tpl} onChange={(e) => setTpl(e.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0b1426] px-3 py-2.5 font-normal"><option value="">Automatic (or the template you chose for the problem)</option>{mine.map((t) => <option key={t.id} value={`learned:${t.id}`}>🎬 {t.name}</option>)}</select>
          </label>
          <label className="text-sm font-bold">Language
            <select value={lang} onChange={(e) => setLang(e.target.value as VideoLang)} className="mt-1 w-full rounded-xl border border-white/15 bg-[#0b1426] px-3 py-2.5 font-normal"><option value="en">English</option><option value="ml">Malayalam</option><option value="both">English, then Malayalam</option></select>
          </label>
        </div>
        {!AVATARS ? null : avatar ? (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={faceOn} onChange={(e) => setFaceOn(e.target.checked)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar.photo} alt="" className="h-7 w-7 rounded-full object-cover ring-2 ring-cyan-400/60" /> My face in the corner, lips moving with the voice</label>
        ) : (
          <p className="text-xs text-slate-500">Want your face in the corner of the videos? Set it up in <a href="/ai-guru/teacher/avatar" className="text-cyan-300 underline">My avatar</a>.</p>
        )}
        {mine.length === 0 && <p className="text-xs text-slate-500">To teach like your own video, first save a template in “Learn from a video”.</p>}
        {!hasAnyAiKey() && <p className="text-xs text-amber-300">No AI key is saved on this computer: videos will use the built-in plans (English only). Add a key in Settings for better ones.</p>}
        <div className="flex gap-3">
          <button onClick={start} disabled={running || problems.length === 0} className="rounded-xl bg-cyan-400 px-5 py-2.5 font-extrabold text-[#04121f] disabled:opacity-40">{running ? 'Making…' : `Make ${problems.length || ''} video${problems.length === 1 ? '' : 's'}`}</button>
          {running && <button onClick={() => { stop.current = true; }} className="rounded-xl border border-white/20 px-5 py-2.5 font-bold">Stop after this one</button>}
        </div>
        <p className="text-xs text-slate-500">Keep this page open while the videos are made. It needs a browser that can record MP4 (Chrome or Edge).</p>
      </section>
      <section className="space-y-3">
        {jobs.length === 0 && <p className="text-slate-400">Your videos will appear here.</p>}
        {ready.length > 1 && <button onClick={() => ready.forEach((j, k) => setTimeout(() => save(j), k * 400))} className="rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-bold text-cyan-200">Download all {ready.length}</button>}
        {jobs.map((j, i) => (
          <article key={i} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <p className="line-clamp-2 text-sm text-slate-200">{i + 1}. {j.text}</p>
            <p className="mt-1 text-xs text-slate-500">Template: {j.chosen}</p>
            {j.state === 'run' && <div className="mt-2"><div className="text-xs text-cyan-200">{j.stage}{j.stage === 'Making the video' ? ` · ${Math.round(j.pct * 100)}%` : '…'}</div><div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-cyan-400" style={{ width: `${Math.round(j.pct * 100)}%` }} /></div></div>}
            {j.state === 'wait' && <p className="mt-2 text-xs text-slate-500">Waiting</p>}
            {j.state === 'fail' && <p role="alert" className="mt-2 text-xs text-rose-300">{j.error}</p>}
            {j.state === 'done' && j.video && (
              <div className="mt-3 space-y-2">
                <video src={j.url} controls className="w-full rounded-xl bg-black" />
                <div className="flex items-center gap-3 text-xs text-slate-400"><span>{j.video.seconds}s · {dnaLabel(j.video.dna)} · {j.video.source === 'ai' ? 'AI plan' : 'built-in plan'}{j.video.check?.checked && <span className={j.video.check.ok ? 'text-emerald-400' : 'text-amber-300'} title={checkSummary(j.video.check)}> · {j.video.check.ok ? 'checked ✓' : `⚠ ${j.video.check.problems.find((p) => p.severity === 'error')?.message ?? 'problem'}`}</span>}</span><button onClick={() => save(j)} className="ml-auto rounded-lg bg-cyan-400 px-3 py-1.5 text-sm font-extrabold text-[#04121f]">⬇ MP4</button></div>
              </div>)}
          </article>))}
      </section>
    </div>
  );
}
