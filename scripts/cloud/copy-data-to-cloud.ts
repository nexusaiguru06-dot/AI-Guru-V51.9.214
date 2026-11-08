/**
 * V51.9.173 — copies the data AI Guru saved on this computer into the cloud:
 *   JSON records  → PostgreSQL (Cloud SQL or Neon), table ai_guru_docs
 *   PDFs, photos, voice and video → the Cloud Storage bucket, or Netlify Blobs (V51.9.175: AI_GURU_BLOBS=netlify
 *   with NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN, a Netlify personal access token)
 * Keys are the same relative paths the app uses, so the app finds everything where it expects it.
 *
 * Run from the app's folder (it reads ./data and ./.data):
 *   DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5432/aiguru AI_GURU_BUCKET=my-bucket npx tsx scripts/cloud/copy-data-to-cloud.ts --dry-run
 *   …then the same without --dry-run.
 * Reaching Cloud SQL from your PC: run the Cloud SQL Auth Proxy (see docs/DEPLOY-GOOGLE-CLOUD.md, step 7).
 * Safe to run again: records and files are overwritten with the copy from this computer.
 * Options: --dry-run (show what would be copied), --only-docs, --only-files, --from=<folder> (default: this folder).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const opt = (name: string) => process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const DRY = args.has('--dry-run');
const FROM = path.resolve(opt('from') || process.cwd());

/** Only the folders the app writes to (the reference libraries in data/ ship with the app and are not copied). */
const STORE_DIRS = [
  'data/ai-guru/admin',
  'data/ai-guru/attendance',
  'data/ai-guru/progress',
  'data/ai-guru/messages',
  'data/ai-guru/teacher',
  'data/ai-guru/reel-looks',
  '.data/ai-guru-material-studio',
];
// V51.9.176: auth.json (the laptop's admin sign-in, often xxx / yyy) is never copied; the live site uses ADMIN_* settings.
const SKIP = [/\.tmp$/, /(^|\/)lockouts\.json$/, /(^|\/)auth\.json$/, /(^|\/)initial-credentials\.txt$/, /(^|\/)\.DS_Store$/];
const TYPES: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm' };

async function walk(dir: string, out: string[]) {
  let entries: import('node:fs').Dirent[] = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out); else out.push(p);
  }
}

async function main() {
  if (!DRY && (!process.env.DATABASE_URL && !args.has('--only-files'))) throw new Error('Set DATABASE_URL (the Cloud SQL database).');
  const toNetlify = process.env.AI_GURU_BLOBS === 'netlify';
  if (!DRY && !args.has('--only-docs')) {
    if (toNetlify && !(process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN)) throw new Error('Set NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN (a Netlify personal access token).');
    if (!toNetlify && !process.env.AI_GURU_BUCKET) throw new Error('Set AI_GURU_BUCKET (the Cloud Storage bucket), or AI_GURU_BLOBS=netlify for Netlify Blobs.');
  }
  const { checkKey, pgDocs, gcsBlobs, netlifyBlobs, pgPool } = await import('../../lib/ai-guru/storage/index');
  const fileStore = toNetlify ? netlifyBlobs : gcsBlobs;

  const files: string[] = [];
  for (const d of STORE_DIRS) await walk(path.join(FROM, d), files);
  let docs = 0, blobs = 0, bytes = 0, skipped = 0;
  for (const abs of files.sort()) {
    const key = path.relative(FROM, abs).split(path.sep).join('/');
    if (SKIP.some((r) => r.test(key))) { skipped++; continue; }
    try { checkKey(key); } catch { console.warn(`  skip (name not allowed): ${key}`); skipped++; continue; }
    const isJson = key.endsWith('.json');
    if (isJson && args.has('--only-files')) continue;
    if (!isJson && args.has('--only-docs')) continue;
    const buf = await fs.readFile(abs);
    if (isJson) {
      let value: unknown;
      try { value = JSON.parse(buf.toString('utf8')); } catch { console.warn(`  skip (not valid JSON): ${key}`); skipped++; continue; }
      if (!DRY) await pgDocs.put(key, value);
      docs++;
      console.log(`${DRY ? '[dry] ' : ''}record  ${key}`);
    } else {
      if (!DRY) await fileStore.put(key, buf, TYPES[path.extname(key).toLowerCase()]);
      blobs++; bytes += buf.length;
      console.log(`${DRY ? '[dry] ' : ''}file    ${key}  (${(buf.length / 1024).toFixed(0)} KB)`);
    }
  }
  console.log(`\n${DRY ? 'Would copy' : 'Copied'} ${docs} records to PostgreSQL and ${blobs} files (${(bytes / 1048576).toFixed(1)} MB) to ${toNetlify ? 'Netlify Blobs' : 'Cloud Storage'}; ${skipped} skipped.`);
  if (!DRY && docs) await (await pgPool()).end();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
