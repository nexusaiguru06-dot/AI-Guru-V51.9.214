#!/usr/bin/env node
/**
 * V51.9.135 — builds the Opus-inspired STYLE LIBRARY for the Reel Studio.
 *
 *   node scripts/ai-guru-build-opus-library.mjs
 *
 * Input : data/third-party/awesome-opus5-5-videos/videos.json   (MIT, github.com/yihui-dev/awesome-opus5-5-videos)
 * Output: data/ai-guru/opus-style-library.json
 *
 * The upstream collection is 703 *prompts* (text people gave Claude Opus 5.5), not animation code. So each one is
 * turned into a STYLE RECIPE for the engine AI Guru already has: a look, camera, pace, music, sounds and fonts, plus
 * a short direction for the AI explainer writer and the picture kinds it should prefer. Nothing from the original is
 * executed; the student's lesson content is never replaced by the example's content.
 *
 * Curation (deterministic, re-run safe):
 *   - DROPPED: brands / franchises, weapons and fighting, gambling / crypto trading, alcohol, adult, horror, politics.
 *   - RECOMMENDED (shown first): the ones whose idea is about explaining, maths, science, steps or words, scored.
 *   - the rest that pass the filter are kept as "more ideas" (still safe, less lesson-like).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data/third-party/awesome-opus5-5-videos/videos.json');
const OUT = join(ROOT, 'data/ai-guru/opus-style-library.json');

/**
 * Hand-picked for lessons (reviewed one by one): slug → AI Guru name, category and mood.
 * These are shown first ("Recommended for lessons"). Everything else that passes the filter is "More ideas".
 */
const CURATED = {
  // maths
  'gdgtify-393073': ['Kinetic proof, step by step', 'maths', 'paper', 'Euclid: there is no last prime'],
  'linearuncle-971663': ['Concept explainer, 3B1B feel', 'maths', 'cosmic', 'What a derivative means'],
  'eleanorina-653042': ['Blackboard maths explainer', 'maths', 'board', 'A statistics idea, 3Blue1Brown style'],
  'generussai-904308': ['Golden ratio & spirals', 'maths', 'cosmic', 'Golden ratio, Mandelbrot, sacred geometry'],
  'emollick-019567': ['Every step a new style', 'maths', 'energetic', 'Recursion, each step in a new style'],
  'godsboy7777-150194': ['Marble machine that adds', 'maths', 'retro', 'A marble machine adding two numbers'],
  'rneayan-417829': ['Count it with marbles', 'maths', 'data', 'Every country’s population as marbles'],
  'drake5112-661428': ['Growth that doubles', 'maths', 'data', 'Network effects and exponential growth'],
  // science
  'cagrimbakirci-842869': ['How it evolved, stage by stage', 'science', 'cosmic', 'How evolution built the eye'],
  'voxyz-ai-345550': ['Black-hole light lab', 'science', 'cosmic', 'Gravitational lensing around a black hole'],
  'apoorvjain25-945542': ['Journey of a photon', 'science', 'cosmic', 'A photon’s 170,000-year trip out of the Sun'],
  'curieuxexplorer-408141': ['Zoom down to the atoms', 'science', 'neon', 'A fingertip, zoomed to the atoms'],
  'kgonia7-746268': ['Powers-of-ten zoom out', 'science', 'cosmic', 'From a cliff to the observable universe'],
  'rashadmirza404-020971': ['Biology lit up', 'science', 'neon', 'Optogenetics: light switches for brain cells'],
  'explorations-iq-921682': ['Molecules & orbitals', 'science', 'calm', 'Molecular orbitals'],
  'hunzai-842605': ['A living ecosystem', 'science', 'calm', 'A tree as an ecosystem'],
  'pagustafsson-566609': ['Volcano, up close', 'science', 'cosmic', 'The Krakatoa eruption'],
  'koldo2k-741714': ['Colour wheel explainer', 'science', 'energetic', 'The 12-hue colour wheel'],
  'haribuilds-007643': ['Data story of a place', 'science', 'data', 'Point Nemo, the most remote place on Earth'],
  'groundcontrol-230877': ['Weather in numbers', 'science', 'data', 'A hot summer, in data'],
  // steps
  '0xspikez-483865': ['Take-apart machine, every part labelled', 'steps', 'paper', 'A jet engine’s stages: suck, squeeze, bang, blow'],
  'cryptowluha-060792': ['From sketch to finished, in stages', 'steps', 'paper', 'A house drawn line by line, in four stages'],
  'mrkindey-267498': ['Builds itself in five stages', 'steps', 'board', 'A house built in five stages'],
  'techartist-697078': ['Chain reaction', 'steps', 'retro', 'A marble starts a domino chain'],
  'tak3sh8-441895': ['Whiteboard doodle explainer', 'steps', 'paper', 'A hard idea, drawn on a whiteboard'],
  'cryptoxorz-359201': ['Science explainer recipe', 'steps', 'board', 'A fill-in template for any science topic'],
  'adomicael-707503': ['Follow the signal', 'steps', 'neon', 'What happens when you send a question'],
  'thesethian-384517': ['Five-stop journey through time', 'steps', 'cosmic', 'Five stops in the next 30 years'],
  // words, stories, history
  'songkeys-384673': ['Doodle history of humanity', 'words', 'retro', 'Humanity’s story, from the first humans to today'],
  'michaelzsguo-782312': ['Sand-animation history', 'words', 'warm', '250 years of history in sand'],
  'buildfastwithai-780900': ['Indian civilisation story', 'words', 'warm', 'Indian civilisation'],
  'iliareingold-486492': ['A myth told in pictures', 'words', 'cosmic', 'Prometheus brings fire'],
  'x4b47x-034026': ['Shadow-theatre story', 'words', 'paper', 'What makes a place feel like home'],
  'woojinrad-455731': ['Coloured-pencil storybook', 'words', 'paper', 'An article told as a storybook'],
  'gdgtify-989608': ['Kinetic speech typography', 'words', 'neon', 'A famous space speech in moving type'],
  'incognitoprince-849212': ['Kinetic text explainer', 'words', 'energetic', 'Any topic in moving text'],
  'paripune-657175': ['One unbroken line draws the story', 'words', 'paper', 'A story drawn with one line'],
  'obydulme-052905': ['Pencil to painted night sky', 'words', 'calm', 'A pencil sketch painted into a night sky'],
  // celebration
  'amberpromptai-345137': ['Festival story', 'celebration', 'warm', 'A festival’s story and traditions'],
  'eric-khun-667455': ['Hand-drawn festival greeting', 'celebration', 'warm', 'A hand-drawn festival wish'],
};

