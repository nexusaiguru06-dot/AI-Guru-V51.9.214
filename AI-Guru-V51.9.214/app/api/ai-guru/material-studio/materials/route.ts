import { NextResponse } from 'next/server';
import { getDocument, listMaterials, saveMaterial } from '@/lib/ai-guru/material-studio/store';
import { contentAccessFor, createLockedParts, fullFor, mayView, schoolVersions, withPublicOwner } from '@/lib/ai-guru/admin/content-access';
import { getMaterial } from '@/lib/ai-guru/material-studio/store';
import { ownerFor, requesterOrGuest } from '@/lib/ai-guru/library/requester';
import { guestCookie } from '@/lib/ai-guru/library/guest';
import { readData } from '@/lib/ai-guru/admin/store';
import { lockedPartsOf, serveMaterial } from '@/lib/ai-guru/material-studio/locks';
import { buildStudyParts, partOfMaterial } from '@/lib/ai-guru/material-studio/parts';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('documentId') || undefined;
  const list = await listMaterials(id);
  // V51.9.93: every material says which part it belongs to; for a student who has not paid, materials of locked parts
  // come as stubs (title, type, part, pages) with no content.
  const a = await contentAccessFor(request);
  const books = new Map<string, { parts: ReturnType<typeof buildStudyParts>; locked: number[] }>();
  for (const docId of new Set(list.map((m) => m.documentId))) {
    const doc = await getDocument(docId);
    if (doc && mayView(doc, a)) books.set(docId, { parts: buildStudyParts(doc), locked: lockedPartsOf(doc, a.freeParts, fullFor(doc, a), a.paidParts).lockedParts });
  }
  const materials = schoolVersions(list.filter((m) => mayView(m, a) && (books.has(m.documentId) || a.isAdmin)), a).map((m) => { const b = books.get(m.documentId); return withPublicOwner(b ? serveMaterial(m, b.parts, b.locked) : a.full ? m : { ...m, sections: [], sources: [], overview: '', locked: true as const, part: 0 }, a); });
  return NextResponse.json({ ok: true, materials, access: { full: a.full, signedIn: a.signedIn } }, { headers: { 'cache-control': 'private, no-store' } });
}

export async function POST(request: Request) {
  try {
    // V51.9.95: a material goes into the shared library under the name of who made it.
    // V51.9.107: without signing in it is saved privately for this browser (a guest), like the guest's books.
    const body = await request.json();
    const who = await requesterOrGuest(request, body?.guestName);
    if ((who.kind as string) === 'student') return NextResponse.json({ ok: false, error: 'Study materials are made by your teachers in the admin portal. Open My Textbooks to download them.' }, { status: 403 }); // V51.9.211: students no longer make study materials
    if (!body?.material?.id || !body.material.documentId) {
      return NextResponse.json({ ok: false, error: 'A valid generated material is required.' }, { status: 400 });
    }

    const qa = body.material.qa || {};
    const status = String(qa.status || 'unknown');
    const score = Number(qa.score || 0);

    // Accept "passed" always. Accept "needs_review" when score is strong enough
    // (bilingual soft flags must not block classroom use of an otherwise good material).
    const allowed =
      status === 'passed' ||
      (status === 'needs_review' && score >= 70);

    if (!allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Material cannot be saved because QA status is ${status}${score ? ` (${score}/100)` : ''}.`,
          issues: Array.isArray(qa.issues) ? qa.issues.slice(0, 5) : [],
        },
        { status: 422 },
      );
    }

    // V51.9.192 (part plan): a part that is not paid cannot be used to make study materials — not even with the
    // student's own AI key, and not for their own upload. The office and fully paid students are not limited.
    const acc = await contentAccessFor(request);
    const book = await getDocument(String(body.material.documentId));
    if (book) {
      const blocked = createLockedParts(book, acc);
      const part = blocked.length ? partOfMaterial(body.material, buildStudyParts(book)) : 0;
      if (blocked.includes(part)) return NextResponse.json({ ok: false, payToOpen: true, part, error: `Part ${part} opens when its fee${acc.partPrice ? ` (₹${acc.partPrice.toLocaleString('en-IN')})` : ''} is paid. Pay it in My account → Pay by UPI; its study materials are then made for you automatically.`, payHref: '/ai-guru/student#pay' }, { status: 402 });
    }
    const before = await getMaterial(String(body.material.id));
    if (before && who.kind === 'student' && !(before.owner?.kind === 'student' && before.owner.id === who.student.id)) return NextResponse.json({ ok: false, error: 'This material belongs to someone else.' }, { status: 403 });
    if (before && who.kind === 'guest' && !(before.owner?.kind === 'guest' && before.owner.id === who.id)) return NextResponse.json({ ok: false, error: 'This material belongs to someone else.' }, { status: 403 });
    const review = who.kind === 'student' && !before && (await readData()).settings.library.reviewStudentWork; // V51.9.95: admin reviews students' work first when asked
    const saved = await saveMaterial({ ...body.material, owner: before?.owner ?? ownerFor(who, 'studio'), hidden: before ? before.hidden : who.kind === 'guest' || review || undefined });
    const res = NextResponse.json({ ok: true, material: saved, ...(who.kind === 'guest' ? { guest: true } : {}) });
    if (who.kind === 'guest' && who.isNew) res.headers.append('set-cookie', guestCookie(who.id, new URL(request.url).protocol === 'https:'));
    return res;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Material save failed.' },
      { status: 422 },
    );
  }
}
