#!/usr/bin/env node
/**
 * Renders one HyperFrames heading-intro clip per heading and writes public/ai-guru/intros/manifest.json.
 *
 *   node tools/hyperframes-intros/build-intros.mjs --in headings.json [--out public/ai-guru/intros] [--format webm|mp4] [--quality draft|looks] [--limit N]
 *
 * headings.json: [{ "heading": "Polynomials", "sub": "Zeros · Factor theorem", "lang": "en", "subject": "Maths", "kicker": "CLASS 10 · MATHS", "chapter": "Polynomials" }, …]
 * in the order the headings appear in the chapter (the order decides which look each one gets). Clips that already exist are skipped.
 * Needs Node 22, ffmpeg on PATH and Chrome: set HYPERFRAMES_BROWSER_PATH if hyperframes cannot find one.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOOKS, pickLook, introKey, subjectClass } from './pick-look.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const inFile = arg('in');
if (!inFile) { console.error('usage: build-intros.mjs --in headings.json [--out dir] [--format webm|mp4] [--quality draft|looks] [--limit N]'); process.exit(2); }
const out = path.resolve(arg('out', 'public/ai-guru/intros'));
const format = arg('format', 'webm');
const quality = arg('quality', 'looks');
const limit = Number(arg('limit', '0')) || Infinity;
const items = JSON.parse(readFileSync(inFile, 'utf8'));
mkdirSync(out, { recursive: true });
const manifestPath = path.join(out, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { version: 1, clips: {} };
const seed = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

let prev = -1, done = 0, skipped = 0;
for (let n = 0; n < items.length && done < limit; n++) {
  const it = items[n];
  const look = Number.isInteger(it.look) ? it.look : pickLook(it.subject, n, prev, it.chapter ?? '');
  prev = look;
  const key = introKey({ heading: it.heading, sub: it.sub ?? '', lang: it.lang, look });
  const file = `${key}.${format}`;
  const dest = path.join(out, file);
  if (existsSync(dest) && manifest.clips[key]) { skipped++; continue; }
  const dir = path.join(tmpdir(), `hf-intro-${key}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(path.join(here, 'looks', LOOKS[look].file), path.join(dir, 'index.html'));
  for (const f of ['common.css', 'common.js', 'gsap.min.js']) cpSync(path.join(here, f), path.join(dir, f));
  cpSync(path.join(here, 'fonts'), path.join(dir, 'fonts'), { recursive: true });
  writeFileSync(path.join(dir, 'data.js'), `window.__INTRO=${JSON.stringify({ heading: it.heading, sub: it.sub ?? '', kicker: it.kicker ?? '', lang: it.lang, subject: subjectClass(it.subject), seed: seed(it.heading) })};`);
  writeFileSync(path.join(dir, 'hyperframes.json'), JSON.stringify({ name: key }));
  const tmpOut = path.join(dir, `out.${format}`);
  const bin = process.env.HYPERFRAMES_BIN ? [process.env.HYPERFRAMES_BIN] : ['npx', '--yes', 'hyperframes'];
  console.log(`[${n + 1}/${items.length}] ${it.heading} (${it.lang}, look ${LOOKS[look].id})`);
  execFileSync(bin[0], [...bin.slice(1), 'render', '-o', tmpOut, '-q', quality, '--format', format], { cwd: dir, stdio: 'inherit', env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_SKIP_SKILLS: '1' } });
  renameSync(tmpOut, dest);
  manifest.clips[key] = { file, ms: 5000, look: LOOKS[look].id, heading: it.heading, lang: it.lang };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  rmSync(dir, { recursive: true, force: true });
  done++;
}
console.log(`done: ${done} rendered, ${skipped} already there → ${manifestPath}`);
