/**
 * V51.9.149 — the English agent: sentence structure. Claims grammar blocks (subject, predicate, object, clause,
 * kinds of sentences) and English chapters; with the AI key the AI marks the parts, otherwise a small rule-based
 * reader splits simple sentences (subject · verb group · object/complement · adverbial phrases).
 */
import type { BookBlock } from '../../../motion-class/segment';
import type { SubjectAgent } from '../../types';
import { score } from '../../claim';
import { sentenceTemplate, type SentencePlan, type Role } from './sentence';

const WORDS: Array<[RegExp, number]> = [
  [/\b(subject|predicate|direct object|indirect object|complement|adverbial|clause|phrase|sentence pattern|parts of speech|noun|pronoun|verb|adjective|adverb|preposition|conjunction)\b/i, 0.35],
  [/\b(declarative|interrogative|imperative|exclamatory|kinds of sentences|types of sentences|active voice|passive voice|tense)\b/i, 0.35],
  [/\b(grammar|identify|underline|sentence)\b/i, 0.15],
];

const AUX = new Set('am is are was were be been being has have had do does did will would shall should can could may might must'.split(' '));
const LINKING = new Set('am is are was were be been seems seem seemed becomes become became looks look looked feels feel felt appears appear appeared'.split(' '));
const PREP = new Set('in on at to from with by for during after before under over into onto near behind across through along around inside outside beside between among towards toward without'.split(' '));
const TIME = new Set('yesterday today tomorrow now tonight soon always never often sometimes daily early late here there'.split(' '));
const COMMON_VERBS = new Set('go goes went gone come comes came eat eats ate eaten play plays played sing sings sang sung read reads write writes wrote written give gives gave given take takes took taken make makes made see sees saw seen sell sells sold buy buys bought tell tells told run runs ran walk walks walked like likes liked love loves loved help helps helped live lives lived work works worked teach teaches taught learn learns learned learnt speak speaks spoke spoken bring brings brought send sends sent show shows showed shown build builds built drink drinks drank keep keeps kept find finds found grow grows grew grown call calls called open opens opened close closes closed draw draws drew drawn sleep sleeps slept'.split(' '));

const isVerbWord = (w: string) => COMMON_VERBS.has(w) || AUX.has(w);

