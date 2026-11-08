/**
 * Class compiler: planned blocks → the bilingual class timeline.
 *
 * For every block (paragraph / problem / equations / result):
 *   1. Read   — English textbook text, read aloud sentence by sentence
 *   2. Teach  — the block's DNA on the whiteboard, explained in English
 *   3. Read   — the Malayalam translation, read aloud
 *   4. Teach  — the SAME DNA plan built again in Malayalam (same graphics)
 *
 * Order is configurable ("reads first" puts both readings before both teachings).
 * A pass is only produced when its language content exists: no plan ever falls
 * back to English text inside a Malayalam pass.
 */

import { makeReel, type MotionReel } from '../reels/motion/reel';
import { withVoice, type MotionScene } from '../reels/motion/engine';
import type { Lang } from '../reels/motion/captions';
import type { BookBlock } from './segment';
import type { BlockPlan, DnaId } from './dna/types';
import { buildDnaScenes } from './dna/builders';
import { buildReadingScene } from './reading';
import { arcScenes } from './dna/arc-builders';
import { arcFor } from './dna/arc-math';
import { headingIntroScene } from './heading-intro';
import { clipFor, pickLook, type IntroClips, type IntroRequest } from './intro-clips';
import { preloadClip } from '../reels/motion/clip';

export type Phase = 'read' | 'teach';
export type ClassOrder = 'per-language' | 'reads-first';

export interface ClassSegment {
  id: string;
  blockId: string;
  phase: Phase;
  lang: Lang;
  dna: DnaId;
  /** "Read · English", "Teach · മലയാളം" … */
  label: string;
  title: string;
  /** Overrides the corner pill (the 3D heading intro says "INTRO"). */
  pill?: string;
  build: () => MotionScene[];
}

export interface CompileOptions {
  order?: ClassOrder;
  languages?: Lang[];
  /** Read the textbook text aloud before teaching (default true). */
  read?: boolean;
  /** V51.9.51: add the app's own common-mistake scene to units whose plan has none (default false). */
  mistakes?: boolean;
  /** V51.9.80: a 3D title intro before every heading (default false). */
  headingIntro3d?: boolean;
  /** Subject name, used to choose the flying symbols of the heading intro. */
  subject?: string;
  /** V51.9.88: rendered HyperFrames clips; a heading with a clip plays it, the others keep the three.js intro. */
  introClips?: IntroClips;
  /** Called once per heading intro with what the render tool needs (tools/hyperframes-intros). */
  onIntro?: (r: IntroRequest) => void;
}

/** True when any bilingual field in the plan has English but no Malayalam. */
export function missingMalayalam(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  if (Array.isArray(x)) return x.some(missingMalayalam);
  const o = x as Record<string, unknown>;
  if (typeof o.en === 'string' && o.en.trim() && !(typeof o.ml === 'string' && o.ml.trim())) return true;
  return Object.entries(o).some(([k, v]) => k !== 'en' && missingMalayalam(v));
}

const LANG_NAME: Record<Lang, string> = { en: 'English', ml: 'മലയാളം' };

/** The problem a unit is about, for the card at the top: the word problem's own statement, or the text of a problem / exercise block. */
export function problemFor(b: BookBlock, plan: BlockPlan, lang: Lang): string | undefined {
  if (plan.dna === 'word-problem') {
    const st = (plan.teach as { statement?: { en?: string; ml?: string } } | null)?.statement;
    const text = (lang === 'ml' ? st?.ml : undefined) || st?.en;
    return text?.trim() || undefined;
  }
  if (plan.dna === 'ai-custom') {
    // a composite that starts from a word problem keeps the problem pinned on every scene, scales included
    const wp = (plan.teach as { segments?: Array<{ dna: string; plan: unknown }> } | null)?.segments?.find((sg) => sg.dna === 'word-problem');
    const st = (wp?.plan as { statement?: { en?: string; ml?: string } } | undefined)?.statement;
    const text = (lang === 'ml' ? st?.ml : undefined) || st?.en;
    if (text?.trim()) return text.trim();
  }
  if ((b.kind === 'problem' || b.kind === 'exercise') && plan.dna !== 'bridge' && plan.dna !== 'section-intro') {
    const text = b.text.replace(/\s+/g, ' ').trim();
    return text && text.length <= 320 ? text : undefined;
  }
  return undefined;
}

/** Pins the problem on every scene that does not already carry one. */
export function withProblem(scenes: MotionScene[], problem: string | undefined, lang: Lang): MotionScene[] {
  if (!problem) return scenes;
  for (const sc of scenes) {
    if (!sc.problem) {
      sc.problem = problem;
      sc.problemLabel = lang === 'ml' ? 'പ്രശ്നം' : 'PROBLEM';
    }
  }
  return scenes;
}

