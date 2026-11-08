import { NextResponse } from 'next/server';
import { getDocument, saveDocumentRecord } from '@/lib/ai-guru/material-studio/store';
import { recoverPdfPagesWithOCR } from '@/lib/ai-guru/material-studio/ocr';
import { indexPdf } from '@/lib/ai-guru/material-studio/index-pdf';
import { contentAccessFor, fullFor } from '@/lib/ai-guru/admin/content-access';
import { isPageLocked, lockedPartsOf } from '@/lib/ai-guru/material-studio/locks';
import { cachedPdf, withPdfSlot } from '@/lib/ai-guru/material-studio/pdf-work';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const page = Math.max(1, Number(body?.page || 1));
    const doc = await getDocument(id);
    const pdf = await cachedPdf(id);
    if (!doc || !pdf) return NextResponse.json({ ok: false, error: 'Indexed textbook not found.' }, { status: 404 });
    // V51.9.93: re-reading a page returns its text, so a locked page is refused for a student who has not paid.
    const access = await contentAccessFor(request);
    if (!fullFor(doc, access) && isPageLocked(doc, page, lockedPartsOf(doc, access.freeParts, false, access.paidParts).lockedParts)) return NextResponse.json({ ok: false, locked: true, error: 'This page is in a part that opens when the fee is paid.' }, { status: 403 });

    const result = await withPdfSlot(() => recoverPdfPagesWithOCR(pdf, [{ page, text: '' }], { force: true, requestedPages: [page] }));
    const recovered = result.pages.find(p => p.page === page);
    if (!recovered?.text) return NextResponse.json({ ok: false, error: `OCR could not recover readable text from page ${page}.`, diagnostics: result.diagnostics }, { status: 422 });

    const indexed = indexPdf([{ page, text: recovered.text }], doc.fileName);
    const newSources = indexed.sources.map((s, i) => ({ ...s, id: `OCR${page}_${i + 1}` }));
    const existing = doc.sources.filter(s => s.page !== page);
    const sources = [...existing, ...newSources].sort((a, b) => a.page - b.page || a.paragraph - b.paragraph);
    const chapters = doc.chapters.map(ch => {
      if (page < ch.startPage || page > ch.endPage) return ch;
      return { ...ch, sourceIds: sources.filter(s => s.page >= ch.startPage && s.page <= ch.endPage).map(s => s.id) };
    });
    const updated = { ...doc, sources, chapters, parser: `${doc.parser}+${result.parser}`, indexedAt: new Date().toISOString() };
    await saveDocumentRecord(updated); // V51.9.179: the PDF itself did not change, so it is not uploaded again
    return NextResponse.json({ ok: true, page, recoveredText: recovered.text, sourceCount: newSources.length, parser: result.parser, diagnostics: result.diagnostics, document: updated });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