/** A simple sentence split into parts without AI; null when it cannot find a verb. */
export function splitSentence(sentence: string): SentencePlan['parts'] | null {
  const toks = sentence.trim().split(/\s+/);
  const low = toks.map((w) => w.toLowerCase().replace(/[^a-z']/g, ''));
  let v = low.findIndex((w, i) => i > 0 && isVerbWord(w));
  const imperative = isVerbWord(low[0]) && !AUX.has(low[0]);
  if (imperative) v = 0;
  if (v < 0) v = low.findIndex((w, i) => i > 0 && /(ed|es)$/.test(w));
  if (v < 0) return null;
  let ve = v;
  while (ve + 1 < low.length && (AUX.has(low[ve + 1]) || low[ve + 1] === 'not' || isVerbWord(low[ve + 1]) || /(ing|ed|en)$/.test(low[ve + 1]) && AUX.has(low[ve]))) ve++;
  const parts: SentencePlan['parts'] = [];
  if (v > 0) parts.push({ text: toks.slice(0, v).join(' '), role: 'subject' });
  parts.push({ text: toks.slice(v, ve + 1).join(' '), role: 'verb' });
  const linking = ve === v && LINKING.has(low[v]);
  // the rest: an object / complement, then adverbial phrases (prepositional or time words)
  let i = ve + 1;
  let cur: string[] = [];
  let role: Role | null = null;
  const flush = () => { if (cur.length && role) parts.push({ text: cur.join(' '), role }); cur = []; };
  while (i < toks.length) {
    const w = low[i];
    if (PREP.has(w) || TIME.has(w) || /ly$/.test(w)) {
      flush();
      role = 'adverbial';
      cur.push(toks[i]);
      // a prepositional phrase runs to the next preposition / time word
      i++;
      while (i < toks.length && !PREP.has(low[i]) && !TIME.has(low[i])) cur.push(toks[i++]);
      flush();
      continue;
    }
    if (!role || role === 'adverbial') { flush(); role = linking ? 'complement' : 'object'; }
    cur.push(toks[i++]);
  }
  flush();
  return parts;
}

function sentenceFromText(text: string, english: boolean): SentencePlan | null {
  const quoted = text.match(/["“']([A-Z][^"”']{6,140}[.?!])["”']/);
  const plain = english && text.trim().split(/\s+/).length <= 20 ? text.trim() : null;
  const sentence = quoted?.[1] ?? plain;
  if (!sentence) return null;
  const parts = splitSentence(sentence);
  if (!parts) return null;
  return {
    sentence, parts,
    steps: [
      { op: 'show', say: { en: 'Read the sentence carefully.', ml: 'വാക്യം ശ്രദ്ധിച്ചു വായിക്കൂ.' } },
      { op: 'parts', say: { en: 'Find who or what it is about, the action, and the rest.', ml: 'ആരെക്കുറിച്ചാണ്, എന്ത് പ്രവൃത്തി, ബാക്കി എന്ത് എന്ന് കണ്ടെത്താം.' } },
      { op: 'pattern', say: { en: 'Write the parts in order: that is the sentence pattern.', ml: 'ഭാഗങ്ങൾ ക്രമത്തിൽ എഴുതിയാൽ വാക്യഘടന കിട്ടും.' } },
      { op: 'kind', say: { en: 'The ending mark and the parts tell us the kind of sentence.', ml: 'അവസാന ചിഹ്നവും ഭാഗങ്ങളും വാക്യത്തിന്റെ തരം പറയുന്നു.' } },
      { op: 'tree', say: { en: 'Subject and predicate together make the sentence.', ml: 'ഉദ്ദേശ്യവും വിധേയവും ചേർന്നതാണ് വാക്യം.' } },
    ],
  };
}

const englishContext = (ctx: { subjectHint?: string; chapterTitle: string }) => /english|grammar/i.test(`${ctx.subjectHint ?? ''} ${ctx.chapterTitle}`);

export const englishAgent: SubjectAgent = {
  id: 'english',
  name: 'English agent',
  templates: [sentenceTemplate],
  claim: (b: BookBlock, ctx) => score(b, ctx, WORDS, 'english') + (englishContext(ctx) ? 0.2 : 0),
  fromText(b, ctx) {
    const p = sentenceFromText(b.text, englishContext(ctx));
    return p ? { template: 'sentence', teach: p } : null;
  },
  system: `You are the ENGLISH grammar planning agent of a school classroom (Kerala / CBSE, classes 5–10; students may be Malayalam-medium). You turn ONE textbook block into a plan for the fixed template "sentence": one English sentence split into its parts. The app colours the parts, computes the pattern (S + V + O + A …) and the kind of sentence, and draws the Subject–Predicate tree.
Reply with ONE JSON object: {"template":"sentence","teach":{"sentence":"The farmer sold his mangoes in the market yesterday.","parts":[{"text":"The farmer","role":"subject"},{"text":"sold","role":"verb"},{"text":"his mangoes","role":"object"},{"text":"in the market","role":"adverbial"},{"text":"yesterday.","role":"adverbial"}],"steps":[show, parts, pattern, kind, tree — in order; parts required]},"read":{"en":"<the block text>","ml":"<faithful Malayalam translation>"}}.
Roles: subject, verb (the whole verb group: "has been sleeping"), object, indirect-object, complement (after is/am/are/seems/becomes …), adverbial (where, when, how, why). The parts, in order, must be EXACTLY the words of the sentence (keep the final punctuation on the last part). Choose the sentence the block teaches, or its clearest example sentence. Captions: one idea, 6–22 words; the Malayalam caption explains in Malayalam but keeps the English words of the sentence in quotes.
If the block is not about English sentences or grammar, reply {"template":null}.`,
};
