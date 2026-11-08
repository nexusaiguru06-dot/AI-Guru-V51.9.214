import type { MathRagContext, MathRagHit, VisualPattern } from './types';
export function formatRagBlock(hits:MathRagHit[], patterns:VisualPattern[], max=18000){
  let out='MATHVIZAI VISUAL MEMORY — retrieved references only; adapt, do not copy.\\n';
  for(const p of patterns){ out+=`\\n[${p.source}] ${p.title} | concepts=${p.concepts.join(', ')} | operations=${p.operations.join(', ')} | purpose=${p.teachingPurpose}\\nEvidence:\\n${p.evidence}\\n`; }
  for(const h of hits.filter(h=>!patterns.some(p=>p.id.endsWith(h.id))).slice(0,3)) out+=`\\n[${h.source}] ${h.file_path}\\n${h.text.slice(0,2200)}\\n`;
  return out.slice(0,max);
}
