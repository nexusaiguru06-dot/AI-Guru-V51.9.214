'use client';

/**
 * Motion reel → MP4 in the browser (WebCodecs + mp4-muxer), frame-stepped and
 * deterministic: frame k is drawn at exactly k/fps, so the file matches the preview.
 * Soundtrack = sound design + music bed, ducked under the step-by-step voice-over,
 * levelled to −14 LUFS. V51.9.97: the finished file is opened again and checked
 * (length, sound, every voice step, blank or frozen picture) — see `check` in the result.
 */

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { probeMp4Export } from '../../video-export/mp4-probe';
import { loadProfile, type StudentProfile } from '../../student/profile';
import { drawReelFrame, FORMAT_SIZE, type ReelFormat } from './draw';
import type { DesignLayer } from '../design/layer';
import { designImagesReady } from '../design/draw-design';
import type { FontKind } from './look';
import type { MotionReel } from './reel';
import { SFX_RATE } from './sfx';
import { mixReelAudio, type VoiceClips } from './audio';
import { loadReelFonts } from './fonts';
import { setClipPlayback } from './clip';
import { bgTime, type BgVideoDraw } from './bg-video';
import { reelVoiceCues, unvoicedSteps } from './reel';
import type { ReelCheck } from './self-check';
import type { TeacherOnReel } from './avatar-draw';
import { reelMouthTrack } from './lipsync';
import type { ReelLook } from './look';
import type { CameraKind } from './camera';
import type { MovesSetting } from './camera-presets';
import type { SeasonId } from './season';
import type { MusicKind, SfxPack } from './sfx';

export interface MotionExportOptions {
  format: ReelFormat;
  fps?: number;
  stepLabel?: string;
  handle?: string;
  music?: boolean;
  /** Voice-over clips (48 kHz mono) keyed by spoken text; the reel must be built with their lengths. */
  voices?: VoiceClips | null;
  /** Show the second-language caption line. */
  subtitles?: boolean;
  /** AI Guru footer + student details on vertical frames (default: on for vertical). */
  footer?: boolean;
  student?: StudentProfile | null;
  /** V51.9.99: the student's photo; default = the photo saved in this browser when "show on reels" is on. null = none. */
  photo?: CanvasImageSource | null;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
  /** Video bitrate in bits/s (default 6 Mb/s; the offline class pack asks for less). V51.9.50. */
  bitrate?: number;
  /** Open the finished MP4 and check its length, sound, voice and picture (default true). V51.9.97. */
  check?: boolean;
  /** Soundtrack loudness in LUFS (default −14); false keeps the raw mix. V51.9.97. */
  loudness?: number | false;
  /**
   * V51.9.100: the teacher's face in a corner bubble. The mouth follows this reel's own voice track, frame by frame
   * (worked out here when `track` is not given). With `faceVideo` (the AI lip-sync result, timed to the reel) each
   * frame shows that video at the same moment instead of the moving photo.
   */
  teacher?: TeacherOnReel | null;
  faceVideo?: HTMLVideoElement | null;
  /** V51.9.157 (Way 4): the student's stock video behind the reel, from `start` seconds, looping; `shade` keeps it readable. */
  bgVideo?: { el: HTMLVideoElement; start: number; shade: number } | null;
  /** V51.9.101: the shared reel's style — look, camera, badges, season, music bed and sound-effect pack. */
  style?: { look?: ReelLook | null; camera?: CameraKind; moves?: MovesSetting; badges?: string[]; season?: SeasonId | null; musicKind?: MusicKind; pack?: SfxPack; duet?: TeacherOnReel | null; stopwatch?: { from: number; to: number } | null; boardFont?: FontKind | null; design?: DesignLayer | null } | null;
}

export interface MotionExportResult {
  blob: Blob;
  durationMs: number;
  videoCodec: string;
  audioCodec: string | null;
  /** The self-check of the finished file (absent when `check: false`). */
  check?: ReelCheck;
  /** Soundtrack loudness after levelling (LUFS), when there is sound. */
  lufs?: number;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Puts a video on exactly time `sec` (frame-stepped export: never real-time playback). False past its end or on error. */
export function seekFrame(v: HTMLVideoElement, sec: number): Promise<boolean> {
  const dur = Number.isFinite(v.duration) ? v.duration : 0;
  if (!dur || sec > dur + 0.05) return Promise.resolve(false);
  const want = Math.min(sec, Math.max(0, dur - 0.02));
  if (Math.abs(v.currentTime - want) < 0.001 && v.readyState >= 2) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok: boolean) => { clearTimeout(timer); v.removeEventListener('seeked', on); v.removeEventListener('error', off); resolve(ok); };
    const on = () => done(true);
    const off = () => done(false);
    const timer = setTimeout(() => done(v.readyState >= 2), 3000);
    v.addEventListener('seeked', on);
    v.addEventListener('error', off);
    v.currentTime = want;
  });
}

