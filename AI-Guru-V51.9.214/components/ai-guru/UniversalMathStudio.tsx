'use client';

import { useEffect, useMemo, useState } from 'react';
import type { UniversalMathScene, MathVisualNode } from '@/lib/ai-guru/math/universal/types';
import { createRuntimeSnapshot, sceneDurationMs, type RuntimeNodeState } from '@/lib/ai-guru/math/animation/runtime';
import { REFERENCE_STYLE_LIBRARY } from '@/lib/ai-guru/math/universal/style-library';
import { MATH_DOMAIN_PROFILES } from '@/lib/ai-guru/math/domains';

function palette(styleId?: string) {
  switch(styleId) {
    case 'geometry-area-derivation': return { ink:'#e8f4f8', accent:'#7dd3fc', fill:'rgba(134,239,172,.20)', emphasis:'#facc15' };
    case 'geometry-proof-construction': return { ink:'#e8f4f8', accent:'#93c5fd', fill:'rgba(147,197,253,.16)', emphasis:'#facc15' };
    case 'trigonometry-unit-circle-reference': return { ink:'#e8f4f8', accent:'#67e8f9', fill:'rgba(103,232,249,.14)', emphasis:'#facc15' };
    case 'calculus-riemann-sum-area-reference': return { ink:'#e8f4f8', accent:'#60a5fa', fill:'rgba(96,165,250,.18)', emphasis:'#facc15' };
    case 'calculus-slope-explorer-reference': return { ink:'#e8f4f8', accent:'#67e8f9', fill:'rgba(103,232,249,.14)', emphasis:'#fbbf24' };
    default: return { ink:'#e6faff', accent:'#67e8f9', fill:'rgba(103,232,249,.12)', emphasis:'#fbbf24' };
  }
}

function Node({n, active, styleId}:{n:MathVisualNode|RuntimeNodeState; active?:boolean; styleId?:string}){
  const p=palette(styleId);
  const stroke=(n as RuntimeNodeState).highlighted?p.emphasis:p.accent;
  const common={style:{opacity:(n as RuntimeNodeState).opacity ?? (active?1:.96),transition:'opacity 180ms ease, transform 180ms ease',transformOrigin:`${n.x??0}px ${n.y??0}px`,transform:active?'scale(1.015)':'scale(1)'}};
  if(n.kind==='highlight') return <rect {...common} x={n.x??0} y={n.y??0} width={n.width??180} height={n.height??70} rx={12} fill={p.fill} stroke={p.emphasis} strokeOpacity={0.8} strokeDasharray="8 6"/>;
  if(n.kind==='erase') return null;
  if(n.kind==='transform') return <text {...common} x={n.x??80} y={n.y??100} fontSize={Number(n.style?.fontSize??38)} fill={p.ink} fontFamily="Chilanka, Noto Sans Malayalam, Nirmala UI, sans-serif">{n.latex??n.content??n.to??''}</text>;
  if(n.kind==='latex'||n.kind==='text') return <text {...common} x={n.x??80} y={n.y??100} fontSize={Number(n.style?.fontSize??38)} fill={p.ink} fontFamily={n.kind==='latex'?'serif':'Chilanka, Noto Sans Malayalam, Nirmala UI, sans-serif'}>{n.latex??n.content}</text>;
  if(n.kind==='line'||n.kind==='arrow') {
    const length=Math.hypot((n.endX??0)-(n.startX??0),(n.endY??0)-(n.startY??0));
    return <line {...common} x1={n.startX??n.x??0} y1={n.startY??n.y??0} x2={n.endX??((n.x??0)+(n.width??100))} y2={n.endY??n.y??0} stroke={stroke} strokeWidth={Number(n.style?.strokeWidth??4)} strokeLinecap="round" strokeDasharray={length} strokeDashoffset={active?0:length} style={{...common.style,transition:'stroke-dashoffset 850ms ease, opacity 180ms ease'}}/>;
  }
  if(n.kind==='point') return <circle {...common} cx={n.x??0} cy={n.y??0} r={Number(n.style?.radius??8)} fill={stroke}/>;
  if(n.kind==='shape'){
    const fill=n.style?.fill && n.style.fill!=='none' ? String(n.style.fill) : 'none';
    if(n.shape==='circle') return <ellipse {...common} cx={(n.x??0)+(n.width??100)/2} cy={(n.y??0)+(n.height??100)/2} rx={(n.width??100)/2} ry={(n.height??100)/2} fill={fill} stroke={stroke} strokeWidth={Number(n.style?.strokeWidth??4)}/>;
    if(n.shape==='triangle') return <polygon {...common} points={`${(n.x??0)+(n.width??100)/2},${n.y??0} ${n.x??0},${(n.y??0)+(n.height??100)} ${(n.x??0)+(n.width??100)},${(n.y??0)+(n.height??100)}`} fill={fill} stroke={stroke} strokeWidth={Number(n.style?.strokeWidth??4)}/>;
    return <rect {...common} x={n.x??0} y={n.y??0} width={n.width??100} height={n.height??100} fill={fill} stroke={stroke} strokeWidth={Number(n.style?.strokeWidth??4)}/>;
  }
  if(n.kind==='graph'&&n.graph){
    const xs=n.graph.x, ys=n.graph.y; const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    const x0=n.x??120,y0=n.y??220,w=n.width??760,h=n.height??420;
    const px=(v:number)=>x0+(v-minX)/(maxX-minX||1)*w; const py=(v:number)=>y0+h-(v-minY)/(maxY-minY||1)*h;
    const pts=xs.map((x,i)=>`${px(x)},${py(ys[i])}`).join(' ');
    return <g {...common}><rect x={x0} y={y0} width={w} height={h} fill="none" stroke={p.ink} strokeOpacity=".2"/><line x1={px(0)} y1={y0} x2={px(0)} y2={y0+h} stroke={p.ink} strokeOpacity=".45"/><line x1={x0} y1={py(0)} x2={x0+w} y2={py(0)} stroke={p.ink} strokeOpacity=".45"/><polyline points={pts} fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></g>;
  }
  return null;
}

