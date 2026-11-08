/**
 * Renders every visual pattern's example into public/pattern-gallery.html (open it in a browser to SEE the library).
 *   npm run patterns:gallery
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATTERNS, actionsToSvg, verifyVisualActions } from '../lib/ai-guru/patterns';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cards = PATTERNS.map((p) => {
  const actions = p.build(p.example);
  const v = verifyVisualActions(actions);
  return `<section><h2>${esc(p.name)} <small>${p.id}</small></h2><p>${esc(p.whenToUse)}</p>
${actionsToSvg(actions)}
<p class="meta">${actions.length} actions \u00b7 dry run: ${v.ok ? 'ok' : 'ERRORS'}${v.warnings.length ? ` (${v.warnings.length} warnings)` : ''} \u00b7 domains: ${p.domains.join(', ')}</p>
<pre>${esc(JSON.stringify(p.example))}</pre></section>`;
}).join('\n');
const html = `<!doctype html><meta charset="utf-8"><title>AI Guru visual pattern gallery</title>
<style>body{background:#0b1017;color:#e6faff;font-family:system-ui,sans-serif;margin:24px}h1{margin:0 0 4px}section{max-width:720px;margin:28px 0;padding:16px;border:1px solid #1e3a4a;border-radius:14px}
h2{margin:0;font-size:18px}small{color:#64748b;font-weight:400}svg{width:100%;height:auto;border-radius:10px}.meta{color:#94a3b8;font-size:13px}pre{white-space:pre-wrap;color:#67e8f9;font-size:12px}</style>
<h1>Visual pattern gallery</h1><p>${PATTERNS.length} patterns. Each is a tested recipe the Visual Developer can pick and fill with a step's real numbers.</p>${cards}`;
const out = path.join(process.cwd(), 'public', 'pattern-gallery.html');
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${PATTERNS.length} patterns)`);
