/** The picture a student posts after a quiz: an SVG (1080 x 1350) made from plain data, so it can be tested and turned into a PNG in the browser. */
import { codeFromLink, codeLine, spacedCode, typePlace } from './join-code';
export type Lang = 'en' | 'ml';
export interface CardData { name: string; correct: number; total: number; pct: number; toffees: number; chillies: number; streak?: number; link: string; lang: Lang; title?: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const FONT = "'Noto Sans Malayalam','Noto Sans',system-ui,'Segoe UI',Arial,sans-serif";

const toffee = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M1 7 L15 10 L15 22 L1 25 Q4 16 1 7Z" fill="#d9e0ea"/><path d="M63 7 L49 10 L49 22 L63 25 Q60 16 63 7Z" fill="#d9e0ea"/><ellipse cx="32" cy="16" rx="21" ry="12.5" fill="#e2351f"/><ellipse cx="29" cy="10.5" rx="12" ry="4" fill="#fff" opacity=".3"/></g>`;
const chilli = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M13 1 Q11 8 15 12 L22 12 Q18 6 17 1Z" fill="#3f8f26"/><path d="M11 13 Q12 10 18 10 Q25 10 26 15 Q31 30 25 44 Q20 56 9 63 Q4 61 7 55 Q14 44 13 32 Q12 22 10 18 Q9 15 11 13Z" fill="#e5251b"/><path d="M17 18 Q21 30 18 42" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".5"/></g>`;

export function scoreCardSvg(d: CardData): string {
  const ml = d.lang === 'ml';
  const t = ml
    ? { head: d.title || 'ഞാൻ ക്വിസ് ജയിച്ചു!', of: 'ശരി ഉത്തരങ്ങൾ', tof: 'ടോഫി', chi: 'മുളക്', streak: (n: number) => `🔥 ${n} ദിവസം തുടർച്ച`, cta: 'എന്റെ ലിങ്കിൽ ചേരൂ, ഫീസിൽ ഡിസ്കൗണ്ട് നേടൂ', tag: 'മലയാളത്തിലും ഇംഗ്ലീഷിലും പഠിക്കാം' }
    : { head: d.title || 'I just finished a quiz!', of: 'right answers', tof: 'toffees', chi: 'chillies', streak: (n: number) => `🔥 ${n}-day streak`, cta: 'Join with my link and get a discount on fees', tag: 'Learn in Malayalam and English' };
  const C = 2 * Math.PI * 150, off = C * (1 - Math.max(0, Math.min(100, d.pct)) / 100);
  const name = esc(d.name.length > 22 ? d.name.slice(0, 21) + '…' : d.name);
  const link = esc(d.link.replace(/^https?:\/\//, ''));
  const code = codeFromLink(d.link); // V51.9.91: the join code, for anyone who cannot tap the link
  const codeTxt = code ? (ml ? `കോഡ് ${spacedCode(code)} · ${typePlace(d.link)}` : `Code ${spacedCode(code)} · type it at ${typePlace(d.link)}`) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" font-family="${FONT}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1b33"/><stop offset="1" stop-color="#05101d"/></linearGradient><radialGradient id="glow" cx=".5" cy=".3" r=".6"><stop offset="0" stop-color="#22d3ee" stop-opacity=".22"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient></defs>
<rect width="1080" height="1350" fill="url(#bg)"/><rect width="1080" height="1350" fill="url(#glow)"/>
<text x="540" y="120" text-anchor="middle" font-size="40" font-weight="800" fill="#22d3ee" letter-spacing="3">AI GURU</text>
<text x="540" y="215" text-anchor="middle" font-size="62" font-weight="800" fill="#fff">${esc(t.head)}</text>
<text x="540" y="290" text-anchor="middle" font-size="46" font-weight="700" fill="#fde68a">${name}</text>
<g transform="translate(540 580)"><circle r="150" fill="none" stroke="#ffffff" stroke-opacity=".12" stroke-width="30"/><circle r="150" fill="none" stroke="#fbbf24" stroke-width="30" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90)"/><text y="28" text-anchor="middle" font-size="96" font-weight="900" fill="#fff">${Math.round(d.pct)}%</text></g>
<text x="540" y="808" text-anchor="middle" font-size="44" fill="#cbd5e1"><tspan font-weight="800" fill="#fff">${d.correct}/${d.total}</tspan> ${esc(t.of)}</text>
<g><rect x="130" y="860" width="380" height="150" rx="75" fill="#fbbf24" fill-opacity=".14" stroke="#fbbf24" stroke-opacity=".5" stroke-width="3"/>${toffee(160, 905, 1.7)}<text x="480" y="958" text-anchor="end" font-size="64" font-weight="900" fill="#fde68a">${d.toffees}</text><text x="320" y="1000" text-anchor="middle" font-size="26" fill="#fde68a" fill-opacity=".8">${esc(t.tof)}</text></g>
<g><rect x="570" y="860" width="380" height="150" rx="75" fill="#f43f5e" fill-opacity=".14" stroke="#f43f5e" stroke-opacity=".5" stroke-width="3"/>${chilli(600, 872, 1.75)}<text x="920" y="958" text-anchor="end" font-size="64" font-weight="900" fill="#fda4af">${d.chillies}</text><text x="760" y="1000" text-anchor="middle" font-size="26" fill="#fda4af" fill-opacity=".8">${esc(t.chi)}</text></g>
${d.streak && d.streak > 1 ? `<text x="540" y="1075" text-anchor="middle" font-size="38" font-weight="700" fill="#fb923c">${esc(t.streak(d.streak))}</text>` : ''}
<rect x="90" y="1120" width="900" height="150" rx="30" fill="#ffffff" fill-opacity=".07"/>
${code ? `<text x="540" y="1168" text-anchor="middle" font-size="31" fill="#e2e8f0">${esc(t.cta)}</text>
<text x="540" y="1214" text-anchor="middle" font-size="36" font-weight="800" fill="#22d3ee">${link}</text>
<text x="540" y="1255" text-anchor="middle" font-size="27" font-weight="700" fill="#fde68a">${esc(codeTxt)}</text>` : `<text x="540" y="1180" text-anchor="middle" font-size="31" fill="#e2e8f0">${esc(t.cta)}</text>
<text x="540" y="1232" text-anchor="middle" font-size="36" font-weight="800" fill="#22d3ee">${link}</text>`}
<text x="540" y="1315" text-anchor="middle" font-size="26" fill="#94a3b8">${esc(t.tag)}</text></svg>`;
}

export function scoreShareText(d: CardData): string {
  const code = codeFromLink(d.link);
  return (d.lang === 'ml'
    ? `🍬 ${d.name} AI Guru ക്വിസിൽ ${d.correct}/${d.total} ശരി (${Math.round(d.pct)}%)! ടോഫി ${d.toffees}, മുളക് ${d.chillies}.${d.link}`
    : `🍬 ${d.name} scored ${d.correct}/${d.total} (${Math.round(d.pct)}%) on an AI Guru quiz! ${d.toffees} toffees, ${d.chillies} chillies.\nLearn in Malayalam and English. Join with my link and get a discount on fees: ${d.link}`) + (code ? `\n${codeLine(code, d.link, d.lang)}` : '');
}

/** Browser only: the card as a PNG file. */
export async function svgToPng(svg: string, w = 1080, h = 1350): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image(); img.decoding = 'async';
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('card image failed')); img.src = url; });
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('png failed'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

export interface WinnerRow { short: string; correct: number; total: number; seconds: number }
/** The winners' picture for a contest (1080 x 1350): top three with scores and times. */
export function winnersCardSvg(d: { title: string; emoji: string; winners: WinnerRow[]; link: string; lang: Lang }): string {
  const ml = d.lang === 'ml';
  const medal = ['#fbbf24', '#cbd5e1', '#d97706'];
  const rows = d.winners.slice(0, 3).map((w, i) => `<g transform="translate(90 ${430 + i * 220})"><rect width="900" height="180" rx="40" fill="#fff" fill-opacity=".07" stroke="${medal[i]}" stroke-width="4"/><circle cx="90" cy="90" r="52" fill="${medal[i]}"/><text x="90" y="108" text-anchor="middle" font-size="56" font-weight="800" fill="#0b1b33">${i + 1}</text><text x="180" y="82" font-size="50" font-weight="800" fill="#fff">${esc(w.short)}</text><text x="180" y="136" font-size="34" fill="#cbd5e1">${w.correct}/${w.total} ${ml ? 'ശരി' : 'right'} · ${w.seconds} ${ml ? 'സെക്കൻഡ്' : 'sec'}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" font-family="${FONT}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1b33"/><stop offset="1" stop-color="#05101d"/></linearGradient></defs>
<rect width="1080" height="1350" fill="url(#bg)"/>
<text x="540" y="120" text-anchor="middle" font-size="40" font-weight="800" fill="#22d3ee" letter-spacing="3">AI GURU</text>
<text x="540" y="240" text-anchor="middle" font-size="100">${d.emoji}</text>
<text x="540" y="330" text-anchor="middle" font-size="58" font-weight="800" fill="#fff">${esc(d.title)}</text>
<text x="540" y="385" text-anchor="middle" font-size="36" fill="#fde68a">${ml ? 'വിജയികൾ' : 'Winners'}</text>
${rows}
<rect x="90" y="1130" width="900" height="130" rx="30" fill="#fff" fill-opacity=".07"/>
<text x="540" y="1188" text-anchor="middle" font-size="31" fill="#e2e8f0">${ml ? 'അടുത്ത ക്വിസിൽ നിങ്ങളും!' : 'Be on the next winners card!'}</text>
<text x="540" y="1238" text-anchor="middle" font-size="36" font-weight="800" fill="#22d3ee">${esc(d.link.replace(/^https?:\/\//, ''))}</text></svg>`;
}