export default function UniversalMathStudio(){
  const [expression,setExpression]=useState('211 × 3');
  const [grade,setGrade]=useState(12);
  const [scene,setScene]=useState<UniversalMathScene|null>(null);
  const [visible,setVisible]=useState(0);
  const [timeMs,setTimeMs]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [planMode,setPlanMode]=useState<'ai'|'template'>('ai');
  const [preferredStyle,setPreferredStyle]=useState('');
  const [teachingLanguage,setTeachingLanguage]=useState<'english'|'malayalam'>('english');
  const [selectedDomain,setSelectedDomain]=useState('');

  const compile=async()=>{
    setBusy(true);setError('');
    try{
      const endpoint=planMode==='ai'?'/api/ai-guru/math/plan':'/api/ai-guru/math/compile';
      const payload=planMode==='ai'?{question:expression,grade,domain:selectedDomain||undefined,preferredStyle:preferredStyle||undefined,bilingual:false,language:teachingLanguage}:{expression,grade,domain:selectedDomain||undefined,preferredStyle:preferredStyle||undefined,bilingual:false,language:teachingLanguage};
      const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok||!j.ok)throw new Error(j.error||'Compilation failed');
      setScene(j.scene);setVisible(0);setPlaying(false);
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  };

  const compileFallback=async()=>{
    setPlanMode('template');
    setBusy(true);setError('');
    try{const r=await fetch('/api/ai-guru/math/compile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expression,grade,domain:selectedDomain||undefined,preferredStyle:preferredStyle||undefined,bilingual:false,language:teachingLanguage})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Fallback compilation failed');setScene(j.scene);setVisible(0);setPlaying(false);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  };
  useEffect(()=>{if(!playing||!scene)return; const total=sceneDurationMs(scene); const start=performance.now()-timeMs; let raf=0; const tick=(now:number)=>{const next=Math.min(total,now-start);setTimeMs(next);setVisible(scene.events.filter(e=>e.atMs<=next).length);if(next<total) raf=requestAnimationFrame(tick);else setPlaying(false);}; raf=requestAnimationFrame(tick); return()=>cancelAnimationFrame(raf);},[playing,scene]);
  const snapshot=useMemo(()=>scene?createRuntimeSnapshot(scene,timeMs):null,[scene,timeMs]);
  const current=useMemo(()=>snapshot?[...snapshot.nodes.values()]:[],[snapshot]);

  return <section className="min-h-screen bg-[#070a0f] p-4 text-white">
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><div className="text-xs uppercase tracking-[.22em] text-cyan-300/80">AI Guru · Maths</div><h1 className="text-2xl font-semibold">Maths, step by step</h1><p className="mt-1 text-sm text-white/60">Classes 1–12 · type a sum or a question and watch it worked out on the whiteboard</p></div>
        <a href="/ai-guru" className="rounded-xl bg-white/10 px-4 py-2 text-sm">← Back to AI Guru</a>
      </div>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-[#10141b] p-4">
          <label htmlFor="math-question" className="text-xs text-white/60">Your sum or question</label>
          <textarea id="math-question" value={expression} onChange={e=>setExpression(e.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none"/>
          <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs text-white/45">Grade<select value={grade} onChange={e=>setGrade(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-white/10 p-2 text-white"><option value={4}>4</option><option value={8}>8</option><option value={10}>10</option><option value={12}>12</option></select></label><div className="rounded-xl border border-white/10 p-3 text-xs text-white/45">Detected domain<div className="mt-2 text-sm text-cyan-200">{scene?.domain??(selectedDomain||'AI detect')}</div></div></div><label className="mt-3 block text-xs text-white/45">Math branch<div className="mt-1 grid grid-cols-[1fr_auto] gap-2"><select value={selectedDomain} onChange={e=>setSelectedDomain(e.target.value)} className="w-full rounded-lg bg-white/10 p-2 text-white"><option value="">🤖 Auto-detect branch</option>{MATH_DOMAIN_PROFILES.filter(p=>p.id!=='general').map(profile=><option key={profile.id} value={profile.id}>{profile.label}</option>)}</select><button type="button" onClick={()=>setSelectedDomain('')} className="rounded-lg bg-white/10 px-3 text-xs">Auto</button></div></label><label className="mt-3 block text-xs text-white/45">Teaching language<div className="mt-1 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setTeachingLanguage('english')} className={`rounded-lg px-3 py-2 text-sm ${teachingLanguage==='english'?'bg-cyan-300 text-black':'bg-white/10 text-white/70'}`}>English · First pass</button><button type="button" onClick={()=>setTeachingLanguage('malayalam')} className={`rounded-lg px-3 py-2 text-sm ${teachingLanguage==='malayalam'?'bg-cyan-300 text-black':'bg-white/10 text-white/70'}`}>Malayalam · Translation</button></div></label>
          <label className="mt-3 block text-xs text-white/45">Visual teaching style<select value={preferredStyle} onChange={e=>setPreferredStyle(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 p-2 text-white"><option value="">🤖 AI choose for this situation</option>{REFERENCE_STYLE_LIBRARY.map(style=><option key={style.id} value={style.id}>{style.name}</option>)}</select></label><details className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3"><summary className="cursor-pointer text-xs text-cyan-200">Maths covered · {MATH_DOMAIN_PROFILES.length} branches</summary><div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-white/55">{MATH_DOMAIN_PROFILES.filter(p=>p.id!=='general').map(profile=><span key={profile.id} className="rounded bg-white/5 px-2 py-1">{profile.label}</span>)}</div></details>
          <button disabled={busy||!expression.trim()} onClick={()=>{setPlanMode('ai');compile()}} className="mt-3 w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-black">{busy?'Planning…':'✨ Generate AI visual lesson'}</button>
          <button disabled={busy||!expression.trim()} onClick={compileFallback} className="mt-2 w-full rounded-xl bg-white/10 px-4 py-2 text-xs text-white/70">Use deterministic fallback</button>
          <div className="mt-2 text-[11px] text-white/35">AI mode creates a problem-specific visual plan; fallback is only for offline/development use.</div>
          {scene&&<div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>{setTimeMs(0);setVisible(0);setPlaying(true)}} className="rounded-xl bg-white/10 px-3 py-2 text-sm">▶ Play</button><button onClick={()=>{setPlaying(false);setTimeMs(0);setVisible(0)}} className="rounded-xl bg-white/10 px-3 py-2 text-sm">↺ Reset</button></div>}
          {scene&&(scene.visualStyle?.referenceSegmentAsset||scene.visualStyle?.referenceUrls?.length)?<div className="mt-3 overflow-hidden rounded-xl border border-cyan-300/10 bg-black/20"><div className="px-3 pt-2 text-[11px] uppercase tracking-wider text-cyan-200/60">Reference visual style</div>{scene.visualStyle.referenceSegmentId&&<div className="px-3 pt-1 text-xs text-cyan-100">Selected concept segment: <span className="font-medium">{scene.visualStyle.referenceSegmentId.replace(/^area-formula-/,'').replaceAll('-',' ')}</span></div>}<video className="mt-2 aspect-video w-full object-contain bg-black" src={scene.visualStyle.referenceSegmentAsset??scene.visualStyle.referenceUrls?.[0]} controls muted playsInline preload="metadata"/><div className="px-3 py-2 text-[11px] text-white/40">Reference segment teaches the visual grammar only — mathematical content is generated and verified by AI Guru.</div></div>:null}{scene&&<div className="mt-4 space-y-2 text-xs text-white/55"><div>Teaching pass: <span className="text-cyan-200">{scene.teachingLanguage==='english'?'English — first explanation':'Malayalam — translation class'}</span></div><div>Grade band: <span className="text-white/80">{scene.gradeBand}</span></div><div>Verified: <span className={scene.verified?'text-emerald-300':'text-amber-300'}>{scene.verified?'yes':'needs review'}</span></div><div>Visual nodes: {scene.nodes.length}</div><div>Selected style: <span className="text-cyan-200">{scene.visualStyle?.name??'AI selection pending'}</span></div>{scene.visualStyle?.referenceSegmentId?<div>Reference segment: <span className="text-cyan-200">{scene.visualStyle.referenceSegmentId}</span></div>:null}<div>Timed events: {scene.events.length}</div>{scene.verification?.steps?.length?<div>Verified steps: {scene.verification.steps.length}</div>:null}</div>}
          {error&&<div className="mt-3 rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-xs text-red-200">{error}</div>}
        </aside>
        <div className="min-h-[650px] rounded-2xl border border-white/10 bg-[#0b1017] p-3"><div className="mb-2 flex items-center justify-between text-xs text-white/40"><span>{scene?scene.title:'Compile a problem to begin'}</span><span>{scene?`${Math.round(timeMs/100)/10}s · ${scene.events.length} events · ${scene.visualStyle?.name??'AI Guru Standard'}`:''}</span></div><div className="flex h-[610px] items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-[#080c12]"><svg viewBox="0 0 1000 700" className="h-full w-full text-cyan-200">{snapshot&&<g transform={`translate(${500-snapshot.camera.x*snapshot.camera.scale} ${350-snapshot.camera.y*snapshot.camera.scale}) scale(${snapshot.camera.scale}) translate(-500 -350)`}>{current.map((n,i)=><Node key={n.id} n={n} active={snapshot.activeEventIds.length>0 && i===Math.max(0,current.length-1)} styleId={scene?.visualStyle?.id}/>)}</g>}</svg>{!scene&&<div className="absolute text-white/30">Your animated mathematical explanation will appear here.</div>}</div></div>
      </div>
    </div>
  </section>;
}
