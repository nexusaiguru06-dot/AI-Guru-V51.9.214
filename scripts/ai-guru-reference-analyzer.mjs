#!/usr/bin/env node
/**
 * AI Guru — Reference Video Analyzer
 *
 * Takes ONE reference video and produces, ready for the registry:
 *   1. keyframes (scene-change + evenly spaced, with timestamps)
 *   2. a contact sheet (one image with all keyframes)
 *   3. a machine-readable STYLE SPEC (json): layout, palette, typography, step grammar,
 *      caption/icon placement, timeline of events, pacing, things NOT to copy, QA checks
 *   4. a registry entry that passes `npm run audit:reference-video-library`
 *
 * Requirements: Node >= 22, ffmpeg + ffprobe on PATH. The AI step needs GEMINI_API_KEY
 * (env or .env.local). Without a key, or with --no-ai, only steps 1-2 and a skeleton are produced.
 *
 *   node scripts/ai-guru-reference-analyzer.mjs <video> [options]
 *
 *   --id <slug>          registry id (default: from file name)
 *   --name "<title>"     display name
 *   --subject <text>     e.g. Algebra   (the AI proposes one if omitted)
 *   --frames <n>         max keyframes (default 12)
 *   --scene <0-1>        scene-change threshold (default 0.06)
 *   --mode video|frames  send the whole video (default) or only the keyframes to Gemini
 *   --model <name>       default: GEMINI_MODEL or gemini-2.5-flash
 *   --no-ai              only keyframes + skeleton
 *   --out <dir>          default: public/reference-styles
 *   --merge              copy the video into the library and add/replace the registry entry
 *   --approve            mark approved=true even when the spec was not AI generated
 *   --dry-run            print what would happen; write nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

/* ---------------------------------- args ---------------------------------- */
function parseArgs(argv) {
  const a = { _: [], frames: 12, scene: 0.06, mode: 'video', out: 'public/reference-styles' };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) { a._.push(t); continue; }
    const k = t.slice(2);
    if (['no-ai', 'merge', 'approve', 'dry-run'].includes(k)) { a[k] = true; continue; }
    a[k] = argv[++i];
  }
  a.frames = Math.max(4, Math.min(40, Number(a.frames) || 12));
  a.scene = Math.max(0.01, Math.min(0.9, Number(a.scene) || 0.06));
  return a;
}
const args = parseArgs(process.argv.slice(2));
const videoArg = args._[0];
if (!videoArg || args.help) {
  console.error('Usage: node scripts/ai-guru-reference-analyzer.mjs <video> [--id slug] [--name "Title"] [--subject Algebra] [--frames 12] [--mode video|frames] [--no-ai] [--merge] [--dry-run]');
  process.exit(videoArg ? 0 : 1);
}
const videoPath = path.resolve(videoArg);
if (!fs.existsSync(videoPath)) { console.error(`Video not found: ${videoPath}`); process.exit(1); }

const slug = (s) => String(s).toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'reference-video';
const id = slug(args.id || path.basename(videoPath));
const outRoot = path.resolve(root, args.out);
const analysisDir = path.join(outRoot, 'analysis', id);
const kfDir = path.join(analysisDir, 'keyframes');
const dry = Boolean(args['dry-run']);

/* --------------------------------- helpers -------------------------------- */
function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
  if (r.error) {
    if (r.error.code === 'ENOENT') { console.error(`'${cmd}' was not found. Install ffmpeg (includes ffprobe) and make sure it is on PATH.`); process.exit(1); }
    throw r.error;
  }
  return r;
}
function loadEnvFile(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* optional */ }
}
loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.join(root, '.env'));

const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const mkdirp = (d) => { if (!dry) fs.mkdirSync(d, { recursive: true }); };

/* --------------------------------- 1. probe -------------------------------- */
function probe(file) {
  const r = run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  if (r.status !== 0) { console.error(`ffprobe failed:\n${r.stderr}`); process.exit(1); }
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  if (!v) { console.error('No video stream found.'); process.exit(1); }
  const [n, d] = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/').map(Number);
  const hasAudio = (j.streams || []).some((s) => s.codec_type === 'audio');
  const ext = path.extname(file).toLowerCase().replace('.', '');
  return {
    durationSeconds: Number(Number(j.format?.duration || v.duration || 0).toFixed(3)),
    width: v.width, height: v.height,
    fps: d ? Number((n / d).toFixed(2)) : 30,
    videoCodec: v.codec_name, hasAudio,
    format: ext || 'mp4',
    mimeType: ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4',
    sizeBytes: fs.statSync(file).size,
  };
}

