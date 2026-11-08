import type { AIGuruLesson, VisualAction } from '../lesson/types';

export interface VideoCue {
  atMs: number;
  durationMs: number;
  kind: 'reference' | 'english' | 'math' | 'malayalam' | 'audio' | 'construction';
  text?: string;
  latex?: string;
  page?: number;
  visualAction?: string;
  cueId?: string;
  visibleVisualIds?: string[];
  persistent?: boolean;
  derivedFromCueId?: string;
  derivation?: Array<{ id: string; latex: string; lineIndex: number; persistent: true }>;
}

export interface AIGuruVideoTimeline {
  version: 1;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  referencePage?: number;
  cues: VideoCue[];
}

type TimelineStep = { id: string; visualId: string; text: string; explanation?: string; latex?: string; durationMs?: number };

function actionText(action: VisualAction): { text: string; latex?: string } {
  if (action.type === 'latex') return { text: action.latex, latex: action.latex };
  if (action.type === 'write') return { text: action.content };
  return { text: '' };
}

function buildSteps(track: { visuals: VisualAction[]; captions?: Record<string, string> }): TimelineStep[] {
  return track.visuals.map((visual, i) => {
    const content = actionText(visual);
    const caption = track.captions?.[visual.id] ?? content.text;
    return {
      id: visual.id,
      visualId: visual.id,
      text: caption,
      explanation: caption,
      latex: content.latex,
      durationMs: 'durationMs' in visual ? visual.durationMs : undefined,
    };
  });
}

/**
 * Export one paragraph as a deliberate two-pass video:
 * reference → complete English pass → complete Malayalam translation pass.
 * The two passes share visual IDs so the mathematical construction is replayed,
 * not independently regenerated.
 */
export function lessonToVideoTimeline(lesson: AIGuruLesson, fps = 30): AIGuruVideoTimeline {
  const cues: VideoCue[] = [];
  let t = 0;
  const push = (durationMs: number, cue: Omit<VideoCue, 'atMs' | 'durationMs'>) => {
    const safe = Math.max(80, Math.round(durationMs));
    cues.push({ atMs: t, durationMs: safe, ...cue });
    t += safe;
  };

  const paragraph = lesson.paragraphs?.[0];
  if (!paragraph) return { version: 1, width: 1920, height: 1080, fps, durationMs: 0, cues: [] };

  push(2200, { kind: 'reference', page: paragraph.source.pageNumber, text: paragraph.source.text });

  const englishSteps = buildSteps(paragraph.english);
  const malayalamSteps = buildSteps(paragraph.malayalam);

  const renderPass = (language: 'english' | 'malayalam', steps: TimelineStep[]) => {
    const visible: string[] = [];
    const derivation: Array<{ id: string; latex: string; lineIndex: number; persistent: true }> = [];
    steps.forEach((step, i) => {
      visible.push(step.visualId);
      if (step.latex) derivation.push({ id: step.visualId, latex: step.latex, lineIndex: i, persistent: true });
      const cueId = `${language === 'english' ? 'step' : 'ml-step'}-${String(i + 1).padStart(2, '0')}`;
      push(Math.max(1500, step.durationMs ?? 2100), {
        kind: language,
        cueId,
        text: step.text,
        latex: step.latex,
        visualAction: i === 0 ? 'construct-and-focus' : i === steps.length - 1 ? 'derive-final-result' : 'derive-next-line',
        visibleVisualIds: [...visible],
        persistent: true,
        derivedFromCueId: i > 0 ? `${language === 'english' ? 'step' : 'ml-step'}-${String(i).padStart(2, '0')}` : undefined,
        derivation: derivation.length ? [...derivation] : undefined,
      });
      // A short construction boundary lets the renderer commit the new visual state
      // before the next spoken beat. It is deliberately not a second-language cue.
      push(120, { kind: 'construction', cueId, latex: step.latex, visualAction: i === 0 ? 'create-objects' : 'append-derived-line', visibleVisualIds: [...visible], persistent: true });
    });
  };

  renderPass('english', englishSteps);
  renderPass('malayalam', malayalamSteps);

  return { version: 1, width: 1920, height: 1080, fps, durationMs: t, referencePage: paragraph.source.pageNumber, cues };
}
