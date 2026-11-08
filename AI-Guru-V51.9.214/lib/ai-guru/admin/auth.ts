/**
 * Admin sign-in (server only). The admin signs in through the ordinary sign-in box of ANY portal; the portals
 * never say that an admin exists. Credentials: ADMIN_USERNAME + ADMIN_PASSWORD in the environment, or, when
 * those are not set, the development sign-in xxx / yyy (change it inside the admin portal before going live). Passwords are stored as scrypt hashes; the session is a signed httpOnly cookie.
 * V51.9.173 (security): in production (NODE_ENV=production) xxx / yyy is never created; set ADMIN_USERNAME + ADMIN_PASSWORD
 * (+ ADMIN_SESSION_SECRET). The sign-in record and the lockout go through lib/ai-guru/storage, so they are shared by every
 * Cloud Run instance, and the lockout uses the address the platform saw (a client cannot fake it with X-Forwarded-For).
 */
import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { docs } from '../storage';

export const COOKIE = 'aig_admin';
const KEY = 'data/ai-guru/admin/auth.json';
const LOCKS = 'data/ai-guru/admin/lockouts.json';
const SESSION_MS = 8 * 3600_000;

interface AuthFile { username: string; salt: string; hash: string; secret: string }

const NO_SECRET = randomBytes(32).toString('hex');
const eq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const hashOf = (pw: string, salt: string) => scryptSync(pw, salt, 64).toString('hex');

/**
 * V51.9.214 — the demo sign-in xxx / yyy also works on a live site (Netlify demo) for as long as NO real admin sign-in is
 * set there. The moment ADMIN_USERNAME + ADMIN_PASSWORD exist, xxx / yyy stops working by itself. AI_GURU_NO_DEMO_ADMIN=1
 * switches the demo sign-in off even when nothing is set.
 */
export const devAdminAllowed = () => process.env.NODE_ENV !== 'production' || process.env.AI_GURU_ALLOW_DEV_ADMIN === '1' || (!envCreds() && process.env.AI_GURU_NO_DEMO_ADMIN !== '1');

async function load(): Promise<AuthFile | null> {
  // V51.9.176 (security): on a live site (production) the admin sign-in comes ONLY from ADMIN_USERNAME / ADMIN_PASSWORD.
  // A saved sign-in record is ignored there, so a record copied from a laptop (often xxx / yyy) can never let anyone in.
  if (!devAdminAllowed()) {
    console.error('[admin] no admin sign-in is set. Set ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_SESSION_SECRET.');
    return null;
  }
  const saved = await docs.get<AuthFile>(KEY);
  if (saved && saved.salt && saved.hash && saved.secret) return saved;
  // DEVELOPMENT STAGE: the owner asked for xxx / yyy. Set ADMIN_USERNAME + ADMIN_PASSWORD (or change them in the admin portal) before going live.
  const username = 'xxx';
  const salt = randomBytes(16).toString('hex');
  const a: AuthFile = { username, salt, hash: hashOf('yyy', salt), secret: randomBytes(32).toString('hex') };
  await docs.put(KEY, a);
  console.warn('[admin] the demo sign-in xxx / yyy is active. Set ADMIN_USERNAME + ADMIN_PASSWORD to replace it.');
  return a;
}

const envCreds = () => (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD ? { u: process.env.ADMIN_USERNAME, p: process.env.ADMIN_PASSWORD } : null);

// Slow down guessing: 5 misses in 15 minutes lock that key for 15 minutes (V51.9.182: callers may set a higher limit,
// e.g. a whole school behind one Wi-Fi address; keys are usually per account, with the address as a backstop). Kept in storage (V51.9.173), so a restart
// or a second Cloud Run instance does not hand out fresh tries.
type Misses = Record<string, number[]>;
const WINDOW = 900_000;
const recent = (xs: number[] | undefined, now: number) => (xs ?? []).filter((t) => now - t < WINDOW);
export async function lockedOut(ip: string, now = Date.now(), limit = 5): Promise<boolean> {
  try { return recent((await docs.get<Misses>(LOCKS))?.[ip], now).length >= limit; } catch { return false; }
}
/** V51.9.182: how a person locked out is told — the real length, in English and Malayalam. */
export const LOCKED_MESSAGE = 'Too many wrong tries. Please wait 15 minutes and try again.';
/** V51.9.182: a whole class signing in on one school Wi-Fi shares an address, so the address alone gets a high limit. */
export const ADDRESS_LIMIT = 60;
/** V51.9.196 (security check): wrong tries on ONE account from any address — stops guessing a password from many addresses. */
export const ACCOUNT_LIMIT = 20;
export async function noteMiss(ip: string, now = Date.now()): Promise<void> {
  try {
    await docs.update<Misses, void>(LOCKS, (cur) => {
      const next: Misses = {};
      for (const [k, v] of Object.entries(cur ?? {})) { const r = recent(v, now); if (r.length) next[k] = r; }
      next[ip] = [...(next[ip] ?? []), now].slice(-100);
      return { value: next, result: undefined };
    });
  } catch (e) { console.error('[admin] could not note a failed try', e); }
}

export async function checkCredentials(username: string, password: string): Promise<boolean> {
  const env = envCreds();
  if (env) return eq(username, env.u) && eq(password, env.p);
  const a = await load();
  if (!a) return false;
  const okPw = eq(hashOf(password, a.salt), a.hash);
  return eq(username, a.username) && okPw;
}

