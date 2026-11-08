import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getDocument } from '@/lib/ai-guru/material-studio/store';
import { contentAccessFor, fullFor } from '@/lib/ai-guru/admin/content-access';
import { isPageLocked, lockedPartsOf } from '@/lib/ai-guru/material-studio/locks';
import { buildStudyParts, partOfPage } from '@/lib/ai-guru/material-studio/parts';
import { cachedPdf, withPdfSlot } from '@/lib/ai-guru/material-studio/pdf-work';

export const runtime = 'nodejs';

/** pdfjs needs its bundled "standard fonts" to draw textbook pages whose Times/Arial
 *  faces are not embedded (the SCERT book's body text is exactly that). Without them
 *  those glyphs are silently dropped and the page image shows headings and diagrams
 *  but NO paragraph text. Trailing separator is required by pdfjs. */
function standardFontDataUrl(): string | undefined {
  const dir = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts');
  return fs.existsSync(path.join(dir, 'FoxitSerif.pfb')) ? dir + path.sep : undefined;
}

async function loadNapiCanvas(): Promise<any> {
  const napi: any = await import('@napi-rs/canvas');
  const g: any = globalThis;
  if (!g.DOMMatrix && napi.DOMMatrix) g.DOMMatrix = napi.DOMMatrix;
  if (!g.Path2D && napi.Path2D) g.Path2D = napi.Path2D;
  if (!g.ImageData && napi.ImageData) g.ImageData = napi.ImageData;
  return napi;
}

function makeCanvasFactory(napi: any) {
  return class NapiCanvasFactory {
    constructor(_options?: unknown) {}
    create(width: number, height: number) {
      if (width <= 0 || height <= 0) throw new Error('Invalid canvas size');
      const canvas = napi.createCanvas(width, height);
      return { canvas, context: canvas.getContext('2d') };
    }
    reset(cc: any, width: number, height: number) { cc.canvas.width = width; cc.canvas.height = height; }
    destroy(cc: any) { cc.canvas.width = 0; cc.canvas.height = 0; cc.canvas = null; cc.context = null; }
  };
}

