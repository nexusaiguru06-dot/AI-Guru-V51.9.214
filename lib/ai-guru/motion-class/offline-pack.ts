/**
 * Offline class pack (V51.9.50): one class as ONE self-contained .html file a student can keep on a
 * low-end phone and open with no internet — share it over WhatsApp / Bluetooth, open it in Chrome.
 *
 * Inside the file: the class video (a small MP4 drawn by the same engine, voice and captions included),
 * the step list and transcript, the questions inside the animation (tap targets already in video
 * pixels) and a small player: play / pause, speed, click any step, pause-and-ask questions, and
 * progress saved on the phone.
 *
 * `offlinePackData` and `offlinePackHtml` are pure (tested in Node); `exportOfflinePack` runs in the
 * browser and encodes the video.
 */

import type { MotionReel } from '../reels/motion/reel';
import type { VoiceClips } from '../reels/motion/audio';
import { FORMAT_SIZE, type ReelFormat } from '../reels/motion/draw';
import { frameTargets, pickBi, type FrameTarget, type PlacedQuestion } from './interactive/questions';

export const OFFLINE_PACK_VERSION = 1;

export interface OfflinePackMeta {
  title: string;
  book?: string;
  chapter?: string;
  section?: string;
  /** Shown at the bottom ("Made with AI Guru"). */
  credit?: string;
}

export interface OfflineQuestion {
  id: string;
  atMs: number;
  step: number;
  lang: 'en' | 'ml';
  kind: 'tap' | 'choice';
  prompt: string;
  explain: string;
  options?: Array<{ id: string; text: string; correct: boolean }>;
  /** Tap targets in video pixels. */
  targets?: FrameTarget[];
}

export interface OfflinePackData {
  v: number;
  id: string;
  meta: OfflinePackMeta;
  width: number;
  height: number;
  durationMs: number;
  steps: Array<{ i: number; t0: number; t1: number; text: string; seg: number }>;
  segments: Array<{ label: string; lang: string; phase: string; t0: number; t1: number }>;
  questions: OfflineQuestion[];
  createdAt: string;
}

export interface TimelineForPack {
  reel: MotionReel;
  steps: Array<{ index: number; t0: number; t1: number; text: string; segment: number }>;
  segments: Array<{ label: string; lang: string; phase: string; t0: number; t1: number }>;
}

function hashId(s: string): string {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}

/** Everything the offline player needs, except the video. */
export function offlinePackData(
  tl: TimelineForPack,
  questions: PlacedQuestion[],
  meta: OfflinePackMeta,
  o: { format?: ReelFormat; ctx?: CanvasRenderingContext2D; now?: Date } = {},
): OfflinePackData {
  const format = o.format ?? 'landscape';
  const { width, height } = FORMAT_SIZE[format];
  const qs: OfflineQuestion[] = questions.map((q) => ({
    id: q.id,
    atMs: Math.round(q.atMs),
    step: q.step,
    lang: q.lang,
    kind: q.kind,
    prompt: pickBi(q.prompt, q.lang),
    explain: pickBi(q.explain, q.lang),
    ...(q.options ? { options: q.options.map((x) => ({ id: x.id, text: pickBi(x.text, q.lang), correct: x.correct })) } : {}),
    ...(q.kind === 'tap' && o.ctx ? { targets: frameTargets(q, tl.reel, format, o.ctx).map((t) => ({ ...t, x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.w), h: Math.round(t.h) })) } : {}),
  }));
  // A tap question without targets cannot be asked offline.
  const usable = qs.filter((q) => q.kind !== 'tap' || (q.targets && q.targets.length));
  const steps = tl.steps.map((s) => ({ i: s.index, t0: Math.round(s.t0), t1: Math.round(s.t1), text: s.text, seg: s.segment }));
  return {
    v: OFFLINE_PACK_VERSION,
    id: hashId(`${meta.book ?? ''}|${meta.chapter ?? ''}|${meta.section ?? ''}|${meta.title}|${steps.length}|${Math.round(tl.reel.durationMs)}`),
    meta,
    width,
    height,
    durationMs: Math.round(tl.reel.durationMs),
    steps,
    segments: tl.segments.map((s) => ({ label: s.label, lang: s.lang, phase: s.phase, t0: Math.round(s.t0), t1: Math.round(s.t1) })),
    questions: usable,
    createdAt: (o.now ?? new Date()).toISOString(),
  };
}

