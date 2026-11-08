/**
 * The chemistry agent. Claims blocks about reactions, elements, compounds, acids and bases; owns the
 * "balance-equation" template; reads an equation such as "CH4 + O2 → CO2 + H2O" straight from the text.
 * V51.9.147: also "periodic-table" (an element: group, period, shells, configuration, valency) and "molar-mass"
 * (molecular mass, moles, molecules); the balancer is exact (any size of coefficient).
 */

import type { BookBlock } from '../../../motion-class/segment';
import type { SubjectAgent } from '../../types';
import { score } from '../../claim';
import { balanceTemplate, parseFormula, toSub, type BalancePlan } from './balance-equation';
import { tableTemplate, type TablePlan } from './periodic-table';
import { massTemplate, type MassPlan } from './molar-mass';
import { ELEMENTS, findElement, valencyOf, type Element } from './elements';

const WORDS: Array<[RegExp, number]> = [
  [/\b(reaction|reactant|reactants|product|products|compound|element|molecule|atom|atoms|ion|ions)\b/i, 0.35],
  [/\b(acid|base|alkali|salt|ph|oxidation|reduction|combustion|precipitate|catalyst|equation)\b/i, 0.3],
  [/\b(mole|molar|valency|periodic table|bond|covalent|ionic|solution|solvent|solute)\b/i, 0.25],
  [/\b(?:[A-Z][a-z]?\d*){2,}\b/, 0.15],
  [/\b(atomic number|mass number|electronic configuration|electron configuration|shells?|sub-?shells?|orbitals?|group|period|metals?|non-?metals?|noble gas(?:es)?)\b/i, 0.2],
  [/\b(molecular mass|molar mass|gram molecular mass|gram atomic mass|GMM|GAM|avogadro|moles?)\b/i, 0.35],
  [new RegExp(`\\b(${ELEMENTS.slice(0, 56).map((e) => e.name).join('|')}|sulphur)\\b`, 'i'), 0.2],
];

const ELEMENT_WORD = new RegExp(`\\b(${ELEMENTS.slice(0, 56).map((e) => e.name).join('|')}|sulphur|aluminum)\\b`, 'i');

/** "the electronic configuration of sodium", "element with atomic number 17", "position of Mg in the periodic table". */
function elementFromText(text: string): TablePlan | null {
  const t = text.replace(/\s+/g, ' ');
  if (!/(periodic table|electronic configuration|electron configuration|shell|valency|group|period|atomic number|bohr)/i.test(t)) return null;
  let e: Element | null = null;
  const z = t.match(/atomic number (?:of )?(?:is )?(\d{1,3})\b/i);
  if (z) e = findElement(Number(z[1]));
  if (!e) { const w = t.match(ELEMENT_WORD); if (w) e = findElement(w[1]); }
  if (!e) { const sy = t.match(/\b(?:of|is|element|atom of)\s+([A-Z][a-z]?)\b(?![a-z])/); if (sy) e = findElement(sy[1]); }
  if (!e || e.z > 56) return null;
  const v = valencyOf(e);
  const steps: TablePlan['steps'] = [
    { op: 'show', say: { en: 'Here is the periodic table: elements in order of atomic number, in groups and periods.', ml: 'ഇതാ ആവർത്തനപ്പട്ടിക: അറ്റോമിക നമ്പർ ക്രമത്തിൽ, ഗ്രൂപ്പുകളിലും പീരിയഡുകളിലുമായി മൂലകങ്ങൾ.' } },
    { op: 'locate', say: { en: `Find ${e.name}: its group is the column and its period is the row.`, ml: `${e.name} കണ്ടെത്താം: ഗ്രൂപ്പ് നിരയും പീരിയഡ് വരിയുമാണ്.` } },
    { op: 'card', say: { en: `The atomic number of ${e.name} is ${e.z}, so its atom has ${e.z} electrons.`, ml: `${e.name}-ന്റെ അറ്റോമിക നമ്പർ ${e.z}; അതിനാൽ ആറ്റത്തിൽ ${e.z} ഇലക്ട്രോൺ.` } },
    { op: 'shells', say: { en: 'The electrons fill the shells K, L, M and N in order.', ml: 'ഇലക്ട്രോണുകൾ K, L, M, N ഷെല്ലുകളിൽ ക്രമത്തിൽ നിറയുന്നു.' } },
    { op: 'config', say: { en: 'Written by sub-shells, this is the electronic configuration.', ml: 'സബ്ഷെൽ ക്രമത്തിൽ എഴുതിയാൽ ഇതാണ് ഇലക്ട്രോൺ വിന്യാസം.' } },
  ];
  if (v) steps.push({ op: 'valency', say: { en: 'The electrons in the outer shell decide the valency.', ml: 'ബാഹ്യതമ ഷെല്ലിലെ ഇലക്ട്രോണുകളാണ് സംയോജകത നിശ്ചയിക്കുന്നത്.' } });
  return { element: e.symbol, steps };
}

