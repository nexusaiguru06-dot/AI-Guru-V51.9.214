/** V51.9.181 (UX review item 9) — the readable sign-in hint, and the proxy keeping it in step. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { fetchIfSignedIn, hintFor, mayHaveSession, nextHint } from './session-hint';
import { proxy } from '@/proxy';

const withCookie = (cookie: string) => vi.stubGlobal('document', { cookie });
afterEach(() => { vi.unstubAllGlobals(); });

describe('hintFor', () => {
  it('lists which session cookies are present, never their values', () => {
    expect(hintFor(() => false)).toBe('');
    expect(hintFor((n) => n === 'aig_student')).toBe('student');
    expect(hintFor((n) => n === 'aig_admin' || n === 'aig_teacher')).toBe('admin.teacher');
  });
});

describe('mayHaveSession / fetchIfSignedIn in the browser', () => {
  it('reads the hint', () => {
    withCookie('a=1; aig_hint=admin.student; b=2');
    expect(mayHaveSession()).toBe(true);
    expect(mayHaveSession('student')).toBe(true);
    expect(mayHaveSession('teacher')).toBe(false);
    withCookie('a=1');
    expect(mayHaveSession()).toBe(false);
  });
  it('without the sign-in, answers 401 at once and makes no request', async () => {
    withCookie('');
    const spy = vi.fn(); vi.stubGlobal('fetch', spy);
    const r = await fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/me');
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ ok: false, error: 'Not signed in' });
    expect(spy).not.toHaveBeenCalled();
  });
  it('with the sign-in, makes the request', async () => {
    withCookie('aig_hint=student');
    const spy = vi.fn(async () => new Response('{"ok":true}')); vi.stubGlobal('fetch', spy);
    expect((await fetchIfSignedIn(['student'], '/x')).status).toBe(200);
    expect(spy).toHaveBeenCalledWith('/x', undefined);
  });
});

describe('proxy keeps aig_hint in step', () => {
  const run = (path: string, cookie: string) => proxy(new NextRequest(`http://x${path}`, { headers: { cookie } }));
  it('sets it on a page when a session cookie is there, and is readable by page code', () => {
    const set = run('/ai-guru/classroom', 'aig_student=signed.token').headers.get('set-cookie') ?? '';
    expect(set).toMatch(/aig_hint=student/);
    expect(set.toLowerCase()).not.toContain('httponly');
  });
  it('on pages it never removes (a link from WhatsApp carries no strict session cookie); on API requests it follows the session', () => {
    expect(run('/ai-guru', 'aig_hint=student').headers.get('set-cookie')).toBeNull();
    expect(run('/api/ai-guru/x', 'aig_hint=student').headers.get('set-cookie')).toMatch(/aig_hint=;/);
    expect(run('/api/ai-guru/x', 'aig_admin=t; aig_hint=admin').headers.get('set-cookie')).toBeNull();
  });
  it('leaves the sign-in, sign-up and sign-out routes to write it themselves', () => {
    expect(run('/api/ai-guru/student-portal/login', 'aig_hint=student').headers.get('set-cookie')).toBeNull();
    expect(run('/api/ai-guru/student-portal/logout', 'aig_student=t').headers.get('set-cookie')).toBeNull();
  });
});

describe('nextHint (what the sign-in and sign-out replies write)', () => {
  it('adds and removes one kind and keeps the others', () => {
    expect(nextHint('', { add: 'student' })).toBe('student');
    expect(nextHint('admin', { add: 'student' })).toBe('admin.student');
    expect(nextHint('admin.student', { remove: 'student' })).toBe('admin');
    expect(nextHint('student', { remove: 'student' })).toBe('');
    expect(nextHint('junk.student', { add: 'teacher' })).toBe('student.teacher');
  });
});
