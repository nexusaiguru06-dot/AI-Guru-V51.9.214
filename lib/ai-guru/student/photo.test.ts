// @vitest-environment node
/** V51.9.99: the student's photo — rules, cropping, and the student's and the office's photo routes end to end. */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanPrefs, cropSquare, imageKind, MAX_PHOTO_BYTES, photoBytes, showOnReels } from './photo';

// a real (tiny) JPEG: SOI + JFIF APP0 + EOI is enough for the type check
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpegUrl = (b = JPEG) => `data:image/jpeg;base64,${b.toString('base64')}`;

describe('photo rules', () => {
  it('shows a photo on reels only when the guardian agreed AND the student switched it on', () => {
    expect(cleanPrefs({ onReels: true, guardianOk: false })).toEqual({ onReels: false, guardianOk: false });
    expect(cleanPrefs({ onReels: true, guardianOk: true })).toEqual({ onReels: true, guardianOk: true });
    expect(cleanPrefs({ onReels: 'yes', guardianOk: 1 })).toEqual({ onReels: false, guardianOk: false });
    expect(showOnReels({ onReels: true, guardianOk: true })).toBe(true);
    expect(showOnReels({ onReels: false, guardianOk: true })).toBe(false);
    expect(showOnReels(null)).toBe(false);
  });

  it('accepts only real JPEG / PNG pictures under the size limit', () => {
    expect(imageKind(JPEG)).toBe('jpeg');
    expect(imageKind(PNG)).toBe('png');
    expect(imageKind(Buffer.from('GIF89a'))).toBeNull();
    expect(photoBytes(jpegUrl())).toMatchObject({ kind: 'jpeg' });
    expect(photoBytes(`data:image/png;base64,${PNG.toString('base64')}`)).toMatchObject({ kind: 'png' });
    expect(photoBytes('data:image/jpeg;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64'))).toEqual({ error: 'That file is not a JPEG or PNG photo.' });
    expect(photoBytes('data:image/svg+xml;base64,PHN2Zz4=')).toMatchObject({ error: expect.any(String) });
    expect(photoBytes('https://example.com/me.jpg')).toMatchObject({ error: expect.any(String) });
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_PHOTO_BYTES)]);
    expect(photoBytes(jpegUrl(big))).toMatchObject({ error: expect.stringMatching(/too large/) });
  });

  it('cuts a square that stays inside the picture', () => {
    expect(cropSquare(1000, 600)).toEqual({ sx: 200, sy: 0, size: 600 });
    expect(cropSquare(600, 1000, 2, 0.5, 0.3)).toEqual({ sx: 150, sy: 150, size: 300 });
    expect(cropSquare(600, 1000, 2, 0, 0)).toEqual({ sx: 0, sy: 0, size: 300 });
    expect(cropSquare(600, 1000, 2, 1, 1)).toEqual({ sx: 300, sy: 700, size: 300 });
    expect(cropSquare(600, 1000, 0.2).size).toBe(600); // zoom below 1 never makes the square bigger than the picture
  });
});

