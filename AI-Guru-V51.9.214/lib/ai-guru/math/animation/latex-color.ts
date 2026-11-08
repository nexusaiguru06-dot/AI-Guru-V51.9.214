/**
 * Per-term colouring for LaTeX using the lesson's variable -> colour map.
 *
 * Every bound variable occurrence becomes \textcolor{#hex}{x}, so `a`, `b`, `x` keep the same colour in the
 * equation, the graph and the diagram. LaTeX commands (\frac, \sqrt, \alpha ...) and \text{...} bodies are
 * left alone. Authors can also colour an arbitrary term explicitly with {\color{gold} 2ab}, resolved here
 * from names to hex.
 */
import { resolveColor } from './colors';

export function colorizeLatex(tex: string, bindings: Record<string, string> = {}, base?: string): string {
  const keys = new Set(Object.keys(bindings).filter(k => k.length === 1));
  const src = String(tex ?? '');
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const m = src.slice(i).match(/^\\([A-Za-z]+)/);
      if (m) {
        const name = m[1];
        // \text{...}, \mathrm{...}, \operatorname{...}: copy the braced body untouched.
        if (/^(text|textbf|mathrm|operatorname|mbox)$/.test(name) && src[i + m[0].length] === '{') {
          let depth = 0, j = i + m[0].length;
          for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (depth === 0) { j++; break; } } }
          out += src.slice(i, j); i = j; continue;
        }
        // \color{name} / \textcolor{name}: translate a colour name to hex so KaTeX accepts it.
        if ((name === 'color' || name === 'textcolor') && src[i + m[0].length] === '{') {
          const end = src.indexOf('}', i + m[0].length);
          if (end > 0) {
            const hex = resolveColor(src.slice(i + m[0].length + 1, end));
            if (hex) { out += `\\${name}{${hex}}`; i = end + 1; continue; }
          }
        }
        out += m[0]; i += m[0].length; continue;
      }
      out += src.slice(i, i + 2); i += 2; continue; // \, \; \{ etc.
    }
    if (keys.has(ch)) { out += `\\textcolor{${bindings[ch]}}{${ch}}`; i++; continue; }
    out += ch; i++;
  }
  return base ? `\\textcolor{${base}}{${out}}` : out;
}
