/**
 * Attendance (server only): one record per class visit.
 * V51.9.178: one row per visit (data/ai-guru/attendance/sessions/<student>/<visit>.json) instead of one list capped at the
 * last 20,000 — old visits are no longer dropped. An old attendance/sessions.json is moved into rows once.
 */
import { docs } from '../storage';
import { migrateLegacyList } from '../storage/legacy-list';
import { rowKey, rowName } from '../storage/rows';
import { applyEvent, type AttendanceEvent, type AttendanceSession } from './register';

const LEGACY = 'data/ai-guru/attendance/sessions.json';
const DIR = 'data/ai-guru/attendance/sessions';
const keyFor = (studentId: string, sessionId: string) => rowKey(`${DIR}/${rowName(studentId)}`, sessionId);
const ready = () => migrateLegacyList<AttendanceSession>(LEGACY, 'attendance-sessions', (s) => keyFor(s.studentId, s.id));

/** Every visit, oldest first. */
export async function readSessions(): Promise<AttendanceSession[]> {
  await ready();
  return (await docs.values<AttendanceSession>(DIR)).filter((s) => s && s.id).sort((a, b) => String(a.enteredAt).localeCompare(String(b.enteredAt)));
}

export async function recordEvent(ev: AttendanceEvent, nowMs = Date.now()): Promise<void> {
  const id = String(ev.sessionId || '').slice(0, 80);
  const studentId = String(ev.studentId || '').slice(0, 80);
  if (!id || !studentId) return;
  await ready();
  await docs.update<AttendanceSession, void>(keyFor(studentId, id), (cur) => {
    const before = cur ? [cur] : [];
    const after = applyEvent(before, ev, nowMs);
    return { value: after === before ? undefined : after.find((s) => s.id === id && s.studentId === studentId), result: undefined };
  });
}
