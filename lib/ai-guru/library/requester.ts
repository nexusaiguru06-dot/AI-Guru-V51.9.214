/** V51.9.95 (server only): who is uploading or making study materials — the admin, a signed-in student, or nobody. */
import { isAdmin, studentFromRequest } from '../admin/auth';
import { readData } from '../admin/store';
import type { Student } from '../admin/fees';
import type { Owner } from './catalog';
import { cleanGuestName, guestIdFrom, newGuestId } from './guest';

export type Requester = { kind: 'admin' } | { kind: 'student'; student: Student };
/** V51.9.107: someone working without signing in. */
export type Guest = { kind: 'guest'; id: string; name: string; isNew: boolean };

export async function requesterOf(req: Request): Promise<Requester | null> {
  if (await isAdmin(req)) return { kind: 'admin' };
  const id = await studentFromRequest(req);
  if (!id) return null;
  const st = (await readData()).students.find((s) => s.id === id);
  return st ? { kind: 'student', student: st } : null;
}

/** V51.9.107: the signed-in admin or student, or else a guest (the browser's guest id, made now when it has none). */
export async function requesterOrGuest(req: Request, guestName?: unknown): Promise<Requester | Guest> {
  const who = await requesterOf(req);
  if (who) return who;
  const id = guestIdFrom(req);
  return { kind: 'guest', id: id ?? newGuestId(), name: cleanGuestName(guestName), isNew: !id };
}

export const ownerFor = (r: Requester | Guest, via: Owner['via']): Owner => (r.kind === 'admin' ? { kind: 'admin', via } : r.kind === 'guest' ? { kind: 'guest', id: r.id, ...(r.name ? { name: r.name } : {}), via: 'studio' } : { kind: 'student', id: r.student.id, name: r.student.name, via });

/** The student who uploaded a book can always study all of it (they had the PDF), and so can the admin. */
export const ownsBook = (doc: { owner?: Owner }, studentId?: string) => !!studentId && doc.owner?.kind === 'student' && doc.owner.id === studentId;
