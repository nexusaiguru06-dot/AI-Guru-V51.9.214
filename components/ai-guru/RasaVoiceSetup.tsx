'use client';

/**
 * V51.9.160 — Settings card: download the on-device Malayalam voice (AI4Bharat Rasa) to this phone or computer,
 * test it, switch it on or off, choose its speaking style, or remove it. Optional for every student.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Trash2 } from 'lucide-react';
import { RASA_STYLES, RASA_STYLE_NAME, rasaText, type RasaStyle } from '@/lib/ai-guru/tts/rasa-core';
import { downloadRasaVoice, rasaDiagnostics, rasaDownloaded, rasaStyle, rasaVoiceOn, RASA_APPROX_MB, removeRasaVoice, setRasaStyle, setRasaVoiceOn, synthRasa, type DownloadProgress } from '@/lib/ai-guru/tts/rasa-voice';

const SAMPLES = [
  'നമസ്കാരം കുട്ടികളേ, ഇന്ന് നമുക്ക് ഭിന്നസംഖ്യകൾ പഠിക്കാം.',
  '2x+y=25, x=?',
  'ഒരു ത്രികോണത്തിന്റെ മൂന്ന് കോണുകളുടെ തുക 180 ഡിഗ്രി ആണ്.',
];
const mb = (n: number) => (n / 1048576).toFixed(0);
/** How long something took (ms), for the speed line under Test. */
async function timed<T>(f: () => Promise<T>): Promise<[T, number]> { const t0 = performance.now(); const r = await f(); return [r, performance.now() - t0]; }

