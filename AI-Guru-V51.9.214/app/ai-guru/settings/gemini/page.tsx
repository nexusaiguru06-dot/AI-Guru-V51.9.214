'use client';
import { KeyTutorialVideo } from '@/components/ai-guru/start/KeyTutorialVideo';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { AiGuruTopNav } from '@/components/ai-guru/AiGuruTopNav';
import { GeminiKeySetup } from '@/components/ai-guru/GeminiKeySetup';
import { FallbackProviderSetup } from '@/components/ai-guru/FallbackProviderSetup';
import { OpenRouterSetup } from '@/components/ai-guru/OpenRouterSetup';
import { studentKey, orderedUsableKeys } from '@/lib/student-key';
import { openRouter } from '@/lib/ai-guru/openrouter';
import { mayHaveSession } from '@/lib/ai-guru/net/session-hint';
import { ApiKeyExplainer } from '@/components/ai-guru/start/ApiKeyExplainer';

export default function GeminiBYOKPage(){
  const [usable,setUsable]=useState(0);
  const [saved,setSaved]=useState(0);
  // V51.9.164: the OpenRouter key counts as active too (it was saved but the banner only looked at Gemini keys)
  const [orUsable,setOrUsable]=useState(0),[orSaved,setOrSaved]=useState(0);
  // V51.9.198: students see three key slots (Gemini, OpenRouter, OpenAI); the office also sees the other providers and voices
  const [office,setOffice]=useState(false);
  useEffect(()=>{setOffice(mayHaveSession('admin'));},[]);

  const sync=useCallback(()=>{setUsable(orderedUsableKeys().length);setSaved(studentKey.getAll().length);setOrUsable(openRouter.usable().length);setOrSaved(openRouter.getAll().length);},[]);
  useEffect(()=>{sync();const evs=['gemini-key-pool-changed','ai-guru-openrouter-changed'];evs.forEach(e=>window.addEventListener(e,sync));return()=>evs.forEach(e=>window.removeEventListener(e,sync));},[sync]);

  return <main className="min-h-screen bg-[#070a0f] text-white p-0" style={{fontFamily:'Noto Sans, Chilanka, Noto Sans Malayalam, Nirmala UI, sans-serif'}}>
    <AiGuruTopNav activeLabel="Settings" />
    <div className="p-5"><header className="mx-auto flex max-w-5xl items-center justify-between border-b border-white/10 pb-5">
      <div>
        <Link href="/ai-guru/start/student" className="text-xs text-white/45" data-back><ArrowLeft className="mr-1 inline" size={14}/> Back</Link>
        <h1 className="mt-2 text-2xl font-semibold">Settings · Your AI keys</h1>
        <p className="mt-1 text-sm text-white/45">Your own free Gemini key (or another AI key) lets AI Guru clear your doubts without limits.</p>
        {office&&<div className="mt-3 flex flex-wrap gap-2">
          <Link href="/ai-guru/student/library" className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-400/20">
            📥 Download or create study materials
          </Link>
          <Link href="/ai-guru/settings/local-tts" className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-400/20">
            Local TTS · Malayalam &amp; English (Piper)
          </Link>
          <a href="https://github.com/rhasspy/piper/releases" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:text-white">
            Download Piper binary ↗
          </a>
          <a href="https://nvda-addons.org/files/get.php?file=hear2read" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-500/20">
            Hear2Read NG (NVDA) ↗
          </a>
        </div>}
      </div>
      <KeyRound className="text-cyan-300" size={28}/>
    </header>

    <section className="mx-auto max-w-5xl py-8">
      <ApiKeyExplainer/>
      <div className={`mb-5 rounded-2xl border p-4 text-sm ${usable||orUsable?'border-emerald-300/20 bg-emerald-300/5 text-emerald-100':'border-amber-300/20 bg-amber-300/5 text-amber-100'}`}>
        {usable
          ? <><Sparkles className="mr-2 inline" size={16}/>Your Gemini keys are active — {usable} of {saved} saved key{saved===1?'':'s'} usable right now. Your doubts are unlimited, and AI Guru rotates between these keys automatically.{orUsable>0&&<> <b>✓ OpenRouter is active too</b> — it answers when the Gemini keys cannot.</>}</>
          : orUsable
            ? <><Sparkles className="mr-2 inline" size={16}/><b>✓ OpenRouter is active</b> — {orUsable} of {orSaved} saved key{orSaved===1?'':'s'} ready. Typed doubts use OpenRouter’s free models. Add a free Gemini key too for live camera &amp; voice doubts (OpenRouter cannot do live talk) and as a faster first choice.</>
            : orSaved
              ? <>Your OpenRouter key is saved but not usable right now (see its state below: not valid, or today’s free limit used up). Add a Gemini key, or check the OpenRouter key.</>
              : <>No usable Gemini or OpenRouter key yet. Paste a free Gemini key below for unlimited doubt clearing (without one you get a few free minutes a day).</>}
      </div>


      <div className="grid gap-5 lg:grid-cols-[1.35fr_.8fr]">
        <div>
          <KeyTutorialVideo/>
          <GeminiKeySetup onKeyChanged={sync} slots={office?undefined:1}/>
          <OpenRouterSetup/>
          <FallbackProviderSetup only={office?undefined:['openai']}/>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-[#10141b] p-6">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="text-cyan-300" size={18}/> How AI Guru uses your keys</div>
          <ol className="mt-4 space-y-4 text-sm text-white/60">
            <li><b className="text-white">1. Save once.</b><br/>Keys stay in this browser. They are never written to the AI Guru database.</li>
            <li><b className="text-white">2. Ask doubts.</b><br/>Camera, voice and typed doubts run on your key, with no daily limit.</li>
            <li><b className="text-white">3. Study materials are not made here.</b><br/>AI Guru’s teachers prepare them; you download them from My Textbooks.</li>
            <li><b className="text-white">4. Automatic rotation.</b><br/>A key that hits its daily quota is benched until tomorrow and generation continues on the next key — long batch runs no longer stop at the first quota error.</li>
            <li><b className="text-white">5. Free minutes without a key.</b><br/>A few doubt minutes a day are free, set by the office.</li>
          </ol>
          <div className="mt-5 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3 text-xs leading-5 text-cyan-100">Google controls API-key permissions, quotas and billing for your own project. Adding more keys raises the free daily request ceiling.</div>
        </aside>
      </div>
    </section>
  </div></main>;
}
