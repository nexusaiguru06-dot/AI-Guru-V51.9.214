/**
 * V51.9.118 — turning a lesson passage into a story reel's storyboard.
 *
 *  The AI (the student's own key, through callAiGuruText) reads the passage and plans the cast and the shots, with every
 *  line in English and Malayalam. Its answer is checked and tidied here: only known settings, characters, props and
 *  actions; at most 8 shots, 6 characters, 4 in a shot; whoever speaks is in the shot. Without AI (no key, offline)
 *  the passage is split into shots by sentences and the setting and characters are guessed from its words.
 *
 *  "Redo this shot" asks for one shot again (or, without AI, frames it a different way); the editor keeps the earlier
 *  version so the student can go back. Pure (no network), except `makeStoryboard` / `redoShot` which take the AI call.
 */
import { ACTIONS, CAST_KINDS, PROPS, SETTINGS, type Action, type Bi, type CastKind, type CastMember, type Prop, type Setting, type Shot, type StoryBoard } from '../motion/recipes/story';

export const MAX_SHOTS = 8, MAX_CAST = 6, MAX_IN_SHOT = 4;
const ML = /[ഀ-ൿ]/;
export const isMalayalam = (s: string) => ML.test(s);

/* ---------------- the AI prompt ---------------- */

export const STORY_SYSTEM = `You turn a school lesson passage (a story, a history event, a poem's story, a Malayalam lesson) into a short animated story reel for Indian students.
Reply with JSON only, in exactly this shape:
{"title":{"en":"…","ml":"…"},
 "cast":[{"id":"c1","name":{"en":"…","ml":"…"},"kind":"…"}],
 "shots":[{"setting":"…","who":["c1"],"action":"…","props":["…"],"narration":{"en":"…","ml":"…"},"line":{"who":"c1","text":{"en":"…","ml":"…"}}}]}
Rules:
- 4 to ${MAX_SHOTS} shots, in story order. Each narration is one or two short sentences (at most 30 words) a child can follow.
- "line" is what one character says in that shot (at most 15 words), or null. The speaker must be in "who".
- kind is one of: ${CAST_KINDS.join(', ')}.
- setting is one of: ${SETTINGS.join(', ')}.
- action is one of: ${ACTIONS.join(', ')} ("fly" only for a bird).
- props: up to 3 of: ${PROPS.join(', ')} (or []).
- At most ${MAX_CAST} characters, at most ${MAX_IN_SHOT} in a shot. Keep the passage's names and facts; do not invent events.
- Give every text in English ("en") and natural, simple Malayalam ("ml").
- Keep it gentle: no blood, weapons shown or frightening detail; tell hard history events calmly and respectfully.`;

export const storyUser = (passage: string, standard?: string) =>
  `${standard ? `Class: Std ${standard}.\n` : ''}Passage:\n"""\n${passage.trim().slice(0, 6000)}\n"""`;

export const redoSystem = `${STORY_SYSTEM}
Now redo ONE shot only. Reply with that one shot's JSON object (same shape as an item of "shots"). Tell the same moment of the story, but frame it differently (another action, order of characters, props, or wording).`;

export const redoUser = (board: StoryBoard, index: number) =>
  `Story so far:\n${JSON.stringify(board)}\n\nRedo shot number ${index + 1}.`;

/* ---------------- checking the answer ---------------- */

const strip = (s: string) => s.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
function bi(v: unknown, max = 300): Bi | null {
  if (typeof v === 'string') { const t = str(v, max); return t ? (isMalayalam(t) ? { en: t, ml: t } : { en: t }) : null; }
  const o = (v ?? {}) as Record<string, unknown>;
  const en = str(o.en, max), ml = str(o.ml, max);
  if (!en && !ml) return null;
  return { en: en || ml, ...(ml ? { ml } : {}) };
}
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v.trim().toLowerCase()) ? (v.trim().toLowerCase() as T) : null);

