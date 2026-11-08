/**
 * V51.9.165 — the live doubt pane answers in the language the student speaks.
 *
 * 'same'  (default): the student may speak or type in any language (Malayalam, English, Hindi, Tamil, Arabic …);
 *                    AI Guru replies — and speaks — in that same language, and switches when the student switches.
 * 'class':           AI Guru replies in the class's teaching language (the old behaviour).
 *
 * Pure (no DOM apart from the guarded localStorage helpers): the tests use it.
 */

export type ReplyLanguageMode = 'same' | 'class';
const KEY = 'ai-guru-doubt-reply-language';

export function readReplyLanguageMode(): ReplyLanguageMode {
  try { return localStorage.getItem(KEY) === 'class' ? 'class' : 'same'; } catch { return 'same'; }
}
export function saveReplyLanguageMode(m: ReplyLanguageMode): void {
  try { localStorage.setItem(KEY, m); } catch { /* private mode */ }
}

/** The instruction for the AI: answer in whatever language the student used in their last turn. */
export const SAME_LANGUAGE_LINE =
  'LANGUAGE: The student may speak or type in any language — Malayalam, English, Hindi, Tamil, Kannada, Telugu, Arabic or any other. ' +
  'In every turn, reply and speak in the SAME language the student used in their latest question, written in that language’s own script ' +
  '(never transliterated into Latin letters). If the student switches language, switch with them. If they mix two languages, answer in the one ' +
  'they used most. Keep numerals as plain digits (0-9), keep mathematical symbols (+, −, ×, ÷, =) and standard technical terms exactly as written. ' +
  'If you cannot tell the language (for example only a number or a picture), answer in the class language below.';

/** BCP-47 code of the language a text is written in, from its script (for the browser's own voice). */
export function speechLangOf(text: string, fallback = 'en-IN'): string {
  const counts: Array<[RegExp, string]> = [
    [/[ഀ-ൿ]/g, 'ml-IN'], [/[஀-௿]/g, 'ta-IN'], [/[ऀ-ॿ]/g, 'hi-IN'], [/[ಀ-೿]/g, 'kn-IN'],
    [/[ఀ-౿]/g, 'te-IN'], [/[ঀ-৿]/g, 'bn-IN'], [/[઀-૿]/g, 'gu-IN'], [/[਀-੿]/g, 'pa-IN'],
    [/[଀-୿]/g, 'or-IN'], [/[؀-ۿ]/g, 'ar-SA'], [/[A-Za-z]/g, 'en-IN'],
  ];
  let best = fallback, most = 0;
  for (const [re, code] of counts) {
    const n = (text.match(re) || []).length;
    // Latin letters count a little less: maths terms and units are often written in English inside another language
    const score = code === 'en-IN' ? n * 0.6 : n;
    if (score > most) { most = score; best = code; }
  }
  return best;
}
