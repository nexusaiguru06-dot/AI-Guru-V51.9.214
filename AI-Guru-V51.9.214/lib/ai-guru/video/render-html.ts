import type { AIGuruVideoTimeline } from './ncert-video-timeline';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
}

export function buildAIGuruVideoHtml(timeline: AIGuruVideoTimeline): string {
  const data = JSON.stringify(timeline).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#0b0d12;color:#f7f7f7;font-family:Inter,Arial,sans-serif;width:100%;height:100%;overflow:hidden}.root{display:grid;grid-template-columns:1fr 1fr;height:100vh}.ref,.board{position:relative;padding:42px;box-sizing:border-box}.ref{background:#151821;border-right:1px solid #30343f}.label{font-size:18px;letter-spacing:.08em;opacity:.55;margin-bottom:18px}.page{font-size:18px;opacity:.7;margin-bottom:28px}.source{font-family:Georgia,serif;font-size:29px;line-height:1.5;font-style:italic}.board{position:relative}.boardTitle{position:absolute;left:42px;top:42px}.stage{position:absolute;left:42px;right:42px;top:110px;bottom:170px}.caption{position:absolute;left:42px;right:42px;bottom:55px;font-size:28px;line-height:1.35;min-height:80px}.ml{font-size:32px}.cursor{position:absolute;bottom:22px;left:42px;right:42px;height:5px;background:#333}.bar{height:100%;width:0;background:#fff}.derivation{font-family:Georgia,serif;font-size:48px;dominant-baseline:middle;text-anchor:middle}.current{font-weight:700}.previous{opacity:.62}.ring{fill:none;stroke:currentColor;stroke-width:4;opacity:0;rx:14}.hint{font-size:20px;opacity:.5;text-anchor:middle}.op{font-size:22px;opacity:.7;text-anchor:middle}</style></head><body><div class="root"><section class="ref"><div class="label">NCERT REFERENCE</div><div id="page" class="page"></div><div id="source" class="source"></div></section><section class="board"><div class="label boardTitle">AI GURU WHITEBOARD</div><div class="stage"><svg id="svg" viewBox="0 0 960 620" preserveAspectRatio="xMidYMid meet"></svg></div><div id="caption" class="caption"></div></section></div><div class="cursor"><div id="bar" class="bar"></div></div><script>
const T=${data};
const page=document.getElementById('page'),source=document.getElementById('source'),caption=document.getElementById('caption'),bar=document.getElementById('bar'),svg=document.getElementById('svg');
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function latex(s){return String(s??'').replace(/\\cdot/g,'·').replace(/\\times/g,'×').replace(/\\pm/g,'±').replace(/\\sqrt\{([^}]*)\}/g,'√($1)').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g,'($1)/($2)').replace(/[{}]/g,'').replace(/\\/g,'');}
function renderDerivation(c,local){
 const lines=Array.isArray(c.derivation)?c.derivation:((c.latex)?[{id:'current',latex:c.latex,lineIndex:0,persistent:true}]:[]);
 let html='';
 lines.forEach((line,i)=>{
   const isCurrent=i===lines.length-1;
   const y=75+i*102;
   const enter=Math.min(1,Math.max(0,(local-(i===lines.length-1?0:.02))/.22));
   const scale=.92+.08*enter;
   const cls=isCurrent?'derivation current':'derivation previous';
   html += '<g opacity="'+enter+'" transform="translate(480 '+y+') scale('+scale+')"><text class="'+cls+'" x="0" y="0">'+esc(latex(line.latex))+'</text>' + (isCurrent?'<rect class="ring" x="-360" y="-38" width="720" height="70" opacity="'+Math.min(1,enter*1.4)+'"/>':'') + '</g>';
 });
 if(lines.length>1) html += '<text class="hint" x="480" y="'+Math.min(580,lines.length*102+15)+'">each line is derived from the line above</text>';
 svg.innerHTML=html;
}
function frame(now){
 const t=now%T.durationMs; const c=T.cues.find(x=>t>=x.atMs&&t<x.atMs+x.durationMs)||T.cues[T.cues.length-1];
 const local=Math.max(0,Math.min(1,(t-c.atMs)/Math.max(1,c.durationMs)));
 page.textContent=c.page?'Page '+c.page:''; source.textContent=c.kind==='reference'?(c.text||''):'';
 const isML=c.kind==='malayalam'; caption.className='caption'+(isML?' ml':''); caption.textContent=c.text||'';
 if(c.kind==='english'||c.kind==='malayalam'||c.kind==='construction'||c.kind==='math') renderDerivation(c,local); else svg.innerHTML='';
 bar.style.width=(t/T.durationMs*100)+'%'; requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
</script></body></html>`;
}
