/**
 * Textbook Reading Cursor
 * -----------------------
 * The single source of truth for "where the teacher is currently reading"
 * inside a textbook page.  Prevents page jumps, enables soft spotlighting,
 * and supplies stable cue IDs that the speech + visual clocks share.
 *
 * Classification rules (what the teacher actually speaks):
 *   HEADING / BODY / DEFINITION / EXAMPLE / QUESTION / EQUATION  → readable
 *   FIGURE / CAPTION / SIDEBAR / DECORATION / PAGE_NUMBER        → skipped
 */

export type TextbookElementType =
  | 'heading'
  | 'body'
  | 'definition'
  | 'example'
  | 'question'
  | 'equation'
  | 'figure'
  | 'caption'
  | 'sidebar'
  | 'decoration'
  | 'page_number';

export interface TextbookSentence {
  /** Stable cue ID, e.g. "p7-para2-s1" */
  id: string;
  text: string;
  translation?: string;          // Malayalam (or other) translation
  type: TextbookElementType;
  /** Short semantic label the teacher planner can use */
  teachingIntent?: string;
  /** Whether this sentence should be spoken by the teacher */
  readable: boolean;
}

export interface TextbookParagraph {
  id: string;
  sentences: TextbookSentence[];
}

export interface TextbookPage {
  pageNumber: number;
  paragraphs: TextbookParagraph[];
}

export interface TextbookCursor {
  page: TextbookPage;
  /** Index of current paragraph (0-based) */
  paragraphIndex: number;
  /** Index of current sentence inside that paragraph (0-based) */
  sentenceIndex: number;
  /** Convenience: the active cue ID */
  currentCueId: string | null;
}

/** Build a cursor positioned at the first readable sentence of a page. */
export function createTextbookCursor(page: TextbookPage): TextbookCursor {
  const cursor: TextbookCursor = {
    page,
    paragraphIndex: 0,
    sentenceIndex: 0,
    currentCueId: null,
  };
  advanceToNextReadable(cursor);
  return cursor;
}

/** Return the currently spotlighted sentence, or null if finished. */
export function currentSentence(cursor: TextbookCursor): TextbookSentence | null {
  const para = cursor.page.paragraphs[cursor.paragraphIndex];
  if (!para) return null;
  return para.sentences[cursor.sentenceIndex] ?? null;
}

/** Advance to the next readable sentence. Returns false when the page is exhausted. */
export function advanceToNextReadable(cursor: TextbookCursor): boolean {
  const paras = cursor.page.paragraphs;
  while (cursor.paragraphIndex < paras.length) {
    const para = paras[cursor.paragraphIndex];
    while (cursor.sentenceIndex < para.sentences.length) {
      const s = para.sentences[cursor.sentenceIndex];
      if (s.readable) {
        cursor.currentCueId = s.id;
        return true;
      }
      cursor.sentenceIndex += 1;
    }
    cursor.paragraphIndex += 1;
    cursor.sentenceIndex = 0;
  }
  cursor.currentCueId = null;
  return false;
}

/** Jump the cursor to a specific cue ID (used when the learner seeks). */
export function seekToCue(cursor: TextbookCursor, cueId: string): boolean {
  for (let pi = 0; pi < cursor.page.paragraphs.length; pi++) {
    const para = cursor.page.paragraphs[pi];
    for (let si = 0; si < para.sentences.length; si++) {
      if (para.sentences[si].id === cueId) {
        cursor.paragraphIndex = pi;
        cursor.sentenceIndex = si;
        cursor.currentCueId = cueId;
        return true;
      }
    }
  }
  return false;
}

/**
 * Lightweight classifier used by the OCR / document pipeline.
 * Heuristics are intentionally simple so they run client-side if needed.
 */
export function classifySentence(text: string, context?: { isHeading?: boolean; isCaption?: boolean }): TextbookElementType {
  const t = text.trim();
  if (!t) return 'decoration';
  if (context?.isHeading || /^(chapter|unit|pairs of equations|mental math)/i.test(t)) return 'heading';
  if (context?.isCaption) return 'caption';
  if (/^\d+\s*$/.test(t) || /^page\s+\d+/i.test(t)) return 'page_number';
  if (/[=≠≈≤≥]/.test(t) && t.length < 80) return 'equation';
  if (/^(definition|theorem|lemma|note|example|exercise|question)\b/i.test(t)) {
    return /example/i.test(t) ? 'example' : /question|exercise/i.test(t) ? 'question' : 'definition';
  }
  if (t.length < 12 && !/[a-z]/i.test(t)) return 'decoration';
  return 'body';
}

/** Mark readable flag based on type. */
export function isReadableType(type: TextbookElementType): boolean {
  return ['heading', 'body', 'definition', 'example', 'question', 'equation'].includes(type);
}

/**
 * Build a page structure from raw OCR / extracted paragraphs.
 * Call this once after document ingest; the resulting TextbookPage is then
 * fed to createTextbookCursor and shared across speech + visual clocks.
 */
export function buildTextbookPage(
  pageNumber: number,
  rawParagraphs: { id?: string; text: string; isHeading?: boolean }[],
): TextbookPage {
  const paragraphs: TextbookParagraph[] = [];
  rawParagraphs.forEach((raw, pi) => {
    // Simple sentence splitter that respects common maths punctuation
    // Keep mathematical punctuation inside a sentence (for example
    // "5x - x = 32; hence x = 8") and split only at real sentence stops
    // or explicit line breaks. Malayalam/English mixed text is supported.
    const parts = raw.text
      .replace(/\r/g, '')
      .split(/(?<=[.?!])\s+(?=[A-Z0-9“"‘\u0D00-\u0D7F])|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const sentences: TextbookSentence[] = parts.map((text, si) => {
      const type = classifySentence(text, { isHeading: raw.isHeading && si === 0 });
      return {
        id: `p${pageNumber}-para${pi + 1}-s${si + 1}`,
        text,
        type,
        readable: isReadableType(type),
      };
    });

    paragraphs.push({
      id: raw.id || `p${pageNumber}-para${pi + 1}`,
      sentences,
    });
  });

  return { pageNumber, paragraphs };
}
