'use client';

/**
 * WebCodecs capability probe shared by every MP4 exporter (lessons, motion reels).
 * Kept free of renderer imports so pages that only export reels stay light.
 */

export type MuxVideo = 'avc' | 'vp9' | 'av1';
export type MuxAudio = 'aac' | 'opus';

const VIDEO_CANDIDATES: Array<{ codec: string; mux: MuxVideo }> = [
  { codec: 'avc1.640028', mux: 'avc' },
  { codec: 'avc1.4d0028', mux: 'avc' },
  { codec: 'avc1.42001f', mux: 'avc' },
  { codec: 'vp09.00.40.08', mux: 'vp9' },
  { codec: 'av01.0.08M.08', mux: 'av1' },
];
const AUDIO_CANDIDATES: Array<{ codec: string; mux: MuxAudio }> = [
  { codec: 'mp4a.40.2', mux: 'aac' },
  { codec: 'opus', mux: 'opus' },
];
export const AUDIO_RATE = 48000;

export interface Mp4Support {
  ok: boolean;
  reason?: string;
  video?: { codec: string; mux: MuxVideo; config: VideoEncoderConfig };
  audio?: { codec: string; mux: MuxAudio; config: AudioEncoderConfig } | null;
}

export async function probeMp4Export(width = 1280, height = 720, fps = 30, bitrate = 3_500_000): Promise<Mp4Support> {
  if (typeof window === 'undefined') return { ok: false, reason: 'MP4 export runs in the browser.' };
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return { ok: false, reason: 'This browser has no WebCodecs. Use Chrome, Edge or Safari 16.4+.' };
  }
  let video: Mp4Support['video'];
  for (const c of VIDEO_CANDIDATES) {
    try {
      const cfg: VideoEncoderConfig = {
        codec: c.codec,
        width,
        height,
        bitrate,
        framerate: fps,
        ...(c.mux === 'avc' ? { avc: { format: 'avc' as const } } : {}),
      };
      const r = await VideoEncoder.isConfigSupported(cfg);
      if (r.supported) {
        video = { codec: c.codec, mux: c.mux, config: (r.config as VideoEncoderConfig) ?? cfg };
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!video) return { ok: false, reason: 'This browser cannot encode H.264, VP9 or AV1 video.' };

  let audio: Mp4Support['audio'] = null;
  if (typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined') {
    for (const c of AUDIO_CANDIDATES) {
      try {
        const cfg: AudioEncoderConfig = { codec: c.codec, sampleRate: AUDIO_RATE, numberOfChannels: 1, bitrate: 96_000 };
        const r = await AudioEncoder.isConfigSupported(cfg);
        if (r.supported) {
          audio = { codec: c.codec, mux: c.mux, config: (r.config as AudioEncoderConfig) ?? cfg };
          break;
        }
      } catch {
        /* try next */
      }
    }
  }
  return { ok: true, video, audio };
}