/** A kind from any word (an AI's "crow", "grandfather", "princess" …). */
export function guessKind(word: string): CastKind {
  const w = word.toLowerCase();
  const exact = oneOf(w, CAST_KINDS);
  if (exact) return exact;
  if (/crow|bird|parrot|sparrow|peacock|eagle|കാക്ക|പക്ഷി|തത്ത|മയിൽ/.test(w)) return 'bird';
  if (/elephant|ആന/.test(w)) return 'elephant';
  if (/tiger|lion|leopard|കടുവ|സിംഹ|പുലി/.test(w)) return 'tiger';
  if (/monkey|ape|കുരങ്ങ്|വാനര/.test(w)) return 'monkey';
  if (/princess|queen|rani|റാണി|രാജ്ഞി/.test(w)) return 'queen';
  if (/king|prince|raja|emperor|ruler|രാജാവ്|രാജ/.test(w)) return 'king';
  if (/sage|saint|guru|monk|rishi|മുനി|സന്യാസി|ഋഷി/.test(w)) return 'sage';
  if (/teacher|master|ടീച്ചർ|അധ്യാപ|മാഷ്/.test(w)) return 'teacher';
  if (/grandmother|grandma|old woman|മുത്തശ്ശി|അമ്മൂമ്മ/.test(w)) return 'grandmother';
  if (/grandfather|grandpa|old man|elder|മുത്തച്ഛ|അപ്പൂപ്പ|വൃദ്ധ/.test(w)) return 'elder';
  if (/girl|daughter|sister|പെൺകുട്ടി|മകൾ/.test(w)) return 'girl';
  if (/boy|son|brother|child|kid|ആൺകുട്ടി|മകൻ|കുട്ടി/.test(w)) return 'boy';
  if (/woman|mother|lady|wife|അമ്മ|സ്ത്രീ/.test(w)) return 'woman';
  return 'man';
}

function cleanShot(raw: unknown, castIds: Set<string>, birds: Set<string>): Shot | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const narration = bi(o.narration, 400);
  if (!narration) return null;
  const setting = oneOf(o.setting, SETTINGS) ?? guessSetting(`${narration.en} ${narration.ml ?? ''}`);
  let who = (Array.isArray(o.who) ? o.who : []).map((x) => str(x, 40)).filter((x, i, a) => castIds.has(x) && a.indexOf(x) === i).slice(0, MAX_IN_SHOT);
  const lo = (o.line ?? null) as Record<string, unknown> | null;
  const lineText = lo ? bi(lo.text ?? lo, 200) : null;
  let line: Shot['line'] = null;
  if (lo && lineText) {
    const sp = str(lo.who, 40);
    if (castIds.has(sp)) {
      if (!who.includes(sp)) who = [...who.slice(0, MAX_IN_SHOT - 1), sp];
      line = { who: sp, text: lineText };
    }
  }
  let action = oneOf<Action>(o.action, ACTIONS) ?? 'stand';
  if (action === 'fly' && !who.some((id) => birds.has(id))) action = 'enter';
  const props = (Array.isArray(o.props) ? o.props : []).map((p) => oneOf<Prop>(p, PROPS)).filter((p, i, a): p is Prop => !!p && a.indexOf(p) === i).slice(0, 3);
  return { setting, who, action, props, narration, line };
}

