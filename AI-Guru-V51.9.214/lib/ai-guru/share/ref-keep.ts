/**
 * V51.9.155 — the friend's code that brought a visitor in. A link like /j/CODE, …/signup?ref=CODE or any AI Guru page
 * with ?ref=CODE keeps the code on this device for 60 days (the last link opened counts), so the sign-up form fills it in by itself
 * even when the visitor looks around first (a reel, a class) and signs up later.
 */
import { cleanCode, isCode } from './join-code';

const KEY = 'aig_ref';
const DAYS = 60;

/** Keeps ?ref=CODE from this query string and returns the code to use (this one, else the one kept earlier). */
export function rememberRef(search: string, now = Date.now()): string {
  let code = '';
  try { code = cleanCode(new URLSearchParams(search).get('ref') ?? ''); } catch { return keptRef(now); }
  if (!isCode(code)) return keptRef(now);
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: now })); } catch { /* storage blocked */ }
  return code;
}

/** The kept code, or '' (none, or older than 60 days). Reads the old plain-text form too. */
export function keptRef(now = Date.now()): string {
  let v: string | null = null;
  try { v = localStorage.getItem(KEY); } catch { return ''; }
  if (!v) return '';
  try {
    const j = JSON.parse(v) as { code?: string; at?: number };
    if (j && typeof j === 'object') return j.code && isCode(j.code) && now - (j.at ?? 0) < DAYS * 864e5 ? j.code : '';
  } catch { /* the old plain form */ }
  const c = cleanCode(v);
  return isCode(c) ? c : '';
}

export function forgetRef() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
