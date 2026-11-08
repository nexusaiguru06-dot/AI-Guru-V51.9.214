import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/ai-guru/admin/auth';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  chmodSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

const CATALOG: Record<string, { model: string; config: string }> = {
  'ml_IN-meera-medium': {
    model: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ml/ml_IN/meera/medium/ml_IN-meera-medium.onnx',
    config: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ml/ml_IN/meera/medium/ml_IN-meera-medium.onnx.json',
  },
  'ml_IN-arjun-medium': {
    model: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ml/ml_IN/arjun/medium/ml_IN-arjun-medium.onnx',
    config: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ml/ml_IN/arjun/medium/ml_IN-arjun-medium.onnx.json',
  },
  'en_US-lessac-medium': {
    model: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
    config: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json',
  },
  'en_GB-alan-medium': {
    model: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium/en_GB-alan-medium.onnx',
    config: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json',
  },
};

function dataRoot() {
  return process.env.PIPER_DATA_DIR || join(process.cwd(), 'data', 'piper');
}
function modelsDir() {
  return process.env.PIPER_MODELS_DIR || join(dataRoot(), 'voices');
}
function binDir() {
  return join(dataRoot(), 'bin');
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
        } catch { /* skip */ }
      }
    }
    for (const name of entries) {
      const full = join(dir, name);
      try {
        if (statSync(full).isDirectory()) {
          const hit = walkFind(full, names, depth + 1);
          if (hit) return hit;
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return null;
}

async function download(url: string, dest: string) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok || !r.body) throw new Error(`Download failed ${r.status} for ${url}`);
  await pipeline(Readable.fromWeb(r.body as any), createWriteStream(dest));
}

function preferredNames(): string[] {
  return process.platform === 'win32' ? ['piper.exe', 'piper'] : ['piper', 'piper.exe'];
}

function resolveExistingBin(): string | null {
  if (process.env.PIPER_BIN && existsSync(process.env.PIPER_BIN)) return process.env.PIPER_BIN;

  const hintPath = join(dataRoot(), 'piper-bin-path.txt');
  if (existsSync(hintPath)) {
    try {
      const hinted = readFileSync(hintPath, 'utf8').trim();
      if (hinted && existsSync(hinted)) return hinted;
      // Stale hint (ENOENT case): try sibling .exe on Windows
      if (process.platform === 'win32' && hinted && !hinted.toLowerCase().endsWith('.exe')) {
        const exe = `${hinted}.exe`;
        if (existsSync(exe)) return exe;
        const alt = join(dirname(hinted), 'piper.exe');
        if (existsSync(alt)) return alt;
      }
    } catch { /* ignore */ }
  }

  for (const name of preferredNames()) {
    const p = join(binDir(), name);
    if (existsSync(p)) return p;
  }

  // Deep search under data/piper
  const found = walkFind(dataRoot(), preferredNames());
  if (found) return found;

  for (const p of ['/usr/local/bin/piper', '/usr/bin/piper']) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function ensurePiperBinary(): Promise<string> {
  const existing = resolveExistingBin();
  if (existing) {
    writeFileSync(join(dataRoot(), 'piper-bin-path.txt'), existing, 'utf8');
    return existing;
  }

  const dir = binDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const platform = process.platform;
  const arch = process.arch;

  let asset = '';
  let isZip = false;
  if (platform === 'linux' && arch === 'x64') asset = 'piper_linux_x86_64.tar.gz';
  else if (platform === 'linux' && arch === 'arm64') asset = 'piper_linux_aarch64.tar.gz';
  else if (platform === 'darwin' && arch === 'x64') asset = 'piper_macos_x64.tar.gz';
  else if (platform === 'darwin' && arch === 'arm64') asset = 'piper_macos_aarch64.tar.gz';
  else if (platform === 'win32') {
    asset = 'piper_windows_amd64.zip';
    isZip = true;
  } else {
    throw new Error(`No automatic Piper binary for ${platform}/${arch}. Set PIPER_BIN to piper.exe path.`);
  }

  const url = `https://github.com/rhasspy/piper/releases/download/2023.11.14-2/${asset}`;
  const archive = join(dir, asset);
  if (!existsSync(archive)) {
    await download(url, archive);
  }

  if (isZip) {
    let extracted = false;
    // Prefer tar if available (Git Bash / Windows 10+ tar can open zip)
    try {
      await execFileAsync('tar', ['-xf', archive, '-C', dir]);
      extracted = true;
    } catch { /* try other tools */ }
    if (!extracted) {
      try {
        await execFileAsync('powershell', [
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`,
        ]);
        extracted = true;
      } catch { /* try unzip */ }
    }
    if (!extracted) {
      try {
        await execFileAsync('unzip', ['-o', archive, '-d', dir]);
        extracted = true;
      } catch (e) {
        throw new Error(
          `Could not extract Piper zip. Install 7-Zip or use tar, or set PIPER_BIN manually. (${e instanceof Error ? e.message : String(e)})`,
        );
      }
    }
  } else {
    await execFileAsync('tar', ['-xzf', archive, '-C', dir]);
  }

  const bin = walkFind(dir, preferredNames()) || walkFind(dataRoot(), preferredNames());
  if (!bin || !existsSync(bin)) {
    throw new Error(
      `Piper binary not found after extract under ${dir}. On Windows the file must be piper.exe.`,
    );
  }
  try {
    chmodSync(bin, 0o755);
  } catch { /* windows */ }

  writeFileSync(join(dataRoot(), 'piper-bin-path.txt'), bin, 'utf8');
  return bin;
}

export async function POST(request: Request) {
  // V51.9.173 (security): this downloads and runs a program on the server, so on a live server only the admin may.
  if (process.env.NODE_ENV === 'production' && !(await isAdmin(request))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = (await request.json().catch(() => ({}))) as {
      voiceId?: string;
      ensureBinary?: boolean;
      installAll?: boolean;
    };
    const logs: string[] = [];

    let piperBin: string | null = null;
    try {
      piperBin = await ensurePiperBinary();
      logs.push(`Piper binary ready: ${piperBin}`);
    } catch (e) {
      logs.push(`Piper binary: ${e instanceof Error ? e.message : String(e)}`);
    }

    const dir = modelsDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const ids = body.installAll
      ? Object.keys(CATALOG)
      : body.voiceId
        ? [String(body.voiceId)]
        : ['ml_IN-meera-medium', 'en_US-lessac-medium'];

    const installed: string[] = [];
    for (const id of ids) {
      const entry = CATALOG[id];
      if (!entry) continue;
      const modelPath = join(dir, `${id}.onnx`);
      const configPath = join(dir, `${id}.onnx.json`);
      if (!existsSync(modelPath)) {
        await download(entry.model, modelPath);
        logs.push(`Downloaded model ${id}`);
      } else {
        logs.push(`Model already present ${id}`);
      }
      if (!existsSync(configPath)) {
        await download(entry.config, configPath);
        logs.push(`Downloaded config ${id}`);
      }
      installed.push(id);
    }

    return NextResponse.json({
      ok: Boolean(piperBin),
      piperBin,
      installed,
      modelsDir: dir,
      logs,
      hint: piperBin
        ? 'Piper is ready. Press Play in classroom — Malayalam uses Meera, English uses Lessac.'
        : 'Voice models may be installed but piper.exe is missing. Click Install again or set PIPER_BIN to the full path of piper.exe.',
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