/** "molecular mass of H2SO4", "how many moles are in 49 g of H2SO4". */
function massFromText(text: string): MassPlan | null {
  const t = text.replace(/\s+/g, ' ');
  if (!/(molecular mass|molar mass|gram molecular|GMM|moles?\b|avogadro)/i.test(t)) return null;
  const F = /\b((?:[A-Z][a-z]?\d*|\([A-Za-z0-9]+\)\d*){2,})\b/g;
  let formula: string | null = null;
  let mm: RegExpExecArray | null;
  while ((mm = F.exec(t))) if (parseFormula(mm[1]) && /\d|[A-Z].*[A-Z]/.test(mm[1])) { formula = mm[1]; break; }
  if (!formula) return null;
  const g = t.match(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/i);
  const massG = g ? Number(g[1]) : undefined;
  const steps: MassPlan['steps'] = [
    { op: 'show', say: { en: `Find the molecular mass of ${formula}${massG !== undefined ? ` and the moles in ${massG} grams` : ''}.`, ml: `${formula}-ന്റെ തന്മാത്രാ മാസ്${massG !== undefined ? `, ${massG} ഗ്രാമിലെ മോളുകൾ` : ''} കണ്ടെത്താം.` } },
    { op: 'atoms', say: { en: 'Count the atoms of each element in one molecule.', ml: 'ഒരു തന്മാത്രയിലെ ഓരോ മൂലകത്തിന്റെയും ആറ്റങ്ങൾ എണ്ണുക.' } },
    { op: 'multiply', say: { en: 'Multiply each count by its atomic mass.', ml: 'ഓരോ എണ്ണത്തെയും അറ്റോമിക മാസ് കൊണ്ട് ഗുണിക്കുക.' } },
    { op: 'add', say: { en: 'Add them to get the molecular mass; one mole has that many grams.', ml: 'ഇവ കൂട്ടിയാൽ തന്മാത്രാ മാസ്; ഒരു മോളിന് അത്രയും ഗ്രാം.' } },
  ];
  if (massG !== undefined) steps.push({ op: 'moles', say: { en: 'Moles = given mass ÷ molar mass.', ml: 'മോൾ = നൽകിയ മാസ് ÷ മോളാർ മാസ്.' } });
  if (massG !== undefined && /(molecules|particles|avogadro)/i.test(t)) steps.push({ op: 'particles', say: { en: 'Each mole has 6.022 × 10²³ molecules.', ml: 'ഓരോ മോളിലും 6.022 × 10²³ തന്മാത്രകൾ.' } });
  return { formula, ...(massG !== undefined ? { massG } : {}), steps };
}

