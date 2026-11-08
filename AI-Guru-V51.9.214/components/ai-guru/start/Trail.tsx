'use client';
/** V51.9.198 — the pages seen in this tab, so a "Back" arrow returns to the page before (or the main page). */
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const KEY = 'aig_trail';
const read = (): string[] => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (t: string[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(t.slice(-30))); } catch { /* storage blocked */ } };

export function useTrail() {
  const pathname = usePathname() || '';
  useEffect(() => { const t = read(); if (t[t.length - 1] !== pathname) { t.push(pathname); write(t); } }, [pathname]);
}

/** Back to the page before in this tab; opened from outside (a link, the home screen) → the main page. */
export function goBack() {
  const t = read();
  if (t.length >= 2 && window.history.length > 1) { write(t.slice(0, -1)); window.history.back(); }
  else window.location.href = '/';
}

export function TrailMark() { useTrail(); return null; }
