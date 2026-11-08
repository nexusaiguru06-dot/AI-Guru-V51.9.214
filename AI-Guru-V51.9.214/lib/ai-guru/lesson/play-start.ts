/**
 * Where must "Play" start?
 *
 * Bug this replaces (reported against V51.8.17): the student opens page 7 in the textbook pane and
 * presses Play, and the classroom jumps back to page 1 (again and again).
 *
 * Why: the page-jump box can point at a physical PDF page that has NO extracted paragraph (front matter,
 * a diagram-only page, a scanned page). `goToPage` then parks the lesson cursor on the nearest PRECEDING
 * paragraph (often a page-1 title paragraph) and only remembers "page 7" in a separate display override.
 * Play cleared that override and taught the cursor paragraph, so the pane snapped to the preceding page.
 *
 * Rules:
 *  1. If the student picked a page (override), start at the first paragraph ON that page.
 *  2. If that page has no paragraph, start at the first paragraph AFTER it (teaching only moves forward).
 *  3. If nothing follows it, use the last paragraph (end of book) and say so.
 *  4. With no override, the visible cursor paragraph is authoritative.
 */
export interface StartParagraphLike { source: { pageNumber?: number } }

export interface PlayStart {
  /** Index into lesson.paragraphs that must be taught first. */
  index: number;
  /** Physical page the textbook pane must show for that paragraph. */
  page: number;
  /** The page the student asked for, if any. */
  requestedPage: number | null;
  /** Why the start differs from what was requested (shown in the class log), if it does. */
  note?: string;
}

const pageOf = (p: StartParagraphLike | undefined) => Math.max(1, Math.floor(Number(p?.source?.pageNumber || 1)));

export function resolvePlayStart(paragraphs: StartParagraphLike[], cursorIndex: number, requestedPage: number | null | undefined): PlayStart | null {
  if (!paragraphs.length) return null;
  const clamp = (i: number) => Math.max(0, Math.min(paragraphs.length - 1, Math.floor(Number.isFinite(i) ? i : 0)));
  const wanted = requestedPage && Number.isFinite(requestedPage) && requestedPage >= 1 ? Math.floor(requestedPage) : null;

  if (wanted === null) {
    const index = clamp(cursorIndex);
    return { index, page: pageOf(paragraphs[index]), requestedPage: null };
  }

  const exact = paragraphs.findIndex(p => pageOf(p) === wanted);
  if (exact >= 0) return { index: exact, page: wanted, requestedPage: wanted };

  // A scanned/diagram-only page may have no extracted paragraph. Keep the
  // requested page selected in the reference pane, but teach from the first
  // readable passage after it so playback does not fall back to stale context.
  let following = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    const pg = pageOf(paragraphs[i]);
    if (pg > wanted && (following < 0 || pg < pageOf(paragraphs[following]))) following = i;
  }
  if (following >= 0) {
    return { index: following, page: wanted, requestedPage: wanted, note: `Page ${wanted} has no extracted paragraph. The textbook reference remains on page ${wanted}; teaching starts from the next readable passage on page ${pageOf(paragraphs[following])}.` };
  }

  // If the requested page is before the first extracted paragraph, keep the first
  // readable paragraph as context but still honour the physical page selection.
  const firstPage = pageOf(paragraphs[0]);
  if (wanted < firstPage) {
    return { index: 0, page: wanted, requestedPage: wanted, note: `Page ${wanted} has no extracted paragraph. The textbook reference remains on page ${wanted}; teaching starts from the first readable passage on page ${firstPage}.` };
  }

  let last = 0;
  for (let i = 0; i < paragraphs.length; i++) if (pageOf(paragraphs[i]) >= pageOf(paragraphs[last])) last = i;
  const page = pageOf(paragraphs[last]);
  return { index: last, page, requestedPage: wanted, note: `Page ${wanted} is past the last readable page (${page}); starting from the last readable page.` };
}
