/**
 * V51.9.173 — runs before every /api request (Next.js 16 "proxy", formerly middleware).
 * Per-address request limits (lib/ai-guru/net/rate-limit.ts) and a few security headers.
 * V51.9.181: also runs before the pages, only to keep the sign-in hint cookie in step.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { clientIp } from '@/lib/ai-guru/net/client-ip';
import { allow, isAiRoute, limits } from '@/lib/ai-guru/net/rate-limit';
import { HINT_COOKIE, hintFor } from '@/lib/ai-guru/net/session-hint';

/** V51.9.181: keep the readable sign-in hint (lib/ai-guru/net/session-hint.ts) in step with the session cookies. */
// The sign-in, sign-up and sign-out routes write the hint themselves in the same reply (session-hint.ts writeHint).
const WRITES_OWN_HINT = /\/(login|logout|signup)$|\/teacher-portal\/session$/;
function syncHint(req: NextRequest, res: NextResponse, page: boolean) {
  if (WRITES_OWN_HINT.test(req.nextUrl.pathname)) return;
  const want = hintFor((name) => !!req.cookies.get(name)?.value);
  const have = req.cookies.get(HINT_COOKIE)?.value ?? '';
  // A page opened from WhatsApp, SMS or a search result does not carry the strict session cookies, so on pages the
  // hint is only ever added to, never removed (newcomer review). Same-site API requests always carry them, so there it
  // follows the session exactly — that is where an expired session clears it.
  const value = page ? [...new Set([...have.split('.'), ...want.split('.')].filter(Boolean))].sort().join('.') : want;
  if (value === have || (page && !want)) return;
  if (value) res.cookies.set(HINT_COOKIE, value, { path: '/', sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', httpOnly: false, maxAge: 60 * 60 * 24 * 30 });
  else res.cookies.delete(HINT_COOKIE);
}

export function proxy(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (!p.startsWith('/api/')) { const page = NextResponse.next(); syncHint(req, page, true); return page; }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const ip = clientIp(req);
    const l = limits();
    const ok = isAiRoute(p) ? allow(`ai:${ip}`, l.ai) && allow(`all:${ip}`, l.all) : allow(`all:${ip}`, l.all);
    if (!ok) return NextResponse.json({ ok: false, error: 'Too many requests from here. Please wait a minute.' }, { status: 429, headers: { 'retry-after': '60' } });
  }
  const res = NextResponse.next();
  res.headers.set('x-content-type-options', 'nosniff');
  syncHint(req, res, false);
  return res;
}

export const config = { matcher: ['/api/:path*', '/', '/ai-guru', '/ai-guru/:path*'] };
