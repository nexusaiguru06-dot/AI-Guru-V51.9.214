/**
 * V51.9.169 — Day / Night theme, kept on this device. The page's <html data-theme="night|day"> is set before the
 * first paint by THEME_BOOT (app/layout.tsx), so there is no flash; app/ai-guru-theme.css does the rest.
 */
export type Theme = 'night' | 'day';
export const THEME_KEY = 'ai-guru-theme';
export const THEME_EVENT = 'ai-guru-theme-changed';

/** Runs in <head> before the page draws: the saved theme, else night. */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.setAttribute('data-theme',t==='day'?'day':'night');}catch(e){document.documentElement.setAttribute('data-theme','night');}})();`;

export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'night';
  return document.documentElement.getAttribute('data-theme') === 'day' ? 'day' : 'night';
}

export function setTheme(t: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_KEY, t); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: t }));
}

export function onThemeChange(cb: (t: Theme) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const f = () => cb(currentTheme());
  window.addEventListener(THEME_EVENT, f);
  window.addEventListener('storage', f);
  return () => { window.removeEventListener(THEME_EVENT, f); window.removeEventListener('storage', f); };
}
