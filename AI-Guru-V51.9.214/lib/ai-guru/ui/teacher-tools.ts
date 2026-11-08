'use client';
/**
 * V51.9.180 (UX review): the "Teacher tools" switch.
 *
 * Students see the class; the engine status, teaching log, QA check and template export/import are tools for the
 * teacher or developer. They stay one tap away behind this switch, which is remembered on this device (off at first).
 */
import { useCallback, useEffect, useState } from 'react';

const KEY = 'ai-guru:teacher-tools';
const EVENT = 'ai-guru:teacher-tools';

export function readTeacherTools(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function useTeacherTools(): [boolean, (on?: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(readTeacherTools());
    const sync = () => setOn(readTeacherTools());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const toggle = useCallback((next?: boolean) => {
    const value = typeof next === 'boolean' ? next : !readTeacherTools();
    try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* private mode: this page only */ }
    setOn(value);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, toggle];
}