/* ------------------------------- 2. keyframes ------------------------------ */
function sceneTimes(file, threshold) {
  // Writes nothing; showinfo prints pts_time of every frame that passed the scene filter to stderr.
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vf', `select='gt(scene,${threshold})',showinfo`, '-an', '-f', 'null', '-']);
  const times = [];
  for (const m of (r.stderr || '').matchAll(/pts_time:([0-9.]+)/g)) times.push(Number(m[1]));
  return times;
}
function pickTimes(duration, scenes, max) {
  const set = new Set([0.2, Math.max(0.2, duration - 0.6)].map((t) => Number(t.toFixed(2))));
  // Scene changes often fire in bursts while a line is being written: keep a time only if it is >=0.7s from the last kept one.
  let last = -10;
  for (const t of scenes) if (t - last >= 0.7) { set.add(Number((t + 0.15).toFixed(2))); last = t; }
  let times = [...set].filter((t) => t >= 0 && t < duration).sort((a, b) => a - b);
  if (times.length > max) {
    const keep = [];
    for (let i = 0; i < max; i++) keep.push(times[Math.round((i * (times.length - 1)) / (max - 1))]);
    times = [...new Set(keep)];
  }
  const min = Math.min(max, 6);
  if (times.length < min) {
    for (let i = 0; i < min; i++) times.push(Number(((duration * (i + 0.5)) / min).toFixed(2)));
    times = [...new Set(times)].sort((a, b) => a - b);
  }
  return times;
}
function extractKeyframes(file, times) {
  const frames = [];
  times.forEach((t, i) => {
    const name = `kf-${String(i + 1).padStart(2, '0')}.jpg`;
    const dest = path.join(kfDir, name);
    if (!dry) {
      const r = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '3', dest]);
      if (r.status !== 0 || !fs.existsSync(dest)) { console.warn(`  ! could not extract frame at ${t}s`); return; }
    }
    frames.push({ index: i + 1, file: name, timeSeconds: t, label: fmtT(t) });
  });
  return frames;
}
function contactSheet(frames) {
  if (dry || frames.length === 0) return null;
  const cols = frames.length <= 6 ? 3 : 4;
  const rows = Math.ceil(frames.length / cols);
  const dest = path.join(analysisDir, 'contact-sheet.jpg');
  const r = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '1', '-i', path.join(kfDir, 'kf-%02d.jpg'),
    '-vf', `scale=480:-2,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', '-q:v', '3', dest]);
  return r.status === 0 && fs.existsSync(dest) ? 'contact-sheet.jpg' : null;
}

/* -------------------------------- 3. Gemini -------------------------------- */
const BASE = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
const KEY = process.env.GEMINI_API_KEY;
const MODEL = args.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function buildPrompt(meta, frames, mode) {
  const stamps = frames.map((f) => `kf-${String(f.index).padStart(2, '0')} = ${f.timeSeconds}s`).join(', ');
  return `You are a teaching-video style analyst for an educational app. You are given ONE reference video (${mode === 'video' ? 'the full video' : 'a contact sheet and its keyframes: ' + stamps}).
Duration ${meta.durationSeconds}s, ${meta.width}x${meta.height}. Study HOW it teaches - its visual grammar - so a different program can recreate the same TYPE of video with different mathematics.

Return ONLY one JSON object (no markdown) with exactly these keys:
{
 "registry": {
   "name": "short title of the teaching style, generic (no channel names)",
   "subject": "e.g. Algebra | Geometry | Calculus | Arithmetic",
   "domains": ["snake_case math domains"],
   "suggestedGrades": "e.g. 7-10",
   "concepts": ["3-8 concepts the video teaches, used to decide when this reference fits a lesson"],
   "teachingMethods": ["3-6 method names, e.g. colour-coded step lines, arc over changed term"],
   "selectionTerms": ["8-15 lowercase search words a lesson question would contain"],
   "teachingPrompt": "3-5 sentences telling a lesson planner how to teach in this style using ORIGINAL content. Must say never copy exact equations, narration, branding or artwork.",
   "qaInstructions": ["6-9 checkable rules, each one sentence"]
 },
 "styleSpec": {
   "schemaVersion": "1.0",
   "canvas": {"aspect": "w:h", "background": "#hex", "notes": ""},
   "regions": [{"name": "title|working-column|caption-column|controls|footer|legend", "x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1, "purpose": ""}],
   "palette": [{"role": "original-line|step-1|step-2|step-3|result|check|caption|title|background|icon-*", "hex": "#rrggbb"}],
   "typography": {"family": "describe (rounded sans, handwriting, mono...)", "weights": "", "sizes": {"title": "relative", "line": "relative", "caption": "relative"}},
   "stepGrammar": {
     "linePerTransformation": true|false,
     "markers": [{"type": "arc|circle|box|underline|arrow|other", "usedFor": "", "colourRule": ""}],
     "captionPosition": "where the caption sits relative to the line",
     "controlsPosition": "where any icons/buttons sit relative to the caption",
     "controls": [{"glyph": "", "meaning": ""}],
     "answerTreatment": "",
     "checkTreatment": "how verification/substitution is shown, or 'none'"
   },
   "timeline": [{"tStart": seconds, "tEnd": seconds, "event": "line-appears|marker-appears|caption-appears|controls-appear|highlight|pause|clear|other", "target": "generic description, e.g. 'first equation line'", "colourRole": "", "notes": ""}],
   "pacing": {"stepCount": n, "avgSecondsPerStep": n, "pauseBeforeAnswerSeconds": n, "revealStyle": "typewriter|fade|draw|pop|instant", "narration": "none|voice-over|text-only"},
   "narrationStyle": "one sentence, or 'none'",
   "doNotCopy": ["channel names, handles, watermarks, logos, exact equations, exact wording, artwork that appear in the video"],
   "rendererHints": ["concrete, implementable instructions for recreating this look programmatically"],
   "confidence": "high|medium|low",
   "uncertainties": ["anything you could not determine"]
 }
}
Rules: describe what you actually see; use timestamps from the video; positions are fractions of the frame; do not invent features that are not there; do not include the video's exact mathematics in registry.teachingPrompt.`;
}

function extractJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* try to salvage */ }
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('Model did not return JSON.');
}

