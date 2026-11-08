/** The biology agent: food chains and energy flow; (V51.9.149) plant and animal cells, Mendel's crosses. */
import type { SubjectAgent } from '../../types';
import { score } from '../../claim';
import { chainTemplate, type ChainPlan } from './food-chain';
import { cellTemplate, PARTS, type CellPart, type CellPlan } from './cell';
import { punnettTemplate, type PunnettPlan } from './punnett';

const WORDS: Array<[RegExp, number]> = [
  [/\b(food chain|food web|producer|consumer|herbivore|carnivore|omnivore|decomposer|trophic|ecosystem)\b/i, 0.5],
  [/\b(cell|organism|photosynthesis|respiration|species|habitat|plant|animal|tissue|organ|enzyme|digest\w*)\b/i, 0.3],
  [/\b(dna|gene|heredity|evolution|bacteria|virus|fungi|nutrition)\b/i, 0.25],
  [/\b(mendel|punnett|genotypes?|phenotypes?|dominant|recessive|alleles?|monohybrid|dihybrid|hybrids?|chromosomes?|offspring|traits?|F1|F2)\b/i, 0.4],
  [/\b(plants|animals|cells|organisms|pea plants?)\b/i, 0.15],
  [/\b(nucleus|cytoplasm|mitochondri\w*|chloroplast\w*|vacuoles?|cell wall|cell membrane|organelles?|golgi|ribosomes?|endoplasmic)\b/i, 0.35],
];

const PART_WORDS: Array<[CellPart, RegExp]> = [
  ['wall', /cell wall/i], ['membrane', /(cell|plasma) membrane/i], ['nucleus', /nucleus/i], ['cytoplasm', /cytoplasm/i],
  ['chloroplast', /chloroplast/i], ['vacuole', /vacuole/i], ['mitochondria', /mitochondri/i], ['er', /endoplasmic/i],
  ['golgi', /golgi/i], ['ribosome', /ribosome/i],
];
function cellFromText(text: string): CellPlan | null {
  if (!/\bcells?\b/i.test(text)) return null;
  const plantish = /plant cell/i.test(text), animalish = /animal cell/i.test(text);
  const named = PART_WORDS.filter(([, re]) => re.test(text)).map(([k]) => k);
  if (named.length < 2 && !plantish && !animalish) return null;
  const kind: CellPlan['kind'] = plantish || (!animalish && named.some((k) => PARTS[k].plantOnly)) ? 'plant' : 'animal';
  const parts = (named.length ? named : (['nucleus', 'cytoplasm', 'membrane', 'mitochondria'] as CellPart[])).filter((k) => kind === 'plant' || !PARTS[k].plantOnly).slice(0, 7);
  return {
    kind,
    steps: [
      { op: 'show', say: kind === 'plant' ? { en: 'A plant cell, as seen under a microscope.', ml: 'സൂക്ഷ്മദർശിനിയിലൂടെ കാണുന്ന ഒരു സസ്യകോശം.' } : { en: 'An animal cell, as seen under a microscope.', ml: 'സൂക്ഷ്മദർശിനിയിലൂടെ കാണുന്ന ഒരു ജന്തുകോശം.' } },
      ...parts.map((k) => ({ op: 'part' as const, part: k, say: { en: `This is the ${PARTS[k].name.en.toLowerCase()}: it ${PARTS[k].job.en}.`, ml: `ഇതാണ് ${PARTS[k].name.ml}: ${PARTS[k].job.ml}.` } })),
      ...(plantish && animalish ? [{ op: 'compare' as const, say: { en: 'Plant cells have a cell wall, chloroplasts and a large vacuole.', ml: 'സസ്യകോശങ്ങൾക്ക് കോശഭിത്തിയും ഹരിതകണങ്ങളും വലിയ ഫേനവുമുണ്ട്.' } }] : []),
    ],
  };
}

