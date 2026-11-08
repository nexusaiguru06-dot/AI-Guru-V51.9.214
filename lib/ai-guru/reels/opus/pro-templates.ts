/**
 * V51.9.156 — Pro templates for the Reel Studio's Style library, after the open-source HyperFrames themes and blocks
 * (github.com/heygen-com/hyperframes, Apache-2.0): bold posters, kinetic titles, a cobalt grid, a pulsing aurora,
 * capsules, a blueprint and a spotlight stage, with iris / curtain / blinds / flash transitions.
 *
 * HyperFrames renders on a server (Chrome + FFmpeg); these are rebuilt in AI Guru's own engine, so a student's phone
 * makes the MP4 itself, free and offline, and the preview is frame-exact with the download. Each template is an ordinary
 * style recipe (look, camera, pace, music, sounds, fonts, opener, ending) whose look is one of the Pro looks.
 */
import type { OpusRecipe, StudioMode } from './library';

const ALL: StudioMode[] = ['sum', 'branch', 'chapter', 'story', 'class', 'explainer'];
const CREDIT = { author: 'AI Guru · after HyperFrames', authorUrl: 'https://github.com/heygen-com/hyperframes', postUrl: null, exampleUrl: null, thumbnail: null };

type T = Pick<OpusRecipe, 'id' | 'name' | 'hint' | 'mood' | 'bestFor' | 'choices' | 'visuals' | 'direction' | 'inspiration'>;
const make = (t: T): OpusRecipe => ({ ...t, category: 'pro', score: 10, recommended: true, tech: ['canvas'], credit: { ...CREDIT } });

