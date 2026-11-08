import type { ReelCheck } from '../reels/motion/self-check';
/**
 * Make a video for one problem the teacher chose (V51.9.63), on the same engine as every class:
 * problem text → DNA (the teacher's pin, a template, or the automatic choice) → plan → validate → scenes → voice → MP4.
 * Runs in the teacher's browser (voice and MP4 encoding need it).
 */
import type { BookBlock } from '../motion-class/segment';
import type { DnaSelection } from '../motion-class/dna/types';
import { selectDna } from '../motion-class/dna/registry';
import { getLearned } from '../motion-class/dna/learned';
import { offlinePlan } from '../motion-class/plan/offline';
import { aiPlanBlock, type Llm } from '../motion-class/plan/ai';
import { compileClass } from '../motion-class/class';
import { prepareSegment, type PreparedSegment } from '../motion-class/player';
import { buildClassTimeline } from '../motion-class/interactive-player';
import { loadReelFonts } from '../reels/motion/fonts';
import type { TeacherOnReel } from '../reels/motion/avatar-draw';

export type VideoLang = 'en' | 'ml' | 'both';

/** Splits what the teacher pasted into problems: blank-line separated, or one per numbered line ("1." / "1)" / "Q1."). */
export function splitProblems(raw: string): string[] {
  const text = raw.replace(/\r/g, '').trim();
  if (!text) return [];
  let parts = text.split(/\n\s*\n+/);
  if (parts.length === 1 && /^\s*(?:q(?:uestion)?\s*)?\d+\s*[.)]/im.test(text)) parts = text.split(/\n(?=\s*(?:q(?:uestion)?\s*)?\d+\s*[.)]\s)/i);
  return parts.map((p) => p.replace(/^\s*(?:q(?:uestion)?\s*)?\d+\s*[.)]\s*/i, '').replace(/\s+/g, ' ').trim()).filter((p) => p.length >= 6).slice(0, 20);
}

export function problemBlock(text: string, i: number): BookBlock {
  return { id: `tp${i}-${Date.now().toString(36)}`, kind: 'problem', page: 0, chapterId: 'teacher', sectionId: 'teacher', lines: [{ text, math: false }], text };
}

/** The DNA to use: the template the teacher chose for this run, else the pin / automatic selection (selectDna reads pins). */
export function selectionFor(block: BookBlock, templateId: string | null): DnaSelection {
  if (templateId && (templateId.startsWith('learned:') ? getLearned(templateId.slice(8)) : true)) {
    return { dna: templateId as DnaSelection['dna'], score: 1, mandatory: true, needsAi: false, ranked: [], reason: 'chosen by the teacher for this video' };
  }
  return selectDna(block, 'Teacher');
}

export interface MadeVideo { blob: Blob; name: string; seconds: number; dna: string; source: 'ai' | 'built-in'; /** V51.9.97 self-check of the MP4 */ check?: ReelCheck }

export interface MakeOptions {
  title: string;
  templateId: string | null;
  language: VideoLang;
  llm: Llm | null;
  onStage?: (s: string) => void;
  onProgress?: (p: number) => void;
  /** V51.9.100: the teacher's own face in the corner, lips moving with the video's voice. */
  teacher?: TeacherOnReel | null;
}

export async function makeProblemVideo(text: string, index: number, o: MakeOptions): Promise<MadeVideo> {
  o.onStage?.('Choosing the template');
  await loadReelFonts();
  const block = problemBlock(text, index);
  const selection = selectionFor(block, o.templateId);
  const ctx = { chapterTitle: o.title, sectionTitle: o.title };
  let plan = offlinePlan(block, o.title, o.title, selection);
  let source: MadeVideo['source'] = 'built-in';
  if (o.llm) {
    o.onStage?.('Planning the lesson');
    const r = await aiPlanBlock(block, ctx, o.llm, { maxAttempts: 3, selection, ephemeral: true });
    if (r.plan.source === 'ai') { plan = r.plan; source = 'ai'; }
  } else if (o.language !== 'en') {
    throw new Error('Malayalam videos need an AI key (Settings).');
  }
  const langs = o.language === 'both' ? (['en', 'ml'] as const) : ([o.language] as const);
  const segs = compileClass([block], new Map([[block.id, plan]]), { title: o.title }, { order: 'per-language', languages: [...langs], mistakes: false });
  const prepared: PreparedSegment[] = [];
  o.onStage?.('Recording the voice');
  for (const seg of segs) prepared.push(await prepareSegment(seg, true));
  if (!prepared.length) throw new Error('The class came out empty.');
  const tl = buildClassTimeline(o.title, prepared);
  o.onStage?.('Making the video');
  const { exportMotionReelMp4 } = await import('../reels/motion/export'); // loaded only when a video is made
  const res = await exportMotionReelMp4(tl.reel, { format: 'landscape', voices: tl.clips, photo: null, teacher: o.teacher ?? null, onProgress: (p) => o.onProgress?.(p) } /* a teacher's video carries no student photo */);
  const slug = text.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40).replace(/^-|-$/g, '') || `problem-${index + 1}`;
  return { blob: res.blob, name: `${String(index + 1).padStart(2, '0')}-${slug}.mp4`, seconds: Math.round(res.durationMs / 1000), dna: plan.dna, source, check: res.check };
}