async function gfetch(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method || 'GET'} ${url.replace(/key=[^&]+/, 'key=***')} -> HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res;
}

async function uploadVideo(file, meta) {
  const bytes = fs.readFileSync(file);
  const start = await gfetch(`${BASE}/upload/v1beta/files?key=${KEY}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length), 'X-Goog-Upload-Header-Content-Type': meta.mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: `reference-${id}` } }),
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini File API did not return an upload URL.');
  const up = await gfetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Length': String(bytes.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bytes,
  });
  let info = (await up.json()).file;
  for (let i = 0; i < 60 && info?.state && info.state !== 'ACTIVE'; i++) {
    if (info.state === 'FAILED') throw new Error('Gemini could not process the video (state FAILED).');
    await new Promise((r) => setTimeout(r, 2000));
    info = await (await gfetch(`${BASE}/v1beta/${info.name}?key=${KEY}`)).json();
  }
  if (info?.state && info.state !== 'ACTIVE') throw new Error(`Video still ${info.state} after waiting.`);
  return info;
}

async function askGemini(parts) {
  const res = await gfetch(`${BASE}/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
  });
  const j = await res.json();
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) throw new Error(`Empty answer from model (${j.promptFeedback?.blockReason || j.candidates?.[0]?.finishReason || 'unknown reason'}).`);
  return extractJson(text);
}