export function compileClass(
  blocks: BookBlock[],
  plans: Map<string, BlockPlan>,
  ctx: { title: string },
  o: CompileOptions = {},
): ClassSegment[] {
  const langs = o.languages ?? ['en', 'ml'];
  const order = o.order ?? 'per-language';
  const out: ClassSegment[] = [];
  let carry: { en: string; ml?: string } | null = null;
  // each heading gets the next of six looks (starting point depends on the chapter), so neighbouring intros never look alike
  let clipN = 0;
  let clipPrev = -1;
  let introLook = [...ctx.title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 6;

  blocks.forEach((b, i) => {
    const plan = plans.get(b.id);
    if (!plan) return;
    // Bridge sentences ("Let's start with a problem:") are read together with the next block.
    if (plan.dna === 'bridge' && i < blocks.length - 1) {
      carry = carry
        ? { en: `${carry.en} ${plan.read.en}`, ml: carry.ml && plan.read.ml ? `${carry.ml} ${plan.read.ml}` : undefined }
        : { en: plan.read.en, ml: plan.read.ml };
      return;
    }
    const read = carry
      ? { en: `${carry.en}${b.kind === 'math' ? '\n' : ' '}${plan.read.en}`, ml: carry.ml && plan.read.ml ? `${carry.ml} ${plan.read.ml}` : undefined }
      : plan.read;
    carry = null;
    const title = ctx.title;
    const reads: ClassSegment[] = [];
    const look = o.headingIntro3d && b.kind === 'heading' ? introLook++ % 6 : 0;
    const clipLook = o.headingIntro3d && b.kind === 'heading' ? (clipPrev = pickLook(o.subject, clipN++, clipPrev, ctx.title)) : 0;
    const teaches: ClassSegment[] = [];
    for (const lang of langs) {
      const text = lang === 'ml' ? read.ml : read.en;
      if (o.headingIntro3d && b.kind === 'heading') {
        const head = (lang === 'ml' ? read.ml : b.text)?.replace(/\s+/g, ' ').trim();
        if (head) {
          const sub = head.toLowerCase() === title.trim().toLowerCase() ? undefined : title;
          o.onIntro?.({ heading: head, sub, lang, subject: o.subject, kicker: `${o.subject ?? ''}`.toUpperCase(), chapter: title, look: clipLook });
          reads.push({
            id: `${b.id}:intro:${lang}`,
            blockId: b.id,
            phase: 'read',
            lang,
            dna: plan.dna,
            label: `${lang === 'ml' ? 'ആമുഖം' : 'Intro'} · ${LANG_NAME[lang]}`,
            title,
            pill: lang === 'ml' ? 'ആമുഖം' : 'INTRO',
            build: () => {
              const sc = headingIntroScene({ heading: head, sub, lang, title, subject: o.subject, variant: look });
              const clip = clipFor(o.introClips, { heading: head, sub, lang, look: clipLook });
              if (clip && sc.layer3d) { sc.layer3d.clip = clip; preloadClip(clip.src); }
              return [sc];
            },
          });
        }
      }
      if (o.read !== false && text && b.kind !== 'heading') {
        reads.push({
          id: `${b.id}:read:${lang}`,
          blockId: b.id,
          phase: 'read',
          lang,
          dna: plan.dna,
          label: `Read · ${LANG_NAME[lang]}`,
          title,
          build: () => [buildReadingScene(text, lang, title)],
        });
      }
      const canTeach = plan.dna !== 'bridge' && plan.teach != null && (lang === 'en' || !missingMalayalam(plan.teach));
      if (canTeach) {
        teaches.push({
          id: `${b.id}:teach:${lang}`,
          blockId: b.id,
          phase: 'teach',
          lang,
          dna: plan.dna,
          label: `Teach · ${LANG_NAME[lang]}`,
          title,
          build: () => {
            const arc = arcScenes(arcFor(plan, lang, { mistakes: o.mistakes }), lang, title);
            return withProblem([...arc.before, ...buildDnaScenes(plan.dna, plan.teach, lang, title), ...arc.after], problemFor(b, plan, lang), lang);
          },
        });
      }
    }
    if (order === 'reads-first') out.push(...reads, ...teaches);
    else for (const lang of langs) out.push(...reads.filter((s) => s.lang === lang), ...teaches.filter((s) => s.lang === lang));
  });
  return out;
}

/** One segment as a reel (optionally timed to voice clips). */
export const PILL: Record<Phase, Record<Lang, string>> = {
  read: { en: 'READ', ml: 'വായന' },
  teach: { en: 'STEP', ml: 'ഘട്ടം' },
};

/** One segment as a reel (optionally timed to voice clips). Steps are numbered per segment. */
export function segmentReel(seg: ClassSegment, voiceMs?: (spoken: string) => number | undefined): MotionReel {
  const parts = withVoice({ lang: seg.lang, clipMs: voiceMs ?? (() => undefined) }, () => seg.build());
  for (const p of parts) {
    p.group = seg.id;
    p.pill = seg.pill ?? PILL[seg.phase][seg.lang];
  }
  return makeReel(seg.title, parts);
}
