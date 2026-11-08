'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { getFallbackProviders, getProvider, maskProviderKey, providerStatus, removeProviderKey, validateFallbackProvider, type FallbackProvider } from '@/lib/ai-guru/byok-providers';

/** V51.9.198: `only` limits the slots (students see OpenAI only, beside Gemini and OpenRouter). */
export function FallbackProviderSetup({ only }: { only?: FallbackProvider[] } = {}) {
  const providers = getFallbackProviders();
  const [states, setStates] = useState<Record<string, any>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<FallbackProvider | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const refresh = () => setStates({ openai: getProvider('openai'), agnes: getProvider('agnes'), sarvam: getProvider('sarvam') });
  useEffect(() => { refresh(); const f=()=>refresh(); window.addEventListener('ai-guru-byok-providers-changed',f); return()=>window.removeEventListener('ai-guru-byok-providers-changed',f); }, []);

  async function save(provider: FallbackProvider) {
    const key = drafts[provider]?.trim(); if (!key) return;
    setBusy(provider); setError(''); setMessage('');
    try {
      const result = await validateFallbackProvider(provider, key);
      setDrafts(v=>({...v,[provider]:''})); refresh();
      setMessage(`${providers[provider].label} connected and tested successfully (${result.model}). ${provider === 'openai' ? 'It will be used first for study-material generation.' : 'It will be used as a fallback provider.'}`);
    } catch (e) { refresh(); setError(e instanceof Error ? e.message : `${providers[provider].label} validation failed.`); }
    finally { setBusy(null); }
  }
  return <section className="mt-5 rounded-2xl border border-white/10 bg-[#10141b] p-6">
    <div>
      <h2 className="text-xl font-semibold">{only?.length===1&&only[0]==='openai'?'OpenAI':'Fallback AI providers'}</h2>
      <p className="mt-1 text-sm leading-6 text-white/50">{only?.length===1&&only[0]==='openai'?'A paid OpenAI key (optional). When it is saved, AI Guru uses it first for study materials, and Gemini or OpenRouter if it fails.':'When an OpenAI key is configured, AI Guru uses it first for study materials; if it fails, it tries Gemini, Agnes AI, then Sarvam AI. Without an OpenAI key, Gemini remains first. Provider keys stay in this browser and are sent only through a temporary provider proxy, not saved to the AI Guru database.'}</p>
    </div>
    <div className="mt-5 space-y-4">
      {(['agnes','sarvam','openai'] as FallbackProvider[]).filter(p=>!only||only.includes(p)).map(provider=>{
        const cfg=providers[provider]; const state=states[provider]; const status=providerStatus(provider);
        return <div key={provider} className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="font-semibold">{cfg.label}</div><div className="mt-1 text-xs text-white/40">Model: <code>{cfg.model}</code> · fallback position {provider==='openai'?1:provider==='agnes'?2:3}</div></div>
            {state && <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${status==='ready'?'bg-emerald-300/15 text-emerald-100':status==='invalid'?'bg-red-300/15 text-red-100':'bg-amber-300/15 text-amber-100'}`}>{status==='ready'?<><CheckCircle2 className="mr-1 inline" size={13}/>Active</>:status==='invalid'?'Invalid':'Temporarily unavailable'}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {state ? <>
              <input readOnly value={maskProviderKey(state.key)} className="min-w-[260px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white/60" />
              <button type="button" onClick={()=>{removeProviderKey(provider);refresh();setMessage(`${cfg.label} fallback key removed.`)}} className="inline-flex items-center gap-1 rounded-lg border border-red-300/20 px-3 py-2 text-xs text-red-200"><Trash2 size={13}/> Delete</button>
            </> : <>
              <input type="password" autoComplete="off" spellCheck={false} value={drafts[provider]||''} onChange={e=>setDrafts(v=>({...v,[provider]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')void save(provider)}} placeholder={`Paste your ${cfg.label} API key here`} className="min-w-[260px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm outline-none focus:border-cyan-300" />
              <button type="button" disabled={!drafts[provider]?.trim()||busy!==null} onClick={()=>void save(provider)} className="rounded-lg bg-cyan-300 px-4 py-2 text-xs font-semibold text-black disabled:opacity-40">{busy===provider?'Testing…':'Save & test'}</button>
              {provider==='openai'&&<a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/20 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-300/10" data-get-openai>Get key ↗</a>/* V51.9.199: beside its paste box */}
            </>}
          </div>
          <p className="mt-2 text-xs text-white/35">API endpoint: <code>{cfg.base}/chat/completions</code></p>
        </div>
      })}
    </div>
    {error&&<div role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-950/25 p-3 text-sm text-red-100">{error}</div>}
    {!error&&message&&<div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm text-emerald-100"><CheckCircle2 className="mr-2 inline" size={15}/>{message}</div>}
    <p className="mt-4 text-xs leading-5 text-white/35">Textbook chapter indexing and study-material generation use the configured provider chain. OpenAI API requests are billed to your OpenAI API account. Reference-video watching remains a Gemini-specific capability; AI Guru uses its local Visual-DNA library when OpenAI or another fallback provider is selected.</p>
  </section>;
}