const rows = JSON.parse(readFileSync(SRC, 'utf8'));

/* ---------------- 1. safety filter ---------------- */
const BLOCK = [
  // brands, franchises, real products and people
  /star ?wars|x-?wing|tie fighter|death star|pok[eé]mon|pikachu|mario|nintendo|zelda|marvel|avengers|spider-?man|batman|superman|disney|pixar|minecraft|fortnite|roblox|harry potter|hogwarts|lord of the rings|naruto|dragon ball|one piece|ghibli|simpsons|sonic|pac-?man|tetris|angry birds|lego|barbie|transformers/i,
  /\b(apple|iphone|ipad|macbook|vision pro|airpods|google|android|pixel phone|samsung|tesla|spacex|nike|adidas|coca-?cola|pepsi|starbucks|mcdonald|netflix|spotify|youtube|tiktok|instagram|whatsapp|facebook|meta|twitter|openai|chatgpt|gpt-?\d|gemini|grok|anthropic|claude|nvidia|microsoft|windows|amazon|uber|airbnb|ferrari|porsche|lamborghini|bmw|mercedes|f1|formula 1|rolex|louis vuitton|gucci|red bull|figma|notion|slack|stripe|linear|vercel|cursor|github)\b/i,
  /end the fed|federal reserve|middle-?earth|black clover|gojo|jujutsu|evangelion|hedgehog in the fog|mona lisa|oktoberfest|samurai|brainrot|fucking|\bfuck|\bdefi\b/i,
  /\b(elon|musk|trump|biden|modi|obama|putin|zuckerberg|jobs|altman|beyonc|taylor swift|messi|ronaldo|kohli)\b/i,
  // violence, weapons, fighting
  /\b(war|warfare|gun|guns|shoot|shooter|shooting|sniper|kill|killing|blood|gore|weapon|weapons|bomb|missile|nuke|nuclear|zombie|battle royale|army|soldier|tank|sword|fight|fighting|combat|assault|explosion|destroy|destroyer|enemy|enemies)\b/i,
  // gambling, money hype, alcohol, adult, horror, politics
  /\b(casino|gambl|betting|bet|poker|slot machine|crypto|bitcoin|ethereum|nft|memecoin|trading bot|stock pick|forex|cocktail|beer|wine|vodka|whisk(e)?y|alcohol|bar ?tender|sexy|nsfw|dating|girlfriend|boyfriend|kiss|horror|scary|demon|devil|satan|ghost|election|political|propaganda)\b/i,
];
const blocked = (p) => BLOCK.some((re) => re.test(p));

