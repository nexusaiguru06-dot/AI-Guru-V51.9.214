/**
 * Attendance register (V51.9.63b). The classroom sends three events: start, beat (every minute while the page is visible)
 * and end. From them the teacher sees, per student and day: first entry, last exit, time actually in class, visits.
 * A visit with no end event (closed tab, power cut) counts as left at its last beat once that is STALE_MS old.
 */
import { chilliesOf, type SessionRecord } from '../quiz/records';

export const STALE_MS = 3 * 60_000;
export const BEAT_MS = 60_000;

export interface AttendanceSession {
  id: string;
  studentId: string;
  studentName: string;
  enteredAt: string;
  lastSeenAt: string;
  exitedAt?: string;
  activeSeconds: number;
}

export interface AttendanceEvent { type: 'start' | 'beat' | 'end'; sessionId: string; studentId: string; studentName?: string }

const iso = (ms: number) => new Date(ms).toISOString();

/** Applies one event to the list (returns a new list). Times come from the server clock, never from the client. */
export function applyEvent(list: AttendanceSession[], ev: AttendanceEvent, nowMs: number): AttendanceSession[] {
  const id = String(ev.sessionId || '').slice(0, 80);
  const studentId = String(ev.studentId || '').slice(0, 80);
  if (!id || !studentId) return list;
  const name = String(ev.studentName ?? '').trim().slice(0, 40);
  const i = list.findIndex((s) => s.id === id && s.studentId === studentId);
  if (i < 0) {
    if (ev.type === 'end') return list; // nothing to close
    return [...list, { id, studentId, studentName: name || '', enteredAt: iso(nowMs), lastSeenAt: iso(nowMs), activeSeconds: 0 }];
  }
  const s = list[i];
  const gap = Math.max(0, nowMs - Date.parse(s.lastSeenAt));
  // Time counts only for beats that follow one another: not for a start, not for the beat that brings a hidden tab back.
  const counts = ev.type !== 'start' && !s.exitedAt;
  const next: AttendanceSession = { ...s, studentName: name || s.studentName, lastSeenAt: iso(nowMs), activeSeconds: s.activeSeconds + (counts ? Math.min(gap, 2 * BEAT_MS) / 1000 : 0) };
  if (ev.type === 'end') next.exitedAt = iso(nowMs);
  else delete next.exitedAt; // came back on the same visit
  const out = [...list];
  out[i] = next;
  return out;
}

export interface RegisterRow {
  studentId: string;
  name: string;
  code: string;
  date: string;
  firstIn: string;
  /** null while the student is still in class. */
  lastOut: string | null;
  inClassNow: boolean;
  seconds: number;
  visits: number;
  quizzes: SessionRecord[];
  toffees: number;
  chillies: number;
  /** Average score of the day's quizzes, or null when none were taken. */
  pct: number | null;
}

export const localDate = (isoStr: string): string => {
  const d = new Date(isoStr);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const codeOf = (studentId: string) => (studentId.replace(/[^a-z0-9]/gi, '').slice(-6) || 'LOCAL0').toUpperCase();

/**
 * The register for the given days (local dates, newest first), one row per student per day they were in class or took a quiz.
 * `nameOf` lets the page use the newest name known for a student.
 */
export function buildRegister(sessions: AttendanceSession[], quizzes: SessionRecord[], dates: string[], nowMs: number, nameOf: (studentId: string) => string = () => ''): RegisterRow[] {
  const want = new Set(dates);
  const rows = new Map<string, RegisterRow>();
  const key = (sid: string, d: string) => `${d}|${sid}`;
  const row = (sid: string, d: string, name: string): RegisterRow => {
    const k = key(sid, d);
    let r = rows.get(k);
    if (!r) { r = { studentId: sid, name: nameOf(sid) || name || `Student ${codeOf(sid)}`, code: codeOf(sid), date: d, firstIn: '', lastOut: null, inClassNow: false, seconds: 0, visits: 0, quizzes: [], toffees: 0, chillies: 0, pct: null }; rows.set(k, r); }
    return r;
  };
  for (const s of sessions) {
    const d = localDate(s.enteredAt);
    if (!want.has(d)) continue;
    const r = row(s.studentId, d, s.studentName);
    const live = !s.exitedAt && nowMs - Date.parse(s.lastSeenAt) < STALE_MS;
    const out = s.exitedAt ?? (live ? null : s.lastSeenAt);
    r.visits += 1;
    r.seconds += s.activeSeconds;
    if (!r.firstIn || s.enteredAt < r.firstIn) r.firstIn = s.enteredAt;
    if (live) r.inClassNow = true;
    else if (out && (!r.lastOut || out > r.lastOut)) r.lastOut = out;
  }
  for (const q of quizzes) {
    const d = localDate(q.at);
    if (!want.has(d)) continue;
    const r = row(q.studentId, d, q.studentName);
    if (q.kind === 'redo') { r.toffees += q.toffees; continue; } // a redo is practice: its toffees count, it is not a quiz
    r.quizzes.push(q);
    r.toffees += q.toffees;
    r.chillies += chilliesOf(q);
  }
  for (const r of rows.values()) {
    if (r.inClassNow) r.lastOut = null;
    if (r.quizzes.length) r.pct = Math.round(r.quizzes.reduce((s, q) => s + q.pct, 0) / r.quizzes.length);
    r.quizzes.sort((a, b) => a.at.localeCompare(b.at));
  }
  return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/** The last `n` local dates up to and including `endDate`, newest first. */
export function lastDates(endDate: string, n: number): string[] {
  const [y, m, d] = endDate.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => localDate(new Date(y, m - 1, d - i, 12).toISOString()));
}

const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const hm = (isoStr: string | null) => (isoStr ? new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

/** CSV for the teacher's spreadsheet. */
export function registerCsv(rows: RegisterRow[]): string {
  const head = ['Date', 'Student', 'Code', 'Entered', 'Left', 'Minutes in class', 'Visits', 'Quizzes', 'Average score %', 'Toffees', 'Chillies'];
  const lines = rows.map((r) => [r.date, r.name, r.code, hm(r.firstIn), r.inClassNow ? 'in class' : hm(r.lastOut), Math.round(r.seconds / 60), r.visits, r.quizzes.length, r.pct ?? '', r.toffees, r.chillies].map(q).join(','));
  return '﻿' + [head.map(q).join(','), ...lines].join('\r\n');
}
