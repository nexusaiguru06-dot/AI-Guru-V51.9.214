import { NextResponse } from 'next/server';
import { getDocument } from '@/lib/ai-guru/material-studio/store';
import { contentAccessFor, fullFor } from '@/lib/ai-guru/admin/content-access';
import { isPageLocked, lockedPartsOf } from '@/lib/ai-guru/material-studio/locks';
import { figuresOfPdfPage, type FigureOut } from '@/lib/ai-guru/material-studio/page-figures-render';
import { cachedPdf, withPdfSlot } from '@/lib/ai-guru/material-studio/pdf-work';

export const runtime = 'nodejs';

/**
 * V51.9.141 — GET /api/ai-guru/material-studio/page-figures/{documentId}?page=N
 *   → { ok, page, figures: [{ box, kind, inside, near, image }] }   (image = PNG data URL of the cut-out picture)
 *
 * The pictures of one textbook page (photos and drawings), each cut out of the page at a good size, with its labels and
 * caption, for the classroom to show on the whiteboard. Same canvas / pdfjs set-up as page-image (see that route for why).
 */
const cache = new Map<string, FigureOut[]>();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = Math.max(1, Number(new URL(request.url).searchParams.get('page') || 1) || 1);
  try {
    const access = await contentAccessFor(request);
    const book = access.full ? null : await getDocument(id);
    if (book && !fullFor(book, access)) {
      const { lockedParts } = lockedPartsOf(book, access.freeParts, false, access.paidParts);
      if (isPageLocked(book, page, lockedParts)) return NextResponse.json({ ok: true, page, figures: [], locked: true });
    }
    const key = `${id}#${page}`;
    const hit = cache.get(key);
    if (hit) return NextResponse.json({ ok: true, page, figures: hit }, { headers: { 'cache-control': 'private, max-age=86400' } });
    const pdf = await cachedPdf(id); // V51.9.179: cached, and at most a few PDF jobs at once
    if (!pdf || !pdf.length) return NextResponse.json({ ok: false, error: 'Indexed textbook PDF not found.' }, { status: 404 });
    const out = await withPdfSlot(() => figuresOfPdfPage(pdf, page));
    cache.set(key, out);
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ ok: true, page, figures: out }, { headers: { 'cache-control': 'private, max-age=86400' } });
  } catch (e) {
    console.error('[page-figures] failed:', e);
    // the class goes on without pictures
    return NextResponse.json({ ok: false, page, figures: [], error: e instanceof Error ? e.message : String(e) });
  }
}