/* ---------------- 2. what kind of idea it is ---------------- */
const KIND = {
  maths: /\b(math|maths|mathematics|mathematical|equation|equations|formula|algebra|geometry|calculus|theorem|proof|pythagor\w*|fraction|fractions|prime numbers?|fibonacci|golden ratio|derivative|integral|probability|statistics|trigonometr\w*|sine wave|triangle|polygon|fourier|fractal|mandelbrot|3b1b|manim|arithmetic)\b/i,
  science: /\b(physics|chemistry|biology|science|atom|atoms|molecule|electron|proton|quantum|gravity|orbit|planet|planets|solar system|galaxy|star|stars|universe|cosmos|black hole|nebula|space|earth|moon|sun|cell|cells|dna|neuron|brain|heart|photosynthesis|evolution|climate|weather|water cycle|volcano|ocean|light|wave|waves|magnet|electric|energy|particle|particles|telescope|eclipse)\b/i,
  process: /\b(step|steps|step-by-step|process|how .{0,30} works|workflow|pipeline|recipe|stages|lifecycle|cycle|flow ?chart|sequence|build-?up|assembl|timeline|roadmap)\b/i,
  words: /\b(typograph|kinetic|text|word|words|letter|letters|quote|title|headline|caption|font|lyric|poem|sentence|story|storytelling|narrat|history|historical|century|ancient|map|journey)\b/i,
  explain: /\b(explain|explainer|educational|teach|teaching|lesson|learn|learning|tutorial|visuali[sz]e|visualization|diagram|infographic|illustrat|demonstrat|show how|walk through|breakdown|break down|understand)\b/i,
  celebrate: /\b(birthday|celebrat|confetti|festival|fireworks|party|launch|countdown|new year|congratulat|award|trophy|milestone)\b/i,
  play: /\b(game|games|playable|arcade|racing|race car|platformer|shooter|multiplayer)\b/i,
  business: /\b(launch|product|startup|saas|brand|branding|portfolio|showreel|show ?reel|founder|business|website|landing page|r[ée]sum[ée]|linkedin|investor|pitch|marketing|ad|advert|commercial|customers?|pricing|app store|my app|our app|supademo|appsumo|demoscene|tech demo)\b/i,
  meta: /\b(opus 5\.5|opus|claude|one-?shot\w*|this model|ai model|llm|agents?|prompt)\b/i,
};
const has = (re, p) => re.test(p);

/* ---------------- 3. mood → engine choices ---------------- */
const MOOD = [
  { id: 'cosmic', re: /\b(space|galaxy|cosmos|universe|nebula|stars|black hole|cinematic|epic|film|movie|trailer|dramatic)\b/i, word: 'Cinematic', look: ['cinematic', 'night', 'ocean'], camera: 'drift', pace: 'relaxed', music: 'calm', pack: 'soft', font: 'elegant', board: 'serif' },
  { id: 'neon', re: /\b(neon|glow|glowing|cyber|synthwave|vaporwave|futuristic|sci-?fi|hologra|laser|electric)\b/i, word: 'Neon', look: ['neon', 'night'], camera: 'punch', pace: 'brisk', music: 'lofi', pack: 'arcade', font: 'modern', board: 'modern' },
  { id: 'retro', re: /\b(retro|pixel|8-?bit|arcade|vintage|old-?school|comic|cartoon|doodle|playful|fun|cute)\b/i, word: 'Playful', look: ['comic', 'sunrise', 'mint'], camera: 'punch', pace: 'brisk', music: 'upbeat', pack: 'arcade', font: 'comic', board: 'rounded' },
  { id: 'paper', re: /\b(paper|ink|hand-?drawn|sketch|notebook|chalk|whiteboard|blackboard|pencil|origami|minimal|minimalist|clean|elegant|swiss|editorial|monochrome)\b/i, word: 'Paper & ink', look: ['ink', 'notebook', 'chalk', 'classic'], camera: 'steady', pace: 'normal', music: 'calm', pack: 'soft', font: 'serif', board: 'hand' },
  { id: 'calm', re: /\b(calm|zen|peaceful|relax|meditat|smooth|gentle|soft|dreamy|ambient|lo-?fi|lofi|serene|ocean|water|rain)\b/i, word: 'Calm', look: ['ocean', 'mint', 'night'], camera: 'drift', pace: 'relaxed', music: 'lofi', pack: 'soft', font: 'rounded', board: 'serif' },
  { id: 'energetic', re: /\b(energetic|fast|hype|punchy|explosive|dynamic|bold|loud|intense|viral|tiktok|reel|short|snappy|bouncy)\b/i, word: 'Punchy', look: ['comic', 'neon', 'sunrise'], camera: 'punch', pace: 'brisk', music: 'upbeat', pack: 'classic', font: 'marker', board: 'marker' },
  { id: 'warm', re: /\b(warm|sunrise|sunset|golden|autumn|festival|kerala|india|indian|culture|tradition|heritage|folk)\b/i, word: 'Warm', look: ['kasavu', 'sunrise'], camera: 'steady', pace: 'normal', music: 'kerala', pack: 'classic', font: 'serif', board: 'hand' },
  { id: 'data', re: /\b(data|chart|graph|grid|dashboard|infographic|statistics|numbers|counter|metrics|plot)\b/i, word: 'Graph paper', look: ['graph', 'notebook'], camera: 'focus', pace: 'normal', music: 'calm', pack: 'classic', font: 'modern', board: 'modern' },
];
const DEFAULT_MOOD = { id: 'board', word: 'Board', look: ['chalk', 'classic', 'night'], camera: 'focus', pace: 'normal', music: 'calm', pack: 'classic', font: 'rounded', board: 'serif' };