export const PRO_TEMPLATES: readonly OpusRecipe[] = [
  make({
    id: 'opus-pro-exam-tip', name: 'Exam tip — bold poster', hint: 'One punchy tip, poster style', mood: 'bold', bestFor: ALL,
    choices: { look: 'pro-poster', camera: 'punch', pace: 'brisk', music: 'upbeat', pack: 'arcade', font: 'modern', boardFont: 'modern', opener: 'challenge', ending: 'comment' },
    visuals: ['title'], direction: 'Bold poster: one short punchy line per screen, the key word first, high energy, end with a question to comment on.',
    inspiration: 'A bold poster: the title words slam in one by one, a thick diagonal band and halftone dots in the corners, and every part opens like window blinds.',
  }),
  make({
    id: 'opus-pro-fact-flash', name: 'Did you know? — fact flash', hint: 'A surprising fact, news style', mood: 'news', bestFor: ALL,
    choices: { look: 'pro-news', camera: 'punch', pace: 'normal', music: 'upbeat', pack: 'classic', font: 'modern', boardFont: 'serif', opener: 'fact', ending: 'quiz' },
    visuals: ['title'], direction: 'News-flash style: open with the surprising fact, then explain it in short clear lines; finish with a quick quiz.',
    inspiration: 'Like a breaking-news card: the title types itself with a blinking caret, red bands across the corners, captions slide up.',
  }),
  make({
    id: 'opus-pro-cobalt', name: 'How it works — cobalt grid', hint: 'Clean, techy, step by step', mood: 'tech', bestFor: ALL,
    choices: { look: 'pro-cobalt', camera: 'focus', pace: 'normal', music: 'lofi', pack: 'soft', font: 'modern', boardFont: 'modern', opener: 'fact', ending: 'part2' },
    visuals: ['grid', 'arrow'], direction: 'Calm technical explainer: one step per screen, precise words, numbers and units always shown.',
    inspiration: 'A deep cobalt grid with glowing corner brackets and a slow scanning light; each part opens through a circle; the title types itself.',
  }),
  make({
    id: 'opus-pro-aurora', name: 'Big idea — aurora pulse', hint: 'Dreamy, glowing, one big idea', mood: 'dreamy', bestFor: ALL,
    choices: { look: 'pro-aurora', camera: 'drift', pace: 'relaxed', music: 'calm', pack: 'soft', font: 'rounded', boardFont: 'serif', opener: 'fact', ending: 'quiz' },
    visuals: ['night-sky', 'beam'], direction: 'Slow and wonder-filled: one big idea, simple words, a pause after each reveal.',
    inspiration: 'Soft colour clouds that drift and pulse with the music; captions come into focus; a flash of light between parts.',
  }),
  make({
    id: 'opus-pro-capsule', name: 'Fun steps — capsule pop', hint: 'Bright and playful (lower classes)', mood: 'playful', bestFor: ALL,
    choices: { look: 'pro-capsule', camera: 'punch', pace: 'normal', music: 'upbeat', pack: 'arcade', font: 'bubbly', boardFont: 'rounded', opener: 'countdown', ending: 'streak' },
    visuals: ['title'], direction: 'Playful and friendly for young students: very short sentences, cheer each step.',
    inspiration: 'Coral capsules float at the edges; a marker highlight sweeps behind the title; parts open like stage curtains; captions pop.',
  }),
  make({
    id: 'opus-pro-blueprint', name: 'Science lab — blueprint', hint: 'Diagrams, measurements, experiments', mood: 'lab', bestFor: ALL,
    choices: { look: 'pro-blueprint', camera: 'focus', pace: 'normal', music: 'lofi', pack: 'classic', font: 'modern', boardFont: 'serif', opener: 'challenge', ending: 'part2' },
    visuals: ['figure', 'arrow'], direction: 'Like an engineer explaining a drawing: name each part, show how it connects, keep the units.',
    inspiration: 'A blueprint sheet with fine grid lines, compass circles and a measuring scale; the title is underlined in gold; parts wipe across.',
  }),
  make({
    id: 'opus-pro-spotlight', name: 'The answer — spotlight stage', hint: 'Dramatic reveal of the answer', mood: 'dramatic', bestFor: ALL,
    choices: { look: 'pro-stage', camera: 'steady', pace: 'relaxed', music: 'calm', pack: 'soft', font: 'elegant', boardFont: 'serif', opener: 'challenge', ending: 'comment' },
    visuals: ['beam'], direction: 'Build up to the answer like a stage reveal: the question, the steps, then the answer in the spotlight.',
    inspiration: 'A dark stage with a soft spotlight from above, a glowing floor and gold rules; the title words drop in; parts open through a circle.',
  }),
  make({
    id: 'opus-pro-coral', name: 'Story moment — coral sunset', hint: 'Warm stories and history', mood: 'warm', bestFor: ['story', 'class', 'chapter', 'explainer'],
    choices: { look: 'pro-coral', camera: 'drift', pace: 'relaxed', music: 'calm', pack: 'soft', font: 'elegant', boardFont: 'serif', opener: 'fact', ending: 'comment' },
    visuals: ['title', 'photo'], direction: 'Warm storytelling: who, where, what happened and why it matters, in a gentle voice.',
    inspiration: 'Warm sunset clouds drifting slowly; a marker highlight on the title; captions rise; parts open like curtains.',
  }),
  make({
    id: 'opus-pro-kasavu-gold', name: 'Kerala special — kasavu gold', hint: 'Onam, Kerala topics, Malayalam', mood: 'festive', bestFor: ALL,
    choices: { look: 'pro-kasavu-gold', camera: 'drift', pace: 'normal', music: 'kerala', pack: 'classic', font: 'serif', boardFont: 'serif', opener: 'fact', ending: 'tag' },
    visuals: ['title'], direction: 'Proud and festive, Kerala flavour; Malayalam words where they fit; invite friends to try it.',
    inspiration: 'A dark stage with kasavu-gold rules top and bottom, a soft spotlight and gold dust; the title is underlined in gold.',
  }),
  make({
    id: 'opus-pro-mono', name: 'Clean notes — mono', hint: 'Minimal, neat revision notes', mood: 'minimal', bestFor: ALL,
    choices: { look: 'pro-mono', camera: 'steady', pace: 'normal', music: 'lofi', pack: 'soft', font: 'modern', boardFont: 'modern', opener: 'none', ending: 'comment' },
    visuals: ['plain'], direction: 'Minimal revision notes: short, neat, one fact per line, no decoration in the words.',
    inspiration: 'Clean white with soft grey capsules; a crisp underline draws under the title; captions rise; parts slide in.',
  }),
];
