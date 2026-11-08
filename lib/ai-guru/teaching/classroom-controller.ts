/**
 * AI Guru Classroom Controller – Teacher-Reading Mode (V51.8.14)
 * -------------------------------------------------------------
 * Extends the original paragraph-level controller with sentence-level
 * READ → TRANSLATE → EXPLAIN → VISUALIZE → CHECK flow.
 *
 * Backward compatible: if a ParagraphTeachingUnit has no beat-level
 * sourceCueId / read / explain fields, the original path is used.
 */

import type { TeachingAction } from '../lesson/types';
import type {
  AIGuruLesson,
  ControllerSnapshot,
  ParagraphTeachingUnit,
  TeachingControllerPort,
  TeachingState,
} from '../lesson/types';
import type { TeachingBeat } from '../math/teaching/types';

export interface TeachingCheckpoint {
  paragraphId: string;
  language: 'english' | 'malayalam';
  lineIndex: number;
  lineId: string;
  caption: string;
  /** Optional cue ID from TextbookCursor */
  sourceCueId?: string;
}

export interface TeachingEvents {
  onCheckpoint?: (checkpoint: TeachingCheckpoint) => void;
  onStateChange?: (snapshot: ControllerSnapshot) => void;
  onParagraphComplete?: (paragraph: ParagraphTeachingUnit) => void;
  /** Fired when the textbook spotlight should move */
  onSpotlight?: (cueId: string | null) => void;
}

/** Extended states for Teacher-Reading Mode */
export type TeacherReadingState =
  | TeachingState
  | 'reading_english'
  | 'translating_malayalam'
  | 'explaining'
  | 'visualizing'
  | 'checking_understanding';

export class AIGuruClassroomController {
  private state: TeacherReadingState = 'idle';
  private paragraphIndex = 0;
  private stopped = false;
  private currentLesson?: AIGuruLesson;

  constructor(
    private readonly port: TeachingControllerPort,
    private readonly events: TeachingEvents = {},
  ) {}

  snapshot(): ControllerSnapshot {
    return { state: this.state as TeachingState, paragraphIndex: this.paragraphIndex };
  }

  private setState(state: TeacherReadingState, error?: string): void {
    this.state = state;
    this.events.onStateChange?.({
      state: state as TeachingState,
      paragraphIndex: this.paragraphIndex,
      error,
    });
  }

  async start(lesson: AIGuruLesson, fromParagraph = 0): Promise<void> {
    this.currentLesson = lesson;
    this.paragraphIndex = fromParagraph;
    this.stopped = false;
    while (!this.stopped && this.paragraphIndex < lesson.paragraphs.length) {
      await this.teachParagraph(lesson.paragraphs[this.paragraphIndex]);
      if (!this.stopped) this.paragraphIndex += 1;
    }
    if (!this.stopped) this.setState('idle');
  }

  checkpoint(
    p: ParagraphTeachingUnit,
    language: 'english' | 'malayalam',
    lineIndex: number,
    lineId: string,
    caption: string,
    sourceCueId?: string,
  ): void {
    this.events.onCheckpoint?.({
      paragraphId: p.id,
      language,
      lineIndex,
      lineId,
      caption,
      sourceCueId,
    });
  }

  stop(): void {
    this.stopped = true;
  }
  pause(): void {
    this.port.pause();
  }
  resume(): void {
    this.port.resume();
  }

