/**
 * Paragraph flow: which lesson paragraph a taught unit belongs to, and which one comes next.
 *
 * Bug this replaces (reproduced on the 20-question paper): when a paragraph was taught on its own,
 * the classroom built the source as { id: 'paragraph:5', paragraph: <GLOBAL 0-based index> } while the
 * matcher read `paragraph` as a PAGE-LOCAL 1-based number. Every paragraph except the first of a
 * page therefore resolved to the paragraph BEFORE it, so "continue to the next paragraph" landed on the
 * same paragraph again and the lesson replayed it forever instead of progressing.
 *
 * Rules now:
 *  1. A source whose id IS a lesson-paragraph id ("paragraph:5") maps directly to that paragraph.
 *  2. Indexed ids ("S2_3") use page + page-local paragraph number (1-based).
 *  3. Exact text is the last resort.
 *  4. The next paragraph is always strictly after everything already taught in this run.
 */
export interface LessonParagraphLike { id: string; source: { pageNumber?: number; text?: string } }
export interface SourceLike { id: string; page: number; paragraph?: number; text?: string }

const norm = (t: unknown) => String(t ?? '').trim();

export function paragraphIndexForSource(hit: SourceLike, paragraphs: LessonParagraphLike[], sectionText?: string): number | undefined {
  const byId = paragraphs.findIndex(p => p.id === hit.id);
  if (byId >= 0) return byId;

  const page = Number(hit.page || 1);
  const samePage = paragraphs.map((p, i) => ({ p, i })).filter(({ p }) => Number(p.source.pageNumber || 1) === page);
  let local = Number(hit.paragraph || 0);
  if (!(local > 0)) { const m = /^S(\d+)_(\d+)$/.exec(hit.id); if (m) local = Number(m[2]); }
  const byNumber = local > 0 ? samePage[local - 1] : undefined;

  const wanted = norm(sectionText) || norm(hit.text);
  const byText = samePage.find(({ p }) => norm(p.source.text) === wanted) ?? samePage.find(({ p }) => norm(p.source.text) === norm(hit.text));
  // Exact text is checked BEFORE the positional guess when both exist and disagree: text cannot be off by one.
  const exactHitText = norm(hit.text) && samePage.find(({ p }) => norm(p.source.text) === norm(hit.text));
  return (exactHitText || byNumber || byText)?.i;
}

/** The IndexedSource used when ONE lesson paragraph is taught on demand. */
export function toIndexedSource(paragraph: LessonParagraphLike, paragraphs: LessonParagraphLike[]): { id: string; page: number; paragraph: number; text: string } {
  const page = Number(paragraph.source.pageNumber || 1);
  const samePage = paragraphs.filter(p => Number(p.source.pageNumber || 1) === page);
  const local = Math.max(1, samePage.findIndex(p => p.id === paragraph.id) + 1);
  return { id: paragraph.id, page, paragraph: local, text: String(paragraph.source.text || '') };
}

/** Next paragraph to teach: strictly after everything already taught in this run, or null at the end. */
export function nextParagraphToTeach(input: { lastMatched?: number; fallbackCurrent: number; taught: Iterable<number>; total: number }): number | null {
  let highest = input.lastMatched ?? input.fallbackCurrent;
  for (const t of input.taught) highest = Math.max(highest, t);
  const next = highest + 1;
  return next < input.total ? next : null;
}
