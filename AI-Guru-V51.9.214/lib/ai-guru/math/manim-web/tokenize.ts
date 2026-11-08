/**
 * Small deterministic LaTeX tokenizer for AI Guru's 3B1B equation renderer.
 * It is deliberately presentation-oriented: the goal is stable glyph groups
 * for TransformMatchingTex, not full LaTeX parsing.
 */
export interface MathTokenPart { latex: string; key: string }

const COMMAND_RE = /^\\[a-zA-Z]+|^\\[^a-zA-Z\s]|^\d+(?:\.\d+)?|^[a-zA-Z]+|^[+\-=<>*/×÷·]|^[()[\]{}|,:;]|^\^|^_|^\s+/;

export function tokenizeLatexForAnimation(input: string): MathTokenPart[] {
  const source = String(input ?? '').trim();
  if (!source) return [{ latex: '\\phantom{0}', key: 'empty' }];

  const parts: MathTokenPart[] = [];
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const match = rest.match(COMMAND_RE);
    if (!match) {
      parts.push({ latex: source[i], key: normalizeTokenKey(source[i]) });
      i += 1;
      continue;
    }
    const token = match[0];
    i += token.length;
    if (/^\s+$/.test(token)) {
      // Keep spacing out of semantic matching. MathJax supplies its own spacing.
      continue;
    }

    // Keep a superscript/subscript group attached to the marker. This makes
    // x^2 transform as x + ^2 rather than as a single opaque equation string.
    if (token === '^' || token === '_') {
      if (source[i] === '{') {
        let depth = 0;
        let j = i;
        do {
          if (source[j] === '{') depth++;
          else if (source[j] === '}') depth--;
          j++;
        } while (j < source.length && depth > 0);
        const group = source.slice(i, j);
        const latex = token + group;
        parts.push({ latex, key: normalizeTokenKey(latex) });
        i = j;
      } else if (i < source.length) {
        const latex = token + source[i];
        parts.push({ latex, key: normalizeTokenKey(latex) });
        i += 1;
      } else {
        parts.push({ latex: token, key: normalizeTokenKey(token) });
      }
      continue;
    }

    // Group \frac{...}{...}, \sqrt{...}, etc. as one semantic operation.
    if (token.startsWith('\\') && ['\\frac', '\\dfrac', '\\tfrac', '\\sqrt', '\\overline'].includes(token)) {
      let j = i;
      let groups = 0;
      while (j < source.length && groups < (token === '\\sqrt' || token === '\\overline' ? 1 : 2)) {
        while (j < source.length && /\s/.test(source[j])) j++;
        if (source[j] !== '{') break;
        let depth = 0;
        do {
          if (source[j] === '{') depth++;
          else if (source[j] === '}') depth--;
          j++;
        } while (j < source.length && depth > 0);
        groups++;
      }
      const latex = source.slice(i - token.length, j);
      parts.push({ latex, key: normalizeTokenKey(latex) });
      i = j;
      continue;
    }

    parts.push({ latex: token, key: normalizeTokenKey(token) });
  }

  return parts.length ? parts : [{ latex: source, key: normalizeTokenKey(source) }];
}

export function normalizeTokenKey(token: string): string {
  return token.replace(/\s+/g, '').replace(/\\left|\\right/g, '');
}