/** Video bitrate that keeps the pack phone-sized: about 20 MB of video, between 0.25 and 0.9 Mb/s (a whiteboard compresses well). */
export function packBitrate(durationMs: number, targetBytes = 20_000_000): number {
  const sec = Math.max(1, durationMs / 1000);
  const audio = 96_000;
  const bits = (targetBytes * 8) / sec - audio;
  return Math.round(Math.max(250_000, Math.min(900_000, bits)));
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** JSON that is safe inside <script>: no "</script>", no U+2028/2029. */
export const scriptJson = (x: unknown) => JSON.stringify(x).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** The whole pack as one HTML document (video as base64). */
export function offlinePackHtml(data: OfflinePackData, videoBase64: string, mime = 'video/mp4'): string {
  const title = escHtml(data.meta.title);
  const sub = escHtml([data.meta.book, data.meta.chapter, data.meta.section].filter(Boolean).join(' · '));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root{--bg:#04101c;--fg:#f2f2f6;--dim:#9aa3b5;--line:#1b2b3d;--en:#8b5cf6;--ml:#06b6d4;--ok:#10b981;--bad:#f43f5e;--ask:#fbbf24;--red:#b3202a}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans Malayalam","Nirmala UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:12px 16px 40px}
h1{font-size:18px;margin:4px 0 0}.sub{color:var(--dim);font-size:12px;margin:2px 0 10px}
.stage{position:relative;width:100%;aspect-ratio:${data.width}/${data.height};background:#fff;border-radius:14px;overflow:hidden}
video{position:absolute;inset:0;width:100%;height:100%;display:block;background:#fff}
.load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#150b55;background:#ffffffd0;font-weight:600}
.bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}
button{font:inherit;border:0;border-radius:9px;padding:7px 11px;background:#ffffff14;color:var(--fg);cursor:pointer}
button.on{background:var(--en);color:#fff}button.big{background:var(--en);color:#fff;font-weight:700;min-width:84px}
.time{margin-left:auto;color:var(--dim);font-variant-numeric:tabular-nums}
.strip{display:flex;height:22px;margin-top:8px;border-radius:7px;overflow:hidden;background:#ffffff0a}
.strip button{padding:0;border-radius:0;min-width:3px;border-left:1px solid var(--bg);position:relative;opacity:.3}
.strip button.seen{opacity:1}.strip button.cur{box-shadow:inset 0 0 0 2px #fff}
.strip i{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:var(--ask)}
.strip i.ok{background:#6ee7b7}.strip i.no{background:#fda4af}
.tx{margin-top:12px;max-height:40vh;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:6px}
.tx div.seg{margin:8px 4px 2px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#67e8f9b0}
.tx button{display:block;width:100%;text-align:left;background:none;color:#ffffffb0;padding:5px 8px;border-radius:7px}
.tx button.cur{background:#8b5cf666;color:#fff}
.q{position:absolute;inset:0;z-index:5}
.card{position:absolute;left:50%;top:8px;transform:translateX(-50%);width:min(94%,760px);background:#fffffff2;color:#150b55;border:2px solid var(--red);border-radius:16px;padding:10px 12px;box-shadow:0 10px 30px #0006}
.pill{display:inline-block;background:var(--red);color:#fff;border-radius:99px;padding:1px 9px;font-size:11px;font-weight:700;margin-right:6px}
.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;margin-top:8px}
.opts button{background:#efeefa;color:#150b55;font-weight:700;font-size:17px}
.opts button.ok{background:var(--ok);color:#fff}.opts button.no{background:var(--bad);color:#fff}
.tg{position:absolute;border-radius:8px;box-shadow:0 0 0 2px #8b5cf680;pointer-events:none}
.tg.ok{box-shadow:0 0 0 4px var(--ok);background:#10b98126}.tg.no{box-shadow:0 0 0 4px var(--bad);background:#f43f5e26}
.fb{margin-top:8px;font-size:14px}.fb b.ok{color:#047857}.fb b.no{color:#be123c}
.card.bottom{top:auto;bottom:8px}.card.below{position:static;transform:none;width:auto;margin-top:8px}
.row{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}.row button{background:#150b55;color:#fff}.row button.ghost{background:none;color:#150b55b0}
.note{color:var(--dim);font-size:12px;margin-top:10px}
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<div class="sub">${sub}</div>
<div class="stage" id="stage"><video id="v" playsinline preload="auto"></video><div class="load" id="load">Opening the class…</div></div>
<div class="bar">
<button class="big" id="play">▶ Play</button>
<button id="back">⏮ Step</button><button id="next">Step ⏭</button>
<button data-r="0.5">0.5×</button><button data-r="0.75">0.75×</button><button data-r="1" class="on">1×</button><button data-r="1.25">1.25×</button><button data-r="1.5">1.5×</button>
<button id="askbtn" class="on" title="Pause and ask questions">❓ Questions</button>
<span class="time" id="time">0:00</span>
</div>
<div class="strip" id="strip"></div>
<div class="bar" id="resumeRow" style="display:none"><button class="big" id="resume">▶ Resume</button><span class="note" id="score"></span></div>
<div class="tx" id="tx"></div>
<p class="note">Works offline. Your place and answers are saved on this device. ${escHtml(data.meta.credit ?? 'Made with AI Guru')}.</p>
</main>
<script type="application/json" id="data">${scriptJson(data)}</script>
<script type="application/octet-stream" id="video" data-mime="${escHtml(mime)}">${videoBase64}</script>
<script>
(function(){
'use strict';
var D=JSON.parse(document.getElementById('data').textContent);
var v=document.getElementById('v'),stage=document.getElementById('stage');
var KEY='ai-guru-offline-pack:'+D.id;
var P={t:0,step:0,seen:{},ans:{}};
try{var s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object'){P.t=+s.t||0;P.step=+s.step||0;P.seen=s.seen||{};P.ans=s.ans||{};}}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(P));}catch(e){}}
var ask=true,open=null,last=0,raf=0,started=false;
function fmt(ms){ms=Math.max(0,ms|0);return Math.floor(ms/60000)+':'+('0'+(Math.floor(ms/1000)%60)).slice(-2);}
function now(){return Math.min(D.durationMs,v.currentTime*1000);}
function stepAt(t){for(var i=D.steps.length-1;i>=0;i--)if(t>=D.steps[i].t0-1)return i;return 0;}
/* video from the embedded base64 */
function loadVideo(){
  var el=document.getElementById('video'),b64=el.textContent.trim(),mime=el.getAttribute('data-mime')||'video/mp4';
  function useBlob(blob){v.src=URL.createObjectURL(blob);el.textContent='';document.getElementById('load').style.display='none';ready();}
  try{fetch('data:'+mime+';base64,'+b64).then(function(r){return r.blob();}).then(useBlob).catch(fallback);}catch(e){fallback();}
  function fallback(){var bin=atob(b64),n=bin.length,parts=[],CH=1<<20;for(var i=0;i<n;i+=CH){var len=Math.min(CH,n-i),u=new Uint8Array(len);for(var k=0;k<len;k++)u[k]=bin.charCodeAt(i+k);parts.push(u);}useBlob(new Blob(parts,{type:mime}));}
}
/* step strip and transcript */
var strip=document.getElementById('strip'),tx=document.getElementById('tx'),cells=[],lines=[];
D.steps.forEach(function(s,i){
  var seg=D.segments[s.seg]||{},teach=seg.phase==='teach',ml=seg.lang==='ml';
  var b=document.createElement('button');b.style.width=Math.max(0.15,(s.t1-s.t0)/D.durationMs*100)+'%';
  b.style.background=teach?(ml?'var(--ml)':'var(--en)'):(ml?'#06b6d499':'#8b5cf699');b.title=(i+1)+'. '+(seg.label||'')+' — '+s.text;
  b.onclick=function(){go(i);};strip.appendChild(b);cells.push(b);
  if(!i||D.steps[i-1].seg!==s.seg){var h=document.createElement('div');h.className='seg';h.textContent=seg.label||'';tx.appendChild(h);}
  var l=document.createElement('button');l.textContent=s.text;l.onclick=function(){go(i);};tx.appendChild(l);lines.push(l);
});
D.questions.forEach(function(q){var c=cells[q.step];if(c){var d=document.createElement('i');d.id='qd-'+q.id;c.appendChild(d);var l=lines[q.step];if(l)l.textContent='❓ '+l.textContent;}});
function marks(){D.questions.forEach(function(q){var d=document.getElementById('qd-'+q.id),a=P.ans[q.id];if(d)d.className=a?(a.first?'ok':'no'):'';});
  var n=D.questions.length;if(n){var done=0,ok=0;D.questions.forEach(function(q){if(P.ans[q.id]){done++;if(P.ans[q.id].first)ok++;}});document.getElementById('score').textContent='Questions: '+done+'/'+n+' answered'+(done?' · '+ok+' right first time':'');}}
function paint(){var t=now(),i=stepAt(t);document.getElementById('time').textContent=fmt(t)+' / '+fmt(D.durationMs);
  if(started&&(P.step!==i||!P.seen[i])){P.step=i;P.seen[i]=1;P.t=t;save();}
  cells.forEach(function(c,k){c.className=(P.seen[k]?'seen':'')+(k===i?' cur':'');});
  lines.forEach(function(l,k){l.className=k===i?'cur':'';});
  document.getElementById('play').textContent=v.paused?'▶ Play':'⏸ Pause';}
function tick(){var t=now();
  if(ask&&!open){for(var k=0;k<D.questions.length;k++){var q=D.questions[k];if(q.atMs>last&&q.atMs<=t&&t-last<1500&&!P.ans[q.id]){v.pause();v.currentTime=q.atMs/1000;last=q.atMs;show(q);paint();return;}}}
  last=t;if(Date.now()-(tick.s||0)>3000){tick.s=Date.now();P.t=t;save();}
  paint();if(!v.paused)raf=requestAnimationFrame(tick);}
function play(){if(open)return;started=true;last=now();var p=v.play();if(p&&p.catch)p.catch(function(){});cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);paint();}
function pause(){v.pause();cancelAnimationFrame(raf);if(started){P.t=now();save();}paint();}
function seek(ms){closeQ();started=true;v.currentTime=Math.max(0,Math.min(D.durationMs,ms))/1000;last=ms;paint();}
function go(i){var s=D.steps[i];if(!s)return;seek(s.t0);play();}
/* questions */
var qEl=null,qCard=null;
function closeQ(){if(qEl){qEl.remove();qEl=null;}if(qCard){qCard.remove();qCard=null;}open=null;}
function pct(a,b){return (a/b*100)+'%';}
function show(q){closeQ();open=q;var root=document.createElement('div');root.className='q';qEl=root;
  var card=document.createElement('div');card.className='card';card.setAttribute('lang',q.lang);
  card.innerHTML='<span class="pill">'+(q.lang==='ml'?'നിങ്ങളുടെ ഊഴം':'YOUR TURN')+'</span><b></b>';card.querySelector('b').textContent=q.prompt;
  var fb=document.createElement('div');fb.className='fb';var row=document.createElement('div');row.className='row';
  var answered=false;
  function finish(ok,picked,skipped){if(answered)return;answered=true;var a=P.ans[q.id];P.ans[q.id]={ok:ok,first:a?a.first:(ok&&!skipped),tries:(a?a.tries:0)+1,skip:!!skipped};save();marks();
    fb.innerHTML='<b class="'+(ok?'ok':'no')+'"></b> ';fb.querySelector('b').textContent=skipped?(q.lang==='ml'?'ഉത്തരം: ':'Answer: '):ok?(q.lang==='ml'?'ശരി! ':'Correct! '):(q.lang==='ml'?'അല്ല. ':'Not quite. ');fb.appendChild(document.createTextNode(q.explain));
    if(q.options)Array.prototype.forEach.call(card.querySelectorAll('.opts button'),function(b){var o=q.options[+b.getAttribute('data-i')];b.disabled=true;if(o.correct)b.className='ok';else if(o.id===picked)b.className='no';});
    if(q.targets)Array.prototype.forEach.call(root.querySelectorAll('.tg'),function(d){var t=q.targets[+d.getAttribute('data-i')];if(t.correct)d.className='tg ok';else if(t.id===picked)d.className='tg no';});
    row.innerHTML='';var c=document.createElement('button');c.textContent=q.lang==='ml'?'തുടരുക ▶':'Continue ▶';c.onclick=function(){closeQ();var s=D.steps[q.step];last=q.atMs;play();};row.appendChild(c);c.focus();}
  if(q.kind==='choice'){var g=document.createElement('div');g.className='opts';q.options.forEach(function(o,i){var b=document.createElement('button');b.textContent=o.text;b.setAttribute('data-i',i);b.onclick=function(){finish(o.correct,o.id,false);};g.appendChild(b);});card.appendChild(g);}
  else{(q.targets||[]).forEach(function(t,i){var d=document.createElement('div');d.className='tg';d.setAttribute('data-i',i);d.style.left=pct(t.x-t.w/2,D.width);d.style.top=pct(t.y-t.h/2,D.height);d.style.width=pct(t.w,D.width);d.style.height=pct(t.h,D.height);root.appendChild(d);});
    root.addEventListener('click',function(e){if(answered||card.contains(e.target))return;var r=root.getBoundingClientRect(),fx=(e.clientX-r.left)/r.width*D.width,fy=(e.clientY-r.top)/r.height*D.height,best=null,bd=1e18;
      (q.targets||[]).forEach(function(t){if(Math.abs(fx-t.x)<=t.w/2&&Math.abs(fy-t.y)<=t.h/2){var d=(fx-t.x)*(fx-t.x)+(fy-t.y)*(fy-t.y);if(d<bd){bd=d;best=t;}}});
      if(best)finish(!!best.correct,best.id,false);});}
  card.appendChild(fb);var sk=document.createElement('button');sk.className='ghost';sk.textContent=q.lang==='ml'?'ഉത്തരം കാണിക്കുക':'Show answer';sk.onclick=function(){finish(false,null,true);};row.appendChild(sk);card.appendChild(row);
  // Keep the card off the tap targets: below the video on narrow screens, else the half without targets.
  var ys=(q.targets||[]).map(function(t){return t.y+t.h/2;}),low=ys.length?Math.max.apply(null,ys):0;
  stage.appendChild(root);
  if(stage.clientWidth<560){card.className='card below';stage.parentNode.insertBefore(card,stage.nextSibling);qCard=card;}
  else{if(low&&low<D.height*0.6)card.className='card bottom';root.appendChild(card);}}
/* controls */
document.getElementById('play').onclick=function(){v.paused?play():pause();};
document.getElementById('back').onclick=function(){var i=stepAt(now()),s=D.steps[i];go(s&&now()-s.t0>1200?i:Math.max(0,i-1));};
document.getElementById('next').onclick=function(){go(Math.min(D.steps.length-1,stepAt(now())+1));};
Array.prototype.forEach.call(document.querySelectorAll('[data-r]'),function(b){b.onclick=function(){v.playbackRate=+b.getAttribute('data-r');try{v.preservesPitch=true;}catch(e){}Array.prototype.forEach.call(document.querySelectorAll('[data-r]'),function(x){x.className=x===b?'on':'';});};});
document.getElementById('askbtn').onclick=function(){ask=!ask;this.className=ask?'on':'';};
v.addEventListener('click',function(){v.paused?play():pause();});
v.addEventListener('ended',function(){cancelAnimationFrame(raf);paint();});
document.addEventListener('keydown',function(e){if(open)return;if(e.key===' '){e.preventDefault();v.paused?play():pause();}else if(e.key==='ArrowRight')document.getElementById('next').click();else if(e.key==='ArrowLeft')document.getElementById('back').click();});
function ready(){marks();paint();if(P.t>1500&&P.t<D.durationMs-1500){var r=document.getElementById('resumeRow');r.style.display='flex';var b=document.getElementById('resume');b.textContent='▶ Resume from step '+(stepAt(P.t)+1);b.onclick=function(){seek(P.t);play();r.style.display='none';};}
  else if(D.questions.length){document.getElementById('resumeRow').style.display='flex';document.getElementById('resume').style.display='none';}}
loadVideo();
})();
</script>
</body>
</html>
`;
}

/* ---------------- browser: encode and package ---------------- */

export interface OfflinePackOptions {
  format?: ReelFormat;
  voices?: VoiceClips | null;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
  /** Override the automatic phone-sized bitrate. */
  bitrate?: number;
  /** Check the class video before packing it (default true). V51.9.97. */
  check?: boolean;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = () => reject(r.error ?? new Error('Could not read the video'));
    r.readAsDataURL(blob);
  });
}

/** Encodes the class video (small) and returns the offline pack as an .html Blob. Browser only. */
export async function exportOfflinePack(
  tl: TimelineForPack,
  questions: PlacedQuestion[],
  meta: OfflinePackMeta,
  o: OfflinePackOptions = {},
): Promise<{ blob: Blob; bytes: number; videoBytes: number; data: OfflinePackData; check?: import('../reels/motion/self-check').ReelCheck }> {
  const format = o.format ?? 'landscape';
  const { exportMotionReelMp4 } = await import('../reels/motion/export');
  const video = await exportMotionReelMp4(tl.reel, {
    format,
    fps: 24,
    bitrate: o.bitrate ?? packBitrate(tl.reel.durationMs),
    voices: o.voices ?? null,
    onProgress: (p) => o.onProgress?.(p * 0.95),
    check: o.check,
    signal: o.signal,
  });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d') ?? undefined;
  const data = offlinePackData(tl, questions, meta, { format, ctx });
  const html = offlinePackHtml(data, await blobToBase64(video.blob), video.blob.type || 'video/mp4');
  o.onProgress?.(1);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return { blob, bytes: blob.size, videoBytes: video.blob.size, data, check: video.check };
}
