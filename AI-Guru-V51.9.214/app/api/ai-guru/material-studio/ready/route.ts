import { NextResponse } from 'next/server';
import { listDocuments, listMaterials } from '@/lib/ai-guru/material-studio/store';
import { contentAccessFor, mayView } from '@/lib/ai-guru/admin/content-access';
import { readyBooks } from '@/lib/ai-guru/material-studio/ready';
import { readData } from '@/lib/ai-guru/admin/store';
import { ownsBook } from '@/lib/ai-guru/library/requester';

export const runtime = 'nodejs';

/**
 * V51.9.116 — the textbooks that are ready to teach: uploaded, indexed, and with study materials made from them.
 * The Classroom shows these in the strip above the lesson; a student clicks one and the class starts.
 * Only books this person may see (their own, a guest's own on this browser, or the shared library).
 * V51.9.187: for a signed-in student, only the books downloaded in "My books" (and their own uploads).
 */
export async function GET(request: Request) {
  const a = await contentAccessFor(request);
  const [docs, mats] = await Promise.all([listDocuments(), listMaterials()]);
  // V51.9.187: a signed-in student's classroom shows the books they downloaded in "My books" (and their own uploads)
  let shown = docs.filter((d) => mayView(d, a));
  let mine = false;
  if (a.studentId && !a.isAdmin) {
    const st = (await readData()).students.find((s) => s.id === a.studentId);
    const have = new Set((st?.library ?? []).map((x) => x.documentId));
    shown = shown.filter((d) => have.has(d.id) || ownsBook(d, a.studentId!));
    mine = true;
  }
  const books = readyBooks(shown, mats.filter((m) => mayView(m, a)), mine);
  return NextResponse.json({ ok: true, books, mine }, { headers: { 'cache-control': 'private, no-store' } });
}
