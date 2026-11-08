/**
 * V51.9.91: the join code as a second way in, next to every QR code. A student who opens the link on the same phone cannot
 * scan their own screen, and a family that shares one phone may watch the reel on a TV — so the code is shown, spoken and
 * written, and can be typed at <site>/j. Pure helpers, no I/O.
 */

/** A well-formed referral or class code (what /j/CODE accepts). */
export const CODE = /^[A-Z0-9]{4,12}$/;

/** What someone typed or read out ("anja k7q2", "ANJA-K7Q2") → the stored form ("ANJAK7Q2"). Only spaces, dashes, dots and underscores are dropped, so anything odd stays odd and is refused. */
export const cleanCode = (s: unknown): string => String(s ?? '').trim().toUpperCase().replace(/[\s\-‐–—_.]+/g, '');

export const isCode = (s: string): boolean => CODE.test(s);

/** The code inside a short invite link (https://site/j/ANJAK7Q2 → ANJAK7Q2), or '' when the link has none. */
export function codeFromLink(link: string): string {
  const m = /\/j\/([A-Za-z0-9]{4,12})(?=[/?#]|$)/.exec(link);
  return m ? m[1].toUpperCase() : '';
}

/** Easier to read off a screen and say aloud: ANJAK7Q2 → "ANJA K7Q2" (groups of four). Short codes (up to 6) stay whole. */
export const spacedCode = (code: string): string => (code.length <= 6 ? code : (code.match(/.{1,4}/g) ?? []).join(' '));

/** Where to type the code, without the scheme: "aiguru.example/j". */
export function typePlace(link: string): string {
  try { return `${new URL(link).host}/j`; } catch { return '/j'; }
}

/** One spoken/caption line naming the code, in the reel's language. */
export function codeLine(code: string, link: string, lang: 'en' | 'ml'): string {
  const c = spacedCode(code), at = typePlace(link);
  return lang === 'ml' ? `കോഡ്: ${c} — ${at} തുറന്ന് ടൈപ്പ് ചെയ്യൂ` : `Code: ${c} — type it at ${at}`;
}
