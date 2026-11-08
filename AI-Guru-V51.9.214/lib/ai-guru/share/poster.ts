import qrcode from 'qrcode-generator';
import { typePlace } from './join-code';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** A QR code as SVG markup for any link. */
export function qrSvg(link: string): string {
  const q = qrcode(0, 'M'); q.addData(link); q.make();
  return q.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
}
/** A printable A4 poster for a class or centre notice board: big QR, join code, plain steps. */
export function posterHtml(g: { name: string; code: string; kind: 'class' | 'centre'; discountPct: number }, link: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(g.name)} · AI Guru</title><style>
@page{size:A4;margin:14mm}body{font-family:system-ui,sans-serif;text-align:center;color:#0b1b2b}
h1{font-size:44px;margin:10px 0 0}h2{font-size:26px;margin:6px 0;color:#0e7490}.qr{width:380px;margin:18px auto}.code{font:700 54px ui-monospace,monospace;letter-spacing:6px;border:4px dashed #0e7490;display:inline-block;padding:8px 24px;border-radius:14px}
ol{display:inline-block;padding-left:40px;text-align:left;font-size:24px;line-height:1.6}small{display:block;margin-top:14px;font-size:16px;color:#475569}</style></head><body>
<h1>Join ${esc(g.name)} on AI Guru</h1><h2>Free lessons in Malayalam and English · quizzes with toffees${g.discountPct > 0 ? ` · ${g.discountPct}% off fees` : ''}</h2>
<div class="qr">${qrSvg(link)}</div><div class="code">${esc(g.code)}</div>
<p><ol><li>Scan the QR, or open <b>${esc(typePlace(link))}</b> and type the code</li><li>Make your account (your class code is already filled in)</li><li>Learn, answer, collect toffees!</li></ol></p>
<small>${esc(link)}</small></body></html>`;
}

/** V51.9.155: a student's own invite poster (school notice board, tuition centre, shop window): QR, code and the offer. */
export function friendPosterHtml(p: { firstName: string; code: string; offer: string }, link: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Join AI Guru with ${esc(p.firstName)}</title><style>
@page{size:A4;margin:14mm}body{font-family:system-ui,sans-serif;text-align:center;color:#0b1b2b}
h1{font-size:44px;margin:10px 0 0}h2{font-size:24px;margin:6px 0;color:#0e7490}.qr{width:360px;margin:18px auto}.code{font:700 54px ui-monospace,monospace;letter-spacing:6px;border:4px dashed #0e7490;display:inline-block;padding:8px 24px;border-radius:14px}
ol{display:inline-block;padding-left:40px;text-align:left;font-size:24px;line-height:1.6}small{display:block;margin-top:14px;font-size:16px;color:#475569}</style></head><body>
<h1>Study with AI Guru</h1><h2>An AI classroom in Malayalam and English · invited by ${esc(p.firstName)}${p.offer ? ` · ${esc(p.offer)}` : ''}</h2>
<div class="qr">${qrSvg(link)}</div><div class="code">${esc(p.code)}</div>
<p><ol><li>Scan the QR, or open <b>${esc(typePlace(link))}</b> and type the code</li><li>Make your account (the code is already filled in)</li><li>Learn with the AI teacher on the whiteboard!</li></ol></p>

<small>${esc(link)}</small></body></html>`;
}
