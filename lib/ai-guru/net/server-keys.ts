/**
 * V51.9.176 (security) — the server's own paid keys (Gemini, Sarvam, OpenAI, Google Cloud TTS) are used only for people
 * who are signed in: the admin, a teacher or a student. A visitor who is not signed in can still use AI Guru with their
 * own key (BYOK) and with the free voices (Edge, the on-device voice), but cannot spend the school's credit.
 *
 * AI_GURU_SERVER_KEYS = signed-in | everyone
 *   default: signed-in when NODE_ENV=production (a live site), everyone on a laptop (npm run dev), so localhost works as before.
 *
 * The check reads the request's cookies through Next.js (next/headers), so it works deep inside the AI and voice code
 * without passing the request around. Outside a web request (tests, scripts, a job already approved by a signed-in
 * route) there is no visitor to check, and the key is allowed.
 */
export type PaidKey = 'GEMINI_API_KEY' | 'SARVAM_API_KEY' | 'OPENAI_API_KEY' | 'GITHUB_TOKEN' | 'GOOGLE_CLOUD_TTS_API_KEY' | 'AI_GURU_GOOGLE_TTS_API_KEY';

export const keyPolicy = (): 'signed-in' | 'everyone' => {
  const v = process.env.AI_GURU_SERVER_KEYS;
  if (v === 'everyone' || v === 'signed-in') return v;
  return process.env.NODE_ENV === 'production' ? 'signed-in' : 'everyone';
};

/** The cookie header of the request being answered, or null when there is no web request (tests, scripts). */
async function requestCookieHeader(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    return h.get('cookie') ?? '';
  } catch {
    return null; // called outside a request
  }
}

/** True when the cookie header carries a valid admin, teacher or student session. */
export async function signedInFromCookies(cookieHeader: string): Promise<boolean> {
  if (!cookieHeader) return false;
  const { isAdmin, studentFromRequest, teacherFromRequest } = await import('../admin/auth');
  const req = new Request('http://local/', { headers: { cookie: cookieHeader } });
  return (await isAdmin(req)) || !!(await teacherFromRequest(req)) || !!(await studentFromRequest(req));
}

/** May the current request use the server's own paid keys? */
export async function serverKeysAllowed(): Promise<boolean> {
  if (keyPolicy() === 'everyone') return true;
  const cookie = await requestCookieHeader();
  if (cookie === null) return true; // not a web request
  return signedInFromCookies(cookie);
}

/** The server's key `name`, or undefined when it is not set or the visitor may not use it. */
export async function serverKey(name: PaidKey): Promise<string | undefined> {
  const v = process.env[name];
  if (!v) return undefined;
  return (await serverKeysAllowed()) ? v : undefined;
}

/** The message to show when only a server key could have answered and the visitor is not signed in. */
export const SIGN_IN_FOR_SERVER_KEY = 'Sign in, or add your own AI key in Settings, to use this.';
