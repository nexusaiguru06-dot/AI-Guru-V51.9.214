/* Shared helpers for every look. window.__INTRO (data.js) = {heading, sub, kicker, lang, subject, seed}. */
const D = window.__INTRO;
const ML = D.lang === 'ml';
document.documentElement.classList.add(ML ? 'ml' : 'en');
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(D.seed || 1);
/** Shrinks the element's font until it fits maxW. */
function fitText(el, maxW, maxSize, minSize) {
  const w0 = el.style.width; el.style.width = 'max-content'; // measure the text itself, not a full-width box
  let s = maxSize; el.style.fontSize = s + 'px';
  while (el.scrollWidth > maxW && s > (minSize || 44)) { s -= 4; el.style.fontSize = s + 'px'; }
  el.style.width = w0;
  return s;
}
/** Letters for Latin text, words for Malayalam (never break a conjunct); returns the unit spans. */
function splitUnits(el, text) {
  const parts = ML ? text.split(/(\s+)/) : Array.from(text);
  for (const p of parts) { const s = document.createElement('span'); s.className = 'u'; s.textContent = p; if (/^\s+$/.test(p)) s.style.whiteSpace = 'pre'; el.appendChild(s); }
  return Array.from(el.querySelectorAll('.u')).filter((s) => s.textContent.trim());
}
const SYM = {
  maths: ['∑', '√', 'π', '∫', 'x²', 'f(x)', 'sin θ', '½', 'Δ', '∞', '≠', '≥', 'log x', 'θ', 'n!', '(a+b)²'],
  science: ['H₂O', 'CO₂', 'E=mc²', 'F=ma', 'pH', 'Na⁺', 'DNA', 'ATP', 'O₂', 'λ', 'Ω', 'e⁻', 'ΔT', '°C', 'Fe', 'CH₄'],
  earth: ['N', 'S', 'E', 'W', '23.5°', '0°', '⛰', '≈', '☀', '🌍', '↑', '°C', 'km', 'mm', '⌖', '≋'],
  general: ['A', 'B', 'C', '?', '!', '✓', '★', '+', '=', '→', '“ ”', '1947', '#', '&', '∞', '✎'],
};
const SK = D.subject === 'maths' || D.subject === 'science' || D.subject === 'earth' ? D.subject : 'general';
const SYMS = SYM[SK];
function mount(html) { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
if (!D.sub) document.documentElement.classList.add('nosub');