/** Visible stand-in when a page cannot be rendered (an <img> can show SVG, no native deps needed). */
function placeholderSvg(page: number, reason: string) {
  const esc = (t: string) => t.replace(/[<>&"]/g, ' ').slice(0, 90);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="800" viewBox="0 0 620 800"><rect width="620" height="800" fill="#0b1220"/><rect x="24" y="24" width="572" height="752" rx="14" fill="none" stroke="#334155" stroke-dasharray="8 6"/><text x="310" y="380" fill="#e2e8f0" font-family="sans-serif" font-size="22" text-anchor="middle">Textbook page ${page}</text><text x="310" y="416" fill="#94a3b8" font-family="sans-serif" font-size="15" text-anchor="middle">preview unavailable on the server</text><text x="310" y="446" fill="#64748b" font-family="sans-serif" font-size="12" text-anchor="middle">${esc(reason)}</text></svg>`;
}

/** V51.9.93: the picture shown instead of a page of a part the student has not unlocked (never the page itself). */
function lockedSvg(page: number, part: number, free: number[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="800" viewBox="0 0 620 800"><rect width="620" height="800" fill="#0b1220"/><rect x="24" y="24" width="572" height="752" rx="14" fill="none" stroke="#22d3ee" stroke-opacity=".4" stroke-dasharray="8 6"/><text x="310" y="330" font-size="64" text-anchor="middle">🔒</text><text x="310" y="400" fill="#e2e8f0" font-family="sans-serif" font-size="24" font-weight="700" text-anchor="middle">Page ${page} · Part ${part}</text><text x="310" y="440" fill="#94a3b8" font-family="sans-serif" font-size="16" text-anchor="middle">This part opens when the fee is paid.</text><text x="310" y="466" fill="#94a3b8" font-family="sans-serif" font-size="16" text-anchor="middle">${free.length ? `Free to study: Part ${free.join(', ')}` : ''}</text></svg>`;
}

/**
 * Renders one page of an indexed textbook to a PNG so the classroom's left
 * reference panel can show the actual page the current paragraph came from.
 *
 * Why an <img> and not an <iframe src="...pdf#page=N">: Chrome's built-in PDF
 * viewer only honours the fragment on first load, so the reference stopped
 * following the paragraph. A plain <img> whose src carries the page number
 * changes reliably every time.
 *
 * IMPORTANT - one canvas library, end to end (verified under `next dev`):
 * pdfjs-dist 4.8.x (Node) tries to use its OWN optional dependency "canvas"
 * (node-canvas) for the canvas factory and for the DOMMatrix/Path2D polyfills.
 * This app ships @napi-rs/canvas instead, and node-canvas is often not built
 * (pnpm skips dependency install scripts by default) - then pdfjs has no canvas at
 * all ("Cannot polyfill DOMMatrix", "reading 'createCanvas'"). Mixing the two
 * libraries is worse: native objects from one handed to the other SEGFAULT the
 * whole server process. So we (1) polyfill DOMMatrix/Path2D/ImageData from
 * @napi-rs/canvas BEFORE pdfjs loads and (2) give pdfjs a CanvasFactory backed by
 * @napi-rs/canvas. Everything then comes from the same module instance.
 *
 * next.config.ts lists pdfjs-dist and @napi-rs/canvas in serverExternalPackages:
 * if pdfjs is bundled it looks for ./pdf.worker.mjs beside the compiled chunk and
 * every request fails with "Setting up fake worker failed".
 *
 * Do NOT set GlobalWorkerOptions.workerSrc = '' (the legacy build defaults it to
 * "./pdf.worker.mjs" for Node; clearing it throws). `disableWorker` is not a real
 * pdfjs option. Keep `standardFontDataUrl` with `useSystemFonts: false`, otherwise
 * non-embedded Times glyphs (the SCERT book's body text) are silently dropped.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let page = 1;
  let pages = 0;
  try {
    const { id } = await params;
    page = Math.max(1, Number(new URL(request.url).searchParams.get('page') || 1) || 1);
    // V51.9.93: pages of a locked part are never rendered for a student who has not paid.
    const access = await contentAccessFor(request);
    const book = access.full ? null : await getDocument(id);
    if (book && !fullFor(book, access)) {
      const { lockedParts, freeParts } = book ? lockedPartsOf(book, access.freeParts, false, access.paidParts) : { lockedParts: [] as number[], freeParts: [] as number[] };
      if (book && isPageLocked(book, page, lockedParts)) {
        return new Response(lockedSvg(page, partOfPage(buildStudyParts(book), page), freeParts), { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store', 'x-page-locked': '1' } });
      }
    }
    const pdf = await cachedPdf(id); // V51.9.179: recently used books stay in a small cache
    if (!pdf || !pdf.length) {
      return NextResponse.json({ ok: false, error: 'Indexed textbook PDF not found.', id }, { status: 404 });
    }

    // V51.9.179: at most a few PDF renders at once in this server copy (each holds the whole book in memory)
    return await withPdfSlot(async () => {
    // Order matters: polyfills first, then pdfjs.
    const napi = await loadNapiCanvas();
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const doc = await pdfjs.getDocument({
      data: new Uint8Array(pdf),
      CanvasFactory: makeCanvasFactory(napi),
      // Deterministic fonts: never depend on which fonts the server happens to have.
      useSystemFonts: false,
      standardFontDataUrl: standardFontDataUrl(),
      isEvalSupported: false,
    }).promise;
    pages = doc.numPages || 1;

    try {
      const target = await doc.getPage(Math.min(page, pages));
      const viewport = target.getViewport({ scale: 1.6 });
      const { canvas, context } = doc.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
      // pdfjs paints an opaque white page background itself (default `background`).
      await target.render({ canvasContext: context, viewport, canvas }).promise;
      const png: Buffer = canvas.toBuffer('image/png');
      target.cleanup?.();
      return new Response(new Uint8Array(png), {
        headers: {
          'content-type': 'image/png',
          // Pages are immutable once indexed, so the browser can keep them.
          'cache-control': 'private, max-age=86400',
          'x-pdf-pages': String(pages),
        },
      });
    } finally {
      try { await doc.destroy?.(); } catch { /* ignore */ }
    }
    });
  } catch (e) {
    // Never leave the reference panel with a broken image: answer 200 with a visible
    // placeholder, the reason in a header, and the full error in the server log.
    const reason = e instanceof Error ? e.message : String(e);
    console.error('[page-image] render failed - returning placeholder:', e);
    return new Response(placeholderSvg(page, reason), {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'no-store',
        'x-pdf-pages': String(pages || ''),
        'x-page-image-fallback': '1',
        'x-page-image-error': reason.replace(/[^\x20-\x7e]/g, ' ').slice(0, 200),
      },
    });
  }
}