let admin = '';
const R: Record<string, any> = {};
const req = (body: unknown, cookie = '', ip = '1.1.1.1', method = 'POST', q = '') => new Request(`http://x/a${q}`, { method, headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: method === 'POST' || method === 'PUT' ? JSON.stringify(body) : undefined });
const get = (cookie = '', q = '') => new Request(`http://x/a${q}`, { headers: { cookie } });
const j = async (r: Response) => r.json();
const cookieOf = (r: Response) => r.headers.get('set-cookie')!.split(';')[0];
let ip = 10;
const signup = async (name: string) => {
  const r = await R.signup.POST(req({ name, standard: '8', syllabus: 'kerala', medium: 'malayalam', school: 'GHSS', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1' }, '', `60.0.0.${ip++}`));
  const c = cookieOf(r);
  return { c, id: (await j(await R.me.GET(get(c)))).student.id as string };
};

beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'photo-')));
  process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  for (const [k, p] of Object.entries({ login: 'admin/login', signup: 'student-portal/signup', me: 'student-portal/me', photo: 'student-portal/photo', aphoto: 'admin/students/photo', students: 'admin/students' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
  admin = cookieOf(await R.login.POST(req({ username: 'boss', password: 'correct-horse-battery' })));
});

describe('photo routes', () => {
  it('a student adds a photo, turns it on for reels (only with the guardian box), and removes it', async () => {
    const s = await signup('Anu Thomas');
    expect((await R.photo.GET(get(s.c))).status).toBe(404);
    expect((await R.photo.POST(req({ image: jpegUrl() }))).status).toBe(401); // not signed in
    expect((await R.photo.POST(req({ onReels: true, guardianOk: true }, s.c))).status).toBe(400); // switches without a photo
    const up = await j(await R.photo.POST(req({ image: jpegUrl(), onReels: true, guardianOk: false }, s.c)));
    expect(up.photo).toMatchObject({ onReels: false, guardianOk: false, by: 'student' });
    const got = await R.photo.GET(get(s.c));
    expect(got.headers.get('content-type')).toBe('image/jpeg');
    expect(got.headers.get('cache-control')).toContain('no-store');
    expect(Buffer.from(await got.arrayBuffer()).equals(JPEG)).toBe(true);
    const on = await j(await R.photo.POST(req({ onReels: true, guardianOk: true }, s.c)));
    expect(on.photo).toMatchObject({ onReels: true, guardianOk: true, at: up.photo.at });
    expect((await j(await R.me.GET(get(s.c)))).student.photo).toMatchObject({ onReels: true, guardianOk: true });
    expect((await R.photo.POST(req({ image: 'data:image/gif;base64,R0lGODlh' }, s.c))).status).toBe(400);
    await R.photo.DELETE(req({}, s.c, '1.1.1.1', 'DELETE'));
    expect((await R.photo.GET(get(s.c))).status).toBe(404);
    const me = (await j(await R.me.GET(get(s.c)))).student;
    expect(me.photo).toBeUndefined();
    expect(me.photoRemoved).toMatchObject({ by: 'student' });
  });

  it('a student never sees another student’s photo; the office sees, adds and takes down any', async () => {
    const a = await signup('Rahul K');
    const b = await signup('Meera S');
    await R.photo.POST(req({ image: jpegUrl(), onReels: true, guardianOk: true }, a.c));
    expect((await R.photo.GET(get(b.c))).status).toBe(404); // b sees only b's (none)
    expect((await R.photo.GET(get(b.c, `?as=${a.id}`))).status).toBe(404); // ?as= is for the admin only
    expect((await R.aphoto.GET(get('', `?id=${a.id}`))).status).toBe(404); // the office route hides itself from non-admins
    expect((await R.aphoto.GET(get(admin, `?id=${a.id}`))).status).toBe(200);
    expect((await R.photo.GET(get(admin, `?as=${a.id}`))).status).toBe(200); // the admin viewing a's page
    const add = await j(await R.aphoto.POST(req({ id: b.id, image: `data:image/png;base64,${PNG.toString('base64')}`, guardianOk: true, onReels: false }, admin)));
    expect(add.photo).toMatchObject({ by: 'admin', guardianOk: true, onReels: false });
    expect((await R.photo.GET(get(b.c))).headers.get('content-type')).toBe('image/png');
    await R.aphoto.DELETE(req({}, admin, '1.1.1.1', 'DELETE', `?id=${a.id}`));
    expect((await j(await R.me.GET(get(a.c)))).student.photoRemoved).toMatchObject({ by: 'admin' });
    expect((await R.aphoto.POST(req({ id: 'st_nobody', image: jpegUrl() }, admin))).status).toBe(404);
    expect((await R.aphoto.POST(req({ id: '../../etc', image: jpegUrl() }, admin))).status).toBe(404);
  });

  it('deleting a student also deletes their photo; editing the record keeps it', async () => {
    const s = await signup('Kiran P');
    await R.photo.POST(req({ image: jpegUrl(), onReels: true, guardianOk: true }, s.c));
    const list = await j(await R.students.GET(get(admin)));
    const st = list.students.find((x: any) => x.id === s.id);
    expect(st.photo).toMatchObject({ onReels: true });
    await R.students.PUT(req({ student: { ...st, name: 'Kiran Prakash' } }, admin, '1.1.1.1', 'PUT'));
    expect((await j(await R.students.GET(get(admin)))).students.find((x: any) => x.id === s.id).photo).toMatchObject({ onReels: true });
    await R.students.DELETE(req({}, admin, '1.1.1.1', 'DELETE', `?id=${s.id}`));
    expect((await R.aphoto.GET(get(admin, `?id=${s.id}`))).status).toBe(404);
  });
});
