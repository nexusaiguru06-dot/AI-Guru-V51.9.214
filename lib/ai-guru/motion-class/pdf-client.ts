'use client';

/**
 * Browser PDF access for the motion class: positioned text per page (for the
 * layout reader) and page pictures (for the AI planner on figure-based blocks).
 * Same worker setup as Material Studio (local worker, pinned CDN fallback).
 */

import { rawItemsFromPdfjs, type RawItem } from './layout';

const PDFJS_VERSION = '4.8.69';
const CDN_WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDoc = any;

export interface LoadedBook {
  name: string;
  pageCount: number;
  pageHeight: number;
  pages: RawItem[][];
  /** Plain text of a page (for the AI planner's context). */
  pageText: (page: number) => string;
  /** JPEG of a page (base64, no data: prefix). */
  pageImage: (page: number) => Promise<{ base64: string; mime: string } | undefined>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function configureWorker(pdfjs: any, cdn = false) {
  if (cdn) {
    pdfjs.GlobalWorkerOptions.workerSrc = CDN_WORKER;
    return;
  }
  if (pdfjs.GlobalWorkerOptions.workerSrc) return;
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = CDN_WORKER;
  }
}

export async function loadBook(file: File, onProgress?: (page: number, total: number) => void): Promise<LoadedBook> {
  const pdfjs = await import('pdfjs-dist');
  const data = await file.arrayBuffer();
  configureWorker(pdfjs);
  let pdf: PdfDoc;
  try {
    pdf = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  } catch (e) {
    if (pdfjs.GlobalWorkerOptions.workerSrc === CDN_WORKER) throw e;
    configureWorker(pdfjs, true);
    pdf = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  }
  const pages: RawItem[][] = [];
  let pageHeight = 792;
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(p, pdf.numPages);
    const page = await pdf.getPage(p);
    if (p === 1) pageHeight = page.getViewport({ scale: 1 }).height;
    pages.push(rawItemsFromPdfjs(await page.getTextContent()));
  }
  const images = new Map<number, { base64: string; mime: string }>();
  return {
    name: file.name,
    pageCount: pdf.numPages,
    pageHeight,
    pages,
    pageText: (page) =>
      (pages[page - 1] ?? [])
        .slice()
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' '),
    pageImage: async (page) => {
      if (images.has(page)) return images.get(page);
      try {
        const p = await pdf.getPage(page);
        const viewport = p.getViewport({ scale: 1.3 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await p.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        const img = { base64: canvas.toDataURL('image/jpeg', 0.72).split(',')[1], mime: 'image/jpeg' };
        images.set(page, img);
        return img;
      } catch {
        return undefined;
      }
    },
  };
}
