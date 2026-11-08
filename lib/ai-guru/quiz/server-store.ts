/**
 * Quiz and practice records (server only), read by the teacher, parent and student portals.
 * V51.9.178: one record per finished quiz (data/ai-guru/progress/records/<student>/<record>.json) instead of one list
 * capped at the last 5,000 — history is no longer dropped. An old progress/sessions.json is moved into rows once.
 */
import { docs } from '../storage';
import { migrateLegacyList } from '../storage/legacy-list';
import { rowKey, rowName } from '../storage/rows';
import { cleanRecord, type SessionRecord } from './records';
import { validRedeem } from '../share/redeem';

const LEGACY = 'data/ai-guru/progress/sessions.json';
const DIR = 'data/ai-guru/progress/records';
const studentDir = (studentId: string) => `${DIR}/${rowName(studentId)}`;
const keyOf = (r: SessionRecord) => rowKey(studentDir(r.studentId), r.id);
const byTime = (a: SessionRecord, b: SessionRecord) => String(a.at).localeCompare(String(b.at));
const ready = () => migrateLegacyList<SessionRecord>(LEGACY, 'progress-records', keyOf);

/** Every record, oldest first. */
export async function readAll(): Promise<SessionRecord[]> {
  await ready();
  return (await docs.values<SessionRecord>(DIR)).filter((r) => r && r.id).sort(byTime);
}

/** One student's records, oldest first. */
export async function readForStudent(studentId: string): Promise<SessionRecord[]> {
  await ready();
  return (await docs.values<SessionRecord>(studentDir(studentId))).filter((r) => r && r.id).sort(byTime);
}

/** Adds a record (one at a time per student, so two quizzes finishing together cannot overwrite each other). Same id = replaced. */
export async function addRecord(raw: unknown): Promise<SessionRecord | null> {
  const rec = cleanRecord(raw);
  if (!rec) return null;
  await ready();
  return docs.transaction(`progress:${rowName(rec.studentId)}`, async (tx) => {
    if (rec.kind === 'redo') {
      const mine = (await tx.entries<SessionRecord>(studentDir(rec.studentId))).map((e) => e.value).filter((r) => r.id !== rec.id);
      // only real, missed, not-yet-redeemed questions turn a chilli into a toffee
      rec.redeem = validRedeem(mine, rec.studentId, rec.redeem ?? []); rec.toffees = rec.redeem.length;
      if (!rec.redeem.length) return null;
    }
    await tx.put(keyOf(rec), rec);
    return rec;
  });
}

/** A visitor's device id (`student:<random uuid>`), as made by currentStudentId() before the student had an account. */
export const VISITOR_ID = /^student:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * V51.9.182 (newcomer review): the quizzes a student did on this device before signing up (or signing in) move to their
 * account, so the teacher's class table and the parent code show them. Only visitor ids move (never another account's),
 * and only into the account that is signing in. Returns how many records moved.
 */
export async function moveVisitorRecords(fromId: string, toId: string): Promise<number> {
  if (!VISITOR_ID.test(fromId) || !toId || fromId === toId) return 0;
  await ready();
  return docs.transaction(`progress:${rowName(toId)}`, async (tx) => {
    const old = await tx.entries<SessionRecord>(studentDir(fromId));
    for (const e of old) {
      const rec = { ...e.value, studentId: toId };
      await tx.put(keyOf(rec), rec);
      await tx.del(e.key);
    }
    return old.length;
  });
}
