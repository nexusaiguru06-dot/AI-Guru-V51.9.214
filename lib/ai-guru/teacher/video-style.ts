/**
 * Learn a template from a teacher's video (V51.9.63).
 *
 * The video is looked at in the teacher's browser: about ten frames are cut out of it and sent to Gemini with the list of
 * the app's own drawing parts (the built-in DNAs). The model says how the video teaches — its steps, pace, layout — and
 * which of those parts, in which order, would teach a problem the same way. That is saved as a template. The video's own
 * pictures, voice and numbers are never copied: new problems are drawn by the app's engine from their own numbers.
 */
import { DNAS, DNA_BY_ID } from './../motion-class/dna/registry';
import { slugId, type LearnedDna } from './../motion-class/dna/learned';
import type { BlockKind } from './../motion-class/segment';

export interface VideoFrame { t: number; base64: string }

/** Cuts `count` evenly spaced frames (JPEG, longest side 768) out of a video file, in the browser. */
export async function extractFrames(file: File, count = 10, onProgress?: (done: number) => void): Promise<{ frames: VideoFrame[]; durationSec: number }> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error('This browser cannot open that video. Try an MP4 (H.264) or WebM file.')); });
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    if (!dur || !v.videoWidth) throw new Error('The video has no readable picture.');
    const scale = Math.min(1, 768 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    const ctx = c.getContext('2d')!;
    const frames: VideoFrame[] = [];
    for (let i = 0; i < count; i++) {
      const t = Math.min(dur - 0.05, Math.max(0.05, (dur * (i + 0.5)) / count));
      await new Promise<void>((res, rej) => { v.onseeked = () => res(); v.onerror = () => rej(new Error('Could not read the video.')); v.currentTime = t; });
      ctx.drawImage(v, 0, 0, c.width, c.height);
      frames.push({ t, base64: c.toDataURL('image/jpeg', 0.72).split(',')[1] });
      onProgress?.(i + 1);
    }
    return { frames, durationSec: dur };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** DNAs a video template may be built from: real drawing parts, not the AI's composition placeholders. */
export const SEGMENT_DNAS = DNAS.filter((d) => !['bridge', 'section-intro', 'chapter-intro'].includes(d.id as string));

export function videoStylePrompt(): { system: string; user: string } {
  const catalogue = SEGMENT_DNAS.map((d) => `- ${d.id}: ${d.name}`).join('\n');
  return {
    system: [
      'You study a teacher\'s maths or science teaching video from frames cut at equal gaps (in order) and describe HOW it teaches, so an app can teach other problems the same way.',
      'The app draws every board itself from these built-in templates (DNAs). You may only use these ids:',
      catalogue,
      'Pick the templates, in teaching order, that would reproduce what the video shows (1 to 5 of them; the same id may not be repeated).',
      'Look at: what is on the board in each part, how a step is revealed (writing, arrows, colour highlights, moving objects), the pace, the colours, the voice style you can infer from the pictures, and how the video ends.',
      'Reply with JSON only: {"name":"short template name","description":"what it teaches and how, 1-2 sentences","subject":"e.g. algebra","keywords":["5-10 words that identify problems this template suits"],"segments":["dna-id","dna-id"],"stepsOutline":["what happens first","then…"],"pace":"slow|medium|fast","styleNotes":"3-6 sentences telling a planner how to teach another problem the same way: layout, order, what to highlight, how each step is revealed, how to finish"}',
    ].join('\n'),
    user: 'These frames are from the video, in order. Describe how it teaches.',
  };
}

export interface TemplateDraft {
  name: string;
  description: string;
  subject: string;
  keywords: string[];
  segments: string[];
  stepsOutline: string[];
  pace: 'slow' | 'medium' | 'fast';
  styleNotes: string;
}

/** Checks the model's answer: only real DNA ids survive; no usable segment means no template. */
export function cleanVideoStyle(raw: unknown): TemplateDraft | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return null;
  const ok = new Set(SEGMENT_DNAS.map((d) => d.id as string));
  const segments: string[] = [];
  for (const s of Array.isArray(r.segments) ? r.segments : []) { const id = String(s).trim(); if (ok.has(id) && !segments.includes(id)) segments.push(id); }
  if (!segments.length) return null;
  const str = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const list = (v: unknown, n: number, len: number) => (Array.isArray(v) ? v : []).map((x) => str(x, len)).filter(Boolean).slice(0, n);
  const name = str(r.name, 60);
  if (!name) return null;
  const pace = ['slow', 'medium', 'fast'].includes(String(r.pace)) ? (String(r.pace) as TemplateDraft['pace']) : 'medium';
  return { name, description: str(r.description, 400), subject: str(r.subject, 40), keywords: list(r.keywords, 10, 30), segments: segments.slice(0, 5), stepsOutline: list(r.stepsOutline, 12, 160), pace, styleNotes: str(r.styleNotes, 900) };
}

export const TEMPLATE_KINDS: BlockKind[] = ['problem', 'exercise', 'prose', 'math', 'result'];

/** The saved template. Its id starts with "video-" so it never clashes with an AI-made one. */
export function draftToLearned(d: TemplateDraft, sourceName: string): LearnedDna {
  return {
    id: `video-${slugId(d.name)}`, name: d.name, description: d.description || `Learned from ${sourceName}`, kinds: TEMPLATE_KINDS, keywords: d.keywords,
    segments: d.segments as LearnedDna['segments'], example: { segments: [] }, createdAt: new Date().toISOString(), source: 'teacher-video',
    styleNotes: `${d.pace} pace. ${d.styleNotes}`.trim(), stepsOutline: d.stepsOutline, sourceName,
  };
}

export const dnaName = (id: string): string => DNA_BY_ID.get(id)?.name ?? id;

export async function analyseFrames(frames: VideoFrame[], call: (system: string, user: string, frames: VideoFrame[]) => Promise<string>): Promise<TemplateDraft> {
  const { system, user } = videoStylePrompt();
  let last = 'no usable answer';
  for (let i = 0; i < 2; i++) {
    try {
      const text = await call(system, i ? `${user} (Your last answer could not be used: ${last}. Reply with the JSON only, using only the listed ids.)` : user, frames);
      const m = text.match(/\{[\s\S]*\}/);
      const d = cleanVideoStyle(JSON.parse(m ? m[0] : text));
      if (d) return d;
      last = 'no listed template id was used';
    } catch (e) { last = e instanceof Error ? e.message : String(e); }
  }
  throw new Error(`Could not learn a template from that video: ${last}`);
}
