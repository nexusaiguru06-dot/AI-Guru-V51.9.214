import type { IndexedSource } from './types';
import { splitQuestionPaper } from './question-paper';

export interface IndexedPage { page: number; text: string; }

/**
 * Server-side indexer. PDF parsing itself happens in the browser so Next.js
 * never bundles pdf.worker.mjs into a server route. The server receives the
 * already extracted page text and creates stable page/paragraph source IDs.
 *
 * The paragraph is AI Guru's fundamental teaching unit, so this file decides
 * what one "paragraph" actually is. The earlier version split EVERY block on
 * sentence boundaries, which shattered real paragraphs into single sentences:
 * on the SCERT Class 9 Mathematics book that produced 1198 units with a median
 * length of 92 characters and fragments as short as "What is the fraction ?".
 * Sentence splitting is now only a rescue for blocks that have no paragraph
 * structure at all, and short fragments are merged forward.
 */

/** Paragraphs shorter than this are merged into the previous unit. */
const MIN_UNIT = 220;
/** A block longer than this has lost its paragraph breaks and needs rescuing. */
const MAX_UNIT = 1400;

/**
 * Private Use Area codepoints are what many textbook PDFs emit for symbols the
 * embedded subset renamed. Left alone they reach the model as invisible boxes,
 * so a minus sign silently disappears from an equation.
 */
