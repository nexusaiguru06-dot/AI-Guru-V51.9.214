import type { VisualAction } from '../lesson/types';

/** Pure SVG for one VisualAction on the 1000x700 board. Shared by the board, the pattern verifier and the pattern gallery. */
export function stylePalette(styleId?: string) {
  switch (styleId) {
    case 'geometry-area-derivation': return { ink:'#e8f4f8', accent:'#7dd3fc', secondary:'#86efac', fill:'rgba(134,239,172,.20)', emphasis:'#facc15' };
    case 'geometry-proof-construction': return { ink:'#e8f4f8', accent:'#93c5fd', secondary:'#c4b5fd', fill:'rgba(147,197,253,.16)', emphasis:'#facc15' };
    case 'trigonometry-unit-circle-reference': return { ink:'#e8f4f8', accent:'#67e8f9', secondary:'#f9a8d4', fill:'rgba(103,232,249,.14)', emphasis:'#facc15' };
    case 'calculus-riemann-sum-area-reference': return { ink:'#e8f4f8', accent:'#60a5fa', secondary:'#86efac', fill:'rgba(96,165,250,.18)', emphasis:'#facc15' };
    case 'calculus-slope-explorer-reference': return { ink:'#e8f4f8', accent:'#67e8f9', secondary:'#fbbf24', fill:'rgba(103,232,249,.14)', emphasis:'#fbbf24' };
    default: return { ink:'#e6faff', accent:'#67e8f9', secondary:'#fbbf24', fill:'rgba(103,232,249,.12)', emphasis:'#fbbf24' };
  }
}

export function actionSvg(action: VisualAction): string {
  const palette = stylePalette((action as { visualStyleId?: string }).visualStyleId);
  const x = 'x' in action ? (action.x ?? 80) : 80;
  const y = 'y' in action ? (action.y ?? 100) : 100;
  const escAttr=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  // MathLikeAnim receives vector-friendly SVG. The teaching engine, not this
  // renderer, decides what the mathematical objects mean.
  if (action.type === 'write' || action.type === 'latex') {
    const raw = action.type === 'latex' ? action.latex : action.content;
    const readable = raw
      .replace(/\\begin\{[^}]*\}/g,'').replace(/\\end\{[^}]*\}/g,'')
      .replace(/\\cdot/g,'·').replace(/\\times/g,'×').replace(/\\pm/g,'±')
      .replace(/\\sqrt\{([^}]*)\}/g,'√($1)').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g,'($1)/($2)')
      .replace(/\\left/g,'').replace(/\\right/g,'')
      .replace(/\\text\{([^}]*)\}/g,'$1')
      .replace(/[{}]/g,'').replace(/\\[a-zA-Z]+/g,'').replace(/\\/g,'').replace(/[ \t]+/g,' ').trim();
    // A single <text> node never wrapped, so anything longer than a short line
    // ran straight off the 1000-unit board. The verbatim textbook paragraph is
    // by definition long, so write actions now wrap to the action's width.
    const absolute = action.placement === 'absolute';
    const anchor = action.anchor ?? 'start';
    const fontSize = action.fontSize ?? 22;
    // Diagram labels are short and must stay exactly where the pattern put them: no wrapping unless a width is given.
    const boxWidth = ('width' in action && action.width ? action.width : absolute ? 100000 : 1000 - x - 60);
    const perLine = Math.max(8, Math.floor(boxWidth / (fontSize * 0.52)));
    const lines: string[] = [];
    for (const paragraph of readable.split('\n')) {
      let current = '';
      for (const word of paragraph.split(/\s+/)) {
        if (current && (current.length + word.length + 1) > perLine) { lines.push(current); current = ''; }
        current += (current ? ' ' : '') + word;
      }
      lines.push(current);
    }
    const italic = ('fontStyle' in action && action.fontStyle === 'italic') ? ' font-style="italic"' : '';
    const tspans = lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : Math.round(fontSize * 1.34)}">${escAttr(line)}</tspan>`).join('');
    const fill = action.color || palette.ink;
    const anchorAttr = anchor !== 'start' ? ` text-anchor="${anchor}"` : '';
    const weight = absolute ? ' font-weight="600"' : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><text x="${x}" y="${y}" font-size="${fontSize}" font-family="Chilanka, Noto Sans Malayalam, Nirmala UI, Noto Sans, sans-serif" fill="${escAttr(fill)}"${italic}${anchorAttr}${weight}>${tspans}</text></svg>`;
  }
  if (action.type === 'line') {
    const dash = action.style === 'dashed' ? ' stroke-dasharray="12 8"' : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><path d="M ${action.startX} ${action.startY} L ${action.endX} ${action.endY}" fill="none" stroke="${action.stroke || palette.accent}" stroke-width="${action.strokeWidth || 5}" stroke-linecap="round"${dash}/></svg>`;
  }
  if (action.type === 'shape') {
    const fill = action.fill && action.fill !== 'none' ? action.fill : 'none';
    const stroke = action.stroke || palette.accent;
    const sw = action.strokeWidth || 5;
    if (action.shape === 'circle') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><circle cx="${x + action.width / 2}" cy="${y + action.height / 2}" r="${Math.min(action.width, action.height) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
    if (action.shape === 'triangle') {
      const p1=`${x + action.width/2},${y}`,p2=`${x},${y+action.height}`,p3=`${x+action.width},${y+action.height}`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><path d="M ${p1} L ${p2} L ${p3} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><rect x="${x}" y="${y}" width="${action.width}" height="${action.height}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
  }
  if (action.type === 'chart') {
    const series=action.data.series[0]??[];
    const labels=series.length;
    const pts=series.map((v,i)=>`${40+(i/Math.max(1,labels-1))*920} ${350-v*60}`).join(' ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><line x1="60" y1="350" x2="940" y2="350" stroke="${palette.ink}" stroke-opacity=".45" stroke-width="3"/><line x1="500" y1="80" x2="500" y2="620" stroke="${palette.ink}" stroke-opacity=".45" stroke-width="3"/><polyline points="${pts}" fill="none" stroke="${palette.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (action.type === 'highlight') {
    const hx=action.x??55, hy=action.y??55, hw=action.width??890, hh=action.height??100;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><rect x="${hx}" y="${hy}" width="${hw}" height="${hh}" rx="18" fill="none" stroke="#fbbf24" stroke-width="8" stroke-dasharray="16 10"/></svg>`;
  }
  if (action.type === 'move') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><circle cx="${action.toX}" cy="${action.toY}" r="10" fill="#67e8f9"/></svg>`;
  }
  if (action.type === 'transform') {
    const label = String((action as any).toId ?? '');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><text x="80" y="110" font-size="32" font-family="Chilanka, Noto Sans Malayalam, Nirmala UI, Noto Sans, sans-serif" fill="${palette.ink}">${escAttr(label)}</text></svg>`;
  }
  if (action.type === 'erase' || action.type === 'pause') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"></svg>`;
}
