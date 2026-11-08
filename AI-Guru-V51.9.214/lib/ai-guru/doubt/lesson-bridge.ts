/**
 * V51.9.59 — the link between the doubt pane (camera / mic / text) and the class that is playing.
 * The Motion boards register themselves here; the pane asks: "what is the lesson?", "what is on the board?" (a picture)
 * and "make a micro class for this doubt". The pane lives outside the board's component tree, as in the RAG Classroom.
 */

export interface LessonExtract {
  page: number;
  document: string;
  text: string;
}

export interface LessonContext {
  /** Chapter and section being taught. */
  chapter: string;
  section: string;
  /** Chapter text (sections) as extracts the pane's grounding already understands. */
  extracts: LessonExtract[];
  /** The step on the board right now: what is being said and the problem it belongs to. */
  now: string;
}

export interface MicroResult {
  ok: boolean;
  title?: string;
  message: string;
}

export interface LessonBridge {
  context(): LessonContext;
  /** The board that is teaching, as a JPEG (base64, no prefix); null when nothing is drawn. */
  snapshot(): string | null;
  /** The student opened the doubt pane: stop the class and keep everything on the boards exactly as it is. */
  hold(): void;
  /** The doubt is cleared (or the pane closed): carry on where the class was, if it was playing. */
  release(): void;
  /** Make and play a micro class for a doubt on the lecture board. The problem board pauses where it is. */
  playMicro(doubt: string): Promise<MicroResult>;
}

const EVENT = 'ai-guru-lesson-bridge';
let current: LessonBridge | null = null;
/**
 * V51.9.166: the doubt pane is open (a voice / camera / typed session is on). While it is open the class stays held:
 * a release() — after each answer, or from a part of the pane that closes — is ignored, and the class carries on only
 * when the pane itself is closed (closePane).
 */
let paneOpen = false;
let heldRelease: (() => void) | null = null;
const whilePaneOpen = (b: LessonBridge): LessonBridge => ({ ...b, release: () => { heldRelease = () => b.release(); } });

export const lessonBridge = {
  set(b: LessonBridge | null) {
    current = b;
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT));
  },
  get(): LessonBridge | null {
    if (!current) return null;
    return paneOpen ? whilePaneOpen(current) : current;
  },
  /** The doubt pane opened: hold the class until closePane(). */
  openPane() {
    paneOpen = true;
    current?.hold();
  },
  /** The doubt pane closed: the class carries on where it was (if it was playing when the pane opened). */
  closePane() {
    if (!paneOpen) return;
    paneOpen = false;
    heldRelease = null;
    current?.release();
  },
  isPaneOpen: (): boolean => paneOpen,
  subscribe(cb: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener(EVENT, cb);
    return () => window.removeEventListener(EVENT, cb);
  },
};