function equationFromText(text: string): BalancePlan | null {
  const clean = text.replace(/\s+/g, ' ');
  const F = '(?:\\d+\\s*)?[A-Z][A-Za-z0-9()₀-₉]*';
  const left = new RegExp(`((?:${F}\\s*\\+\\s*)*${F})\\s*$`);
  const right = new RegExp(`^\\s*((?:${F}\\s*\\+\\s*)*${F})`);
  const parts = clean.split(/\s*(?:→|->|⟶|=>)\s*/);
  for (let k = 0; k + 1 < parts.length; k++) {
    const l = parts[k].match(left);
    const r = parts[k + 1].match(right);
    if (!l || !r) continue;
    const split = (s: string) => s.split('+').map((x) => x.trim().replace(/^\d+\s*/, '').replace(/[₀-₉]/g, (c) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c))));
    const reactants = split(l[1]);
    const products = split(r[1]);
    if (reactants.length > 4 || products.length > 4) continue;
    if (![...reactants, ...products].every((f) => parseFormula(f))) continue;
    const names = (xs: string[]) => xs.map(toSub).join(' + ');
    return {
      reactants,
      products,
      steps: [
        { op: 'show', say: { en: `Here is the reaction: ${names(reactants)} gives ${names(products)}.`, ml: `ഇതാ രാസപ്രവർത്തനം: ${names(reactants)} → ${names(products)}.` } },
        { op: 'count', say: { en: 'Count the atoms of each element on both sides.', ml: 'ഇരുവശത്തെയും ഓരോ മൂലകത്തിന്റെയും ആറ്റങ്ങൾ എണ്ണുക.' } },
        { op: 'balance', say: { en: 'Put numbers in front of the formulas until every count matches.', ml: 'എല്ലാ എണ്ണവും തുല്യമാകുന്നതുവരെ സൂത്രവാക്യങ്ങൾക്ക് മുന്നിൽ സംഖ്യകൾ ചേർക്കുക.' } },
        { op: 'check', say: { en: 'Both sides have the same atoms. The equation is balanced.', ml: 'ഇരുവശത്തും ഒരേ ആറ്റങ്ങൾ. സമവാക്യം സന്തുലിതം.' } },
      ],
    };
  }
  return null;
}

export const chemistryAgent: SubjectAgent = {
  id: 'chemistry',
  name: 'Chemistry agent',
  templates: [balanceTemplate, tableTemplate, massTemplate],
  claim: (b: BookBlock, ctx) => score(b, ctx, WORDS, 'chemistry'),
  fromText(b) {
    const plan = equationFromText(b.text);
    if (plan) return { template: 'balance-equation', teach: plan };
    const mass = massFromText(b.text);
    if (mass) return { template: 'molar-mass', teach: mass };
    const el = elementFromText(b.text);
    return el ? { template: 'periodic-table', teach: el } : null;
  },
  system: `You are the CHEMISTRY planning agent of a school classroom (Kerala / CBSE, classes 8–10). You turn ONE textbook block into a plan for ONE of three fixed picture templates. The app computes every number written on the board (coefficients, atom counts, masses, moles, shells, valency); you choose the template, name the formulas or the element, and write the captions.
Reply with ONE JSON object: {"template":"balance-equation"|"periodic-table"|"molar-mass","teach":{...},"read":{"en":"<the block text>","ml":"<faithful Malayalam translation>"}}.
"balance-equation": {"reactants":["CH4","O2"],"products":["CO2","H2O"],"steps":[show, count, balance, check — each once, in this order, each {"op":..,"say":{en,ml}}]}. Formulas are plain ASCII with digits for subscripts (H2O, Ca(OH)2, Fe2O3), no coefficients, no state symbols, 1–4 per side; both sides must contain the same elements.
"periodic-table": {"element":"Na","steps":[show, then any of locate, card, shells, config, valency — in this order, each at most once]}. element is a symbol, an English name or an atomic number. Use it for an element's position (group, period), atomic number, electrons in shells (K L M N), electronic configuration (1s² 2s² …) or valency. valency only for groups 1, 2 and 13–18.
"molar-mass": {"formula":"H2SO4","massG":49,"steps":[show, atoms, multiply, add, then moles, particles — in this order, each at most once]}. Use it for molecular mass / gram molecular mass, moles from a mass (needs massG in grams) and the number of molecules (Avogadro number). "add" is required.
Captions are spoken: one idea, 6–22 words, bilingual {"en","ml"} (natural Malayalam; keep symbols and digits). Do not write computed numbers in captions unless you are sure: the board shows them.
If the block fits none of the three, reply {"template":null}.`,
};
