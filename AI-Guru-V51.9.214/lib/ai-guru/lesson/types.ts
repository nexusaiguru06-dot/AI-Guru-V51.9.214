export type TeachingAction = { id: string; type: string; [key: string]: unknown };

export type LanguageTrack = 'english' | 'malayalam';
export type TeachingStrategy = 'referral_video' | 'step_by_step' | 'specialized_visual' | 'hybrid';
export type TeachingState =
  | 'idle' | 'loading_paragraph' | 'reference_ready' | 'reading_source'
  | 'english_explanation' | 'english_visual' | 'malayalam_translation'
  | 'malayalam_visual' | 'malayalam_audio' | 'paragraph_complete' | 'error';

export interface BoundingBox { x: number; y: number; width: number; height: number; }

export interface ParagraphSource {
  bookId: string;
  chapterIndex: number;
  sectionIndex?: number;
  paragraphIndex: number;
  pageNumber: number;
  text: string;
  pageImage: string;
  boundingBox?: BoundingBox;
  formulas?: string[];
  assetIds?: string[];
}

export interface WordCue { id: string; word: string; startMs: number; endMs: number; }

export type VisualAction =
  | { type: 'write'; id: string; content: string; x: number; y: number; width?: number; height?: number; fontSize?: number; durationMs?: number; visualStyleId?: string; /** 'italic' is how the verbatim textbook paragraph is written on the board, before the handwritten explanation. */ fontStyle?: 'italic' | 'normal'; /** Board colour role: work (cyan), highlight (pink pulse), result (green), problem (pinned title), caption (muted). */ role?: 'work' | 'highlight' | 'mark' | 'result' | 'answer' | 'problem' | 'caption' | 'op' | 'tpl'; /** Worked-solution template row (colour line + arc/circle + right-hand label + box). */ tpl?: import('../math/template-types').TemplateRowSpec; /** 'absolute' = draw as a positioned label inside the figure at x,y (diagram labels); default 'flow' = a row in the working column. */ placement?: 'flow' | 'absolute'; /** Text colour for absolute labels (hex). */ color?: string; /** SVG text-anchor for absolute labels. */ anchor?: 'start' | 'middle' | 'end' }
  | { type: 'latex'; id: string; latex: string; x: number; y: number; width?: number; height?: number; fontSize?: number; durationMs?: number; visualStyleId?: string; placement?: 'flow' | 'absolute'; color?: string; anchor?: 'start' | 'middle' | 'end' }
  | { type: 'shape'; id: string; shape: 'rectangle' | 'circle' | 'triangle'; x: number; y: number; width: number; height: number; fill?: string; stroke?: string; strokeWidth?: number; durationMs?: number; visualStyleId?: string }
  | { type: 'line'; id: string; startX: number; startY: number; endX: number; endY: number; style?: 'solid' | 'dashed'; stroke?: string; strokeWidth?: number; durationMs?: number; visualStyleId?: string }
  | { type: 'chart'; id: string; chartType: 'line' | 'scatter' | 'bar' | 'column' | 'pie' | 'ring' | 'area' | 'radar'; x: number; y: number; width: number; height: number; data: { labels: string[]; legends: string[]; series: number[][] }; durationMs?: number; visualStyleId?: string }
  | { type: 'highlight'; id: string; targetId: string; x?: number; y?: number; width?: number; height?: number; durationMs?: number }
  | { type: 'move'; id: string; targetId: string; fromX: number; fromY: number; toX: number; toY: number; durationMs?: number; visualStyleId?: string }
  | { type: 'token-move'; id: string; token: string; fromX: number; fromY: number; toX: number; toY: number; durationMs?: number; fadeOut?: boolean; fontSize?: number; visualStyleId?: string }
  | { type: 'transform'; id: string; fromId: string; toId: string; durationMs?: number; retainFrom?: boolean; derivedLineIndex?: number; visualStyleId?: string }
  | { type: 'erase'; id: string; targetId: string; durationMs?: number; visualStyleId?: string }
  | { type: 'pause'; id: string; durationMs: number };

export interface AudioTrack { provider: string; audioId?: string; audioUrl?: string; durationMs: number; words?: WordCue[]; }

export interface TeachingTrack {
  text: string;
  audio?: AudioTrack;
  visuals: VisualAction[];
  captions?: Record<string, string>;
}

export interface CueEvent {
  id: string;
  paragraphId: string;
  track: LanguageTrack;
  startMs: number;
  endMs?: number;
  trigger: 'word' | 'phrase' | 'time';
  triggerText?: string;
  action: VisualAction;
}

export interface ParagraphTeachingUnit {
  id: string;
  teachingStrategy?: TeachingStrategy;
  source: ParagraphSource;
  english: TeachingTrack;
  malayalam: TeachingTrack;
  cues: CueEvent[];
  verified: boolean;
}

export interface AIGuruLesson {
  /** The default classroom mode teaches the complete English pass, then replays the same math scene in Malayalam. */
  teachingMode?: 'two-pass';
  schemaVersion: '1.0';
  id: string;
  title: string;
  language: { source: 'english'; target: 'malayalam' };
  paragraphs: ParagraphTeachingUnit[];
}

export interface ControllerSnapshot {
  state: TeachingState;
  paragraphIndex: number;
  error?: string;
}

export interface TeachingControllerPort {
  showReference(source: ParagraphSource): Promise<void> | void;
  playActions(actions: TeachingAction[]): Promise<void>;
  playSpeechWithCues?: (text: string, cues: CueEvent[], language: LanguageTrack) => Promise<void>;
  pause(): void;
  resume(): void;
  resetVisuals(): void;
}