export function RasaVoiceSetup() {
  const [have, setHave] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [style, setStyle] = useState<RasaStyle>('book');
  const [prog, setProg] = useState<DownloadProgress | null>(null);
  const [busy, setBusy] = useState<'' | 'download' | 'test'>('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [said, setSaid] = useState('');
  const [info, setInfo] = useState('');
  const abort = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(async () => { setHave(await rasaDownloaded()); setOn(rasaVoiceOn()); setStyle(rasaStyle()); }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
    const f = () => void refresh();
    window.addEventListener('ai-guru-rasa-changed', f);
    return () => { window.removeEventListener('ai-guru-rasa-changed', f); abort.current?.abort(); audio.current?.pause(); };
  }, [refresh]);

  const download = async () => {
    setBusy('download'); setErr(''); setMsg('');
    abort.current = new AbortController();
    try {
      await downloadRasaVoice(setProg, abort.current.signal);
      setMsg('The Malayalam voice is on this device now and switched on. Press a ▶ Test button to hear it.');
      await refresh();
    } catch (e) { setErr((e as Error)?.name === 'AbortError' ? 'Download stopped.' : e instanceof Error ? e.message : String(e)); }
    finally { setBusy(''); setProg(null); }
  };
  const test = async (text: string) => {
    setBusy('test'); setErr(''); setSaid(''); setInfo('');
    try {
      const [r, ms] = await timed(() => synthRasa(text, { style }));
      setSaid(r.text);
      setInfo(`Made ${(r.durationMs / 1000).toFixed(1)} s of speech in ${(ms / 1000).toFixed(1)} s on this device${ms > r.durationMs ? ' (slower than speaking: long lessons may pause between sentences)' : ''}.`);
      audio.current?.pause();
      audio.current = new Audio(URL.createObjectURL(new Blob([r.wav as BlobPart], { type: 'audio/wav' })));
      await audio.current.play().catch(() => undefined);
    } catch (e) {
      let d = '';
      try { d = await rasaDiagnostics(); } catch { /* engine did not start */ }
      setErr(`${e instanceof Error ? e.message : String(e)}${d ? ` — model: ${d}` : ''}`);
    } finally { setBusy(''); }
  };

  const pct = prog && prog.total ? Math.round((prog.loaded / prog.total) * 100) : null;
  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-[#10141b] p-5" data-rasa-setup>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Malayalam voice on this device (AI4Bharat Rasa)</h2>
        {have && <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${on ? 'bg-emerald-300/15 text-emerald-100' : 'bg-white/10 text-white/60'}`}>{on ? <><CheckCircle2 className="mr-1 inline" size={13} />In use for Malayalam</> : 'Downloaded, switched off'}</span>}
      </div>
      <p className="mt-2 text-sm leading-6 text-white/60">
        A natural Malayalam teacher’s voice that reads Malayalam letters directly, so it has no Tamil-like accent. It is downloaded once (about {RASA_APPROX_MB} MB, use Wi-Fi), kept in this browser, and works without the internet afterwards.
        When it is on, the classroom, reels and “Ask my paper” use it first for Malayalam; English sentences keep the English voice. Optional: download it only if you want it.
      </p>

      {have === false && (
        <div className="mt-3 space-y-2">
          <button type="button" disabled={!!busy} onClick={() => void download()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50" data-rasa-download><Download size={15} />{busy === 'download' ? 'Downloading…' : `Download the Malayalam voice (~${RASA_APPROX_MB} MB)`}</button>
          {prog && (
            <div className="space-y-1" data-rasa-progress>
              <div className="h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-emerald-300 transition-all" style={{ width: `${prog.file === 'tokens' ? 2 : pct ?? 5}%` }} /></div>
              <p className="text-xs text-white/50">{prog.file === 'tokens' ? 'Getting the letter list…' : `Voice file: ${mb(prog.loaded)}${prog.total ? ` of ${mb(prog.total)}` : ''} MB`} <button type="button" onClick={() => abort.current?.abort()} className="ml-2 underline">Stop</button></p>
            </div>
          )}
        </div>
      )}

      {have && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={on} onChange={(e) => { setRasaVoiceOn(e.target.checked); setOn(e.target.checked); }} data-rasa-on /> Use it for Malayalam</label>
            <label className="text-sm">Style
              <select value={style} onChange={(e) => { const s = e.target.value as RasaStyle; setRasaStyle(s); setStyle(s); }} className="ml-2 rounded-lg border border-white/10 bg-[#0b1426] px-2 py-1 text-sm" data-rasa-style>
                {(Object.keys(RASA_STYLES) as RasaStyle[]).map((s) => <option key={s} value={s}>{RASA_STYLE_NAME[s]}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void removeRasaVoice().then(refresh).then(() => setMsg('The Malayalam voice was removed from this device.'))} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-300/20 px-3 py-1.5 text-xs text-red-200"><Trash2 size={13} /> Remove</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s, i) => (
              <button key={i} type="button" disabled={!!busy} onClick={() => void test(s)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-40" data-rasa-test={i}>{busy === 'test' ? 'Speaking…' : `▶ Test ${i + 1}: ${s.length > 28 ? `${s.slice(0, 28)}…` : s}`}</button>
            ))}
          </div>
          {said && <p className="rounded-lg bg-black/30 p-2 text-sm text-white/80" data-rasa-said><span className="text-white/40">It read: </span>{said}</p>}
          {info && <p className="text-xs text-white/50">{info}</p>}
          <p className="text-xs text-white/40">Example: “2x+y=25, x=?” is read as “{rasaText('2x+y=25, x=?').text}”.</p>
        </div>
      )}

      {err && <div role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-950/25 p-3 text-sm text-red-100">{err}</div>}
      {!err && msg && <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm text-emerald-100">{msg}</div>}
      <p className="mt-3 text-[11px] leading-5 text-white/35">
        Voice model: <a className="underline" href="https://huggingface.co/ai4bharat/vits_rasa_13" target="_blank" rel="noreferrer">vits_rasa_13</a> by AI4Bharat (IIT Madras), CC-BY-4.0, one Malayalam speaker; ONNX version by <a className="underline" href="https://huggingface.co/MatiasLin/sherpa-onnx-vits-rasa-13" target="_blank" rel="noreferrer">MatiasLin</a>. Runs with ONNX Runtime Web on this device.
      </p>
    </div>
  );
}