/** "Tt × Tt", "RrYy x RrYy" (with the letters' meanings when the text gives them: "T for tall, t for dwarf"). */
function punnettFromText(text: string): PunnettPlan | null {
  const m = text.match(/\b((?:[A-Z][A-Za-z]){1,2})\s*[×x✕*]\s*((?:[A-Z][A-Za-z]){1,2})\b/);
  if (!m || m[1].length !== m[2].length) return null;
  const letters = (m[1].match(/../g) ?? []).map((pp) => pp[0].toUpperCase());
  if ((m[1].match(/../g) ?? []).some((pp) => pp.toUpperCase() !== pp[0].toUpperCase().repeat(2))) return null;
  const meaning = (L: string, dom: boolean) => {
    const re = new RegExp(`\\b${dom ? L : L.toLowerCase()}\\b\\s*(?:for|=|:|represents|stands for)\\s*([a-z]+)`, dom ? '' : '');
    const mm = text.match(re);
    return mm ? mm[1] : dom ? 'dominant' : 'recessive';
  };
  const traits = letters.map((L) => ({ letter: L, dominant: { en: meaning(L, true), ml: meaning(L, true) }, recessive: { en: meaning(L, false), ml: meaning(L, false) } }));
  return {
    traits, parent1: m[1], parent2: m[2],
    steps: [
      { op: 'show', say: { en: `The cross is ${m[1]} × ${m[2]}.`, ml: `സങ്കരണം ${m[1]} × ${m[2]}.` } },
      { op: 'gametes', say: { en: 'Each parent gives one factor of each pair to a gamete.', ml: 'ഓരോ രക്ഷിതാവും ഓരോ ജോടിയിൽ നിന്നും ഒരു ഘടകം ബീജകോശത്തിന് നൽകുന്നു.' } },
      { op: 'grid', say: { en: 'Fill the Punnett square: one gamete from each parent in every box.', ml: 'പന്നറ്റ് ചതുരം പൂരിപ്പിക്കുക: ഓരോ കള്ളിയിലും ഓരോ രക്ഷിതാവിൽ നിന്നും ഒരു ബീജകോശം.' } },
      { op: 'ratio', say: { en: 'Count the boxes to get the ratio of the offspring.', ml: 'കള്ളികൾ എണ്ണിയാൽ സന്തതികളുടെ അനുപാതം കിട്ടും.' } },
    ],
  };
}
const ROLES = ['producer', 'primary consumer', 'secondary consumer', 'tertiary consumer', 'quaternary consumer'];
const ROLES_ML = ['ഉത്പാദകൻ', 'പ്രാഥമിക ഉപഭോക്താവ്', 'ദ്വിതീയ ഉപഭോക്താവ്', 'തൃതീയ ഉപഭോക്താവ്', 'ചതുർഥ ഉപഭോക്താവ്'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function chainFromText(text: string): ChainPlan | null {
  const m = text.match(/([A-Za-z][A-Za-z ]{1,24}(?:\s*(?:→|->|⟶)\s*[A-Za-z][A-Za-z ]{1,24}){2,4})/);
  if (!m || !/food|energy|eat|chain|consum|produc/i.test(text)) return null;
  const names = m[1].split(/→|->|⟶/).map((s) => s.trim()).filter(Boolean);
  if (names.length < 3 || names.length > 5) return null;
  const e = text.match(/(\d[\d,]*)\s*(?:kJ|kj|J|joules?)/);
  const start = e ? Number(e[1].replace(/,/g, '')) : 10000;
  return {
    organisms: names.map((n, i) => ({ name: { en: cap(n), ml: cap(n) }, role: { en: ROLES[i], ml: ROLES_ML[i] } })),
    startEnergy: start >= 10 ? start : 10000,
    steps: [
      { op: 'show', say: { en: `A food chain: ${names.join(', then ')}.`, ml: `ഒരു ഭക്ഷ്യശൃംഖല: ${names.join(' → ')}.` } },
      { op: 'flow', say: { en: 'Energy moves along the arrows; only about ten percent passes on.', ml: 'ഊർജ്ജം അമ്പുകളിലൂടെ നീങ്ങുന്നു; ഏകദേശം പത്തു ശതമാനം മാത്രം അടുത്ത തലത്തിലെത്തുന്നു.' } },
      { op: 'pyramid', say: { en: 'Each level up holds ten times less energy.', ml: 'ഓരോ തലത്തിലും ഊർജ്ജം പത്തിലൊന്നായി കുറയുന്നു.' } },
      { op: 'answer', say: { en: 'Very little energy reaches the top of the chain.', ml: 'ശൃംഖലയുടെ മുകളിലെത്തുന്ന ഊർജ്ജം വളരെ കുറവാണ്.' } },
    ],
  };
}

export const biologyAgent: SubjectAgent = {
  id: 'biology',
  name: 'Biology agent',
  templates: [chainTemplate, cellTemplate, punnettTemplate],
  claim: (b, ctx) => score(b, ctx, WORDS, 'biology'),
  fromText(b) {
    const p = chainFromText(b.text);
    if (p) return { template: 'food-chain', teach: p };
    const pu = punnettFromText(b.text);
    if (pu) return { template: 'punnett', teach: pu };
    const c = cellFromText(b.text);
    return c ? { template: 'cell', teach: c } : null;
  },
  system: `You are the BIOLOGY planning agent of a school classroom (Kerala / CBSE, classes 8–10). You turn ONE textbook block into a plan for ONE of three fixed picture templates. The app draws everything and computes every number (energy levels, gametes, Punnett boxes, ratios); you choose the template and write the captions.
Reply with ONE JSON object: {"template":"<id>","teach":{...},"read":{"en":"<the block text>","ml":"<faithful Malayalam translation>"}}. Every step is {"op":"...","say":{"en":"...","ml":"..."}}.
- "food-chain": {"organisms":[{"name":{en,ml},"role":{en,ml}}],"startEnergy":10000,"steps":[show, flow, pyramid, answer — each once, in order]}. 3–5 organisms from the producer upward. Do not write energy numbers in captions.
- "cell": {"kind":"plant"|"animal","steps":[show, then "part" steps with "part" one of membrane, wall, nucleus, cytoplasm, mitochondria, chloroplast, vacuole, er, golgi, ribosome (each once; no wall or chloroplast for an animal cell), then optionally "compare" last]}. The app writes each part's name and job.
- "punnett": {"traits":[{"letter":"T","dominant":{en:"tall",ml},"recessive":{en:"dwarf",ml}}] (1 or 2 traits),"parent1":"Tt","parent2":"Tt","steps":[show, gametes, grid, ratio — in order; grid required]}. Genotypes are one letter-pair per trait, in the order of traits (RrYy). Do not write ratios in captions unless sure: the board computes them.
Captions are spoken: one idea, 6–22 words, natural Malayalam.
If the block fits none of the three, reply {"template":null}.`,
};
