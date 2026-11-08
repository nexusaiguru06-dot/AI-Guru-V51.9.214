// @vitest-environment node
/** V51.9.100: the teacher's avatar — rules, files, who may use it, and the two local workers (teacher voice, AI lip-sync). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encodeWav } from '../reels/motion/audio';
import { BLOCK_TEXT, cleanStudentAvatar, cleanVoice, studentAvatarBlock } from '../student/avatar';
import { pcm16ToClip } from '../reels/motion/voice';
import { cleanMarks, cleanStyle, DEFAULT_MARKS, effectiveStyle, hasConsent, studentsMayUse, videoBytes, videoKind, voiceBytes, wavSeconds, CONSENT_VERSION } from './avatar';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
const jpegUrl = `data:image/jpeg;base64,${JPEG.toString('base64')}`;
const wav = (sec: number, rate = 16_000) => Buffer.from(encodeWav(new Float32Array(Math.round(sec * rate)).map((_, i) => 0.2 * Math.sin(i / 7)), rate));
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(40)]);

describe('avatar rules', () => {
  it('keeps the marks inside the picture and drops eyes that sit below the mouth', () => {
    expect(cleanMarks(null)).toEqual({ mouth: DEFAULT_MARKS.mouth });
    expect(cleanMarks({ mouth: { x: 5, y: -1, w: 9 } }).mouth).toEqual({ x: 0.9, y: 0.2, w: 0.45 });
    expect(cleanMarks({ mouth: { x: 0.5, y: 0.7, w: 0.2 }, eyes: [{ x: 0.4, y: 0.45 }, { x: 0.6, y: 0.45 }] }).eyes).toHaveLength(2);
    expect(cleanMarks({ mouth: { x: 0.5, y: 0.5, w: 0.2 }, eyes: [{ x: 0.4, y: 0.6 }, { x: 0.6, y: 0.6 }] }).eyes).toBeUndefined();
    expect(cleanStyle('ai')).toBe('ai');
    expect(cleanStyle('<script>')).toBe('lipsync');
    expect(effectiveStyle('ai', false)).toBe('lipsync');
    expect(effectiveStyle('ai', true)).toBe('ai');
  });

  it('needs consent for the current wording; students need consent AND sharing', () => {
    const m: any = { consent: { version: CONSENT_VERSION, at: 'x' }, shareWithStudents: false };
    expect(hasConsent(m)).toBe(true);
    expect(hasConsent({ consent: { version: CONSENT_VERSION - 1, at: 'x' } })).toBe(false);
    expect(studentsMayUse(m)).toBe(false);
    expect(studentsMayUse({ ...m, shareWithStudents: true })).toBe(true);
    expect(studentsMayUse({ ...m, consent: { version: 0, at: 'x' }, shareWithStudents: true })).toBe(false);
  });

  it('accepts only real WAV voice samples of a sensible length, and MP4 / WebM face videos', () => {
    expect(wavSeconds(wav(5))).toBeCloseTo(5, 2);
    expect(wavSeconds(Buffer.from('not a wav at all, definitely not, no no no no no'))).toBeNull();
    expect(voiceBytes(wav(6).toString('base64'))).toMatchObject({ seconds: 6 });
    expect(voiceBytes(`data:audio/wav;base64,${wav(6).toString('base64')}`)).toMatchObject({ seconds: 6 });
    expect(voiceBytes(wav(1).toString('base64'))).toMatchObject({ error: expect.stringMatching(/at least/) });
    expect(voiceBytes(wav(40, 8000).toString('base64'))).toMatchObject({ error: expect.stringMatching(/under/) });
    expect(voiceBytes(JPEG.toString('base64'))).toMatchObject({ error: expect.stringMatching(/WAV/) });
    expect(videoKind(MP4)).toBe('mp4');
    expect(videoKind(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0]))).toBe('webm');
    expect(videoBytes(MP4.toString('base64'), 8)).toMatchObject({ kind: 'mp4', seconds: 8 });
    expect(videoBytes(MP4.toString('base64'), 40)).toMatchObject({ error: expect.any(String) });
    expect(videoBytes(JPEG.toString('base64'), 8)).toMatchObject({ error: expect.stringMatching(/MP4 or WebM/) });
  });
});

describe('a student’s own avatar (on the phone, own key)', () => {
  const photo = { dataUrl: 'data:image/jpeg;base64,xx', guardianOk: true, onReels: true };
  it('needs the photo with the guardian’s agreement, the student’s own key, and their tick to pay for the voice', () => {
    expect(studentAvatarBlock({ photo: null, hasOwnKey: true, voiceOptIn: true })).toBe('no-photo');
    expect(studentAvatarBlock({ photo: { ...photo, guardianOk: false }, hasOwnKey: true, voiceOptIn: true })).toBe('no-guardian');
    expect(studentAvatarBlock({ photo: { ...photo, onReels: false }, hasOwnKey: true, voiceOptIn: true })).toBe('no-guardian');
    expect(studentAvatarBlock({ photo, hasOwnKey: false, voiceOptIn: true })).toBe('no-key');
    expect(studentAvatarBlock({ photo, hasOwnKey: true, voiceOptIn: false })).toBe('no-voice-ok');
    expect(studentAvatarBlock({ photo, hasOwnKey: true, voiceOptIn: true })).toBeNull();
    expect(BLOCK_TEXT['no-key']).toMatch(/does not pay/);
  });
  it('keeps only known voices and clean marks', () => {
    expect(cleanVoice('Puck')).toBe('Puck');
    expect(cleanVoice('EvilVoice')).toBe('Kore');
    expect(cleanStudentAvatar({ marks: { mouth: { x: 9, y: 0.7, w: 0.2 } }, voice: 'x' })).toMatchObject({ voice: 'Kore', marks: { mouth: { x: 0.9 } } });
    expect(cleanStudentAvatar(null)).toBeNull();
  });
  it('turns Gemini’s raw 16-bit voice into a clip at the reel rate', () => {
    const n = 24000;
    const pcm = Buffer.alloc(n * 2);
    for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.round(8000 * Math.sin(i / 5)), i * 2);
    const clip = pcm16ToClip(pcm.toString('base64'), 'audio/L16;codec=pcm;rate=24000');
    expect(clip.length).toBeGreaterThan(47_000); // 1 s at 48 kHz (trimmed a little)
    expect(clip.length).toBeLessThan(49_000);
  });
});

/* ---------------- routes end to end ---------------- */

