'use client';

import { EDGE_MALAYALAM_VOICES } from '@/lib/ai-guru/tts/provider-order';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, HardDrive, Mic2, CheckCircle2, ExternalLink, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { AiGuruTopNav } from '@/components/ai-guru/AiGuruTopNav';
import { RasaVoiceSetup } from '@/components/ai-guru/RasaVoiceSetup';

type LocalStatus = {
  ok: boolean;
  piperBin?: string | null;
  models?: Array<{ id: string; language: string; path: string; present: boolean }>;
  error?: string;
};

const NVDA_ADDON = {
  name: 'Hear2Read NG (Indic Speech Synthesizer)',
  version: '2.0.8',
  desc: 'Free NVDA add-on with natural Malayalam + English (Indian accent) and other Indic languages. Built on Piper neural TTS. Runs fully offline on your PC for screen-reader use.',
  download: 'https://nvda-addons.org/files/get.php?file=hear2read',
  site: 'https://hear2read.org/NVDA_Addon',
  github: 'https://github.com/Hear2Read/hear2read-ng-nvda',
  store: 'https://addonstore.nvaccess.org/',
  languages: 'Malayalam, English (Indian accent), Hindi, Tamil, Telugu, Kannada, Bengali, Gujarati, Assamese, Nepali, Odia, Punjabi',
};

const PIPER_VOICES = [
  {
    id: 'ml_IN-meera-medium',
    language: 'Malayalam (female · Meera)',
    model: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ml/ml_IN/meera/medium/ml_IN-meera-medium.onnx',
    config: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ml/ml_IN/meera/medium/ml_IN-meera-medium.onnx.json',
  },
  {
    id: 'ml_IN-arjun-medium',
    language: 'Malayalam (male · Arjun)',
    model: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ml/ml_IN/arjun/medium/ml_IN-arjun-medium.onnx',
    config: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ml/ml_IN/arjun/medium/ml_IN-arjun-medium.onnx.json',
  },
  {
    id: 'en_US-lessac-medium',
    language: 'English US (female · Lessac)',
    model: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
    config: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json',
  },
  {
    id: 'en_GB-alan-medium',
    language: 'English GB (male · Alan)',
    model: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium/en_GB-alan-medium.onnx',
    config: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json',
  },
];