export async function exportMotionReelMp4(reel: MotionReel, o: MotionExportOptions): Promise<MotionExportResult> {
  const { width, height } = FORMAT_SIZE[o.format];
  const fps = o.fps ?? 30;
  await loadReelFonts();
  await designImagesReady(o.style?.design); // V51.9.119: the designer's photos are decoded before the first frame
  if (reel.parts.some((p) => p.layer3d)) { try { await (await import('../../three-d/ensure')).ensureHeadingIntro3d(); } catch { /* 2D title card is used */ } }
  const support = await probeMp4Export(width, height, fps, o.bitrate ?? 6_000_000);
  if (!support.ok || !support.video) throw new Error(support.reason || 'MP4 export is not supported in this browser.');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const photo = o.photo !== undefined ? o.photo : await (await import('../../student/photo-client')).reelPhoto().catch(() => null);

  const target = new ArrayBufferTarget();
  const withAudio = !!support.audio;
  const muxer = new Muxer({
    target,
    video: { codec: support.video.mux, width, height, frameRate: fps },
    ...(withAudio ? { audio: { codec: support.audio!.mux, numberOfChannels: 1, sampleRate: SFX_RATE } } : {}),
    fastStart: 'in-memory',
  });

  let failure: Error | null = null;
  const onError = (e: unknown) => {
    failure = e instanceof Error ? e : new Error(String(e));
  };
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: onError });
  venc.configure(support.video.config);
  let aenc: AudioEncoder | null = null;
  let mix: Float32Array | null = null;
  let lufs: number | undefined;

  setClipPlayback(false); // clips play in real time; the export draws the three.js intro frame by frame
  const teacher: TeacherOnReel | null = o.teacher ? { ...o.teacher, track: o.teacher.track ?? reelMouthTrack(reel, o.voices, fps) } : null;
  const faceVideo = teacher && o.faceVideo ? o.faceVideo : null;
  try {
    const frames = Math.ceil((reel.durationMs / 1000) * fps);
    for (let k = 0; k < frames; k++) {
      if (o.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      if (failure) throw failure;
      if (faceVideo && teacher) teacher.frame = (await seekFrame(faceVideo, k / fps)) ? faceVideo : null;
      let bg: BgVideoDraw | null = null;
      if (o.bgVideo) { const v = o.bgVideo.el; bg = { frame: (await seekFrame(v, bgTime((k * 1000) / fps, o.bgVideo.start, v.duration))) ? v : null, width: v.videoWidth, height: v.videoHeight, shade: o.bgVideo.shade }; }
      drawReelFrame(ctx, reel, (k * 1000) / fps, { format: o.format, stepLabel: o.stepLabel, handle: o.handle, subtitles: o.subtitles, footer: o.footer ?? o.format !== 'square', download: true, student: o.student ?? loadProfile(), photo, teacher, look: o.style?.look, camera: o.style?.camera, moves: o.style?.moves, badges: o.style?.badges, season: o.style?.season, duet: o.style?.duet, stopwatch: o.style?.stopwatch, boardFont: o.style?.boardFont, design: o.style?.design, bgVideo: bg });
      const frame = new VideoFrame(canvas, { timestamp: Math.round((k * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(frame, { keyFrame: k % (fps * 2) === 0 });
      frame.close();
      while (venc.encodeQueueSize > 6) await tick();
      if (k % 5 === 0) {
        o.onProgress?.(0.9 * (k / frames));
        await tick();
      }
    }
    await venc.flush();

    if (withAudio) {
      const report: { after?: number } = {};
      const samples = mixReelAudio(reel, o.voices, { rate: SFX_RATE, music: o.music, loudness: o.loudness, report, musicKind: o.style?.musicKind, pack: o.style?.pack });
      mix = samples;
      if (report.after !== undefined && Number.isFinite(report.after)) lufs = report.after;
      aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: onError });
      aenc.configure(support.audio!.config);
      const CHUNK = 4096;
      for (let i = 0; i < samples.length; i += CHUNK) {
        const part = new Float32Array(samples.subarray(i, Math.min(samples.length, i + CHUNK)));
        const data = new AudioData({
          format: 'f32-planar',
          sampleRate: SFX_RATE,
          numberOfFrames: part.length,
          numberOfChannels: 1,
          timestamp: Math.round((i / SFX_RATE) * 1e6),
          data: part,
        });
        aenc.encode(data);
        data.close();
        while (aenc.encodeQueueSize > 16) await tick();
      }
      await aenc.flush();
    }
    if (failure) throw failure;
    muxer.finalize();
    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    let check: ReelCheck | undefined;
    if (o.check !== false) {
      o.onProgress?.(0.95);
      const { checkReelVideo } = await import('./self-check-browser');
      const voices = o.voices?.size ? reelVoiceCues(reel).filter((c) => o.voices!.has(c.say)).map((c) => [c.t, c.t + c.ms] as [number, number]) : [];
      check = await checkReelVideo(blob, { durationMs: reel.durationMs, audio: withAudio, voices, unvoiced: unvoicedSteps(reel, o.voices) }, {
        mix: mix ? { samples: mix, rate: SFX_RATE } : null,
        onProgress: (p) => o.onProgress?.(0.95 + 0.05 * p),
        signal: o.signal,
      }).catch((e: unknown): ReelCheck => ({ checked: false, ok: true, reason: (e as Error)?.message ?? 'check failed', problems: [] }));
    }
    o.onProgress?.(1);
    return {
      blob,
      durationMs: reel.durationMs,
      videoCodec: support.video.codec,
      audioCodec: withAudio ? support.audio!.codec : null,
      check,
      lufs,
    };
  } finally {
    setClipPlayback(true);
    try {
      if (venc.state !== 'closed') venc.close();
    } catch {
      /* closed */
    }
    try {
      if (aenc && aenc.state !== 'closed') aenc.close();
    } catch {
      /* closed */
    }
  }
}
