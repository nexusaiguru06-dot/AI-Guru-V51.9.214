/**
 * V51.9.192 — when a student pays for a part, its study materials are made for them automatically (server only).
 *
 * For each of the student's textbooks (the books in "My books", their own uploads, and the library books of their
 * syllabus and standard), every study-material type that is not there yet for the paid part(s) is made on the AI Guru
 * cloud with the school's key — the same jobs the office uses. They are saved in the shared library, so the next student
 * of the same class finds them ready. The student gets a message in Messages; tapping it opens My books.
 */
import type { AdminData } from '../admin/store';
import type { Invoice, Student } from '../admin/fees';
import { paidPartsList } from '../admin/part-plan';
import { listDocuments } from '../material-studio/store';
import { MATERIAL_TYPES } from '../material-studio/types';
import { bookMatches } from './catalog';
import { ownsBook } from './requester';
import { requestCloudMaterials } from './cloud';

export interface PartMaterialsResult { parts: number[]; books: number; queued: number; ready: number; noKey: boolean }

export async function makePaidPartMaterials(data: AdminData, st: Student, inv: Invoice): Promise<PartMaterialsResult | null> {
  if (!inv.partBill) return null;
  const parts = inv.partBill.all ? paidPartsList(data.settings.access.freeParts) : inv.partBill.part ? [inv.partBill.part] : [];
  if (!parts.length) return null;
  const mine = new Set((st.library ?? []).map((x) => x.documentId));
  const books = (await listDocuments()).filter((d) => !d.hidden && (mine.has(d.id) || ownsBook(d, st.id) || bookMatches(d, st)));
  let queued = 0, ready = 0, noKey = false;
  for (const d of books) {
    for (const p of parts) {
      const r = await requestCloudMaterials({ kind: 'admin' }, d.id, p, [...MATERIAL_TYPES]).catch(() => null);
      if (!r) continue;
      if (!r.ok) { if (r.status === 403) noKey = true; continue; } // 400 = that part has no readable text
      queued += r.results.filter((x) => x.job && x.job.status !== 'done').length;
      ready += r.results.filter((x) => x.existing || x.job?.status === 'done').length;
    }
  }
  return { parts, books: books.length, queued, ready, noKey };
}

/** The message for the student. */
export function partMaterialsText(first: string, r: PartMaterialsResult): string {
  const which = r.parts.length > 1 ? `Parts ${r.parts[0]}–${r.parts[r.parts.length - 1]}` : `Part ${r.parts[0]}`;
  if (!r.books) return `📚 ${which} is open for you, ${first}! Download your textbooks in My books — ${which} of each is open, with its study materials.`;
  const made = r.queued ? ` ${r.queued} study material${r.queued === 1 ? ' is' : 's are'} being made for you now on AI Guru’s cloud (a few minutes each).` : '';
  const have = r.ready ? ` ${r.ready} ${r.ready === 1 ? 'is' : 'are'} ready already.` : '';
  const key = r.noKey && !r.queued ? ' The school will add the rest soon; you can also make them in Material Studio with your own key.' : '';
  return `📚 ${which} is open in all your books, ${first}!${have}${made}${key} Open My books and press “Download” again to keep them on this device.`;
}
