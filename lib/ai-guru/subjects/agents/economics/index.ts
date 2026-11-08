/**
 * V51.9.149 — the economics agent: demand, supply and price; the circular flow of income.
 * Claims blocks about markets, demand, supply, income, consumption and saving; reads simple demand/supply equations
 * and income figures straight from the text when there is no AI.
 */
import type { BookBlock } from '../../../motion-class/segment';
import type { SubjectAgent } from '../../types';
import { score } from '../../claim';
import { supplyDemandTemplate, type SupplyDemandPlan } from './supply-demand';
import { circularTemplate, type CircularPlan } from './circular-flow';

const WORDS: Array<[RegExp, number]> = [
  [/\b(demand|supply|law of demand|law of supply)\b/i, 0.4],
  [/\b(equilibrium|market|market price|price elasticity)\b/i, 0.2],
  [/\bQ\s*[ds]\s*=/i, 0.3],
  [/\b(households?|firms?|circular flow|factors of production|national income|consumption|saving|investment|GDP|disposable income)\b/i, 0.35],
  [/\b(economy|economic|economics|goods and services|producers?|consumers?|wages|rent|interest|profit|taxes?)\b/i, 0.2],
];

/** "Qd = 100 − 2P", "Qs = 10 + P" (with a possible shift "demand rises by 30"). */
function sdFromText(text: string): SupplyDemandPlan | null {
  const t = text.replace(/\s+/g, ' ').replace(/[–—−]/g, '-');
  const d = t.match(/Q\s*d\s*=\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)?\s*P/i);
  const s = t.match(/Q\s*s\s*=\s*(-?\s*\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)?\s*P/i);
  if (!d || !s) return null;
  const sh = t.match(/(demand|supply)\s+(?:rises|increases|goes up|falls|decreases|goes down)\s+by\s+(\d+(?:\.\d+)?)/i);
  const plan: SupplyDemandPlan = {
    demand: { a: Number(d[1]), b: Number(d[2] ?? 1) },
    supply: { c: Number(s[1].replace(/\s/g, '')), d: Number(s[2] ?? 1) },
    ...(sh ? { shift: { curve: sh[1].toLowerCase() as 'demand' | 'supply', by: Number(sh[2]) * (/(falls|decreases|down)/i.test(sh[0]) ? -1 : 1) } } : {}),
    steps: [
      { op: 'show', say: { en: 'Let us draw the market on a price–quantity graph.', ml: 'വിപണിയെ വില–അളവ് ഗ്രാഫിൽ വരയ്ക്കാം.' } },
      { op: 'demand', say: { en: 'The demand line slopes down: higher price, less bought.', ml: 'ചോദനരേഖ താഴേക്ക്: വില കൂടുമ്പോൾ വാങ്ങൽ കുറയുന്നു.' } },
      { op: 'supply', say: { en: 'The supply line slopes up: higher price, more offered.', ml: 'പ്രദാനരേഖ മുകളിലേക്ക്: വില കൂടുമ്പോൾ വിൽപ്പന കൂടുന്നു.' } },
      { op: 'equilibrium', say: { en: 'At equilibrium, quantity demanded equals quantity supplied.', ml: 'സന്തുലിതാവസ്ഥയിൽ ചോദനം = പ്രദാനം.' } },
    ],
  };
  if (sh) plan.steps.push({ op: 'shift', say: { en: `Now ${sh[1].toLowerCase()} changes; find the new equilibrium.`, ml: `ഇനി ${sh[1].toLowerCase() === 'demand' ? 'ചോദനം' : 'പ്രദാനം'} മാറുന്നു; പുതിയ സന്തുലിതാവസ്ഥ കണ്ടെത്താം.` } });
  return plan;
}

function flowFromText(text: string): CircularPlan | null {
  if (!/(circular flow|households?)/i.test(text) || !/(firms?|producers?|business)/i.test(text)) return null;
  const num = (re: RegExp) => { const m = text.match(re); return m ? Number(m[1].replace(/,/g, '')) : undefined; };
  const income = num(/income\s*(?:is|of|=)?\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
  const consumption = num(/consumption\s*(?:is|of|=)?\s*₹?\s*([\d,]+(?:\.\d+)?)/i) ?? num(/spend\w*\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
  const tax = num(/tax(?:es)?\s*(?:is|of|=)?\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
  const government = /government/i.test(text);
  const steps: CircularPlan['steps'] = [
    { op: 'show', say: { en: 'Households and firms depend on each other.', ml: 'കുടുംബങ്ങളും ഉത്പാദകരും പരസ്പരം ആശ്രയിക്കുന്നു.' } },
    { op: 'real', say: { en: 'Goods go to households; labour and land go to firms.', ml: 'സാധനങ്ങൾ കുടുംബങ്ങളിലേക്ക്; തൊഴിലും ഭൂമിയും ഉത്പാദകരിലേക്ക്.' } },
    { op: 'money', say: { en: 'Money moves the opposite way: spending and income.', ml: 'പണം എതിർദിശയിൽ: ചെലവും വരുമാനവും.' } },
  ];
  if (government) steps.push({ op: 'government', say: { en: 'The government collects taxes and spends on public services.', ml: 'സർക്കാർ നികുതി പിരിക്കുകയും പൊതുസേവനങ്ങൾക്ക് ചെലവഴിക്കുകയും ചെയ്യുന്നു.' } });
  if (income !== undefined && consumption !== undefined && income - (tax ?? 0) >= consumption) steps.push({ op: 'saving', say: { en: 'Income not spent is saved.', ml: 'ചെലവാക്കാത്ത വരുമാനമാണ് സമ്പാദ്യം.' } });
  return { government, ...(income !== undefined ? { income } : {}), ...(consumption !== undefined ? { consumption } : {}), ...(tax !== undefined && government ? { tax } : {}), steps };
}

export const economicsAgent: SubjectAgent = {
  id: 'economics',
  name: 'Economics agent',
  templates: [supplyDemandTemplate, circularTemplate],
  claim: (b: BookBlock, ctx) => score(b, ctx, WORDS, 'economics'),
  fromText(b) {
    const sd = sdFromText(b.text);
    if (sd) return { template: 'supply-demand', teach: sd };
    const cf = flowFromText(b.text);
    return cf ? { template: 'circular-flow', teach: cf } : null;
  },
  system: `You are the ECONOMICS planning agent of a school classroom (Kerala / CBSE, classes 8–12). You turn ONE textbook block into a plan for ONE of two fixed picture templates. The app draws everything and computes every number (equilibrium price and quantity, shifts, saving); you choose the template, give the data and write the captions.
Reply with ONE JSON object: {"template":"<id>","teach":{...},"read":{"en":"<the block text>","ml":"<faithful Malayalam translation>"}}. Every step is {"op":"...","say":{"en":"...","ml":"..."}}.
- "supply-demand": {"good":{en,ml},"demand":{"a":100,"b":2} (Qd = a − bP),"supply":{"c":10,"d":1} (Qs = c + dP),"shift":{"curve":"demand"|"supply","by":30} (optional; + = more at every price),"currency":"₹","steps":[show, demand, supply, equilibrium, shift — in order; equilibrium required]}. When the block only describes demand and supply in words, choose simple illustrative numbers and say so in the captions ("for example").
- "circular-flow": {"government":false,"income":1000,"consumption":750,"tax":100,"unit":"crore ₹","steps":[show, real, money, government, saving — in order]} (figures optional; "saving" needs income and consumption; "government" needs government true).
Captions are spoken: one idea, 6–22 words, natural Malayalam. Do not write computed numbers in captions unless sure.
If the block fits neither, reply {"template":null}.`,
};
