import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface OCRPageResult {
  page: number;
  text: string;
  engine: string;
  layout?: Array<{ text: string; bbox?: { x: number; y: number; width: number; height: number } }>;
}

export interface OCRBatchResult {
  pages: OCRPageResult[];
  parser: string;
  diagnostics: { engine: string; mode: 'hybrid' | 'forced'; pagesRequested: number; pagesRecovered: number };
}

function normaliseText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function odlUrl(): string | undefined {
  const raw = process.env.OPENDATALOADER_URL || process.env.DOCLING_URL;
  return raw?.trim().replace(/\/$/, '') || undefined;
}

function pageFromProv(node: any): number | undefined {
  const prov = Array.isArray(node?.prov) ? node.prov[0] : undefined;
  const page = Number(prov?.page_no);
  return Number.isFinite(page) && page > 0 ? page : undefined;
}

function bboxFromProv(node: any) {
  const b = Array.isArray(node?.prov) ? node.prov[0]?.bbox : undefined;
  if (!b) return undefined;
  const left = Number(b.l ?? b.left);
  const top = Number(b.t ?? b.top);
  const right = Number(b.r ?? b.right);
  const bottom = Number(b.b ?? b.bottom);
  if (![left, top, right, bottom].every(Number.isFinite)) return undefined;
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * Parse ODL/Docling's JSON without depending on one exact schema revision.
 * ODL deliberately keeps provenance on every text node, so page identity and
 * bounding boxes survive the OCR/layout stage.
 */
function parseODLDocument(payload: any, wanted: Set<number>): OCRPageResult[] {
  const doc = payload?.document ?? payload?.data ?? payload;
  const texts = Array.isArray(doc?.texts) ? doc.texts : [];
  const grouped = new Map<number, OCRPageResult>();
  for (const node of texts) {
    const page = pageFromProv(node);
    if (!page || !wanted.has(page)) continue;
    const text = normaliseText(node?.text ?? node?.orig ?? node?.content);
    if (!text) continue;
    const current = grouped.get(page) ?? { page, text: '', engine: 'opendataloader-docling', layout: [] };
    if (current.text) current.text += '\n';
    current.text += text;
    current.layout!.push({ text, bbox: bboxFromProv(node) });
    grouped.set(page, current);
  }
  return [...grouped.values()].map(x => ({ ...x, text: normaliseText(x.text) }));
}

async function ocrWithOpenDataLoader(pdf: Buffer, pages: number[]): Promise<OCRPageResult[]> {
  const base = odlUrl();
  if (!base) return [];
  const form = new FormData();
  form.append('files', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), 'textbook.pdf');
  form.append('page_ranges', `${Math.min(...pages)}-${Math.max(...pages)}`);
  const response = await fetch(`${base}/v1/convert/file`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`OpenDataLoader OCR returned HTTP ${response.status}`);
  const payload = await response.json();
  const parsed = parseODLDocument(payload, new Set(pages));
  if (!parsed.length) throw new Error('OpenDataLoader returned no text for the requested pages.');
  return parsed;
}

async function commandExists(command: string): Promise<boolean> {
  try { await execFileAsync(command, ['--version'], { timeout: 5000 }); return true; } catch { return false; }
}

async function ocrOneWithTesseract(pdfPath: string, page: number, tempDir: string): Promise<OCRPageResult> {
  const base = path.join(tempDir, `page-${page}`);
  await execFileAsync('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-png', '-r', process.env.AI_GURU_OCR_DPI || '220', pdfPath, base], { timeout: 120000 });
  const imagePath = `${base}.png`;
  const { stdout } = await execFileAsync('tesseract', [imagePath, 'stdout', '-l', process.env.AI_GURU_OCR_LANG || 'eng', '--psm', process.env.AI_GURU_OCR_PSM || '3'], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  return { page, text: normaliseText(stdout), engine: 'tesseract-local' };
}

async function ocrWithTesseract(pdf: Buffer, pages: number[]): Promise<OCRPageResult[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-guru-ocr-'));
  const pdfPath = path.join(tempDir, 'input.pdf');
  await fs.writeFile(pdfPath, pdf);
  try {
    const out: OCRPageResult[] = [];
    for (const page of pages) {
      try { out.push(await ocrOneWithTesseract(pdfPath, page, tempDir)); }
      catch (error) { console.warn(`[AI Guru OCR] page ${page} failed:`, error); }
    }
    return out;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * ODL-inspired hybrid OCR: use the configured OpenDataLoader/Docling backend
 * first (layout + provenance), then fall back to local Tesseract for hosts that
 * do not run the Python hybrid service. Only weak/missing pages are OCR'd unless
 * force=true, which mirrors ODL's auto-vs-full OCR modes.
 */
export async function recoverPdfPagesWithOCR(
  /** V51.9.179: the PDF, or a function that loads it — called only when a page actually needs OCR */
  pdfOrLoader: Buffer | (() => Promise<Buffer>),
  pages: Array<{ page: number; text: string }>,
  options: { force?: boolean; requestedPages?: number[] } = {},
): Promise<OCRBatchResult> {
  const requested = options.requestedPages?.length
    ? options.requestedPages.filter(p => Number.isFinite(p) && p >= 1)
    : pages.map(p => p.page);
  const weak = new Set(
    pages.filter(p => options.force || requested.includes(p.page) && normaliseText(p.text).length < 120).map(p => p.page),
  );
  const targets = requested.filter(p => options.force || weak.has(p));
  if (!targets.length) return { pages: [], parser: 'browser-pdfjs-paragraph-v3', diagnostics: { engine: 'none', mode: 'hybrid', pagesRequested: 0, pagesRecovered: 0 } };

  const pdf = Buffer.isBuffer(pdfOrLoader) ? pdfOrLoader : await pdfOrLoader();
  let engine = 'none';
  let results: OCRPageResult[] = [];
  try {
    results = await ocrWithOpenDataLoader(pdf, targets);
    engine = 'opendataloader-docling';
  } catch (error) {
    console.warn('[AI Guru OCR] OpenDataLoader unavailable; using local fallback:', error);
  }
  const recovered = new Set(results.filter(r => r.text.length >= 25).map(r => r.page));
  const missing = targets.filter(p => !recovered.has(p));
  if (missing.length && await commandExists('tesseract') && await commandExists('pdftoppm')) {
    const local = await ocrWithTesseract(pdf, missing);
    results = [...results, ...local];
    if (local.length) engine = results.some(r => r.engine === 'opendataloader-docling') ? 'opendataloader-docling+tesseract' : 'tesseract-local';
  }
  return { pages: results.filter(r => r.text.length >= 25), parser: engine === 'opendataloader-docling' ? 'opendataloader-docling-ocr-v1' : 'opendataloader-compatible-ocr-v1', diagnostics: { engine, mode: options.force ? 'forced' : 'hybrid', pagesRequested: targets.length, pagesRecovered: results.filter(r => r.text.length >= 25).length } };
}
