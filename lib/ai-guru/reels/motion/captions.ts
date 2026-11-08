/**
 * Step captions for the built-in arithmetic recipes, English + Malayalam.
 * Short, spoken-style lines (one idea per step) like the Learn-by-Line lessons.
 */

export type Lang = 'en' | 'ml';

type P = Record<string, string | number>;
type Tpl = (p: P) => string;

const PLACE_EN = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'lakhs', 'ten-lakhs'];
const PLACE_ML = ['ഒറ്റകൾ', 'പത്തുകൾ', 'നൂറുകൾ', 'ആയിരങ്ങൾ', 'പതിനായിരങ്ങൾ', 'ലക്ഷങ്ങൾ', 'പത്തുലക്ഷങ്ങൾ'];

export function placeName(lang: Lang, i: number): string {
  const t = lang === 'ml' ? PLACE_ML : PLACE_EN;
  return t[Math.min(i, t.length - 1)];
}

const EN: Record<string, Tpl> = {
  'add.title': (p) => `${p.expr} = ?`,
  'add.setup': () => 'Write the numbers one below the other, lining up the place values.',
  'add.col': (p) => `${cap(p.place)}: ${p.sum}`,
  'add.carry': (p) => `Write ${p.digit}, carry ${p.carry} to the ${p.next}.`,
  'add.lastCarry': (p) => `Bring down the carry ${p.carry}.`,
  'add.answer': (p) => `So, ${p.expr} = ${p.result}`,

  'sub.setup': () => 'Write the bigger number on top and line up the place values.',
  'sub.swap': (p) => `${p.a} is smaller than ${p.b}, so the answer is negative: work out ${p.b} − ${p.a}.`,
  'sub.borrow': (p) => `${p.top} is smaller than ${p.bottom}. Borrow 1 from the ${p.from}.`,
  'sub.borrowed': (p) => `${p.top} becomes ${p.now}.`,
  'sub.col': (p) => `${cap(p.place)}: ${p.top} − ${p.bottom} = ${p.diff}`,
  'sub.answer': (p) => `So, ${p.expr} = ${p.result}`,
  'sub.down': (p) => `${cap(p.place)}: nothing to subtract, bring down ${p.top}.`,
  'sub.pass': (p) => `The ${p.place} digit is 0, so it borrows too: 10 − 1 leaves 9.`,

  'mul.setup': () => 'Write the numbers one below the other.',
  'mul.by': (p) => `Multiply ${p.a} by the ${p.place} digit, ${p.d}.`,
  'mul.zero': (p) => `We are multiplying by ${p.place}, so first put ${p.n} in the ones place.`,
  'mul.prod': (p) => `${p.x} × ${p.y} = ${p.p}`,
  'mul.prodCarry': (p) => `${p.x} × ${p.y} = ${p.pp}, plus carry ${p.c} = ${p.p}`,
  'mul.carry': (p) => `Write ${p.digit}, carry ${p.carry}.`,
  'mul.add': () => 'Now add the rows.',
  'mul.answer': (p) => `So, ${p.expr} = ${p.result}`,

  'div.setup': () => 'Set up the long division: divisor outside, dividend inside.',
  'div.fits': (p) => `How many ${p.d}s in ${p.cur}? ${p.q}, because ${p.q} × ${p.d} = ${p.prod}.`,
  'div.zero': (p) => `${p.d} does not go into ${p.cur}. Write 0 in the quotient.`,
  'div.sub': (p) => `Subtract: ${p.cur} − ${p.prod} = ${p.r}`,
  'div.down': (p) => `Bring down the next digit, ${p.digit}.`,
  'div.answer': (p) => (Number(p.r) ? `So, ${p.a} ÷ ${p.d} = ${p.q}, remainder ${p.r}` : `So, ${p.a} ÷ ${p.d} = ${p.q}`),
};

