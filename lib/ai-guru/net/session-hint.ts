/**
 * V51.9.181 (UX review item 9) — a readable hint of which sign-ins this browser has.
 *
 * The session cookies (aig_admin, aig_student, aig_teacher) are http-only, so page code cannot see them and used to
 * ask the server on every page — "am I the admin? a student?" — getting 401/404 back for every visitor who is not.
 * proxy.ts now keeps a small readable cookie, `aig_hint`, listing which session cookies are present (never their
 * contents). Page code checks it first and skips the call when there is no such session. It is only a hint: the server
 * still checks the real cookie on every request.
 */
export const HINT_COOKIE = 'aig_hint';
export type SessionKind = 'admin' | 'student' | 'teacher';
export const SESSION_COOKIES: Record<SessionKind, string> = { admin: 'aig_admin', student: 'aig_student', teacher: 'aig_teacher' };

/** The hint value for a set of cookie names present on a request: e.g. "admin.student", or '' for none. */
export function hintFor(has: (cookie: string) => boolean): string {
  return (Object.keys(SESSION_COOKIES) as SessionKind[]).filter((k) => has(SESSION_COOKIES[k])).join('.');
}

/** The hint after a sign-in (`add`) or sign-out (`remove`), from the hint the request carried. */
export function nextHint(current: string | undefined, change: { add?: SessionKind; remove?: SessionKind }): string {
  const have = new Set((current ?? '').split('.').filter((k): k is SessionKind => k in SESSION_COOKIES));
  if (change.add) have.add(change.add);
  if (change.remove) have.delete(change.remove);
  return (Object.keys(SESSION_COOKIES) as SessionKind[]).filter((k) => have.has(k)).join('.');
}

/**
 * V51.9.181 fix (newcomer review): the sign-in, sign-up and sign-out routes set the hint in the same reply that sets or
 * clears the session, so the page knows at once. (Before, only the proxy set it, from the cookies the request carried —
 * a sign-in request carries none yet, so the student page stayed on its sign-in form after a correct sign-in.)
 */
export function writeHint(res: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => unknown } }, request: Request, change: { add?: SessionKind; remove?: SessionKind }) {
  const current = /(?:^|;\s*)aig_hint=([^;]*)/.exec(request.headers.get('cookie') ?? '')?.[1];
  const value = nextHint(current ? decodeURIComponent(current) : '', change);
  const secure = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  res.cookies.set(HINT_COOKIE, value, { path: '/', sameSite: 'lax', secure, httpOnly: false, maxAge: value ? 60 * 60 * 24 * 30 : 0 });
}

/** In the browser: whether this browser may have that sign-in (any sign-in when no kind is given). */
export function mayHaveSession(...kinds: SessionKind[]): boolean {
  if (typeof document === 'undefined') return true;
  const m = document.cookie.match(/(?:^|;\s*)aig_hint=([^;]*)/);
  const have = m ? decodeURIComponent(m[1]).split('.').filter(Boolean) : [];
  return kinds.length ? kinds.some((k) => have.includes(k)) : have.length > 0;
}

/**
 * `fetch`, but only when the browser may have one of these sign-ins. Without one it answers at once with a 401-like
 * `{ ok: false }` response, the same thing the server would have said, without a network request or a console error.
 */
export function fetchIfSignedIn(kinds: SessionKind[], input: string, init?: RequestInit): Promise<Response> {
  if (mayHaveSession(...kinds)) return fetch(input, init);
  return Promise.resolve(new Response(JSON.stringify({ ok: false, error: 'Not signed in' }), { status: 401, headers: { 'content-type': 'application/json' } }));
}
