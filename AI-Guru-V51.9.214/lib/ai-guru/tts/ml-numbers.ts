/**
 * V51.9.160 — numbers as spoken Malayalam words, for voices that read only Malayalam letters (the AI4Bharat Rasa
 * voice). Edge's Malayalam voice reads digits itself, so this is used only for those voices.
 *
 *   25 → ഇരുപത്തിയഞ്ച്      125 → നൂറ്റി ഇരുപത്തിയഞ്ച്      2,500 → രണ്ടായിരത്തി അഞ്ഞൂറ്
 *   1,25,000 → ഒരു ലക്ഷത്തി ഇരുപത്തിയഞ്ച് ആയിരം      2.5 → രണ്ട് പോയിന്റ് അഞ്ച്
 *
 * Tens and units are joined as one word (as children hear them in class); hundreds, thousands, lakhs and crores are
 * separate words, which every Malayalam voice reads clearly.
 */
const UNITS = ['പൂജ്യം', 'ഒന്ന്', 'രണ്ട്', 'മൂന്ന്', 'നാല്', 'അഞ്ച്', 'ആറ്', 'ഏഴ്', 'എട്ട്', 'ഒൻപത്'];
const TEENS = ['പത്ത്', 'പതിനൊന്ന്', 'പന്ത്രണ്ട്', 'പതിമൂന്ന്', 'പതിനാല്', 'പതിനഞ്ച്', 'പതിനാറ്', 'പതിനേഴ്', 'പതിനെട്ട്', 'പത്തൊൻപത്'];
const TENS = ['', '', 'ഇരുപത്', 'മുപ്പത്', 'നാൽപ്പത്', 'അൻപത്', 'അറുപത്', 'എഴുപത്', 'എൺപത്', 'തൊണ്ണൂറ്'];
/** "ഇരുപത്" → "ഇരുപത്തി", "തൊണ്ണൂറ്" → "തൊണ്ണൂറ്റി" (the form before a following number). */
const TENS_JOIN = ['', '', 'ഇരുപത്തി', 'മുപ്പത്തി', 'നാൽപ്പത്തി', 'അൻപത്തി', 'അറുപത്തി', 'എഴുപത്തി', 'എൺപത്തി', 'തൊണ്ണൂറ്റി'];
/** A unit after "…ത്തി": vowels take a ‑യ‑ glide (ഇരുപത്തി + അഞ്ച് → ഇരുപത്തിയഞ്ച്). */
const UNIT_AFTER = ['', 'യൊന്ന്', 'രണ്ട്', 'മൂന്ന്', 'നാല്', 'യഞ്ച്', 'യാറ്', 'യേഴ്', 'യെട്ട്', 'യൊൻപത്'];
const HUNDREDS = ['', 'നൂറ്', 'ഇരുനൂറ്', 'മുന്നൂറ്', 'നാനൂറ്', 'അഞ്ഞൂറ്', 'അറുനൂറ്', 'എഴുനൂറ്', 'എണ്ണൂറ്', 'തൊള്ളായിരം'];
const HUNDREDS_JOIN = ['', 'നൂറ്റി', 'ഇരുനൂറ്റി', 'മുന്നൂറ്റി', 'നാനൂറ്റി', 'അഞ്ഞൂറ്റി', 'അറുനൂറ്റി', 'എഴുനൂറ്റി', 'എണ്ണൂറ്റി', 'തൊള്ളായിരത്തി'];
const THOUSANDS: Record<number, [string, string]> = { 1: ['ആയിരം', 'ആയിരത്തി'], 2: ['രണ്ടായിരം', 'രണ്ടായിരത്തി'], 3: ['മൂവായിരം', 'മൂവായിരത്തി'], 4: ['നാലായിരം', 'നാലായിരത്തി'], 5: ['അയ്യായിരം', 'അയ്യായിരത്തി'], 6: ['ആറായിരം', 'ആറായിരത്തി'], 7: ['ഏഴായിരം', 'ഏഴായിരത്തി'], 8: ['എണ്ണായിരം', 'എണ്ണായിരത്തി'], 9: ['ഒൻപതിനായിരം', 'ഒൻപതിനായിരത്തി'], 10: ['പതിനായിരം', 'പതിനായിരത്തി'] };

function below100(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10), u = n % 10;
  return u ? TENS_JOIN[t] + UNIT_AFTER[u] : TENS[t];
}
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  if (!h) return below100(r);
  return r ? `${HUNDREDS_JOIN[h]} ${below100(r)}` : HUNDREDS[h];
}
/** "ഒന്ന്" before ലക്ഷം / കോടി is said "ഒരു". */
const countWord = (n: number) => (n === 1 ? 'ഒരു' : wholeNumber(n));

/** A whole number (0 to 99,99,99,99,999) in Malayalam words, Indian grouping (ആയിരം, ലക്ഷം, കോടി). */
export function wholeNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n !== Math.floor(n)) return String(n);
  if (n < 1000) return below1000(n);
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), th = Math.floor((n % 1e5) / 1e3), rest = n % 1000;
  const more = (after: number) => after > 0;
  if (crore) parts.push(`${countWord(crore)} കോടി`);
  if (lakh) parts.push(`${countWord(lakh)} ${more(n % 1e5) ? 'ലക്ഷത്തി' : 'ലക്ഷം'}`);
  if (th) parts.push(THOUSANDS[th] ? THOUSANDS[th][more(rest) ? 1 : 0] : `${below100(th)} ${more(rest) ? 'ആയിരത്തി' : 'ആയിരം'}`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/** "2.5" → "രണ്ട് പോയിന്റ് അഞ്ച്" (digits after the point one by one, as teachers read them). */
export function numberWords(text: string): string {
  const clean = text.replace(/,/g, '');
  const [whole, frac] = clean.split('.');
  const w = wholeNumber(Number(whole || '0'));
  return frac ? `${w} പോയിന്റ് ${[...frac].map((d) => UNITS[Number(d)]).join(' ')}` : w;
}

/** Every number in a sentence → words ("1,25,000", "125000", "3.14"). Other text is left as it is. */
export function mlNumbersInText(s: string): string {
  return s.replace(/\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?/g, (m) => numberWords(m));
}