const ML: Record<string, Tpl> = {
  'add.title': (p) => `${p.expr} = ?`,
  'add.setup': () => 'സ്ഥാനവില ഒത്തുവരുന്ന രീതിയിൽ സംഖ്യകൾ ഒന്നിനു താഴെ ഒന്നായി എഴുതുക.',
  'add.col': (p) => `${p.place}: ${p.sum}`,
  'add.carry': (p) => `${p.digit} എഴുതുക, ${p.carry} ${p.next} സ്ഥാനത്തേക്ക് കൊണ്ടുപോകുക.`,
  'add.lastCarry': (p) => `കൊണ്ടുവന്ന ${p.carry} താഴെ എഴുതുക.`,
  'add.answer': (p) => `അതിനാൽ, ${p.expr} = ${p.result}`,

  'sub.setup': () => 'വലിയ സംഖ്യ മുകളിൽ എഴുതി സ്ഥാനവിലകൾ ഒത്തുവയ്ക്കുക.',
  'sub.swap': (p) => `${p.a}, ${p.b}-നേക്കാൾ ചെറുതാണ്; ഉത്തരം ന്യൂനസംഖ്യ. ${p.b} − ${p.a} കണ്ടെത്താം.`,
  'sub.borrow': (p) => `${p.top}, ${p.bottom}-നേക്കാൾ ചെറുതാണ്. ${p.from} സ്ഥാനത്തുനിന്ന് 1 കടം വാങ്ങുക.`,
  'sub.borrowed': (p) => `${p.top} ഇപ്പോൾ ${p.now} ആയി.`,
  'sub.col': (p) => `${p.place}: ${p.top} − ${p.bottom} = ${p.diff}`,
  'sub.answer': (p) => `അതിനാൽ, ${p.expr} = ${p.result}`,
  'sub.down': (p) => `${p.place}: കുറയ്ക്കാൻ ഒന്നുമില്ല, ${p.top} താഴെ എഴുതുക.`,
  'sub.pass': (p) => `${p.place} സ്ഥാനത്ത് 0 ആണ്; അതും കടം വാങ്ങുന്നു: 10 − 1 = 9.`,

  'mul.setup': () => 'സംഖ്യകൾ ഒന്നിനു താഴെ ഒന്നായി എഴുതുക.',
  'mul.by': (p) => `${p.a}-നെ ${p.place} സ്ഥാനത്തെ അക്കമായ ${p.d} കൊണ്ട് ഗുണിക്കുക.`,
  'mul.zero': (p) => `${p.place} കൊണ്ടാണ് ഗുണിക്കുന്നത്, അതിനാൽ ആദ്യം ${p.n} എഴുതുക.`,
  'mul.prod': (p) => `${p.x} × ${p.y} = ${p.p}`,
  'mul.prodCarry': (p) => `${p.x} × ${p.y} = ${p.pp}, കൂടെ ${p.c} ചേർത്താൽ ${p.p}`,
  'mul.carry': (p) => `${p.digit} എഴുതുക, ${p.carry} അടുത്ത സ്ഥാനത്തേക്ക്.`,
  'mul.add': () => 'ഇനി വരികൾ കൂട്ടുക.',
  'mul.answer': (p) => `അതിനാൽ, ${p.expr} = ${p.result}`,

  'div.setup': () => 'ഹരണം ക്രമീകരിക്കുക: ഹാരകം പുറത്ത്, ഹാര്യം അകത്ത്.',
  'div.fits': (p) => `${p.cur}-ൽ ${p.d} എത്ര തവണ? ${p.q}, കാരണം ${p.q} × ${p.d} = ${p.prod}.`,
  'div.zero': (p) => `${p.cur}-ൽ ${p.d} പോകില്ല. ഹരണഫലത്തിൽ 0 എഴുതുക.`,
  'div.sub': (p) => `കുറയ്ക്കുക: ${p.cur} − ${p.prod} = ${p.r}`,
  'div.down': (p) => `അടുത്ത അക്കമായ ${p.digit} താഴേക്ക് ഇറക്കുക.`,
  'div.answer': (p) =>
    Number(p.r) ? `അതിനാൽ, ${p.a} ÷ ${p.d} = ${p.q}, ശിഷ്ടം ${p.r}` : `അതിനാൽ, ${p.a} ÷ ${p.d} = ${p.q}`,
};

function cap(v: string | number): string {
  const s = String(v);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function say(lang: Lang, key: string, p: P = {}): string {
  const t = (lang === 'ml' ? ML : EN)[key] ?? EN[key];
  if (!t) throw new Error(`caption: missing key ${key}`);
  return t(p);
}

export const STEP_LABEL: Record<Lang, string> = { en: 'STEP', ml: 'ഘട്ടം' };
