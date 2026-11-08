/**
 * The review page (V51.9.46): one self-contained HTML file next to the videos. A teacher watches each
 * segment, marks it Approved or Needs changes (with a comment), and downloads review.json, which
 * `ai-guru-render-review --apply` merges back (see review.ts). No server and no network are needed.
 */

import type { ReviewManifest } from './review';

const safeJson = (x: unknown) => JSON.stringify(x).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028|\u2029/g, '');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function reviewHtml(manifest: ReviewManifest): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Class review</title>
<style>
:root{--bg:#f6f7fb;--card:#fff;--ink:#1b1b3a;--mute:#5b5f7a;--line:#d9dcea;--ok:#17a34a;--bad:#c2410c;--acc:#b91c1c}
@media (prefers-color-scheme:dark){:root{--bg:#0d0f1a;--card:#161a2b;--ink:#eceefb;--mute:#9aa0c0;--line:#2b3150;--ok:#4ade80;--bad:#fb923c;--acc:#f87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line);padding:12px 16px}
h1{font-size:19px;margin:0 0 4px}.bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:14px;color:var(--mute)}
.bar b{color:var(--ink)}.ready{color:var(--ok);font-weight:700}
main{max-width:960px;margin:0 auto;padding:16px;display:grid;gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;display:grid;gap:10px}
.card.approved{border-color:var(--ok)}.card.changes{border-color:var(--bad)}
.top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.label{font-weight:700}.meta{color:var(--mute);font-size:13px}
video{width:100%;max-height:70vh;background:#000;border-radius:10px}
.row{display:flex;gap:8px;flex-wrap:wrap}
button,.file{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:8px 14px;cursor:pointer;min-height:40px}
button.on.ok{background:var(--ok);color:#fff;border-color:var(--ok)}button.on.bad{background:var(--bad);color:#fff;border-color:var(--bad)}
textarea{width:100%;min-height:64px;font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px}
.note{color:var(--bad);font-size:13px}
input[type=file]{display:none}
</style></head><body>
<header><h1 id="title"></h1><div class="bar" id="sum"></div>
<div class="row" style="margin-top:8px"><input id="who" placeholder="Reviewer name" style="font:inherit;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink)">
<button id="dl">Download review.json</button><label class="file">Load review.json<input id="ld" type="file" accept="application/json"></label></div></header>
<main id="list"></main>
<script>
const M=${safeJson(manifest)};
const KEY='ai-guru-review:'+M.generatedAt;
const D={};M.items.forEach(i=>D[i.segmentId]={status:i.status,comment:i.comment||''});
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s){Object.assign(D,s.d||{});document.getElementById('who').value=s.who||''}}catch(e){}
const $=id=>document.getElementById(id);
const fmt=ms=>{const s=Math.round(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function save(){try{localStorage.setItem(KEY,JSON.stringify({d:D,who:$('who').value}))}catch(e){}}
function sum(){const v=Object.values(D);const a=v.filter(x=>x.status==='approved').length,c=v.filter(x=>x.status==='changes').length,p=v.length-a-c;
$('sum').innerHTML='<span><b>'+a+'</b> approved</span><span><b>'+c+'</b> need changes</span><span><b>'+p+'</b> to watch</span>'+(a===v.length&&v.length?'<span class="ready">All approved</span>':'');}
function draw(){$('title').textContent=M.title+' — review';const L=$('list');L.innerHTML='';
M.items.forEach(it=>{const d=D[it.segmentId];const c=document.createElement('section');c.className='card '+d.status;
const v=document.createElement('video');v.controls=true;v.preload='metadata';v.src=it.file;v.setAttribute('playsinline','');
const t=document.createElement('div');t.className='top';t.innerHTML='<span class="label"></span><span class="meta"></span>';
t.firstChild.textContent=it.label;t.lastChild.textContent=it.dna+' · '+fmt(it.durationMs)+(it.timing==='voice'?' · voice timing':' · estimated timing');
const r=document.createElement('div');r.className='row';
const ok=document.createElement('button');ok.textContent='Approve';ok.className='ok'+(d.status==='approved'?' on':'');
const bad=document.createElement('button');bad.textContent='Needs changes';bad.className='bad'+(d.status==='changes'?' on':'');
const ta=document.createElement('textarea');ta.placeholder='What should change? (required for "Needs changes")';ta.value=d.comment;ta.hidden=d.status!=='changes';
const nt=document.createElement('div');nt.className='note';
ok.onclick=()=>{d.status=d.status==='approved'?'pending':'approved';save();draw();sum()};
bad.onclick=()=>{d.status=d.status==='changes'?'pending':'changes';save();draw();sum()};
ta.oninput=()=>{d.comment=ta.value;nt.textContent=d.status==='changes'&&!ta.value.trim()?'Please say what should change.':'';save()};
r.append(ok,bad);c.append(t,v,r,ta,nt);L.append(c)});}
$('who').oninput=save;
$('dl').onclick=()=>{const miss=M.items.filter(i=>D[i.segmentId].status==='changes'&&!D[i.segmentId].comment.trim());
if(miss.length){alert('Please write a comment for: '+miss.map(i=>i.label).join(', '));return}
const out={version:1,reviewer:$('who').value.trim()||undefined,generatedAt:M.generatedAt,decisions:M.items.map(i=>({segmentId:i.segmentId,status:D[i.segmentId].status,comment:D[i.segmentId].comment.trim()||undefined}))};
const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download='review.json';a.click()};
$('ld').onchange=e=>{const f=e.target.files[0];if(!f)return;f.text().then(x=>{try{const j=JSON.parse(x);(j.decisions||[]).forEach(z=>{if(D[z.segmentId]&&['pending','approved','changes'].includes(z.status))D[z.segmentId]={status:z.status,comment:z.comment||''}});if(j.reviewer)$('who').value=j.reviewer;save();draw();sum()}catch(err){alert('That file is not a review.json')}})};
draw();sum();
</script></body></html>`;
}

/** For tests: titles and labels as they appear in the page's data. */
export const reviewLabels = (m: ReviewManifest) => m.items.map((i) => esc(i.label));
