import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const runtime = 'nodejs';

const VOICES = [
  { id: 'ml_IN-meera-medium', language: 'ml-IN' },
  { id: 'ml_IN-arjun-medium', language: 'ml-IN' },
  { id: 'en_US-lessac-medium', language: 'en-US' },
  { id: 'en_GB-alan-medium', language: 'en-GB' },
];

function dataRoot() {
  return process.env.PIPER_DATA_DIR || join(process.cwd(), 'data', 'piper');
}
function modelsDir() {
  return process.env.PIPER_MODELS_DIR || join(dataRoot(), 'voices');
}

function walkFind(dir: string, names: string[], depth = 0): string | null {
  if (depth > 6 || !existsSync(dir)) return null;
  try {
    const entries = readdirSync(dir);
    for (const name of names) {
      if (entries.includes(name)) {
        const full = join(dir, name);
        try {
          if (statSync(full).isFile()) return full;
        } catch { /* */ }
      }
    }
    for (const name of entries) {
      const full = join(dir, name);
      try {
        if (statSync(full).isDirectory()) {
          const hit = walkFind(full, names, depth + 1);
          if (hit) return hit;
        }
      } catch { /* */ }
    }
  } catch { /* */ }
  return null;
}

function resolveBin(): string | null {
  if (process.env.PIPER_BIN && existsSync(process.env.PIPER_BIN)) return process.env.PIPER_BIN;
  const hint = join(dataRoot(), 'piper-bin-path.txt');
  if (existsSync(hint)) {
    try {
      const p = readFileSync(hint, 'utf8').trim();
      if (p && existsSync(p)) return p;
      if (process.platform === 'win32' && p && !p.toLowerCase().endsWith('.exe')) {
        if (existsSync(p + '.exe')) return p + '.exe';
        const alt = join(dirname(p), 'piper.exe');
        if (existsSync(alt)) return alt;
      }
    } catch { /* */ }
  }
  const names = process.platform === 'win32' ? ['piper.exe', 'piper'] : ['piper', 'piper.exe'];
  for (const n of names) {
    const p = join(dataRoot(), 'bin', n);
    if (existsSync(p)) return p;
  }
  return walkFind(dataRoot(), names);
}

export async function GET() {
  const dir = modelsDir();
  const piperBin = resolveBin();
  const models = VOICES.map((v) => {
    const path = join(dir, `${v.id}.onnx`);
    return {
      id: v.id,
      language: v.language,
      path,
      present: existsSync(path) && existsSync(path + '.json'),
    };
  });
  return NextResponse.json({
    ok: true,
    piperBin,
    modelsDir: dir,
    models,
    ready: Boolean(piperBin) && models.some((m) => m.present),
    platform: process.platform,
  });
}
