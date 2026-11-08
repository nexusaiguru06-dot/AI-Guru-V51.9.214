import { NextResponse } from 'next/server';
import { getDocument } from '@/lib/ai-guru/material-studio/store';
import { contentAccessFor, createLockedParts, fullFor, mayView, withPublicOwner } from '@/lib/ai-guru/admin/content-access';
import { serveDocument } from '@/lib/ai-guru/material-studio/locks';

export const dynamic = 'force-dynamic';

/** The indexed book. V51.9.93: for a student who has not paid, the text of locked parts is left out (pages, chapter
 *  titles and the part map stay, so the classroom can show what unlocks). `document.access` says what is open. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return NextResponse.json({ ok: false, error: 'Document not found' }, { status: 404 });
  const a = await contentAccessFor(request);
  if (!mayView(doc, a)) return NextResponse.json({ ok: false, error: 'Document not found' }, { status: 404 });
  return NextResponse.json({ ok: true, document: serveDocument(withPublicOwner(doc, a), { full: fullFor(doc, a), signedIn: a.signedIn, due: a.due, fee: a.fee, studentCode: a.studentCode, monthly: a.monthly, yearly: a.yearly, yearlyReductionPct: a.yearlyReductionPct, why: a.why, defaultFree: a.freeParts, paidParts: a.paidParts, createLocked: createLockedParts(doc, a), ...(a.partPrice ? { partPrice: a.partPrice } : {}) }) }, { headers: { 'cache-control': 'private, no-store' } });
}