const GLYPH_FIXES: Array<[RegExp, string]> = [
  [/[\uF02D\u2212\u2013\u2014](?=\s*[\dA-Za-z(])/g, '-'],
  [/\uF02D/g, '-'],
  [/[\uF0B4\uF0D7]/g, '×'],
  [/\uF0B8/g, '÷'],
  [/\uF0B1/g, '±'],
  [/\uF03D/g, '='],
  [/\uF0B0/g, '°'],
  [/\uF070/g, 'π'],
  [/\uF0D6/g, '√'],
  [/\uF0A3/g, '≤'],
  [/\uF0B3/g, '≥'],
  [/\uF0B9/g, '≠'],
  // Anything still in the Private Use Area is a symbol we cannot name. It
  // becomes a space rather than being deleted, so tokens either side do not
  // silently fuse into a different expression.
  [/[\uE000-\uF8FF]/g, ' '],
];

function repairGlyphs(text: string): string {
  let out = text;
  for (const [pattern, replacement] of GLYPH_FIXES) out = out.replace(pattern, replacement);
  return out;
}

/**
 * Running heads and folios repeat on nearly every page ("9 Pairs of Equations",
 * "10 Standard - IX Mathematics"). Left in place they get glued onto the first
 * paragraph of each page and are then taught aloud as if they were content.
 * A line is treated as furniture only when it is short AND the same normalised
 * line appears on many pages, so a genuine one-line sentence is never dropped.
 */
function runningLines(pages: IndexedPage[]): Set<string> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const line of String(page.text || '').split('\n')) {
      const normalised = line.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!normalised || normalised.length > 60) continue;
      // A line that is nothing but numbers normalises to "#" on every page, so
      // it would otherwise be classed as furniture and deleted everywhere —
      // taking the stacked numerators and denominators of this textbook's
      // fractions with it. Folios are handled by the page-number edge rule.
      if (/^[#\s.()-]*$/.test(normalised)) continue;
      if (seen.has(normalised)) continue;
      seen.add(normalised);
      counts.set(normalised, (counts.get(normalised) || 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.floor(pages.length * 0.25));
  return new Set([...counts.entries()].filter(([, n]) => n >= threshold).map(([k]) => k));
}

function stripFurniture(text: string, furniture: Set<string>, pageNo: number): string {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  // A bare number is only a folio when it IS this page's number and it sits at
  // the very top or bottom of the page. Stripping every short digit line ate
  // the numerators and denominators of stacked fractions, which this textbook
  // emits on their own lines — "another form of 1/2" silently became
  // "another form of 2".
  const contentIndexes = lines.map((l, i) => [l.trim(), i] as const).filter(([t]) => t).map(([, i]) => i);
  const edges = new Set([...contentIndexes.slice(0, 2), ...contentIndexes.slice(-2)]);
  return lines
    .filter((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (edges.has(i) && trimmed === String(pageNo)) return false;
      const normalised = trimmed.replace(/\d+/g, '#').replace(/\s+/g, ' ').toLowerCase();
      return !furniture.has(normalised);
    })
    .join('\n');
}

function splitIntoBlocks(pageText: string): string[] {
  const explicit = pageText.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
  const blocks = explicit.length > 1 ? explicit : [pageText.trim()];
  const out: string[] = [];
  for (const block of blocks) {
    const clean = block.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    if (clean.length <= MAX_UNIT) { out.push(clean); continue; }
    // Only here — a block with no usable paragraph structure — do we fall back
    // to sentence boundaries, and we regroup sentences up to MAX_UNIT rather
    // than emitting one unit per sentence.
    let buffer = '';
    for (const sentence of clean.split(/(?<=[.!?])\s+(?=[A-Z(])/)) {
      if (buffer && (buffer.length + sentence.length) > MAX_UNIT) { out.push(buffer.trim()); buffer = ''; }
      buffer += (buffer ? ' ' : '') + sentence;
    }
    if (buffer.trim()) out.push(buffer.trim());
  }
  return out;
}

/** Merges fragments forward so no teaching unit is a stray clause. */
function mergeShortUnits(blocks: string[]): string[] {
  const merged: string[] = [];
  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (previous && (previous.length < MIN_UNIT || block.length < 60) && (previous.length + block.length) <= MAX_UNIT) {
      merged[merged.length - 1] = `${previous} ${block}`;
    } else {
      merged.push(block);
    }
  }
  return merged.filter(x => x.replace(/\s+/g, '').length >= 25);
}

export function indexPdf(pages: IndexedPage[], fileName: string): { pageCount:number; sources:IndexedSource[]; parser:string } {
  if (!Array.isArray(pages) || !pages.length) throw new Error('No readable PDF pages were supplied.');
  const furniture = runningLines(pages);
  const sources: IndexedSource[] = [];

  // A numbered question paper is taught ONE QUESTION per unit, in printed order.
  const cleaned = pages
    .map(page => ({ page: Math.max(1, Number(page.page) || 1), text: repairGlyphs(stripFurniture(String(page.text || ''), furniture, Math.max(1, Number(page.page) || 1))).trim() }))
    .filter(page => page.text);
  // A question paper is a SHORT document. A 144-page textbook also contains stray lines that begin
  // "1." "2." "3." (decimals, list items, worked-example steps), which used to be mistaken for a
  // numbered paper and collapsed the whole book into 5 giant units. Gate on size AND on sanity.
  const looksLikePaper = (units: ReturnType<typeof splitQuestionPaper>) =>
    !!units && cleaned.length <= 12 && units.every(u => u.text.length <= 3000);
  const candidateUnits = cleaned.length <= 12 ? splitQuestionPaper(cleaned) : null;
  const questionUnits = looksLikePaper(candidateUnits) ? candidateUnits : null;
  if (questionUnits) {
    const perPage = new Map<number, number>();
    for (const unit of questionUnits) {
      const n = (perPage.get(unit.page) ?? 0) + 1;
      perPage.set(unit.page, n);
      sources.push({ id: `S${unit.page}_${n}`, page: unit.page, paragraph: n, text: unit.text, title: fileName });
    }
    return { pageCount: Math.max(...pages.map(p => Number(p.page) || 1)), sources, parser: 'browser-pdfjs-question-paper-v1' };
  }

  for (const page of pages) {
    const pageNo = Math.max(1, Number(page.page) || 1);
    const pageText = repairGlyphs(stripFurniture(String(page.text || ''), furniture, pageNo)).trim();
    if (!pageText) continue;
    const units = mergeShortUnits(splitIntoBlocks(pageText));
    const usable = units.length ? units : [pageText.replace(/\s+/g, ' ').trim()];
    usable.forEach((text, i) => sources.push({ id:`S${pageNo}_${i+1}`, page:pageNo, paragraph:i+1, text, title:fileName }));
  }
  if (!sources.length) throw new Error('This PDF has no readable text. Use a PDF with a text layer or enable OCR before indexing.');
  return { pageCount: Math.max(...pages.map(p => Number(p.page) || 1)), sources, parser:'browser-pdfjs-paragraph-v3' };
}
