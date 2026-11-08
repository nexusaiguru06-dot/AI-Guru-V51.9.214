'use client';
import { useEffect } from 'react';
import { startAttendance } from '@/lib/ai-guru/attendance/client';

/** Invisible: records when this student enters and leaves the classroom, for the teacher's attendance register. */
export function AttendanceBeacon() {
  useEffect(() => startAttendance(), []);
  return null;
}