async function analyseWithGemini(meta, frames, mode) {
  const prompt = buildPrompt(meta, frames, mode);
  const parts = [];
  let uploaded = null;
  if (mode === 'video') {
    console.log(`  uploading video (${(meta.sizeBytes / 1048576).toFixed(1)} MB) to the Gemini File API ...`);
    uploaded = await uploadVideo(videoPath, meta);
    parts.push({ fileData: { mimeType: uploaded.mimeType || meta.mimeType, fileUri: uploaded.uri } });
  } else {
    const sheet = path.join(analysisDir, 'contact-sheet.jpg');
    if (fs.existsSync(sheet)) parts.push({ inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(sheet).toString('base64') } });
    for (const f of frames) parts.push({ inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(path.join(kfDir, f.file)).toString('base64') } });
  }
  parts.push({ text: prompt });
  try {
    console.log(`  asking ${MODEL} ...`);
    try { return await askGemini(parts); }
    catch (e) {
      if (!/JSON|Empty answer/.test(String(e.message))) throw e;
      console.log('  answer was not valid JSON - retrying once ...');
      return await askGemini([...parts.slice(0, -1), { text: `${prompt}\n\nReturn strictly valid JSON only.` }]);
    }
  } finally {
    if (uploaded?.name) { try { await fetch(`${BASE}/v1beta/${uploaded.name}?key=${KEY}`, { method: 'DELETE' }); } catch { /* best effort */ } }
  }
}

/* --------------------------- 4. validate + assemble ------------------------- */
const arr = (v, fallback = []) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : fallback);