/** Checks and tidies an AI storyboard (text or object). Throws when nothing usable is in it. */
export function parseStoryboard(input: string | unknown): StoryBoard {
  const raw = typeof input === 'string' ? JSON.parse(strip(input)) : input;
  const o = (raw ?? {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const cast: CastMember[] = [];
  for (const c of Array.isArray(o.cast) ? o.cast : []) {
    const r = (c ?? {}) as Record<string, unknown>;
    const name = bi(r.name, 40);
    let id = str(r.id, 40) || `c${cast.length + 1}`;
    if (!name || cast.length >= MAX_CAST) continue;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    cast.push({ id, name, kind: oneOf(r.kind, CAST_KINDS) ?? guessKind(`${str(r.kind)} ${name.en}`) });
  }
  const ids = new Set(cast.map((c) => c.id));
  const birds = new Set(cast.filter((c) => c.kind === 'bird').map((c) => c.id));
  const shots = (Array.isArray(o.shots) ? o.shots : []).map((s) => cleanShot(s, ids, birds)).filter((s): s is Shot => !!s).slice(0, MAX_SHOTS);
  if (!shots.length) throw new Error('The storyboard has no shots.');
  const title = bi(o.title, 80) ?? { en: 'A story' };
  return { title, cast, shots };
}

/** One shot from a "redo this shot" answer (checked against the story's cast). */
export function parseShot(input: string | unknown, board: StoryBoard): Shot {
  const raw = typeof input === 'string' ? JSON.parse(strip(input)) : input;
  const o = (raw ?? {}) as Record<string, unknown>;
  const shot = cleanShot(Array.isArray(o.shots) ? o.shots[0] : o.shot ?? o, new Set(board.cast.map((c) => c.id)), new Set(board.cast.filter((c) => c.kind === 'bird').map((c) => c.id)));
  if (!shot) throw new Error('The new shot has no narration.');
  return shot;
}

/* ---------------- without AI ---------------- */

const SETTING_WORDS: Array<[Setting, RegExp]> = [
  ['night', /\bnight|moon|star|dark\b|രാത്രി|ചന്ദ്ര|നക്ഷത്ര/i],
  ['river', /river|stream|boat|lake|പുഴ|നദി|തോണി|വള്ളം|കായൽ/i],
  ['sea', /\bsea\b|ocean|beach|shore|കടൽ|തീരം/i],
  ['temple', /temple|shrine|festival|ക്ഷേത്ര|അമ്പല|ഉത്സവ/i],
  ['palace', /palace|king|queen|court|throne|kingdom|കൊട്ടാര|രാജാവ്|രാജ്യ|സിംഹാസന/i],
  ['forest', /forest|jungle|wood|tree|കാട്|വന|മരം/i],
  ['school', /school|class|teacher|lesson|സ്കൂൾ|ക്ലാസ്|വിദ്യാലയ|ടീച്ചർ/i],
  ['field', /field|paddy|farm|harvest|crop|വയൽ|പാടം|കൃഷി|കൊയ്ത്ത്/i],
  ['market', /market|shop|bazaar|sell|buy|ചന്ത|കട|അങ്ങാടി/i],
  ['home', /\bhome|house|kitchen|room|വീട്|അടുക്കള/i],
];
export function guessSetting(text: string): Setting {
  for (const [s, re] of SETTING_WORDS) if (re.test(text)) return s;
  return 'village';
}

const STOP = new Set(['The', 'A', 'An', 'He', 'She', 'It', 'They', 'We', 'I', 'You', 'One', 'Once', 'Then', 'But', 'And', 'So', 'When', 'After', 'At', 'In', 'On', 'His', 'Her', 'Their', 'This', 'That', 'There', 'Next', 'Soon', 'Finally', 'Every', 'All', 'What', 'Why', 'How', 'Where', 'Who', 'Yes', 'No', 'Now', 'Long', 'Many', 'Some', 'India', 'Kerala']);
const ANIMALS: Array<[RegExp, CastKind, Bi]> = [
  [/crow|കാക്ക/i, 'bird', { en: 'Crow', ml: 'കാക്ക' }],
  [/elephant|ആന/i, 'elephant', { en: 'Elephant', ml: 'ആന' }],
  [/tiger|lion|കടുവ|സിംഹ/i, 'tiger', { en: 'Tiger', ml: 'കടുവ' }],
  [/monkey|കുരങ്ങ/i, 'monkey', { en: 'Monkey', ml: 'കുരങ്ങൻ' }],
  [/\bbird|parrot|പക്ഷി|തത്ത/i, 'bird', { en: 'Bird', ml: 'പക്ഷി' }],
  [/\bking\b|രാജാവ്/i, 'king', { en: 'King', ml: 'രാജാവ്' }],
  [/teacher|ടീച്ചർ|അധ്യാപക/i, 'teacher', { en: 'Teacher', ml: 'ടീച്ചർ' }],
];

/** Sentences of a passage (English or Malayalam). */
export function sentences(text: string): string[] {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?।])\s+(?=["“'‘(]?[^\s])/).map((s) => s.trim()).filter((s) => s.length > 1);
}

/** A storyboard without AI: shots of one or two sentences, the setting and characters guessed from the words. */
export function storyboardWithoutAi(passage: string, title?: string): StoryBoard {
  const text = passage.trim();
  if (!text) throw new Error('Paste the story or lesson passage first.');
  const ml = isMalayalam(text);
  const ss = sentences(text);
  const per = Math.max(1, Math.ceil(ss.length / MAX_SHOTS));
  const groups: string[][] = [];
  for (let i = 0; i < ss.length; i += Math.max(per, ss.length > 6 ? 2 : 1)) groups.push(ss.slice(i, i + Math.max(per, ss.length > 6 ? 2 : 1)));
  // characters: names said twice or more (English), then animals / roles in the words
  const cast: CastMember[] = [];
  if (!ml) {
    const count = new Map<string, number>();
    for (const w of text.match(/\b[A-Z][a-z]{2,}\b/g) ?? []) if (!STOP.has(w)) count.set(w, (count.get(w) ?? 0) + 1);
    [...count.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([name], k) => {
      const near = new RegExp(`${name}[^.]{0,40}`, 'i').exec(text)?.[0] ?? '';
      const kind = guessKind(near);
      cast.push({ id: `c${k + 1}`, name: { en: name }, kind: kind === 'man' && k % 2 ? 'woman' : kind });
    });
  }
  for (const [re, kind, name] of ANIMALS) if (cast.length < 4 && re.test(text) && !cast.some((c) => c.kind === kind)) cast.push({ id: `c${cast.length + 1}`, name, kind });
  const shots: Shot[] = groups.slice(0, MAX_SHOTS).map((g, k) => {
    const said = g.join(' ');
    const here = cast.filter((c) => [c.name.en, c.name.ml].some((n) => n && said.toLowerCase().includes(n.toLowerCase())));
    const who = (here.length ? here : cast.slice(0, 1)).slice(0, MAX_IN_SHOT).map((c) => c.id);
    const q = /["“]([^"”]{3,120})["”]/.exec(said);
    const narration: Bi = ml ? { en: said, ml: said } : { en: said };
    const quote = q ? q[1] : '';
    return {
      setting: guessSetting(said),
      who,
      action: k === 0 && who.length ? (cast.find((c) => c.id === who[0])?.kind === 'bird' ? 'fly' : 'enter') : 'stand',
      props: [],
      narration,
      line: quote && who[0] ? { who: who[0], text: ml ? { en: quote, ml: quote } : { en: quote } } : null,
    };
  });
  const first = ss[0] ?? text;
  const t = title?.trim() || (first.length > 48 ? `${first.slice(0, 45)}…` : first);
  return { title: ml ? { en: t, ml: t } : { en: t }, cast, shots };
}

/** Without AI, "redo this shot" frames it another way: the next action, the characters in the other order. */
export function varyShot(shot: Shot, board: StoryBoard): Shot {
  const birds = new Set(board.cast.filter((c) => c.kind === 'bird').map((c) => c.id));
  const can = ACTIONS.filter((a) => a !== 'fly' || shot.who.some((id) => birds.has(id)));
  const action = can[(can.indexOf(shot.action) + 1) % can.length];
  return { ...shot, action, who: [...shot.who].reverse() };
}

/* ---------------- with AI ---------------- */

export type Llm = (system: string, user: string) => Promise<string>;

/** The storyboard by AI; on any failure, the one made without AI (and why). */
export async function makeStoryboard(passage: string, llm: Llm | null, o: { standard?: string; title?: string } = {}): Promise<{ board: StoryBoard; by: 'ai' | 'plain'; note?: string }> {
  if (!passage.trim()) throw new Error('Paste the story or lesson passage first.');
  if (llm) {
    try {
      const board = parseStoryboard(await llm(STORY_SYSTEM, storyUser(passage, o.standard)));
      if (o.title?.trim()) board.title = { ...board.title, en: o.title.trim() };
      return { board, by: 'ai' };
    } catch (e) {
      return { board: storyboardWithoutAi(passage, o.title), by: 'plain', note: `AI could not plan it (${e instanceof Error ? e.message : String(e)}), so it was split by sentences.` };
    }
  }
  return { board: storyboardWithoutAi(passage, o.title), by: 'plain' };
}

/** One shot again (AI), or framed another way when AI is not there or fails. */
export async function redoShot(board: StoryBoard, index: number, llm: Llm | null): Promise<{ shot: Shot; by: 'ai' | 'plain' }> {
  if (llm) {
    try { return { shot: parseShot(await llm(redoSystem, redoUser(board, index)), board), by: 'ai' }; } catch { /* fall through */ }
  }
  return { shot: varyShot(board.shots[index], board), by: 'plain' };
}

/* ---------------- kept on this device ---------------- */

const KEY = 'ai-guru:story-board:v1';
export function saveBoard(b: StoryBoard | null) { try { if (b) localStorage.setItem(KEY, JSON.stringify(b)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } }
export function loadBoard(): StoryBoard | null { try { const s = localStorage.getItem(KEY); return s ? parseStoryboard(JSON.parse(s)) : null; } catch { return null; } }

/* ---------------- ready samples ---------------- */

export const SAMPLE_STORIES: Array<{ id: string; label: string; board: StoryBoard }> = [
  {
    id: 'thirsty-crow',
    label: 'The thirsty crow (fable)',
    board: {
      title: { en: 'The Thirsty Crow', ml: 'ദാഹിച്ച കാക്ക' },
      cast: [{ id: 'crow', name: { en: 'Crow', ml: 'കാക്ക' }, kind: 'bird' }],
      shots: [
        { setting: 'field', who: ['crow'], action: 'fly', props: [], narration: { en: 'It was a very hot summer day. A thirsty crow flew far, looking for water.', ml: 'ഒരു കടുത്ത വേനൽ ദിവസം. ദാഹിച്ചു വലഞ്ഞ ഒരു കാക്ക വെള്ളം തേടി ഒരുപാട് ദൂരം പറന്നു.' }, line: null },
        { setting: 'village', who: ['crow'], action: 'stand', props: ['pot'], narration: { en: 'At last it saw a pot. But the water was far down at the bottom.', ml: 'ഒടുവിൽ അത് ഒരു കുടം കണ്ടു. പക്ഷേ വെള്ളം കുടത്തിന്റെ അടിയിലായിരുന്നു.' }, line: { who: 'crow', text: { en: 'My beak cannot reach the water!', ml: 'എന്റെ കൊക്ക് വെള്ളം വരെ എത്തുന്നില്ലല്ലോ!' } } },
        { setting: 'village', who: ['crow'], action: 'stand', props: ['pot', 'pebbles'], narration: { en: 'The clever crow had an idea. It dropped pebbles into the pot, one by one.', ml: 'ബുദ്ധിമാനായ കാക്കയ്ക്ക് ഒരു ആശയം തോന്നി. അത് ഓരോ കല്ലായി കുടത്തിലേക്ക് ഇട്ടു.' }, line: null },
        { setting: 'village', who: ['crow'], action: 'stand', props: ['pot-full'], narration: { en: 'The water rose to the top. The crow drank happily and flew away.', ml: 'വെള്ളം മുകളിലേക്ക് ഉയർന്നു. കാക്ക സന്തോഷത്തോടെ വെള്ളം കുടിച്ച് പറന്നുപോയി.' }, line: { who: 'crow', text: { en: 'Where there is a will, there is a way!', ml: 'മനസ്സുണ്ടെങ്കിൽ വഴിയുമുണ്ട്!' } } },
      ],
    },
  },
  {
    id: 'ammu-purse',
    label: 'Ammu and the lost purse (honesty)',
    board: {
      title: { en: 'Ammu and the Lost Purse', ml: 'അമ്മുവും കളഞ്ഞുപോയ പഴ്സും' },
      cast: [
        { id: 'ammu', name: { en: 'Ammu', ml: 'അമ്മു' }, kind: 'girl' },
        { id: 'raghavan', name: { en: 'Grandpa Raghavan', ml: 'രാഘവൻ മുത്തച്ഛൻ' }, kind: 'elder' },
        { id: 'lakshmi', name: { en: 'Lakshmi Teacher', ml: 'ലക്ഷ്മി ടീച്ചർ' }, kind: 'teacher' },
      ],
      shots: [
        { setting: 'market', who: ['ammu'], action: 'walk', props: ['purse'], narration: { en: 'One morning, Ammu was walking through the market. She saw a purse lying on the ground.', ml: 'ഒരു ദിവസം രാവിലെ അമ്മു ചന്തയിലൂടെ നടക്കുകയായിരുന്നു. നിലത്ത് ഒരു പഴ്സ് കിടക്കുന്നത് അവൾ കണ്ടു.' }, line: null },
        { setting: 'market', who: ['ammu'], action: 'stand', props: ['purse'], narration: { en: 'Inside were some money and an old photo.', ml: 'അതിനുള്ളിൽ കുറച്ചു പണവും ഒരു പഴയ ഫോട്ടോയും ഉണ്ടായിരുന്നു.' }, line: { who: 'ammu', text: { en: 'Someone must be looking for this. I will find the owner.', ml: 'ആരെങ്കിലും ഇത് തിരയുന്നുണ്ടാകും. ഞാൻ ഉടമയെ കണ്ടുപിടിക്കും.' } } },
        { setting: 'village', who: ['ammu', 'raghavan'], action: 'enter', props: ['well'], narration: { en: 'Near the well, Grandpa Raghavan was searching, looking worried. Ammu gave the purse back to him.', ml: 'കിണറിനടുത്ത് രാഘവൻ മുത്തച്ഛൻ വിഷമത്തോടെ തിരയുകയായിരുന്നു. അമ്മു പഴ്സ് അദ്ദേഹത്തിന് തിരികെ നൽകി.' }, line: { who: 'raghavan', text: { en: 'Thank you, child! That photo is very dear to me.', ml: 'നന്ദി മോളേ! ആ ഫോട്ടോ എനിക്ക് വളരെ പ്രിയപ്പെട്ടതാണ്.' } } },
        { setting: 'school', who: ['lakshmi', 'ammu'], action: 'stand', props: ['book'], narration: { en: 'The next day, Lakshmi Teacher told the whole class about Ammu’s honesty.', ml: 'പിറ്റേന്ന് ലക്ഷ്മി ടീച്ചർ അമ്മുവിന്റെ സത്യസന്ധതയെക്കുറിച്ച് ക്ലാസ്സിൽ എല്ലാവരോടും പറഞ്ഞു.' }, line: { who: 'lakshmi', text: { en: 'Honesty is the best gift we can give.', ml: 'സത്യസന്ധതയാണ് നമുക്ക് നൽകാവുന്ന ഏറ്റവും നല്ല സമ്മാനം.' } } },
      ],
    },
  },
];
