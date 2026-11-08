'use client';

/**
 * V51.9.100 — Teacher Portal → My avatar.
 *  1. Photo: a front-facing photo (camera or file), cut to a square.
 *  2. Mark the mouth and the eyes (drag the dots), and watch the lips move in the live preview.
 *  3. Face style: lip-sync on the photo (any computer) · photo only · AI lip-sync from a short video (GPU PC).
 *  4. Optional: a voice sample (read the sentence shown) so reels can speak in your own voice.
 *  5. Consent ("my own face and voice") and whether your students may use the avatar on their reels.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cropSquare } from '@/lib/ai-guru/student/photo';
import { squareJpeg, decodeImage } from '@/lib/ai-guru/student/photo-client';
import { useDevicePhotos } from '@/components/ai-guru/avatar/DevicePhotos';
import {
  CHARACTER_CONSENT_TEXT,
  CONSENT_TEXT,
  CONSENT_TEXT_ML,
  DEFAULT_MARKS,
  VIDEO_SECONDS,
  VOICE_PROMPT,
  VOICE_SECONDS,
  saveLocalAvatar,
  type AvatarForReel,
  type AvatarMeta,
  type AvatarStyle,
  type FaceMarks,
} from '@/lib/ai-guru/teacher/avatar';
import { audioToWav, bytesToB64, loadTeacherAuth, saveTeacherAuth, startRecording, teacherAvatarCall, videoSeconds, type TeacherAuth } from '@/lib/ai-guru/teacher/avatar-client';
import { drawTeacherBubble, prepareAvatar, type PreparedAvatar } from '@/lib/ai-guru/reels/motion/avatar-draw';
import { demoMouthTrack, mouthTrack, type MouthTrack } from '@/lib/ai-guru/reels/motion/lipsync';
import { loadReelFonts } from '@/lib/ai-guru/reels/motion/fonts';
import { CHARACTERS, CHARACTER_MARKS, characterById, characterPhoto } from '@/lib/ai-guru/avatar/characters';
import { bestSpeechWindow, bestStills, cutClip, frameAt, videoAudio, type Candidate } from '@/lib/ai-guru/teacher/own-video';
import { encodeWav, resample } from '@/lib/ai-guru/reels/motion/audio';
import { callGeminiClientContents, studentKey } from '@/lib/student-key';

const VIEW = 260;
const box = 'rounded-2xl border border-white/10 bg-white/[.04] p-4';
const btn = 'rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-40';

type Pic = { img: CanvasImageSource; w: number; h: number; mirror: boolean };
type Dot = 'mouth' | 'eye0' | 'eye1';

export function AvatarSetup() {
  const [auth, setAuth] = useState<TeacherAuth | null>(null);
  const [code, setCode] = useState('');
  const [key, setKey] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [meta, setMeta] = useState<AvatarMeta | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // photo
  const [saved, setSaved] = useState<string | null>(null); // the avatar photo on the server (data URL)
  const [pic, setPic] = useState<Pic | null>(null);
  // V51.9.103: a ready-made AI Guru character instead of a photo, and "use my own video"
  const [charId, setCharId] = useState<string | null>(null);
  const [own, setOwn] = useState<{ video: HTMLVideoElement; url: string; file: File; stills: Candidate[]; picked: number | null; note: string } | null>(null);
  const [ownBusy, setOwnBusy] = useState<string | null>(null);
  const ownFile = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState({ x: 0.5, y: 0.42 });
  const [cam, setCam] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  // marks + style + settings
  const [marks, setMarks] = useState<FaceMarks>(DEFAULT_MARKS);
  const [markMode, setMarkMode] = useState(false);
  const [dot, setDot] = useState<Dot | null>(null);
  const [style, setStyle] = useState<AvatarStyle>('lipsync');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [share, setShare] = useState(false);

  // voice
  const [vlang, setVlang] = useState<'ml' | 'en'>('ml');
  const [refText, setRefText] = useState<string>(VOICE_PROMPT.ml);
  const [voice, setVoice] = useState<{ b64: string; seconds: number; url: string } | null>(null);
  const [rec, setRec] = useState<{ stop: () => Promise<Blob>; cancel: () => void } | null>(null);
  const [removeVoice, setRemoveVoice] = useState(false);
  const audioFile = useRef<HTMLInputElement>(null);

  // face video (AI lip-sync)
  const [face, setFace] = useState<{ b64: string; seconds: number; url: string } | null>(null);
  const videoFile = useRef<HTMLInputElement>(null);

  // live preview
  const preview = useRef<HTMLCanvasElement>(null);
  const [prepared, setPrepared] = useState<PreparedAvatar | null>(null);
  const [voiceTrack, setVoiceTrack] = useState<MouthTrack | null>(null);
  const demo = useRef<MouthTrack>(demoMouthTrack());
  const audioEl = useRef<HTMLAudioElement | null>(null);

  const apply = useCallback((j: Record<string, any>) => {
    const m = (j.meta ?? null) as AvatarMeta | null;
    const a = (j.avatar ?? null) as AvatarForReel | null;
    setMeta(m);
    setSaved(a?.photo ?? null);
    if (m) {
      setCharId(m.character ?? null);
      setMarks(m.marks);
      setStyle(m.style);
      setName(m.name);
      setShare(m.shareWithStudents);
      if (m.voice) { setRefText(m.voice.refText); setVlang(m.voice.lang); }
    }
    saveLocalAvatar(a); // the reel maker on this computer reads it with no network
  }, []);

  const open = useCallback(async (a: TeacherAuth) => {
    setErr(''); setBusy(true);
    try {
      const j = await teacherAvatarCall(a, { action: 'get' });
      setAuth(a); saveTeacherAuth(a);
      setTeacherName(j.teacherName ?? '');
      if (!j.meta) setName(j.teacherName ?? '');
      apply(j);
    } catch (e) { setErr((e as Error).message); saveTeacherAuth(null); }
    finally { setBusy(false); }
  }, [apply]);

  useEffect(() => { const a = loadTeacherAuth(); if (!a) return; const t = setTimeout(() => void open(a), 0); return () => clearTimeout(t); }, [open]);

  /* ---- photo ---- */
  const stopCam = useCallback(() => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setCam(false); }, []);
  useEffect(() => () => stopCam(), [stopCam]);
  const openCamera = async () => {
    setErr('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      stream.current = s; setCam(true);
      requestAnimationFrame(() => { if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => {}); } });
    } catch { setErr('Allow the camera, or upload a photo from this device.'); }
  };
  const snap = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    setPic({ img: c, w: c.width, h: c.height, mirror: true }); setZoom(1.3); setCentre({ x: 0.5, y: 0.45 }); stopCam(); setMarkMode(false);
  };
  // V51.9.104: photos from this device (several at once, best first, the crop starts on the face)
  const device = useDevicePhotos((p) => {
    setErr(''); setCharId(null);
    setPic({ img: p.img, w: p.w, h: p.h, mirror: false }); setZoom(p.crop.zoom); setCentre({ x: p.crop.cx, y: p.crop.cy }); setMarkMode(false);
  }, { btnClass: btn, enabled: !!auth });
  /** The square photo as it will be saved (data URL), from the crop or the saved one. */
  const squareUrl = useCallback((): string | null => (charId ? characterPhoto(charId) : pic ? squareJpeg(pic.img, pic.w, pic.h, zoom, centre.x, centre.y, pic.mirror) : saved), [charId, pic, zoom, centre, saved]);

  // the prepared avatar for the preview follows the crop and the marks
  useEffect(() => {
    const url = squareUrl();
    let live = true;
    const t = setTimeout(() => {
      if (!url) { setPrepared(null); return; }
      void decodeImage(url).then((img) => { if (live) setPrepared(prepareAvatar(img, { marks, name: name || teacherName, style: style === 'ai' ? 'lipsync' : style, id: meta?.id })); }).catch(() => {});
    }, 120);
    return () => { live = false; clearTimeout(t); };
  }, [squareUrl, marks, name, teacherName, style, meta?.id]);

  useEffect(() => { void loadReelFonts(); }, []); // the name tag uses the reel's own font

  // preview loop: the bubble at the size it has on a vertical reel, lips moving with the voice sample (or a demo)
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const c = preview.current;
      const ctx = c?.getContext('2d');
      if (c && ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        if (prepared) {
          const tr = voiceTrack ?? demo.current;
          const len = (tr.open.length / tr.fps) * 1000;
          const a = audioEl.current;
          const t = a && !a.paused ? a.currentTime * 1000 : (performance.now() - start) % (len + 600);
          ctx.scale(c.width / 220, c.width / 220);
          drawTeacherBubble(ctx, { avatar: prepared, track: tr }, t, 110, 100, 150);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [prepared, voiceTrack]);

  // the crop / mark editor view
  const view = useRef<HTMLCanvasElement>(null);
  const [viewImg, setViewImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const u = markMode ? squareUrl() : null;
    let live = true;
    void (u ? decodeImage(u) : Promise.resolve(null)).then((img) => { if (live) setViewImg(img); }).catch(() => { if (live) setViewImg(null); });
    return () => { live = false; };
  }, [markMode, squareUrl]);
  useEffect(() => {
    const c = view.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, VIEW, VIEW);
    if (markMode) {
      if (viewImg) ctx.drawImage(viewImg, 0, 0, VIEW, VIEW);
      const M = marks.mouth;
      ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(M.x * VIEW, M.y * VIEW, (M.w * VIEW) / 2, (M.w * VIEW) / 5, 0, 0, Math.PI * 2); ctx.stroke();
      for (const e of marks.eyes ?? []) { ctx.strokeStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(e.x * VIEW, e.y * VIEW, 9, 0, Math.PI * 2); ctx.stroke(); }
    } else if (pic) {
      const { sx, sy, size } = cropSquare(pic.w, pic.h, zoom, centre.x, centre.y);
      ctx.save();
      if (pic.mirror) { ctx.translate(VIEW, 0); ctx.scale(-1, 1); }
      ctx.drawImage(pic.img, sx, sy, size, size, 0, 0, VIEW, VIEW);
      ctx.restore();
    }
  }, [pic, zoom, centre, markMode, marks, viewImg]);

  const local = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (markMode) {
      const p = local(e);
      const d = (q: { x: number; y: number }) => Math.hypot(q.x - p.x, q.y - p.y);
      const cand: Array<[Dot, number]> = [['mouth', d(marks.mouth)], ...(marks.eyes ? ([['eye0', d(marks.eyes[0])], ['eye1', d(marks.eyes[1])]] as Array<[Dot, number]>) : [])];
      cand.sort((a, b) => a[1] - b[1]);
      setDot(cand[0][0]);
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, cx: centre.x, cy: centre.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (markMode) {
      if (!dot) return;
      const p = local(e);
      const q = { x: Math.min(0.95, Math.max(0.05, p.x)), y: Math.min(0.95, Math.max(0.05, p.y)) };
      setMarks((m) => (dot === 'mouth' ? { ...m, mouth: { ...m.mouth, ...q } } : { ...m, eyes: m.eyes ? (dot === 'eye0' ? [q, m.eyes[1]] : [m.eyes[0], q]) : m.eyes }));
      return;
    }
    const d0 = drag.current;
    if (!d0 || !pic) return;
    const { size } = cropSquare(pic.w, pic.h, zoom, d0.cx, d0.cy);
    const k = size / VIEW;
    const dx = ((e.clientX - d0.x) * k * (pic.mirror ? -1 : 1)) / pic.w;
    const dy = ((e.clientY - d0.y) * k) / pic.h;
    setCentre({ x: Math.min(1, Math.max(0, d0.cx - dx)), y: Math.min(1, Math.max(0, d0.cy - dy)) });
  };
  const onUp = () => { drag.current = null; setDot(null); };

  /* ---- voice ---- */
  const takeVoice = async (blob: Blob) => {
    setErr('');
    try {
      const w = await audioToWav(blob);
      if (w.seconds < VOICE_SECONDS.min) throw new Error(`That is only ${w.seconds.toFixed(1)} s. Read the whole sentence (at least ${VOICE_SECONDS.min} s).`);
      if (w.seconds > VOICE_SECONDS.max) throw new Error(`That is ${Math.round(w.seconds)} s. Keep it under ${VOICE_SECONDS.max} s.`);
      setVoice(w); setRemoveVoice(false);
      // the preview's lips follow the sample
      const ctx = new OfflineAudioContext(1, 1, 16_000);
      const buf = await ctx.decodeAudioData(await (await fetch(w.url)).arrayBuffer());
      setVoiceTrack(mouthTrack(buf.getChannelData(0), buf.sampleRate, 30));
    } catch (e) { setErr((e as Error).message || 'Could not open that recording.'); }
  };
  const toggleRec = async () => {
    if (rec) { const b = await rec.stop(); setRec(null); await takeVoice(b); return; }
    try { setRec(await startRecording()); } catch { setErr('Allow the microphone to record your voice.'); }
  };
  const playSample = () => {
    const url = voice?.url;
    if (!url) return;
    audioEl.current?.pause();
    const a = new Audio(url);
    audioEl.current = a;
    void a.play().catch(() => {});
  };

  /* ---- face video ---- */
  const takeFaceVideo = async (f?: File) => {
    if (!f) return;
    setErr('');
    try {
      if (!/^video\/(mp4|webm|quicktime)/.test(f.type) && !/\.(mp4|webm)$/i.test(f.name)) throw new Error('Choose an MP4 or WebM video.');
      const sec = await videoSeconds(f);
      if (!(sec >= VIDEO_SECONDS.min && sec <= VIDEO_SECONDS.max)) throw new Error(`The video is ${sec.toFixed(1)} s. Use ${VIDEO_SECONDS.min}–${VIDEO_SECONDS.max} s (about 8 s is best).`);
      if (f.size > 15_000_000) throw new Error('The video is larger than 15 MB. Record a shorter or smaller one.');
      const b64 = bytesToB64(new Uint8Array(await f.arrayBuffer()));
      setFace({ b64, seconds: sec, url: URL.createObjectURL(f) });
    } catch (e) { setErr((e as Error).message); }
  };

  /* ---- V51.9.103: a character ---- */
  const pickCharacter = (id: string | null) => {
    setCharId(id);
    if (id) { setPic(null); setMarkMode(false); setMarks(CHARACTER_MARKS); if (style === 'ai') setStyle('lipsync'); }
  };

  /* ---- V51.9.103: use my own video ---- */
  const takeOwnVideo = async (f?: File) => {
    if (!f) return;
    setErr(''); setNote('');
    if (!/^video\//.test(f.type) && !/\.(mp4|webm|mov|m4v)$/i.test(f.name)) { setErr('Choose a video file (MP4, WebM or MOV).'); return; }
    if (f.size > 400_000_000) { setErr('That video is very large. Use a shorter part of it (under 400 MB).'); return; }
    pickCharacter(null);
    try {
      setOwnBusy('Finding the best stills…');
      const r = await bestStills(f, { onProgress: (p) => setOwnBusy(`Finding the best stills… ${Math.round(p * 100)}%`) });
      const notes: string[] = [];
      if (!r.stills.length) notes.push('No clear face was found; try a video where you face the camera in good light.');
      setOwn({ video: r.video, url: r.url, file: f, stills: r.stills, picked: null, note: '' });
      if (r.stills[0]) await pickStill(r.video, r.stills[0].t, 0);
      // the clearest 10–15 s of speech becomes the voice sample
      setOwnBusy('Finding the clearest speech…');
      try {
        const a = await videoAudio(f);
        const w = bestSpeechWindow(a.samples, a.rate, 12);
        if (!w) notes.push('Not enough clear speech for a voice sample; record one below instead.');
        else {
          const cut = a.samples.subarray(Math.floor(w.start * a.rate), Math.floor(w.end * a.rate));
          const wav = new Blob([encodeWav(resample(cut, a.rate, 24_000), 24_000)], { type: 'audio/wav' });
          await takeVoice(wav);
          notes.push(`Voice sample: ${(w.end - w.start).toFixed(1)} s from ${Math.floor(w.start / 60)}:${String(Math.floor(w.start % 60)).padStart(2, '0')}.`);
          // the words of the sample: Gemini with the key saved on this computer (optional)
          if (studentKey.hasUsableKey()) {
            setOwnBusy('Writing down the words…');
            try {
              const b64 = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] ?? ''); fr.readAsDataURL(wav); });
              const text = (await callGeminiClientContents('You transcribe speech exactly. Write only the words spoken, in the script of the language spoken (Malayalam in Malayalam script, English in English). No notes.', [{ role: 'user', parts: [{ inlineData: { mimeType: 'audio/wav', data: b64 } }, { text: 'Transcribe this recording exactly.' }] }], undefined, { temperature: 0 })).trim();
              if (text) { setRefText(text); setVlang(/[\u0D00-\u0D7F]/.test(text) ? 'ml' : 'en'); notes.push('The words were written down for you: check them below.'); }
            } catch { notes.push('Type the exact words of the voice sample below (the AI could not write them down).'); }
          } else notes.push('Type the exact words of the voice sample below (or add an AI key in Settings to have them written down).');
        }
      } catch (e) { notes.push((e as Error).message); }
      setOwn((o) => (o ? { ...o, note: notes.join(' ') } : o));
    } catch (e) { setErr((e as Error).message); }
    finally { setOwnBusy(null); }
  };
  async function pickStill(v: HTMLVideoElement, t: number, i: number) {
    const f = await frameAt(v, t);
    setPic({ ...f, mirror: false }); setZoom(1.5); setCentre({ x: 0.5, y: 0.42 }); setMarkMode(false);
    setOwn((o) => (o ? { ...o, picked: i } : o));
  }
  const ownClip = async () => {
    if (!own) return;
    setOwnBusy('Cutting 8 seconds of your video…');
    try {
      const t = own.picked !== null ? own.stills[own.picked].t : 0;
      const clip = await cutClip(own.video, Math.max(0, t - 2), 8);
      await takeFaceVideo(clip);
      setStyle('ai');
    } catch (e) { setErr((e as Error).message); }
    finally { setOwnBusy(null); }
  };

  /* ---- save ---- */
  const save = async () => {
    if (!auth) return;
    setErr(''); setNote('');
    if (!consent) { setErr(charId ? 'Tick the box to confirm.' : 'Tick the box to confirm this is your own face and voice.'); return; }
    const photo = charId ? characterPhoto(charId) ?? undefined : pic ? squareUrl() ?? undefined : undefined;
    if (!photo && !saved) { setErr('Add your photo first.'); return; }
    if (style === 'ai' && !face && !meta?.video) { setErr('The AI lip-sync needs a short video of your face. Add one, or choose “Lips move on my photo”.'); return; }
    setBusy(true);
    try {
      const j = await teacherAvatarCall(auth, {
        action: 'save',
        ...(photo ? { photo } : {}),
        marks, style, name, consent: true, shareWithStudents: share, character: charId ?? '',
        ...(voice ? { voice: { wav: voice.b64, refText, lang: vlang } } : {}),
        ...(removeVoice && !voice ? { removeVoice: true } : {}),
        ...(face ? { video: { data: face.b64, seconds: face.seconds } } : {}),
      });
      apply(j);
      setPic(null); setVoice(null); setFace(null); setRemoveVoice(false); setConsent(false);
      setNote('Saved. Your face is ready for reels on this computer' + (share ? ' and for your students’ reels.' : '.'));
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!auth || !window.confirm('Remove your avatar (photo, voice sample and video)?')) return;
    setBusy(true);
    try { apply(await teacherAvatarCall(auth, { action: 'remove' })); setNote('Your avatar was removed.'); setPic(null); setCharId(null); setMarks(DEFAULT_MARKS); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!auth) {
    return (
      <div className={`${box} max-w-md space-y-3`}>
        <p className="text-sm text-slate-300">Open your avatar with your class code and teacher key (the same as “My class code”).</p>
        <label className="block text-xs font-bold text-slate-300">Class code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 font-mono text-white" autoComplete="off" /></label>
        <label className="block text-xs font-bold text-slate-300">Teacher key (6 digits)<input value={key} onChange={(e) => setKey(e.target.value)} inputMode="numeric" maxLength={6} type="password" className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white" /></label>
        {err && <p className="text-sm text-rose-300">{err}</p>}
        <button onClick={() => open({ code, key })} disabled={busy || !code || key.length < 6} className="rounded-xl bg-cyan-400 px-5 py-2.5 font-extrabold text-[#04121f] disabled:opacity-40">{busy ? 'Opening…' : 'Open'}</button>
      </div>
    );
  }

  const hasPhoto = !!pic || !!saved || !!charId;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <section className={`${box} ${device.over ? 'outline-dashed outline-2 outline-cyan-400' : ''}`} {...device.dropProps}>
          <h2 className="mb-1 text-lg font-extrabold">1 · Your photo — or a character</h2>
          <p className="mb-3 text-sm text-slate-400">Face the camera, good light, mouth closed, nothing covering the mouth. Only your own face — or pick an AI Guru character below (nobody real).</p>
          <div className="flex flex-wrap items-start gap-4">
            {cam ? (
              <div className="relative overflow-hidden rounded-2xl bg-black">
                <video ref={video} playsInline muted autoPlay className="h-[260px] w-[260px] -scale-x-100 object-cover" />
                <div className="pointer-events-none absolute inset-3 rounded-full border-2 border-dashed border-white/70" />
              </div>
            ) : charId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={characterPhoto(charId) ?? ''} alt="" className="h-40 w-40 rounded-full border-4 border-white object-cover" />
            ) : hasPhoto && (pic || markMode) ? (
              <div className={`relative h-[260px] w-[260px] touch-none select-none overflow-hidden rounded-2xl bg-slate-800 ${markMode ? 'cursor-crosshair' : 'cursor-grab'}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                <canvas ref={view} width={VIEW} height={VIEW} className="h-full w-full" />
                {!markMode && <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80" />}
              </div>
            ) : saved ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={saved} alt="" className="h-40 w-40 rounded-full border-4 border-white object-cover" />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-full border-2 border-dashed border-white/30 text-6xl text-white/40">👤</div>
            )}
            <div className="flex flex-col gap-2">
              {cam ? (
                <>
                  <button onClick={snap} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f]">📸 Take photo</button>
                  <button onClick={stopCam} className={btn}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => { pickCharacter(null); void openCamera(); }} className={btn}>📷 Camera</button>
                  {device.button}
                  <button onClick={() => ownFile.current?.click()} disabled={!!ownBusy} className={btn} title="A video of yourself: photo, voice sample and the words, taken from it">🎬 Use my own video</button>
                  <input ref={ownFile} type="file" accept="video/*" className="hidden" onChange={(e) => { void takeOwnVideo(e.target.files?.[0]); e.target.value = ''; }} />
                  {hasPhoto && !charId && <button onClick={() => setMarkMode((m) => !m)} className={`${btn} ${markMode ? 'ring-2 ring-rose-400' : ''}`}>{markMode ? '✓ Done marking' : '👄 Mark mouth & eyes'}</button>}
                </>
              )}
            </div>
          </div>
          {pic && !markMode && !cam && (
            <label className="mt-3 flex w-[260px] items-center gap-2 text-xs text-slate-300">🔍<input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" /><span className="text-[11px] text-slate-400">drag to move</span></label>
          )}
          {!cam && !markMode && device.dropHint}
          {device.tray}
          {markMode && (
            <div className="mt-3 space-y-2 text-xs text-slate-300">
              <p>Drag the <b className="text-rose-300">red oval</b> onto your lips and the <b className="text-cyan-300">blue circles</b> onto your eyes.</p>
              <label className="flex w-[260px] items-center gap-2">Mouth width<input type="range" min={0.08} max={0.4} step={0.005} value={marks.mouth.w} onChange={(e) => setMarks((m) => ({ ...m, mouth: { ...m.mouth, w: Number(e.target.value) } }))} className="flex-1" /></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!marks.eyes} onChange={(e) => setMarks((m) => (e.target.checked ? { ...m, eyes: DEFAULT_MARKS.eyes } : { mouth: m.mouth }))} /> Blink (needs the eyes marked)</label>
            </div>
          )}
        </section>

                {(own || ownBusy) && (
          <section className={box}>
            <h2 className="mb-1 text-base font-extrabold">🎬 From my own video</h2>
            <p className="mb-2 text-xs text-slate-400">Only a video of yourself — for example a class video downloaded from your own YouTube Studio or saved from your own Instagram. Never someone else&apos;s video.</p>
            {ownBusy && <p className="text-sm text-cyan-200">{ownBusy}</p>}
            {own && (
              <>
                {own.stills.length > 0 && <p className="mb-1 text-xs text-slate-300">Pick the best still for your photo:</p>}
                <div className="flex flex-wrap gap-2">
                  {own.stills.map((c, i) => (
                    <button key={c.t} onClick={() => void pickStill(own.video, c.t, i)} className={`overflow-hidden rounded-xl border-2 ${own.picked === i ? 'border-cyan-400' : 'border-transparent'}`} title={`at ${c.t.toFixed(1)} s`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.thumb} alt="" className="h-20 w-20 object-cover" />
                    </button>
                  ))}
                </div>
                {own.note && <p className="mt-2 text-xs text-slate-300">{own.note}</p>}
                <button onClick={ownClip} disabled={!!ownBusy || own.picked === null} className={`${btn} mt-2`} title="For the AI lip-sync (GPU PC): 8 seconds around the still you picked">✂ Use 8 s of it for the AI lip-sync</button>
              </>
            )}
          </section>
        )}

        <section className={box}>
          <h2 className="mb-1 text-base font-extrabold">🧑‍🏫 Or an AI Guru character</h2>
          <p className="mb-2 text-xs text-slate-400">Illustrated people who are nobody real: no photo needed. Each has its own classroom voice; your own voice sample (below) is used instead if you add one.</p>
          <div className="flex flex-wrap gap-2">
            {CHARACTERS.map((c) => (
              <button key={c.id} onClick={() => pickCharacter(charId === c.id ? null : c.id)} className={`flex flex-col items-center rounded-xl border-2 p-1 text-[11px] ${charId === c.id ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={characterPhoto(c.id) ?? ''} alt="" className="h-16 w-16 rounded-full object-cover" />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </section>

<section className={box}>
          <h2 className="mb-2 text-lg font-extrabold">2 · Face style</h2>
          <div className="space-y-2 text-sm">
            {([
              ['lipsync', 'Lips move on my photo', 'Works on any computer, no GPU. The mouth opens and closes with every word; the eyes blink.'],
              ['still', 'Photo only', 'Your photo with a ring that glows while you speak.'],
              ['ai', 'AI lip-sync from a short video (GPU PC)', 'More natural: a 5–10 s video of your face is lip-synced by LatentSync on a PC with an NVIDIA GPU. When that PC is off, the reel uses “Lips move on my photo”.'],
            ] as Array<[AvatarStyle, string, string]>).map(([id, label, sub]) => (
              <label key={id} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${style === id ? 'border-cyan-400/70 bg-cyan-400/10' : 'border-white/10'}`}>
                <input type="radio" name="style" className="mt-1" checked={style === id} onChange={() => setStyle(id)} />
                <span><b>{label}</b><span className="block text-xs text-slate-400">{sub}</span></span>
              </label>
            ))}
          </div>
          {style === 'ai' && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-xs text-slate-400">Record about 8 seconds: look at the camera, keep your head still, talk normally. One face only, no cuts.</p>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => videoFile.current?.click()} className={btn}>🎥 {face || meta?.video ? 'Change the video' : 'Add a face video'}</button>
                {(face || meta?.video) && <span className="text-xs text-emerald-300">✓ {face ? `${face.seconds.toFixed(1)} s (not saved yet)` : `${meta!.video!.seconds} s saved`}</span>}
                <input ref={videoFile} type="file" accept="video/mp4,video/webm,video/*" capture="user" className="hidden" onChange={(e) => { void takeFaceVideo(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              {face && <video src={face.url} muted playsInline controls className="h-32 rounded-lg" />}
            </div>
          )}
        </section>

        <section className={box}>
          <h2 className="mb-1 text-lg font-extrabold">3 · Your voice <span className="text-sm font-normal text-slate-400">(optional)</span></h2>
          <p className="mb-3 text-sm text-slate-400">Read the sentence below in a quiet room ({VOICE_SECONDS.min}–{VOICE_SECONDS.max} s). Reels then speak in your voice (IndicF5 on the AI Guru PC; when it is off, the classroom voice is used).</p>
          <div className="mb-2 flex gap-2">
            {(['ml', 'en'] as const).map((l) => <button key={l} onClick={() => { setVlang(l); setRefText(VOICE_PROMPT[l]); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${vlang === l ? 'bg-violet-600' : 'bg-white/10'}`}>{l === 'ml' ? 'Malayalam' : 'English'}</button>)}
          </div>
          <label className="block text-xs font-bold text-slate-300">The exact words you say (change them if you read something else)
            <textarea value={refText} onChange={(e) => setRefText(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 p-2 text-sm text-white" />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={toggleRec} className={`${btn} ${rec ? 'bg-rose-500/80 hover:bg-rose-500' : ''}`}>{rec ? '■ Stop recording' : '🎙 Record'}</button>
            <button onClick={() => audioFile.current?.click()} className={btn} disabled={!!rec}>📁 Upload a recording</button>
            <input ref={audioFile} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void takeVoice(f); e.target.value = ''; }} />
            {voice && <><button onClick={playSample} className={btn}>▶ Play + watch the lips</button><span className="text-xs text-emerald-300">✓ {voice.seconds.toFixed(1)} s (not saved yet)</span></>}
            {!voice && meta?.voice && !removeVoice && <><span className="text-xs text-emerald-300">✓ Voice sample saved ({meta.voice.seconds} s)</span><button onClick={() => setRemoveVoice(true)} className="text-xs text-rose-300 underline">Remove it</button></>}
            {removeVoice && <span className="text-xs text-amber-300">The voice sample will be removed when you save.</span>}
          </div>
        </section>

        <section className={box}>
          <h2 className="mb-2 text-lg font-extrabold">4 · Name and permission</h2>
          <label className="block text-xs font-bold text-slate-300">Name under your face<input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={teacherName} className="mt-1 w-full max-w-sm rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white" /></label>
          <label className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {charId ? <span>{CHARACTER_CONSENT_TEXT}<span className="block text-xs text-slate-400">{characterById(charId)?.name} is an AI Guru character.</span></span>
              : <span>{CONSENT_TEXT}<span className="block text-xs text-amber-200/80">Do not use a photo, video or voice of anyone else — not a film star, another teacher, or anything downloaded from YouTube or Instagram that is not you.</span></span>}
          </label>
          <label className="mt-2 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={share} onChange={(e) => setShare(e.target.checked)} />
            <span>My students may put my face on the reels they make and share.<span className="block text-xs text-slate-400">Only the students in your classes see this option, and only your face with the free lip-sync on their phone — your voice and the AI lip-sync stay on the AI Guru PC for your own reels (no cost to the school from students’ reels). Everyone who watches their reels will see your face.</span></span>
          </label>
        </section>

        {err && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{err}</p>}
        {note && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{note}</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={save} disabled={busy || !hasPhoto} className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-6 py-2.5 font-extrabold disabled:opacity-40">{busy ? 'Saving…' : 'Save my avatar'}</button>
          {meta && <button onClick={remove} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/10">Remove my avatar</button>}
          <button onClick={() => { saveTeacherAuth(null); setAuth(null); }} className="ml-auto rounded-xl px-4 py-2.5 text-xs text-slate-400 hover:bg-white/5">Sign out</button>
        </div>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <div className={box}>
          <h3 className="mb-2 text-sm font-extrabold">Live preview</h3>
          <canvas ref={preview} width={440} height={440} className="w-full rounded-xl" />
          <p className="mt-2 text-xs text-slate-400">{voiceTrack ? 'The lips follow your voice sample (press ▶ Play).' : 'The lips follow a test voice. Record your voice to see it with your own words.'}</p>
          {style === 'ai' && <p className="mt-1 text-xs text-slate-500">The AI lip-sync is made on the GPU PC when a reel is exported; this preview shows the photo version.</p>}
        </div>
        <div className={`${box} text-xs text-slate-400`}>
          <b className="text-slate-200">Where it appears</b>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Reel Studio → “My face” on this computer; your students see “Teacher’s face” (face only) if you allow it.</li>
            <li>Templates &amp; videos → problem videos (“My face in the corner”).</li>
            <li>A small bubble in the bottom corner, clear of the maths and the captions; not on the closing QR card.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
