/**
 * V51.9.90: the last part of a share clip — a big QR code of the student's link, so someone watching on a TV, a laptop or a
 * friend's phone can scan it from the screen. Drawn as plain black squares on white (long runs merged), so it scans from the
 * exported MP4 and needs nothing but the Motion engine.
 */
import qrcode from 'qrcode-generator';
import type { MotionScene } from '../reels/motion/engine';
import type { Lang } from '../reels/motion/captions';
import { label, newScene, uid } from '../subjects/kit';
import { codeFromLink, spacedCode, typePlace } from './join-code';

/** Dark runs of one QR row, as [startColumn, length]; merging runs keeps the picture to a few hundred shapes. */
export function qrRuns(link: string): { n: number; runs: Array<{ r: number; c: number; len: number }> } {
  const q = qrcode(0, 'M');
  q.addData(link);
  q.make();
  const n = q.getModuleCount();
  const runs: Array<{ r: number; c: number; len: number }> = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!q.isDark(r, c)) { c++; continue; }
      let len = 0;
      while (c + len < n && q.isDark(r, c + len)) len++;
      runs.push({ r, c, len });
      c += len;
    }
  }
  return { n, runs };
}

export function qrScene(o: { link: string; lang: Lang }): MotionScene {
  const ml = o.lang === 'ml';
  const { n, runs } = qrRuns(o.link);
  // V51.9.91: the join code under the QR, for anyone who cannot scan (same phone, TV, screen recording).
  const code = codeFromLink(o.link);
  const m = newScene('AI Guru', 780);
  const size = code ? 400 : 440;
  const cell = size / n;
  const x0 = 360 - size / 2;
  const y0 = code ? 135 : 150;
  const say = code
    ? (ml ? `ഈ QR സ്കാൻ ചെയ്യൂ, അല്ലെങ്കിൽ കോഡ് ${spacedCode(code)} ടൈപ്പ് ചെയ്യൂ` : `Scan this QR code, or type the code ${spacedCode(code)}`)
    : (ml ? 'ഈ QR സ്കാൻ ചെയ്ത് ചേരൂ' : 'Scan this QR code to join');
  let t = m.step(say, 300, 3200);
  label(m, ml ? 'സ്കാൻ ചെയ്ത് ചേരൂ' : 'Scan to join', 360, 70, t, { size: 36, weight: '700' });
  const pad = 26;
  m.poly(uid('qb'), [[x0 - pad, y0 - pad], [x0 + size + pad, y0 - pad], [x0 + size + pad, y0 + size + pad], [x0 - pad, y0 + size + pad]], t, { color: '#222222', fill: '#ffffff', fillAlpha: 1, width: 3, dur: 1, z: 1, silent: true });
  for (const { r, c, len } of runs) {
    const x = x0 + c * cell;
    const y = y0 + r * cell;
    m.poly(uid('qm'), [[x, y], [x + len * cell + 0.6, y], [x + len * cell + 0.6, y + cell + 0.6], [x, y + cell + 0.6]], t, { color: '#000000', fill: '#000000', fillAlpha: 1, width: 0.1, dur: 1, z: 2, silent: true });
  }
  if (code) {
    const base = y0 + size + pad;
    label(m, ml ? 'അല്ലെങ്കിൽ ഈ കോഡ് ടൈപ്പ് ചെയ്യൂ' : 'or type this code', 360, base + 45, t + 300, { size: 24, color: '#4b5563' });
    label(m, spacedCode(code), 360, base + 105, t + 300, { size: 56, color: 'accent', weight: '800' });
    label(m, ml ? `${typePlace(o.link)} തുറന്ന്` : `at ${typePlace(o.link)}`, 360, base + 160, t + 300, { size: 26, weight: '700' });
  } else {
    label(m, o.link.replace(/^https?:\/\//, ''), 360, y0 + size + 90, t + 300, { size: 26, color: 'accent', weight: '700' });
  }
  m.hold(t + 3000);
  const scene = m.build();
  scene.group = 'qr-card';
  return scene;
}
