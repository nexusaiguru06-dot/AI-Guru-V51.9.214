/**
 * Material Studio's books and study materials (server only).
 *   .data/ai-guru-material-studio/documents/<id>.json   — the indexed book          (docs: files or PostgreSQL)
 *   .data/ai-guru-material-studio/materials/<id>.json   — a study material          (docs)
 *   .data/ai-guru-material-studio/pdf/<id>.pdf          — the uploaded PDF          (blobs: files or Cloud Storage)
 * V51.9.173: goes through lib/ai-guru/storage, so the same code runs on localhost and on Google Cloud Run.
 */
import { blobs, docs } from '../storage';
import type { IndexedDocument, StudyMaterial } from './types';

const ROOT = '.data/ai-guru-material-studio';
const DOCS = `${ROOT}/documents`;
const MATS = `${ROOT}/materials`;
const PDFS = `${ROOT}/pdf`;

/** V51.9.172 (security): a book or material id becomes a file name, so it may only hold letters, digits, ':', '_' and '-'.
 *  Ids like "../../data/x" were able to read and write files outside the store. */
export const SAFE_ID = /^[A-Za-z0-9:_-]{1,96}$/;
export const isSafeId = (id: unknown): id is string => typeof id === 'string' && SAFE_ID.test(id);
function keyIn(dir: string, id: string, ext: string) {
  if (!isSafeId(id)) throw new Error('Invalid id');
  return `${dir}/${id}${ext}`;
}
const tryKey = (dir: string, id: string, ext: string) => (isSafeId(id) ? keyIn(dir, id, ext) : null);

export async function saveDocument(doc: IndexedDocument, pdf: Buffer) {
  await blobs.put(keyIn(PDFS, doc.id, '.pdf'), pdf, 'application/pdf');
  await docs.put(keyIn(DOCS, doc.id, '.json'), doc);
  return doc;
}
/** V51.9.179: saves only the book's record (its PDF is already stored and did not change). */
export async function saveDocumentRecord(doc: IndexedDocument) { await docs.put(keyIn(DOCS, doc.id, '.json'), doc); return doc; }

/** V51.9.179: large PDFs go from the browser straight to Cloud Storage (`uploads/u_….pdf`); this moves one into place
 *  inside the store (no download) and saves the record. */
export const UPLOAD_KEY = /^uploads\/u_[a-f0-9]{24}\.pdf$/;
export async function saveDocumentFromUpload(doc: IndexedDocument, uploadKey: string) {
  if (!UPLOAD_KEY.test(uploadKey)) throw new Error('Invalid upload');
  await blobs.move(uploadKey, keyIn(PDFS, doc.id, '.pdf'));
  await docs.put(keyIn(DOCS, doc.id, '.json'), doc);
  return doc;
}
export async function getDocument(id: string) { const k = tryKey(DOCS, id, '.json'); return k ? docs.get<IndexedDocument>(k) : null; }
/** V51.9.179: the PDF as a stream (no full copy in memory), or null. */
export async function pdfStream(id: string) { const k = tryKey(PDFS, id, '.pdf'); return k ? blobs.stream(k) : null; }
export async function getDocumentPdf(id: string) { const k = tryKey(PDFS, id, '.pdf'); return k ? blobs.get(k) : null; }
export async function saveMaterial(material: StudyMaterial) { await docs.put(keyIn(MATS, material.id, '.json'), material); return material; }
export async function getMaterial(id: string) { const k = tryKey(MATS, id, '.json'); return k ? docs.get<StudyMaterial>(k) : null; }
export async function listMaterials(documentId?: string) {
  const items = (await docs.values<StudyMaterial>(MATS)).filter((x) => !!x && typeof x === 'object');
  return items.filter((x) => !documentId || x.documentId === documentId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
/** V51.9.93: every indexed book (for the admin's free-parts list). */
export async function listDocuments() {
  return (await docs.values<IndexedDocument>(DOCS)).filter((x) => !!x && typeof x === 'object').sort((a, b) => String(b.indexedAt).localeCompare(String(a.indexedAt)));
}
/** V51.9.93: change only a book's free parts (the PDF is untouched). */
export async function setDocumentFreeParts(id: string, freeParts: number[] | undefined) {
  const doc = await getDocument(id);
  if (!doc) return null;
  if (freeParts) doc.freeParts = freeParts; else delete doc.freeParts;
  await docs.put(keyIn(DOCS, id, '.json'), doc);
  return doc;
}
/** V51.9.95: library upkeep by the admin. */
export async function updateDocument(id: string, patch: Partial<Pick<IndexedDocument, 'subject' | 'grade' | 'syllabus' | 'sourceLanguage' | 'teachingLanguage' | 'hidden'>>) {
  const doc = await getDocument(id);
  if (!doc) return null;
  const next = { ...doc, ...patch };
  if (next.hidden === false) delete next.hidden;
  await docs.put(keyIn(DOCS, id, '.json'), next);
  return next;
}
export async function updateMaterial(id: string, patch: Partial<Pick<StudyMaterial, 'hidden'>>) {
  const m = await getMaterial(id);
  if (!m) return null;
  const next = { ...m, ...patch };
  if (next.hidden === false) delete next.hidden;
  await docs.put(keyIn(MATS, id, '.json'), next);
  return next;
}
export async function deleteMaterial(id: string) {
  const k = tryKey(MATS, id, '.json');
  if (!k || !(await docs.get(k))) return false;
  await docs.del(k);
  return true;
}
export async function deleteDocument(id: string) {
  const mats = await listMaterials(id);
  await Promise.all(mats.map((m) => deleteMaterial(m.id)));
  const k = tryKey(DOCS, id, '.json');
  if (!k) return false;
  const ok = !!(await docs.get(k));
  await docs.del(k);
  await blobs.del(keyIn(PDFS, id, '.pdf')).catch(() => undefined);
  void import('./pdf-work').then((m) => m.forgetPdf(id)).catch(() => undefined); // V51.9.179: drop it from the PDF cache
  return ok;
}