const R: Record<string, any> = {};
let admin = '';
const req = (body: unknown, cookie = '', ip = '1.1.1.1') => new Request('http://x/a', { method: 'POST', headers: { cookie, 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (cookie = '') => new Request('http://x/a', { headers: { cookie } });
const j = async (r: Response) => r.json();
const form = (name: string, extra = {}) => ({ name, standard: '8', school: 'GHSS Aluva', state: 'Kerala', district: 'Ernakulam', place: 'Aluva', password: 'secret1', confirm: 'secret1', ...extra });
let ipN = 1;
const signup = async (name: string, coupon?: string) => (await R.signup.POST(req(form(name, coupon ? { coupon } : {}), '', `70.0.0.${ipN++}`))).headers.get('set-cookie')!.split(';')[0];

// fake workers: the teacher voice (IndicF5) and the AI lip-sync (LatentSync)
let worker: Server;
const seen: Record<string, any> = {};
beforeAll(async () => {
  process.chdir(mkdtempSync(path.join(tmpdir(), 'avatar-')));
  process.env.ADMIN_USERNAME = 'boss'; process.env.ADMIN_PASSWORD = 'correct-horse-battery';
  for (const [k, p] of Object.entries({ login: 'admin/login', classes: 'admin/classes', signup: 'student-portal/signup', avatar: 'teacher-avatar', mine: 'student-portal/teacher-avatar', voice: 'teacher-voice', lipsync: 'teacher-avatar/lipsync' })) R[k] = await import(`@/app/api/ai-guru/${p}/route`);
  admin = (await R.login.POST(req({ username: 'boss', password: 'correct-horse-battery' }))).headers.get('set-cookie')!.split(';')[0];
  worker = createServer((rq, rs) => {
    let body = '';
    rq.on('data', (c) => { body += c; });
    rq.on('end', () => {
      const b = JSON.parse(body || '{}');
      seen[rq.url!] = b;
      rs.setHeader('content-type', 'application/json');
      if (rq.url === '/tts') rs.end(JSON.stringify({ ok: true, audio_b64: wav(1.5).toString('base64') }));
      else if (rq.url === '/lipsync') rs.end(JSON.stringify({ ok: true, video_b64: MP4.toString('base64'), sync_confidence: 6.2 }));
      else { rs.statusCode = 404; rs.end('{}'); }
    });
  });
  await new Promise<void>((r) => worker.listen(0, '127.0.0.1', () => r()));
  const port = (worker.address() as { port: number }).port;
  process.env.AIGURU_TEACHER_VOICE_URL = `http://127.0.0.1:${port}`;
  process.env.AIGURU_LIPSYNC_URL = `http://127.0.0.1:${port}`;
});
afterAll(() => { worker?.close(); });

describe('avatar routes', () => {
  it('a teacher saves their avatar; their students see it only when shared; other classes never', async () => {
    const c = await j(await R.classes.POST(req({ action: 'create', kind: 'class', name: 'Class 8B', teacherName: 'Mrs Nair', school: 'GHSS Aluva' }, admin)));
    const other = await j(await R.classes.POST(req({ action: 'create', kind: 'class', name: 'Class 9C', teacherName: 'Mr Menon', school: 'GHSS Aluva' }, admin)));
    const T = { code: c.group.code, key: c.teacherKey };
    const pupil = await signup('Anu Thomas', c.group.code);
    const stranger = await signup('Rahul K', other.group.code);
    const loner = await signup('Meera S');

    expect((await R.avatar.POST(req({ code: T.code, key: '000000', action: 'get' }, '', '9.9.9.1'))).status).toBe(401);
    expect((await R.avatar.POST(req({ action: 'get' }))).status).toBe(401);
    expect(await j(await R.avatar.POST(req({ ...T, action: 'get' })))).toMatchObject({ ok: true, meta: null, avatar: null, teacherName: 'Mrs Nair' });

    // consent is required, and a photo
    expect((await R.avatar.POST(req({ ...T, action: 'save', photo: jpegUrl }))).status).toBe(400);
    expect((await R.avatar.POST(req({ ...T, action: 'save', consent: true }))).status).toBe(400);
    // AI style needs the face video
    expect((await R.avatar.POST(req({ ...T, action: 'save', consent: true, photo: jpegUrl, style: 'ai' }))).status).toBe(400);
    const saved = await j(await R.avatar.POST(req({ ...T, action: 'save', consent: true, photo: jpegUrl, style: 'lipsync', marks: { mouth: { x: 0.5, y: 0.72, w: 0.2 } }, shareWithStudents: false, voice: { wav: wav(6).toString('base64'), refText: 'നമസ്കാരം കുട്ടികളേ', lang: 'ml' } })));
    expect(saved.meta).toMatchObject({ id: c.group.teacherCode, name: 'Mrs Nair', style: 'lipsync', shareWithStudents: false, voice: { seconds: 6, lang: 'ml' } });
    expect(saved.avatar).toMatchObject({ photo: jpegUrl, hasVoice: true, hasVideo: false });

    // not shared yet: the pupil gets nothing, and cannot use the teacher's voice
    expect((await R.mine.GET(get(pupil))).status).toBe(404);
    expect((await R.voice.POST(req({ text: 'hello', lang: 'en' }, pupil))).status).toBe(404);
    // shared: the pupil gets the avatar; a student of another class and one without a class do not
    await R.avatar.POST(req({ ...T, action: 'save', consent: true, shareWithStudents: true }));
    const got = await j(await R.mine.GET(get(pupil)));
    // students get the face only: no cloned voice, no AI lip-sync (those run on the AI Guru PC and would cost the company)
    expect(got.avatar).toMatchObject({ id: c.group.teacherCode, shared: true, hasVoice: false, hasVideo: false, style: 'lipsync' });
    expect((await R.mine.GET(get(stranger))).status).toBe(404);
    expect((await R.mine.GET(get(loner))).status).toBe(404);
    expect((await R.mine.GET(get(''))).status).toBe(401);
    // saving without a new voice keeps the old one
    expect((await j(await R.avatar.POST(req({ ...T, action: 'get' })))).meta.voice).toMatchObject({ seconds: 6 });

    // a student never reaches the voice worker, even with sharing on
    const blocked = await R.voice.POST(req({ text: 'hello', lang: 'en' }, pupil));
    expect(blocked.status).toBe(403);
    expect((await j(blocked)).error).toMatch(/own key/);
    expect(seen['/tts']).toBeUndefined();
    // the teacher's voice goes to the worker with the saved sample and its words
    const v = await j(await R.voice.POST(req({ text: 'ഇന്ന് നമുക്ക് പഠിക്കാം', lang: 'ml', ...T })));
    expect(v).toMatchObject({ ok: true, result: { provider: 'teacher-voice' } });
    expect(seen['/tts']).toMatchObject({ text: 'ഇന്ന് നമുക്ക് പഠിക്കാം', ref_text: 'നമസ്കാരം കുട്ടികളേ' });
    expect(Buffer.from(seen['/tts'].ref_audio_b64, 'base64').equals(wav(6))).toBe(true);
    expect((await R.voice.POST(req({ text: 'hi', lang: 'en' }, stranger))).status).toBe(404);
    expect((await j(await R.voice.POST(req({ text: 'teacher self', lang: 'en', ...T })))).ok).toBe(true);

    // AI lip-sync: refused until the style is 'ai' with a video; then the worker gets the video and the voice track
    expect((await R.lipsync.POST(req({ audio: wav(3).toString('base64'), ...T }))).status).toBe(404);
    const ai = await j(await R.avatar.POST(req({ ...T, action: 'save', consent: true, style: 'ai', shareWithStudents: true, video: { data: MP4.toString('base64'), seconds: 8 } })));
    expect(ai.meta).toMatchObject({ style: 'ai', video: { seconds: 8, type: 'mp4' } });
    expect((await R.lipsync.POST(req({ audio: 'bm90IGEgd2F2', ...T }))).status).toBe(400);
    expect((await R.lipsync.POST(req({ audio: wav(3).toString('base64') }, pupil))).status).toBe(403); // students: never the GPU worker
    expect(seen['/lipsync']).toBeUndefined();
    expect((await j(await R.mine.GET(get(pupil)))).avatar).toMatchObject({ style: 'lipsync', hasVideo: false }); // AI style shows as the free lip-sync
    const ls = await j(await R.lipsync.POST(req({ audio: wav(3).toString('base64'), ...T })));
    expect(ls).toMatchObject({ ok: true, syncConfidence: 6.2 });
    expect(Buffer.from(ls.video, 'base64').equals(MP4)).toBe(true);
    expect(seen['/lipsync']).toMatchObject({ video_type: 'mp4', steps: 20 });

    // worker off → 503 (the browser then uses the classroom voice / the photo lip-sync)
    process.env.AIGURU_TEACHER_VOICE_URL = 'http://127.0.0.1:9';
    expect((await R.voice.POST(req({ text: 'hello', lang: 'en', ...T }))).status).toBe(503);

    // removing deletes everything; the pupil loses it at once
    expect(await j(await R.avatar.POST(req({ ...T, action: 'remove' })))).toMatchObject({ ok: true, avatar: null });
    expect((await R.mine.GET(get(pupil))).status).toBe(404);
  });
});

/* ---------------- V51.9.103: characters and "use my own video" ---------------- */
import { createCanvas } from '@napi-rs/canvas';
import { CHARACTERS, CHARACTER_MARKS, drawCharacter } from '../avatar/characters';
import { bestSpeechWindow, frameScore, skinLike } from './own-video';

describe('V51.9.103 characters (nobody real)', () => {
  it('six characters, unique ids, each with free classroom voices and a Gemini voice', () => {
    expect(CHARACTERS.length).toBe(6);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(6);
    for (const c of CHARACTERS) { expect(c.edge.en).toMatch(/^en-IN-/); expect(c.edge.ml).toMatch(/^ml-IN-/); expect(c.gemini).toBeTruthy(); }
  });
  it('the lips and eyes are drawn exactly at the marks the lip-sync uses', () => {
    for (const ch of CHARACTERS) {
      const c = createCanvas(512, 512);
      const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
      drawCharacter(ctx, ch);
      const px = (x: number, y: number) => Array.from(ctx.getImageData(Math.round(x * 512), Math.round(y * 512), 1, 1).data);
      const lip = px(CHARACTER_MARKS.mouth.x, CHARACTER_MARKS.mouth.y);
      const cheek = px(0.5, 0.6);
      expect(lip[0] + lip[1] + lip[2], ch.id).toBeLessThan(cheek[0] + cheek[1] + cheek[2]); // lips darker than the skin above
      for (const e of CHARACTER_MARKS.eyes!) { const p = px(e.x - 0.03, e.y); expect(p[0] + p[1] + p[2], `${ch.id} eye`).toBeGreaterThan(600); } // white of the eye
    }
  });
  it('a student may use a character without a photo or the guardian question; the own key is still needed', () => {
    expect(studentAvatarBlock({ photo: null, hasOwnKey: true, voiceOptIn: true, character: 'meenu' })).toBeNull();
    expect(studentAvatarBlock({ photo: null, hasOwnKey: false, voiceOptIn: true, character: 'meenu' })).toBe('no-key');
    expect(studentAvatarBlock({ photo: null, hasOwnKey: true, voiceOptIn: true })).toBe('no-photo');
    expect(cleanStudentAvatar({ character: 'arjun', marks: { mouth: { x: 0.1, y: 0.2, w: 0.3 } } })).toMatchObject({ character: 'arjun', marks: CHARACTER_MARKS, voice: 'Puck' });
    expect(cleanStudentAvatar({ character: 'mohanlal' })?.character).toBeUndefined();
  });
});

describe('V51.9.103 use my own video: picking the still and the speech', () => {
  const frame = (fill: (x: number, y: number) => [number, number, number], w = 96, h = 96) => {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = fill(x, y); const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
    return d;
  };
  it('a sharp, well-lit face-coloured centre beats a blurred one; no face scores 0', () => {
    const face = (x: number, y: number): [number, number, number] => {
      const inFace = (x - 48) ** 2 / 900 + (y - 44) ** 2 / 1300 < 1;
      const detail = (x * 7 + y * 13) % 9 === 0 ? -60 : 0; // eyes, hair, edges
      return inFace ? [196 + detail, 140 + detail, 110 + detail] : [90, 120, 150];
    };
    const sharp = frameScore(frame(face), 96, 96);
    // the same face out of focus: no fine detail, soft edge
    const blurred = frameScore(frame((x, y) => { const e = Math.max(0, Math.min(1, (1 - ((x - 48) ** 2 / 900 + (y - 44) ** 2 / 1300)) * 3)); return [90 + e * 106, 120 + e * 20, 150 - e * 40]; }), 96, 96);
    const wall = frameScore(frame(() => [90, 120, 150]), 96, 96);
    expect(sharp.face).toBeGreaterThan(0.5);
    expect(sharp.total).toBeGreaterThan(0);
    expect(sharp.sharp).toBeGreaterThan(blurred.sharp);
    expect(wall.total).toBe(0);
    expect(skinLike(196, 140, 110)).toBe(true);
    expect(skinLike(90, 120, 150)).toBe(false);
  });
  it('finds the clearest 12 s of speech and starts and ends in a pause', () => {
    const rate = 8000, sec = 60;
    const s = new Float32Array(rate * sec);
    for (let i = 0; i < s.length; i++) {
      const t = i / rate;
      const speaking = t > 30 && t < 44 && Math.sin(t * 9) > -0.6; // 14 s of speech with short gaps
      s[i] = (speaking ? 0.3 * Math.sin(2 * Math.PI * 180 * t) : 0) + 0.002 * Math.sin(i * 12.9898);
    }
    const w = bestSpeechWindow(s, rate, 12)!;
    expect(w.start).toBeGreaterThanOrEqual(29.3);
    expect(w.end).toBeLessThanOrEqual(44.7);
    expect(w.end - w.start).toBeGreaterThan(11);
    expect(w.speech).toBeGreaterThan(0.6);
    expect(bestSpeechWindow(new Float32Array(rate * 20), rate)).toBeNull(); // silence
  });
  it('avoids clipped (distorted) speech', () => {
    const rate = 8000;
    const s = new Float32Array(rate * 40);
    for (let i = 0; i < s.length; i++) {
      const t = i / rate;
      if (t > 2 && t < 15) s[i] = Math.max(-1, Math.min(1, 1.6 * Math.sin(2 * Math.PI * 200 * t))); // clipped
      if (t > 22 && t < 35) s[i] = 0.3 * Math.sin(2 * Math.PI * 200 * t); // clean
    }
    const w = bestSpeechWindow(s, rate, 12)!;
    expect(w.start).toBeGreaterThan(20);
  });
});

describe('V51.9.103 a teacher saves a character', () => {
  it('stores the character, fixes the marks, offers its classroom voices, and refuses unknown ones', async () => {
    const c = await j(await R.classes.POST(req({ action: 'create', kind: 'class', name: 'Class 7C', teacherName: 'Mr Joseph', school: 'GHSS Aluva' }, admin)));
    const T = { code: c.group.code, key: c.teacherKey };
    expect((await R.avatar.POST(req({ ...T, action: 'save', consent: true, character: 'mohanlal', photo: jpegUrl }))).status).toBe(400);
    const saved = await j(await R.avatar.POST(req({ ...T, action: 'save', consent: true, character: 'ravi', photo: jpegUrl, style: 'ai', marks: { mouth: { x: 0.2, y: 0.3, w: 0.1 } }, shareWithStudents: true })));
    expect(saved.meta).toMatchObject({ character: 'ravi', style: 'lipsync', marks: CHARACTER_MARKS });
    expect(saved.avatar).toMatchObject({ character: 'ravi', edge: { en: 'en-IN-PrabhatNeural', ml: 'ml-IN-MidhunNeural' } });
    const pupil = await signup('Neha R', c.group.code);
    expect((await j(await R.mine.GET(get(pupil)))).avatar).toMatchObject({ character: 'ravi', shared: true, hasVoice: false });
    // back to their own photo: the character goes
    const own = await j(await R.avatar.POST(req({ ...T, action: 'save', consent: true, character: '', photo: jpegUrl, marks: { mouth: { x: 0.5, y: 0.7, w: 0.2 } } })));
    expect(own.meta.character).toBeUndefined();
    expect(own.avatar.edge).toBeUndefined();
  });
});