function validateSpec(spec, duration) {
  const warnings = [];
  if (!spec || typeof spec !== 'object') return ['styleSpec missing'];
  for (const k of ['canvas', 'regions', 'palette', 'stepGrammar', 'timeline', 'pacing', 'doNotCopy', 'rendererHints']) if (!spec[k]) warnings.push(`styleSpec.${k} missing`);
  for (const ev of Array.isArray(spec.timeline) ? spec.timeline : []) {
    if (typeof ev.tStart === 'number' && ev.tStart > duration + 1) warnings.push(`timeline event beyond video length: ${ev.event}@${ev.tStart}s`);
    if (typeof ev.tStart === 'number' && typeof ev.tEnd === 'number' && ev.tEnd < ev.tStart) warnings.push(`timeline event ends before it starts: ${ev.event}@${ev.tStart}s`);
  }
  for (const p of Array.isArray(spec.palette) ? spec.palette : []) if (!/^#[0-9a-f]{6}$/i.test(String(p.hex || ''))) warnings.push(`palette hex not #rrggbb: ${p.role}=${p.hex}`);
  for (const r of Array.isArray(spec.regions) ? spec.regions : []) for (const k of ['x', 'y', 'w', 'h']) if (typeof r[k] !== 'number' || r[k] < 0 || r[k] > 1) warnings.push(`region ${r.name}.${k} not a 0-1 fraction`);
  return warnings;
}

function buildEntry({ meta, ai, aiOk }) {
  const reg = ai?.registry || {};
  const name = args.name || reg.name || id.replace(/-/g, ' ');
  const subject = args.subject || reg.subject || 'TODO subject';
  const concepts = arr(reg.concepts, [id.replace(/-/g, ' ')]);
  const ext = meta.format;
  const base = `/reference-styles/analysis/${id}`;
  return {
    id, name,
    file: `/reference-styles/${id}.${ext}`,
    originalFilename: path.basename(videoPath),
    approved: Boolean(args.approve || aiOk),
    doNotCopyContent: true,
    role: 'style-reference',
    commonTeachingStyleId: 'visual-derivation-explanation-v1',
    styleId: id,
    qaProfileId: `${id}-v1`,
    subject,
    domains: arr(reg.domains, [String(subject).toLowerCase().replace(/[^a-z0-9]+/g, '_')]),
    suggestedGrades: reg.suggestedGrades || '6-12',
    concepts,
    teachingMethods: arr(reg.teachingMethods, ['step-by-step derivation']),
    selectionTerms: arr(reg.selectionTerms, [id, ...concepts.map((c) => c.toLowerCase())]),
    teachingPrompt: reg.teachingPrompt || 'TODO: describe this reference as a teaching grammar. Use it only as a style reference; generate original mathematics, narration, diagrams and visual actions; never copy exact equations, scenes, narration, branding or artwork.',
    qaInstructions: arr(reg.qaInstructions, ['TODO: add checkable QA rules for this style.']),
    assetType: 'full_reference',
    durationSeconds: meta.durationSeconds, width: meta.width, height: meta.height, fps: meta.fps,
    videoCodec: meta.videoCodec, format: ext, mimeType: meta.mimeType,
    // New in V46: what the analyzer produced, so planners/QA can look at the reference instead of only reading words.
    styleSpecFile: `${base}/spec.json`,
    contactSheet: `${base}/contact-sheet.jpg`,
    keyframeDir: `${base}/keyframes`,
    analysis: { source: aiOk ? `gemini:${MODEL}:${args.mode}` : 'skeleton', analyzedAt: new Date().toISOString() },
  };
}

function mergeIntoRegistry(entry, meta) {
  const regPath = path.join(outRoot, 'ai-guru-reference-video-registry.json');
  if (!fs.existsSync(regPath)) { console.error(`Registry not found: ${regPath}`); process.exit(1); }
  const registry = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  const assets = Array.isArray(registry.assets) ? registry.assets : [];
  const dest = path.join(outRoot, `${id}.${meta.format}`);
  if (dry) { console.log(`  [dry-run] would copy video -> ${dest} and update registry (${assets.length} assets)`); return; }
  if (path.resolve(videoPath) !== path.resolve(dest)) fs.copyFileSync(videoPath, dest);
  fs.copyFileSync(regPath, `${regPath}.bak`);
  const at = assets.findIndex((a) => a.id === id);
  if (at >= 0) assets[at] = { ...assets[at], ...entry }; else assets.push(entry);
  registry.assets = assets;
  registry.assetCount = assets.length;
  if (at < 0 && typeof registry.physicalVideoFileCount === 'number') registry.physicalVideoFileCount += 1; // one new physical file
  fs.writeFileSync(regPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`  registry updated (${at >= 0 ? 'replaced' : 'added'} "${id}"; backup: ${path.basename(regPath)}.bak)`);
}

/* ---------------------------------- main ----------------------------------- */
(async () => {
  console.log(`Analyzing ${path.basename(videoPath)}  ->  id "${id}"${dry ? '  [dry-run]' : ''}`);
  const meta = probe(videoPath);
  console.log(`  ${meta.width}x${meta.height} @ ${meta.fps}fps, ${fmtT(meta.durationSeconds)}, ${meta.hasAudio ? 'has audio' : 'silent'}`);

  mkdirp(kfDir);
  const times = pickTimes(meta.durationSeconds, sceneTimes(videoPath, args.scene), args.frames);
  const frames = extractKeyframes(videoPath, times);
  const sheet = contactSheet(frames);
  console.log(`  ${frames.length} keyframes${sheet ? ' + contact sheet' : ''}`);

  let ai = null; let aiOk = false; let warnings = [];
  const wantAi = !args['no-ai'];
  if (wantAi && !KEY) console.log('  GEMINI_API_KEY not set - producing keyframes + skeleton only (use --no-ai to silence).');
  if (wantAi && KEY && !dry) {
    try {
      ai = await analyseWithGemini(meta, frames, args.mode === 'frames' ? 'frames' : 'video');
      warnings = validateSpec(ai.styleSpec, meta.durationSeconds);
      aiOk = true;
    } catch (e) {
      console.error(`  AI analysis failed: ${e.message}\n  Keyframes are saved; fix the problem and re-run, or try --mode frames.`);
    }
  }

  const entry = buildEntry({ meta, ai, aiOk });
  const spec = {
    ...(ai?.styleSpec || { schemaVersion: '1.0', note: 'Skeleton - no AI analysis was run. Fill in or re-run with GEMINI_API_KEY.' }),
    source: { videoId: id, originalFilename: path.basename(videoPath), durationSeconds: meta.durationSeconds, width: meta.width, height: meta.height, fps: meta.fps },
    keyframes: frames,
    contactSheet: sheet,
  };

  if (!dry) {
    fs.writeFileSync(path.join(analysisDir, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
    fs.writeFileSync(path.join(analysisDir, 'registry-entry.json'), `${JSON.stringify(entry, null, 2)}\n`);
  }
  console.log(`  output: ${path.relative(root, analysisDir) || analysisDir}`);
  for (const w of warnings) console.log(`  ! spec warning: ${w}`);

  if (args.merge) {
    if (!entry.approved) console.log('  NOT merged: no AI analysis and no --approve. Review registry-entry.json, then re-run with --approve --merge.');
    else mergeIntoRegistry(entry, meta);
  } else {
    console.log('  Review spec.json and registry-entry.json, then re-run with --merge (or paste the entry into the registry).');
  }
  console.log('Done. Verify with: npm run audit:reference-video-library');
})().catch((e) => { console.error(e); process.exit(1); });
