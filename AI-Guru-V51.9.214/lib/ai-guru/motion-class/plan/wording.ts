/**
 * Narration wording (V51.9.51). Two things that lose a struggling student, from the 3brown1blue teaching
 * rules (MIT) and Grant Sanderson's advice: words that say "you should already see this" (obviously,
 * clearly, it follows that…), and spoken sentences too long to follow by ear. Applies to what is SPOKEN
 * on the board (captions, arc lines), never to the textbook text that is read aloud.
 */

/** English words and phrases that tell the student they should already know. */
export const DISMISSIVE_EN = /\b(obviously|clearly|trivially|trivial|it follows that|it is easy to see|it's easy to see|easy to see that|as everyone knows|needless to say|of course|simply)\b/i;
/** Malayalam equivalents: "clearly / plainly / trivially / easy to see / everyone knows / of course". */
export const DISMISSIVE_ML = /(വ്യക്തമായും|സ്പഷ്ടമായും|നിസ്സാരമായി|എളുപ്പത്തിൽ കാണാം|എളുപ്പം കാണാം|എല്ലാവർക്കും അറിയാം|തീർച്ചയായും|പറയേണ്ടതില്ലല്ലോ)/;

/** One spoken sentence: at most this many words (golden captions stay under 18). */
export const SENTENCE_MAX_WORDS_EN = 25;
export const SENTENCE_MAX_WORDS_ML = 40;

const sentences = (s: string) => s.split(/(?<=[.!?।])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Problems with one spoken line pair, as sentences the planner can act on. */
export function wordingProblems(en: string | undefined, ml: string | undefined, path: string): string[] {
  const out: string[] = [];
  const e = en ?? '';
  const m = ml ?? '';
  const de = e.match(DISMISSIVE_EN);
  if (de) out.push(`${path}.en says "${de[0]}"; a student who does not see it yet feels lost. Say the reason instead.`);
  const dm = m.match(DISMISSIVE_ML);
  if (dm) out.push(`${path}.ml says "${dm[0]}"; say the reason instead.`);
  const longEn = sentences(e).find((s) => words(s) > SENTENCE_MAX_WORDS_EN);
  if (longEn) out.push(`${path}.en has a ${words(longEn)}-word sentence; spoken sentences need at most ${SENTENCE_MAX_WORDS_EN} words. Split it.`);
  const longMl = sentences(m).find((s) => words(s) > SENTENCE_MAX_WORDS_ML);
  if (longMl) out.push(`${path}.ml has a ${words(longMl)}-word sentence; split it.`);
  return out;
}