export async function changePassword(current: string, next: string, newUsername?: string): Promise<string | null> {
  if (envCreds()) return 'The admin sign-in is set by ADMIN_USERNAME / ADMIN_PASSWORD in the server settings; change it there.';
  const a = await load();
  if (!a) return 'No admin sign-in is set. Set ADMIN_USERNAME and ADMIN_PASSWORD in the server settings.';
  if (!eq(hashOf(current, a.salt), a.hash)) return 'Current password is not right';
  if (next.length < 10) return 'New password needs at least 10 characters (the development password yyy is short on purpose)';
  const salt = randomBytes(16).toString('hex');
  await docs.put(KEY, { ...a, username: newUsername?.trim() || a.username, salt, hash: hashOf(next, salt) });
  return null;
}

async function secret(): Promise<string> {
  const env = envCreds();
  if (env) return `${env.u}\n${env.p}\n${process.env.ADMIN_SESSION_SECRET ?? ''}`;
  const a = await load();
  // no sign-in set (production without ADMIN_*): a random per-process secret, so no cookie can ever be valid
  return a ? a.secret : NO_SECRET;
}

export async function makeSession(now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const exp = String(now + SESSION_MS);
  const sig = createHmac('sha256', await secret()).update(exp).digest('hex');
  return { value: `${exp}.${sig}`, maxAge: SESSION_MS / 1000 };
}

export async function validSession(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !(Number(exp) > now)) return false;
  return eq(sig, createHmac('sha256', await secret()).update(exp).digest('hex'));
}

export function cookieFrom(req: Request): string | undefined {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}
export const isAdmin = async (req: Request) => validSession(cookieFrom(req));

export { clientIp } from '../net/client-ip';

// ---- Students (V51.9.71): same machinery, a separate cookie, a PIN per student kept as a scrypt hash on the student record.
export const STUDENT_COOKIE = 'aig_student';
const STUDENT_SESSION_MS = 12 * 3600_000;

export function hashPin(pin: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: hashOf(pin, salt) };
}
export const verifyPin = (pin: string, l: { salt: string; hash: string } | undefined) => !!l && eq(hashOf(pin, l.salt), l.hash);
export const newPin = () => String(randomInt(100000, 1000000));

/** A signed, expiring student token: `studentId.exp.sig` (the signature covers both). */
export async function makeStudentSession(studentId: string, now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const body = `${Buffer.from(studentId).toString('base64url')}.${now + STUDENT_SESSION_MS}`;
  return { value: `${body}.${createHmac('sha256', `stu:${await secret()}`).update(body).digest('hex')}`, maxAge: STUDENT_SESSION_MS / 1000 };
}
export async function studentFromRequest(req: Request, now = Date.now()): Promise<string | null> {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${STUDENT_COOKIE}=([^;]+)`));
  const parts = m ? decodeURIComponent(m[1]).split('.') : [];
  if (parts.length !== 3 || !(Number(parts[1]) > now)) return null;
  const body = `${parts[0]}.${parts[1]}`;
  if (!eq(parts[2], createHmac('sha256', `stu:${await secret()}`).update(body).digest('hex'))) return null;
  try { return Buffer.from(parts[0], 'base64url').toString(); } catch { return null; }
}

// ---- Teachers (V51.9.173): a teacher signs in once with the class code + 6-digit key; the portal's pages that show
// every student's results, attendance and quizzes need this (or the admin's) session.
export const TEACHER_COOKIE = 'aig_teacher';
const TEACHER_SESSION_MS = 12 * 3600_000;
export async function makeTeacherSession(classId: string, now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const body = `${Buffer.from(classId).toString('base64url')}.${now + TEACHER_SESSION_MS}`;
  return { value: `${body}.${createHmac('sha256', `tch:${await secret()}`).update(body).digest('hex')}`, maxAge: TEACHER_SESSION_MS / 1000 };
}
/** V51.9.195: a CLASS teacher's session (the class id). A school teacher's session (`sch:…`) is NOT one: it opens only
 *  the school-teacher routes (lib/ai-guru/schools/session.ts), never the class-teacher pages, the shared question sets,
 *  every student's progress, or the server's AI keys. */
export async function teacherFromRequest(req: Request, now = Date.now()): Promise<string | null> {
  const v = await teacherSessionValue(req, now);
  return v && !v.startsWith('sch:') ? v : null;
}
/** The raw teacher-cookie value (class id or `sch:<school teacher id>`), when the cookie is valid. */
export async function teacherSessionValue(req: Request, now = Date.now()): Promise<string | null> {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${TEACHER_COOKIE}=([^;]+)`));
  const parts = m ? decodeURIComponent(m[1]).split('.') : [];
  if (parts.length !== 3 || !(Number(parts[1]) > now)) return null;
  const body = `${parts[0]}.${parts[1]}`;
  if (!eq(parts[2], createHmac('sha256', `tch:${await secret()}`).update(body).digest('hex'))) return null;
  try { return Buffer.from(parts[0], 'base64url').toString(); } catch { return null; }
}
/** null when the request comes from the admin or a signed-in teacher; otherwise a 401 to return. */
export async function teacherGate(req: Request): Promise<Response | null> {
  if (await isAdmin(req)) return null;
  if (await teacherFromRequest(req)) return null;
  return Response.json({ ok: false, error: 'Teacher sign-in needed', signIn: 'teacher' }, { status: 401 });
}
