'use client';

/**
 * V51.9.100 — a student makes their own avatar ON THEIR PHONE, with their own key (BYOK).
 * Face: their photo (guardian agreement + "show on my reels" needed) with the mouth and eyes marked; the lips are
 * drawn in the browser (free). Voice: Gemini text-to-speech with the student's own Gemini key (their bill, ticked here).
 * Nothing is uploaded; the AI Guru PC's voice and AI lip-sync are never used for students.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_MARKS, type FaceMarks } from '@/lib/ai-guru/teacher/avatar';
import { BLOCK_TEXT, BYOK_VOICES, loadStudentAvatar, saveStudentAvatar, studentAvatarBlock, type ByokVoice } from '@/lib/ai-guru/student/avatar';
import type { LocalPhoto } from '@/lib/ai-guru/student/photo';
import { decodeImage } from '@/lib/ai-guru/student/photo-client';
import { studentKey, callGeminiTtsClient } from '@/lib/student-key';
import { drawTeacherBubble, prepareAvatar, type PreparedAvatar } from '@/lib/ai-guru/reels/motion/avatar-draw';
import { demoMouthTrack, mouthTrack, type MouthTrack } from '@/lib/ai-guru/reels/motion/lipsync';
import { pcm16ToClip } from '@/lib/ai-guru/reels/motion/voice';
import { SFX_RATE } from '@/lib/ai-guru/reels/motion/sfx';
import { loadReelFonts } from '@/lib/ai-guru/reels/motion/fonts';
import { CHARACTERS, CHARACTER_MARKS, characterById, characterPhoto } from '@/lib/ai-guru/avatar/characters';

const VIEW = 240;
type Dot = 'mouth' | 'eye0' | 'eye1';

export function StudentAvatarEditor({ photo, name, onEditPhoto, onClose }: { photo: LocalPhoto | null; name: string; onEditPhoto: () => void; onClose: () => void }) {
  const saved = useMemo(() => loadStudentAvatar(), []);
  const [marks, setMarks] = useState<FaceMarks>(saved?.marks ?? DEFAULT_MARKS);
  const [voice, setVoice] = useState<ByokVoice>(saved?.voice ?? 'Kore');
  // V51.9.103: a ready-made character instead of my photo (nobody real: no photo or guardian question needed)
  const [character, setCharacter] = useState<string | null>(saved?.character ?? null);
  const pickCharacter = (id: string | null) => {
    setCharacter(id);
    const ch = characterById(id);
    if (ch) { setMarks(CHARACTER_MARKS); setVoice(ch.gemini as ByokVoice); }
    else setMarks(saved && !saved.character ? saved.marks : DEFAULT_MARKS);
  };
  const [optIn, setOptIn] = useState(() => studentKey.getTtsOptIn());
  const hasOwnKey = useMemo(() => studentKey.hasUsableKey(), []);
  const block = studentAvatarBlock({ photo, hasOwnKey, voiceOptIn: optIn, character });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [dot, setDot] = useState<Dot | null>(null);
  const [track, setTrack] = useState<MouthTrack | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const view = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const demo = useRef<MouthTrack>(demoMouthTrack());
  const playing = useRef<{ ctx: AudioContext; start: number } | null>(null);

  useEffect(() => { void loadReelFonts(); }, []);
  const picture = character ? characterPhoto(character) : photo?.dataUrl;
  useEffect(() => { let live = true; if (picture) void decodeImage(picture).then((i) => { if (live) setImg(i); }).catch(() => {}); return () => { live = false; }; }, [picture]);
  const prepared: PreparedAvatar | null = useMemo(() => (img ? prepareAvatar(img, { marks, name, style: 'lipsync', id: 'me' }) : null), [img, marks, name]);

  // marker view
  useEffect(() => {
    const ctx = view.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, VIEW, VIEW);
    if (img) { const side = Math.min(img.naturalWidth, img.naturalHeight); ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, VIEW, VIEW); }
    const M = marks.mouth;
    ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(M.x * VIEW, M.y * VIEW, (M.w * VIEW) / 2, (M.w * VIEW) / 5, 0, 0, Math.PI * 2); ctx.stroke();
    for (const e of marks.eyes ?? []) { ctx.strokeStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(e.x * VIEW, e.y * VIEW, 8, 0, Math.PI * 2); ctx.stroke(); }
  }, [img, marks]);

  // live preview
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const c = preview.current;
      const ctx = c?.getContext('2d');
      if (c && ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        if (prepared) {
          const tr = track ?? demo.current;
          const len = (tr.open.length / tr.fps) * 1000;
          const p = playing.current;
          const t = p ? (p.ctx.currentTime - p.start) * 1000 : (performance.now() - t0) % (len + 600);
          ctx.scale(c.width / 220, c.width / 220);
          drawTeacherBubble(ctx, { avatar: prepared, track: tr }, t, 110, 100, 150);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [prepared, track]);

  const local = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return { x: Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width)), y: Math.min(0.95, Math.max(0.05, (e.clientY - r.top) / r.height)) }; };
  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = local(e);
    const d = (q: { x: number; y: number }) => Math.hypot(q.x - p.x, q.y - p.y);
    const c: Array<[Dot, number]> = [['mouth', d(marks.mouth)], ...(marks.eyes ? ([['eye0', d(marks.eyes[0])], ['eye1', d(marks.eyes[1])]] as Array<[Dot, number]>) : [])];
    setDot(c.sort((a, b) => a[1] - b[1])[0][0]);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dot) return;
    const q = local(e);
    setMarks((m) => (dot === 'mouth' ? { ...m, mouth: { ...m.mouth, ...q } } : { ...m, eyes: m.eyes ? (dot === 'eye0' ? [q, m.eyes[1]] : [m.eyes[0], q]) : m.eyes }));
  };

  /** One sentence in the chosen voice, with the student's own key (a tiny cost on their key). */
  const tryVoice = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await callGeminiTtsClient('Hello! Let us learn maths together, step by step.', 'en-IN', undefined, { voiceName: voice });
      const clip = pcm16ToClip(r.data, r.mimeType);
      setTrack(mouthTrack(clip, SFX_RATE, 30));
      const ctx = new AudioContext({ sampleRate: SFX_RATE });
      const buf = ctx.createBuffer(1, clip.length, SFX_RATE);
      buf.copyToChannel(new Float32Array(clip), 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      playing.current = { ctx, start: ctx.currentTime + 0.05 };
      src.start(ctx.currentTime + 0.05);
      src.onended = () => { playing.current = null; void ctx.close(); };
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const save = () => {
    if (block) { setErr(BLOCK_TEXT[block]); return; }
    if (!saveStudentAvatar({ ...(character ? { character } : {}), marks, voice, at: new Date().toISOString() })) { setErr('This phone could not keep the avatar.'); return; }
    onClose();
  };

  const box = 'flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-200';
  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#0b1220] p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">My avatar</h2>
          <button onClick={onClose} className="rounded-lg px-2 text-xl text-slate-400 hover:text-white" aria-label="Close">✕</button>
        </div>
        <div className="mb-3">
          <p className="mb-1 text-xs font-bold text-slate-300">Whose face?</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => pickCharacter(null)} className={`rounded-xl border-2 px-3 py-2 text-xs ${!character ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10'}`}>📷 My photo</button>
            {CHARACTERS.map((c) => (
              <button key={c.id} onClick={() => pickCharacter(c.id)} className={`flex flex-col items-center rounded-xl border-2 p-1 text-[10px] ${character === c.id ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10'}`} title="An AI Guru character: nobody real">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={characterPhoto(c.id) ?? ''} alt="" className="h-11 w-11 rounded-full object-cover" />
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-400">Made and kept on this phone only. The lips move on your photo for free; the voice uses <b>your own Gemini key</b>. AI Guru does not pay for avatars.</p>

        {(block === 'no-photo' || block === 'no-guardian') ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{BLOCK_TEXT[block]}</p>
            <button onClick={onEditPhoto} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f]">📷 My photo</button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-center gap-3">
              <div className={`relative h-[240px] w-[240px] cursor-crosshair touch-none select-none overflow-hidden rounded-2xl bg-slate-800 ${character ? 'hidden' : ''}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => setDot(null)} onPointerCancel={() => setDot(null)}>
                <canvas ref={view} width={VIEW} height={VIEW} className="h-full w-full" />
              </div>
              <canvas ref={preview} width={300} height={300} className="h-[150px] w-[150px] rounded-xl" />
            </div>
            {!character && (
              <>
                <p className="mt-2 text-xs text-slate-300">Drag the <b className="text-rose-300">red oval</b> onto your lips and the <b className="text-cyan-300">blue circles</b> onto your eyes.</p>
                <label className="mt-1 flex items-center gap-2 text-xs text-slate-300">Mouth width<input type="range" min={0.08} max={0.4} step={0.005} value={marks.mouth.w} onChange={(e) => setMarks((m) => ({ ...m, mouth: { ...m.mouth, w: Number(e.target.value) } }))} className="flex-1" /></label>
              </>
            )}
            {character && <p className="mt-2 text-center text-xs text-slate-300">{characterById(character)?.name} — an AI Guru character (nobody real). Your name still shows under the bubble.</p>}

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-bold text-slate-300">My avatar’s voice (Gemini)
                <select value={voice} onChange={(e) => setVoice(e.target.value as ByokVoice)} className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-normal text-white">
                  {BYOK_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </label>
              {!hasOwnKey ? (
                <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{BLOCK_TEXT['no-key']} <a href="/ai-guru/settings/gemini" className="font-bold text-cyan-300 underline">Add my key</a></div>
              ) : (
                <label className={box}>
                  <input type="checkbox" className="mt-1" checked={optIn} onChange={(e) => { setOptIn(e.target.checked); studentKey.setTtsOptIn(e.target.checked); }} />
                  <span>Use my own Gemini key for my avatar’s voice.<span className="block text-xs text-slate-400">Google bills your key for each spoken step (not AI Guru). This also lets the class use your key as a last-resort voice. You can untick it any time.</span></span>
                </label>
              )}
              {hasOwnKey && optIn && <button onClick={tryVoice} disabled={busy} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-40">{busy ? 'Speaking…' : '▶ Try my voice (uses my key)'}</button>}
            </div>
          </>
        )}

        {err && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{err}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {saved && <button onClick={() => { saveStudentAvatar(null); onClose(); }} className="mr-auto rounded-lg px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10">Remove my avatar</button>}
          <button onClick={onClose} className="ml-auto rounded-xl bg-white/10 px-4 py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={!!block} className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-5 py-2 text-sm font-extrabold disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  );
}