/** The explainer pictures that suit the idea (the explainer engine draws these in code). */
function visualsFor(p) {
  const v = [];
  if (/\b(space|star|stars|galaxy|universe|cosmos|night|sky|nebula)\b/i.test(p)) v.push('night-sky');
  if (/\b(planet|planets|earth|moon|sun|mars|orbit|solar)\b/i.test(p)) v.push('planet');
  if (/\b(atom|atoms|molecule|electron|proton|quantum|chemistry)\b/i.test(p)) v.push('atom');
  if (/\b(light|laser|beam|ray|flash|photon)\b/i.test(p)) v.push('beam');
  if (/\b(particle|particles|rain|neutrino|dust|snow)\b/i.test(p)) v.push('rain');
  if (/\b(grid|data|sensor|pixel|matrix|dots)\b/i.test(p)) v.push('grid');
  if (/\b(arrow|direction|path|trace|vector|flow)\b/i.test(p)) v.push('arrow');
  if (/\b(typograph|kinetic|title|headline|word|letters)\b/i.test(p)) v.push('title');
  return v.slice(0, 4);
}

/* ---------------- 4. naming ---------------- */
const CAT_WORD = { maths: 'maths', science: 'science explainer', steps: 'step-by-step', words: 'kinetic words', celebration: 'celebration', motion: 'motion graphics' };
const clean = (s) => s.replace(/https?:\/\/\S+/g, '').replace(/[`*_#>"“”【】{}\[\]]/g, '').replace(/\s+/g, ' ').trim();
/** What the original was about, in a few words ("how evolution built the eye"), or null. */
function topicHint(prompt) {
  const s = clean(prompt);
  const m = s.match(/(?:explain(?:s|ing)?|explainer(?: video)?(?: of| on| about)?|about|showing|visuali[sz](?:e|es|ing)|visualization of|history of|how)\s+((?:how |why |what |the |a |an )?[^.,;:!?()]{5,70})/i);
  let t = m ? m[1] : '';
  t = t.replace(/\b(in|using|with|for|as|at|on) (html|javascript|js|three\.?js|canvas|svg|gsap|remotion|a single|one|my|our|\d).*$/i, '').trim();
  t = t.split(' ').slice(0, 8).join(' ').replace(/[^\p{L}\p{N}']+$/u, '');
  if (t.length < 5 || /\b(opus|claude|video|animation|motion|graphics?)\b$/i.test(t)) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ---------------- 5. build ---------------- */
const out = [];
const seenNames = new Map();
let dropped = 0;
for (const r of rows) {
  const p = String(r.prompt || '');
  if (!p.trim() || blocked(p)) { dropped++; continue; }
  const k = Object.fromEntries(Object.entries(KIND).map(([key, re]) => [key, has(re, p)]));
  const tags = Array.isArray(r.tech_tags) ? r.tech_tags : [];
  // games and pure 3D toys are kept only when the idea is also about learning something
  const lessonish = k.maths || k.science || k.explain || k.process;
  if ((k.play || tags.includes('playable')) && !lessonish) { dropped++; continue; }

  const cur = CURATED[r.slug];
  const category = cur ? cur[1] : k.maths ? 'maths' : k.science ? 'science' : k.process ? 'steps' : k.words ? 'words' : k.celebrate ? 'celebration' : 'motion';
  const mood = (cur && (MOOD.find((m) => m.id === cur[2]) ?? (cur[2] === 'board' ? DEFAULT_MOOD : null))) || MOOD.find((m) => m.re.test(p)) || DEFAULT_MOOD;
  // the board looks suit maths; space and science lean cinematic
  let looks = mood.look;
  if (category === 'maths' && mood.id === 'board') looks = ['graph', 'chalk', 'notebook'];
  if (category === 'science' && mood.id === 'board') looks = ['cinematic', 'ocean', 'night'];
  const look = looks[out.length % looks.length];
  const bestFor = category === 'maths' ? ['sum', 'branch', 'class', 'chapter'] : category === 'science' ? ['explainer', 'class', 'chapter'] : category === 'steps' ? ['class', 'branch', 'sum'] : category === 'words' ? ['explainer', 'story'] : category === 'celebration' ? ['chapter', 'story', 'sum'] : ['explainer', 'story', 'class'];
  const opener = category === 'maths' ? 'challenge' : category === 'science' ? 'fact' : category === 'celebration' ? 'countdown' : 'fact';
  const ending = category === 'maths' || category === 'steps' ? 'comment' : category === 'science' ? 'quiz' : 'tag';
  const visuals = visualsFor(p);

  const score = (k.business ? -4 : 0) + (k.meta && !k.maths && !k.science ? -1 : 0) + (k.explain ? 3 : 0) + (k.maths ? 3 : 0) + (k.science ? 2 : 0) + (k.process ? 2 : 0) + (k.words ? 1 : 0) + (r.has_remake ? 1 : 0) + (r.prompt_partial ? -1 : 0) + (tags.includes('threejs') || tags.includes('shader') ? -1 : 0) + (p.length > 120 ? 1 : 0);

  // the style's name says how it looks; the hint says what the original was about
  const base = `${mood.word} ${CAT_WORD[category]}`;
  const n = (seenNames.get(base) ?? 0) + 1;
  seenNames.set(base, n);
  const name = cur ? cur[0] : `${base} · ${String(n).padStart(2, '0')}`;
  const auto = topicHint(p);
  const hint = cur ? cur[3] ?? null : auto && /^(how|why|what|the history|a brief history|history)\b/i.test(auto) ? auto : null;

  const direction = [
    `Style "${mood.word}" (${category}).`,
    { cosmic: 'Slow, cinematic reveals; one big idea per screen; quiet confident tone.', neon: 'Glowing, high-contrast, quick cuts; short punchy sentences.', retro: 'Bright and playful; friendly jokes are fine; short sentences, lots of energy.', paper: 'Clean and minimal; calm hand-drawn feel; precise wording.', calm: 'Gentle pace; soft words; let each idea breathe.', energetic: 'Fast hook in the first line; punchy rhythm; end on a challenge.', warm: 'Warm and familiar; everyday Kerala / Indian examples where they fit.', data: 'Numbers first; count-up figures and clear labels; one fact per screen.', board: 'Clear teacher tone; build the idea step by step.' }[mood.id],
    visuals.length ? `Prefer these pictures: ${visuals.join(', ')}.` : '',
  ].filter(Boolean).join(' ');

  out.push({
    id: `opus-${r.slug}`,
    name,
    hint,
    category,
    mood: mood.id,
    bestFor,
    score,
    recommended: !!cur,
    choices: { look, camera: mood.camera, pace: mood.pace, music: mood.music, pack: mood.pack, font: mood.font, boardFont: mood.board, opener, ending },
    visuals,
    direction,
    inspiration: p.replace(/\s+/g, ' ').trim().slice(0, 280),
    tech: tags,
    credit: { author: r.author, authorUrl: r.author_url, postUrl: r.post_url, exampleUrl: r.skillry_url || null, thumbnail: r.poster_url || null },
  });
}

const picked = out.filter((x) => x.recommended).length;
const missing = Object.keys(CURATED).filter((slug) => !out.some((x) => x.id === `opus-${slug}`));
if (missing.length) throw new Error(`curated ideas missing (filtered out or renamed upstream): ${missing.join(', ')}`);

out.sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.score - a.score || a.id.localeCompare(b.id));
const lib = {
  v: 1,
  source: { name: 'awesome-opus5-5-videos', url: 'https://github.com/yihui-dev/awesome-opus5-5-videos', license: 'MIT', total: rows.length, note: 'Every idea belongs to its creator (linked on each entry). AI Guru keeps only the style idea and the credit; the lesson content is always the student’s own.' },
  builtAt: new Date().toISOString().slice(0, 10),
  counts: { upstream: rows.length, kept: out.length, recommended: picked, dropped },
  recipes: out,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(lib, null, 0) + '\n');
console.log(`[opus-library] ${rows.length} upstream → ${out.length} kept (${picked} recommended), ${dropped} dropped → ${OUT}`);
