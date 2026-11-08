import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { figuresFromOps, textBits, type PageFigure } from './page-figures';

/** V51.9.141 — the pictures of one PDF page, cut out as PNG data URLs (server only; same pdfjs set-up as page-image). */
export type FigureOut = PageFigure & { image: string };

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


export async function figuresOfPdfPage(pdf: Uint8Array | Buffer, page: number): Promise<FigureOut[]> {
    const napi = await loadNapiCanvas();
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), CanvasFactory: makeCanvasFactory(napi), useSystemFonts: false, standardFontDataUrl: standardFontDataUrl(), isEvalSupported: false }).promise;
    try {
      const target = await doc.getPage(Math.min(page, doc.numPages || 1));
      const vp1 = target.getViewport({ scale: 1 });
      const ops = await target.getOperatorList();
      const tc = await target.getTextContent();
      const figures = figuresFromOps(ops.fnArray, ops.argsArray, pdfjs.OPS, textBits(tc.items, vp1.height), vp1.width, vp1.height);
      const out: FigureOut[] = [];
      if (figures.length) {
        const scale = 2.2;
        const viewport = target.getViewport({ scale });
        const { canvas, context } = doc.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await target.render({ canvasContext: context, viewport, canvas }).promise;
        for (const f of figures) {
          const pad = 4;
          const x = Math.max(0, Math.floor((f.box.x - pad) * scale)), y = Math.max(0, Math.floor((f.box.y - pad) * scale));
          const w = Math.min(canvas.width - x, Math.ceil((f.box.w + 2 * pad) * scale)), h = Math.min(canvas.height - y, Math.ceil((f.box.h + 2 * pad) * scale));
          if (w < 20 || h < 20) continue;
          const k = Math.min(1, 1100 / w);
          const cut = napi.createCanvas(Math.round(w * k), Math.round(h * k));
          cut.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, cut.width, cut.height);
          out.push({ ...f, image: `data:image/png;base64,${cut.toBuffer('image/png').toString('base64')}` });
        }
      }
      target.cleanup?.();
      return out;
    } finally {
      try { await doc.destroy?.(); } catch { /* ignore */ }
    }
}