  private async teachParagraph(p: ParagraphTeachingUnit): Promise<void> {
    try {
      this.setState('loading_paragraph');
      this.port.resetVisuals();
      await this.port.showReference(p.source);
      this.setState('reference_ready');

      // Prefer fine-grained Teacher-Reading beats when available
      const beats = (p as any).beats as TeachingBeat[] | undefined;
      if (beats && beats.length > 0 && beats.some((b) => b.sourceCueId || b.read || b.explain)) {
        await this.teachBeats(p, beats);
      } else {
        // Legacy path (original V51.8 behaviour)
        await this.teachLegacyParagraph(p);
      }

      this.setState('paragraph_complete');
      this.events.onParagraphComplete?.(p);
    } catch (error) {
      this.setState('error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /** New Teacher-Reading path: one beat at a time with full bilingual cycle */
  private async teachBeats(p: ParagraphTeachingUnit, beats: TeachingBeat[]): Promise<void> {
    for (let i = 0; i < beats.length; i++) {
      if (this.stopped) return;
      const beat = beats[i];

      // 1. Spotlight the textbook sentence
      if (beat.sourceCueId) {
        this.events.onSpotlight?.(beat.sourceCueId);
      }

      // 2. READ (English)
      if (beat.read?.en) {
        this.setState('reading_english');
        await this.speak(beat.read.en, 'english', `${p.id}:beat-${i}:read-en`);
      }

      // 3. TRANSLATE (Malayalam)
      if (beat.read?.ml) {
        this.setState('translating_malayalam');
        await this.speak(beat.read.ml, 'malayalam', `${p.id}:beat-${i}:read-ml`);
      }

      // 4. EXPLAIN (English then Malayalam)
      if (beat.explain?.en) {
        this.setState('explaining');
        await this.speak(beat.explain.en, 'english', `${p.id}:beat-${i}:explain-en`);
      }
      if (beat.explain?.ml) {
        await this.speak(beat.explain.ml, 'malayalam', `${p.id}:beat-${i}:explain-ml`);
      }

      // Fallback: use narration if no structured explain
      if (!beat.explain?.en && beat.narration) {
        this.setState('explaining');
        await this.speak(beat.narration, 'english', `${p.id}:beat-${i}:narration`);
      }

      // 5. VISUALIZE (3B1B actions – never long prose)
      this.setState('visualizing');
      if (beat.actions && beat.actions.length) {
        // Convert AnimationIntent → TeachingAction if the port expects the older shape.
        // Most runtimes already understand the DNA action list via a dedicated player;
        // here we emit a generic "visual" action that the stage can interpret.
        await this.port.playActions([
          {
            id: `${p.id}:beat-${i}:visual`,
            type: 'visual_beat',
            beatId: beat.id,
            actions: beat.actions,
            targetObjects: beat.targetObjects,
            visualIntent: beat.visualIntent,
            dna: beat.dna,
          } as any,
        ]);
      }

      // 6. Optional micro-check
      if (beat.checkQuestion?.en) {
        this.setState('checking_understanding');
        await this.speak(beat.checkQuestion.en, 'english', `${p.id}:beat-${i}:check-en`);
        if (beat.checkQuestion.ml) {
          await this.speak(beat.checkQuestion.ml, 'malayalam', `${p.id}:beat-${i}:check-ml`);
        }
      }

      this.checkpoint(
        p,
        'english',
        i,
        beat.id,
        beat.explain?.en || beat.narration || '',
        beat.sourceCueId,
      );
    }

    // Clear spotlight at end of paragraph
    this.events.onSpotlight?.(null);
  }

  /** Original V51.8 paragraph path (kept for full backward compatibility) */
  private async teachLegacyParagraph(p: ParagraphTeachingUnit): Promise<void> {
    this.setState('reading_source');
    if (this.port.playSpeechWithCues) {
      await this.port.playSpeechWithCues(
        p.source.text,
        p.cues.filter((c) => c.track === 'english'),
        'english',
      );
    } else {
      await this.port.playActions([
        { id: `${p.id}:read`, type: 'speech', text: p.source.text } as TeachingAction,
      ]);
    }

    this.setState('english_explanation');
    if (this.port.playSpeechWithCues) {
      await this.port.playSpeechWithCues(
        p.english.text,
        p.cues.filter((c) => c.track === 'english'),
        'english',
      );
    } else {
      await this.port.playActions(
        this.toTeachingActions(p.english.visuals, p.english.text, `${p.id}:en`),
      );
    }
    this.setState('english_visual');
    await this.port.playActions(
      this.toTeachingActions(p.english.visuals, undefined, `${p.id}:en-visuals`),
    );

    this.setState('malayalam_translation');
    await this.port.playActions(
      this.toTeachingActions([], p.malayalam.text, `${p.id}:ml-text`),
    );
    this.setState('malayalam_visual');
    await this.port.playActions(
      this.toTeachingActions(p.malayalam.visuals, undefined, `${p.id}:ml`),
    );

    this.setState('malayalam_audio');
    if (this.port.playSpeechWithCues) {
      await this.port.playSpeechWithCues(
        p.malayalam.text,
        p.cues.filter((c) => c.track === 'malayalam'),
        'malayalam',
      );
    } else if (p.malayalam.audio) {
      await this.port.playActions([
        {
          id: `${p.id}:ml-audio`,
          type: 'speech',
          text: p.malayalam.text,
          audioId: p.malayalam.audio.audioId,
        } as TeachingAction,
      ]);
    }
  }

  private async speak(
    text: string,
    language: 'english' | 'malayalam',
    id: string,
  ): Promise<void> {
    if (!text?.trim()) return;
    if (this.port.playSpeechWithCues) {
      await this.port.playSpeechWithCues(text, [], language);
    } else {
      await this.port.playActions([
        { id, type: 'speech', text, language } as TeachingAction,
      ]);
    }
  }

  private toTeachingActions(
    visuals: ParagraphTeachingUnit['english']['visuals'],
    speech: string | undefined,
    prefix: string,
  ): TeachingAction[] {
    const actions: TeachingAction[] = [];
    if (speech) {
      actions.push({ id: `${prefix}:speech`, type: 'speech', text: speech } as TeachingAction);
    }
    for (const v of visuals) {
      if (v.type === 'write')
        actions.push({
          id: v.id,
          type: 'wb_draw_text',
          elementId: v.id,
          content: v.content,
          x: v.x,
          y: v.y,
          width: v.width,
          height: v.height,
          fontSize: v.fontSize,
        } as TeachingAction);
      else if (v.type === 'latex')
        actions.push({
          id: v.id,
          type: 'wb_draw_latex',
          elementId: v.id,
          latex: v.latex,
          x: v.x,
          y: v.y,
          width: v.width,
          height: v.height,
        } as TeachingAction);
      else if (v.type === 'shape')
        actions.push({
          id: v.id,
          type: 'wb_draw_shape',
          elementId: v.id,
          shape: v.shape,
          x: v.x,
          y: v.y,
          width: v.width,
          height: v.height,
        } as TeachingAction);
      else if (v.type === 'line')
        actions.push({
          id: v.id,
          type: 'wb_draw_line',
          elementId: v.id,
          startX: v.startX,
          startY: v.startY,
          endX: v.endX,
          endY: v.endY,
          style: v.style,
        } as TeachingAction);
      else if (v.type === 'chart')
        actions.push({
          id: v.id,
          type: 'wb_draw_chart',
          elementId: v.id,
          chartType: v.chartType,
          x: v.x,
          y: v.y,
          width: v.width,
          height: v.height,
          data: v.data,
        } as TeachingAction);
      else if (v.type === 'highlight')
        actions.push({ id: v.id, type: 'spotlight', elementId: v.targetId } as TeachingAction);
    }
    return actions;
  }
}