export default function LocalTTSPage() {
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [preferred, setPreferred] = useState<'local-piper' | 'edge' | 'auto'>('auto');
  const [mlVoice, setMlVoice] = useState<string>(EDGE_MALAYALAM_VOICES[0]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/ai-guru/local-tts/status');
      const j = await r.json();
      setStatus(j);
    } catch (e) {
      setStatus({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    void refresh();
    try {
      const v = localStorage.getItem('ai-guru-tts-preferred');
      if (v === 'local-piper' || v === 'edge' || v === 'auto') setPreferred(v);
      const mv = localStorage.getItem('ai-guru-edge-ml-voice');
      if (mv && (EDGE_MALAYALAM_VOICES as readonly string[]).includes(mv)) setMlVoice(mv);
    } catch { /* ignore */ }
  }, [refresh]);

  function savePreferred(v: 'local-piper' | 'edge' | 'auto') {
    setPreferred(v);
    try { localStorage.setItem('ai-guru-tts-preferred', v); } catch { /* ignore */ }
    setMsg(`Classroom voice preference saved: ${v}`);
  }

  function saveMlVoice(v: string) {
    setMlVoice(v);
    try { localStorage.setItem('ai-guru-edge-ml-voice', v); } catch { /* ignore */ }
    setMsg(`Malayalam Edge voice saved: ${v}`);
  }

  async function installVoice(id: string) {
    setBusy(true);
    setMsg(`Downloading ${id} + ensuring Piper binary…`);
    try {
      const r = await fetch('/api/ai-guru/local-tts/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voiceId: id, ensureBinary: true }),
      });
      const j = await r.json();
      if (!r.ok || j.ok === false) throw new Error(j.error || 'Install failed');
      setMsg([`Installed ${id}`, ...(j.logs || [])].join(' · '));
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function installAllAuto() {
    setBusy(true);
    setMsg('Automatic setup: downloading Piper binary + Malayalam (Meera) + English (Lessac)…');
    try {
      const r = await fetch('/api/ai-guru/local-tts/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ installAll: true, ensureBinary: true }),
      });
      const j = await r.json();
      if (!r.ok || j.ok === false) throw new Error(j.error || 'Install failed');
      setMsg(`Done. ${(j.logs || []).join(' · ')} ${j.hint || ''}`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const readyCount = status?.models?.filter(m => m.present).length ?? 0;

  return (
    <main className="min-h-screen bg-[#070a0f] text-white p-0" style={{ fontFamily: 'Noto Sans, Chilanka, Noto Sans Malayalam, Nirmala UI, sans-serif' }}>
      <AiGuruTopNav activeLabel="Local TTS" />
      <div className="p-5">
      <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-white/10 pb-5">
        <div>
          <Link href="/ai-guru/settings/gemini" className="text-xs text-white/45">
            <ArrowLeft className="mr-1 inline" size={14} /> Your AI keys
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Settings · Local TTS (Malayalam & English)</h1>
          <p className="mt-1 text-sm text-white/45">
            Offline classroom voice via Piper · same family as the Hear2Read NG NVDA add-on.
          </p>
        </div>
        <HardDrive className="text-cyan-300" size={28} />
      </header>

      <section className="mx-auto max-w-5xl space-y-6 py-8">
        {/* V51.9.160: the downloadable on-device Malayalam voice */}
        <RasaVoiceSetup />
        {/* Preference */}
        <div className="rounded-2xl border border-white/10 bg-[#10141b] p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Volume2 className="text-cyan-300" size={18} /> Classroom voice preference
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ['auto', 'Auto (Edge → Local Piper → others)'],
              ['local-piper', 'Local Piper first (then Edge)'],
              ['edge', 'Edge first (then Piper)'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => savePreferred(id)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  preferred === id
                    ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100'
                    : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {msg ? <p className="mt-3 text-xs text-cyan-100/80">{msg}</p> : null}
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="mb-2 text-xs font-semibold text-white/70">Malayalam Edge voice</div>
            <div className="flex flex-wrap gap-2">
              {([
                ['ml-IN-SobhanaNeural', 'Sobhana (female)'],
                ['ml-IN-MidhunNeural', 'Midhun (male)'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => saveMlVoice(id)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    mlVoice === id
                      ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100'
                      : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* One-click auto setup */}
        <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5">
          <div className="text-sm font-semibold text-cyan-50">Automatic offline voice setup</div>
          <p className="mt-2 text-xs leading-5 text-white/60">
            One click downloads the Piper engine for this machine and the Malayalam + English voice models.
            No GitHub account needed — AI Guru handles it on the server.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void installAllAuto()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-black hover:bg-cyan-300 disabled:opacity-50"
          >
            {busy ? 'Installing…' : 'Install Piper + Malayalam + English now'}
          </button>
          {msg ? <p className="mt-3 text-xs text-cyan-100/90 whitespace-pre-wrap">{msg}</p> : null}
        </div>

        {/* Status */}
        <div className={`rounded-2xl border p-4 text-sm ${readyCount > 0 ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-100' : 'border-amber-300/20 bg-amber-300/5 text-amber-100'}`}>
          {readyCount > 0 ? (
            <><CheckCircle2 className="mr-2 inline" size={16} />Local Piper ready — {readyCount} voice model(s) installed. Classroom can speak offline.</>
          ) : (
            <>No local voice models yet. Download Malayalam / English models below (or point <code className="text-white/80">PIPER_BIN</code> + models on the server).</>
          )}
          {status?.piperBin ? <div className="mt-1 text-xs opacity-80">Piper binary: {status.piperBin}</div> : null}
          {status?.error ? <div className="mt-1 text-xs text-rose-200">{status.error}</div> : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_.9fr]">
          {/* Piper models for the app */}
          <div className="rounded-2xl border border-white/10 bg-[#10141b] p-6">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Mic2 className="text-cyan-300" size={18} /> Piper models for AI Guru classroom
            </div>
            <p className="mb-4 text-xs text-white/45">
              These ONNX voices run on the server (same neural family as Hear2Read NG). Download installs into the app data folder and enables offline teaching when Edge TTS returns 502.
            </p>
            <ul className="space-y-3">
              {PIPER_VOICES.map(v => {
                const present = status?.models?.some(m => m.id === v.id && m.present);
                return (
                  <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{v.language}</div>
                      <div className="truncate text-[10px] text-white/35">{v.id}</div>
                    </div>
                    {present ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] text-emerald-200">Installed</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void installVoice(v.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-500/90 px-3 py-1.5 text-[11px] font-semibold text-black disabled:opacity-50"
                      >
                        <Download size={12} /> Install
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[10px] leading-4 text-white/35">
              Source: Hugging Face <code>rhasspy/piper-voices</code> (MIT). Models are downloaded once and cached under the server data directory.
            </p>
          </div>

          {/* NVDA Hear2Read add-on info */}
          <aside className="rounded-2xl border border-white/10 bg-[#10141b] p-6">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Download className="text-violet-300" size={18} /> NVDA add-on (desktop screen reader)
            </div>
            <h2 className="mt-2 text-base font-semibold text-white">{NVDA_ADDON.name}</h2>
            <p className="mt-1 text-[11px] text-white/40">v{NVDA_ADDON.version} · free · offline</p>
            <p className="mt-3 text-sm leading-5 text-white/60">{NVDA_ADDON.desc}</p>
            <p className="mt-3 text-xs text-white/45">
              <b className="text-white/70">Languages:</b> {NVDA_ADDON.languages}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={NVDA_ADDON.download}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
              >
                <Download size={16} /> Download Hear2Read NG 2.0.8
              </a>
              <a href={NVDA_ADDON.site} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-200/80 hover:text-cyan-100">
                hear2read.org/NVDA_Addon <ExternalLink size={12} />
              </a>
              <a href={NVDA_ADDON.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70">
                GitHub · hear2read-ng-nvda <ExternalLink size={12} />
              </a>
              <a href={NVDA_ADDON.store} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70">
                Or install from NVDA Add-on Store (search “hear2”) <ExternalLink size={12} />
              </a>
            </div>
            <ol className="mt-5 space-y-2 text-xs leading-5 text-white/50">
              <li><b className="text-white/75">1.</b> Download the <code>.nvda-addon</code> and open it with NVDA.</li>
              <li><b className="text-white/75">2.</b> Restart NVDA → open Hear2Read Voice Manager.</li>
              <li><b className="text-white/75">3.</b> Install Malayalam + English voices.</li>
              <li><b className="text-white/75">4.</b> This is for the screen reader. Classroom teaching uses the Piper models on the left.</li>
            </ol>
          </aside>
        </div>

        <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-4 text-xs leading-5 text-cyan-100/90">
          <b>Why two things?</b> The NVDA Hear2Read add-on gives offline Malayalam/English speech for accessibility on Windows.
          AI Guru classroom needs its own server-side Piper models so Play ▶ can narrate lessons even when Edge TTS returns 502.
          Both use the same neural TTS family (Piper).
        </div>
      </section>
      </div>
    </main>
  );
}
