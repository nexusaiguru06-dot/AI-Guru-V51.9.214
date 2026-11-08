/**
 * V51.9.101 — reel LOOKS: every shared reel gets its own board, colours, shapes, fonts, avatar frame and transitions,
 * while the brand stays fixed (logo, the student's link, the footer in the same place) and the maths never changes
 * (the board items keep their layout; only colours are re-mapped, and every look passes a readability check).
 *
 * Pure: the browser, the MP4 export and the tests share it.
 */

import { FONT, MATH_FONT_DEFAULT, ROLE } from './grammar';

export type BoardKind = 'whiteboard' | 'blackboard' | 'chalkboard' | 'graph' | 'notebook' | 'kasavu' | 'neon' | 'ink' | 'comic' | 'cinema'
  /* V51.9.156 Pro templates (HyperFrames-style) */
  | 'poster' | 'cobalt' | 'aurora' | 'capsule' | 'blueprint' | 'stage';
export type ShapeKind = 'rounded' | 'ribbon' | 'sticky' | 'bubble' | 'speech';
export type FontKind = 'serif' | 'rounded' | 'hand' | 'modern' | 'bubbly' | 'marker' | 'elegant' | 'comic';
export type FrameKind = 'circle' | 'rounded' | 'polaroid';
export type TransitionKind = 'cut' | 'wipe' | 'zoom' | 'slide' | 'chalk' | 'iris' | 'curtain' | 'blinds' | 'flash';
export type CaptionIn = 'fade' | 'slide' | 'pop' | 'rise' | 'blur';
/** V51.9.156: how the title card comes in at the start of the reel (and the mark it keeps afterwards). */
export type TitleIn = 'none' | 'kinetic' | 'highlight' | 'underline' | 'type';

export interface LookPalette {
  dark: boolean;
  /** Board / frame background and an optional second tone (gradients, patterns). */
  paper: string;
  paper2?: string;
  /** Pattern lines (graph grid, notebook rules, kasavu stripes). */
  pattern?: string;
  /** Text drawn straight on the paper (footer, handle). */
  text: string;
  muted: string;
  /** Cards (title, caption, step pill) and their text. */
  panel: string;
  panelText: string;
  /** Title / pill outline and the pill's label. */
  frame: string;
  /** Caption card outline. */
  line: string;
  /** Brand teal (follow pill, avatar ring). */
  teal: string;
  /** Karaoke caption colours: not voiced, already spoken, the word now, words still to come, the second-language line. */
  cap: { idle: string; spoken: string; now: string; next: string; sub: string };
  /** Role colours re-mapped for this board (only what differs from the whiteboard). */
  roles?: Partial<Record<keyof typeof ROLE, string>>;
  haloAlpha: number;
  /** V51.9.105: maths strokes glow (neon). */
  glow?: boolean;
  /** V51.9.105: card outline width × this (comic: bold outlines). */
  outline?: number;
}

export interface ReelLook {
  id: string;
  name: string;
  nameMl: string;
  board: BoardKind;
  palette: LookPalette;
  shape: ShapeKind;
  font: FontKind;
  frame: FrameKind;
  transition: TransitionKind;
  captionIn: CaptionIn;
  /** V51.9.156: the title's entrance (Pro templates); none = as before. */
  titleIn?: TitleIn;
  /** V51.9.156: a Pro template look (chosen from the Style library; never picked at random). */
  pro?: boolean;
}

const LIGHT_CAP = { idle: '#4a4377', spoken: '#150b55', now: '#b3202a', next: '#a29dc2', sub: '#7a7598' };
const DARK_CAP = { idle: '#d9d6f2', spoken: '#f2f2f6', now: '#ff6b73', next: '#6f6b8f', sub: '#9a96bd' };

/** The look every reel had before V51.9.101 (and the one the live class keeps). */
export const CLASSIC: ReelLook = {
  id: 'classic', name: 'Classic whiteboard', nameMl: 'വൈറ്റ്ബോർഡ്', board: 'whiteboard',
  palette: { dark: false, paper: '#ffffff', text: ROLE.ink, muted: '#5a5a78', panel: '#ffffff', panelText: '#1b1b1b', frame: '#b3202a', line: ROLE.ink, teal: '#12a4b3', cap: LIGHT_CAP, haloAlpha: 0.75 },
  shape: 'rounded', font: 'serif', frame: 'circle', transition: 'cut', captionIn: 'fade',
};

/**
 * V51.9.126 — the explainer reels' cinematic style for any maths reel: a deep night sky that slowly zooms (stars,
 * the Milky Way, soft glows, a vignette), glowing maths, glass cards, and the caption in an elegant serif that
 * appears word by word with the voice (words not yet spoken are not shown).
 */
export const CINEMATIC: ReelLook = {
  id: 'cinematic', name: 'Cinematic', nameMl: 'സിനിമാറ്റിക്', board: 'cinema',
  palette: { dark: true, paper: '#03050d', paper2: '#0a1330', text: '#f4f1ea', muted: '#aab3cf', panel: '#0a0f22', panelText: '#f7f3ea', frame: '#d9c38a', line: '#c9d2ff', teal: '#8b7cf6',
    cap: { idle: '#ece9f7', spoken: '#ffffff', now: '#c9b8ff', next: 'rgba(255,255,255,0)', sub: '#9aa3c4' }, haloAlpha: 0.25, glow: true,
    roles: { a: '#ff8f8f', b: '#cfa8ff', c: '#8ff0b2', carry: '#ffc861', result: '#ffffff', ink: '#f2efe6', done: '#9aa1c4', accent: '#ffd27a', tick: '#8ff0b2', halo: '#ffe6a8' } },
  shape: 'rounded', font: 'elegant', frame: 'circle', transition: 'zoom', captionIn: 'fade',
};

/** The 3Blue1Brown-style black board (theme 'dark'). */
export const NIGHT: ReelLook = {
  id: 'night', name: 'Night board', nameMl: 'കറുത്ത ബോർഡ്', board: 'blackboard',
  palette: { dark: true, paper: '#000000', text: '#f2f2f6', muted: '#b9b9c8', panel: '#0b0b0f', panelText: '#f2f2f6', frame: '#58c4dd', line: '#cfcfe8', teal: '#12a4b3', cap: { ...DARK_CAP, now: '#58c4dd' }, haloAlpha: 0.3,
    roles: { a: '#fc6255', b: '#c789ff', c: '#83c167', carry: '#ffb347', result: '#f2f2f6', ink: '#f2f2f6', done: '#6f6b8f', accent: '#ff6b73', tick: '#83c167' } },
  shape: 'rounded', font: 'serif', frame: 'circle', transition: 'zoom', captionIn: 'fade',
};

export const LOOKS: readonly ReelLook[] = [
  CLASSIC,
  NIGHT,
  {
    id: 'chalk', name: 'Green chalkboard', nameMl: 'ചോക്ക് ബോർഡ്', board: 'chalkboard',
    palette: { dark: true, paper: '#21443a', paper2: '#2a5246', text: '#f4f1e6', muted: '#c9d6cf', panel: '#1a362e', panelText: '#f4f1e6', frame: '#ffd36a', line: '#e8e2cc', teal: '#7fe0d0', cap: { idle: '#e7e3d3', spoken: '#fbf8ee', now: '#ffd36a', next: '#8fa79c', sub: '#b9c9c0' }, haloAlpha: 0.28,
      roles: { a: '#ff9a8a', b: '#dcb0ff', c: '#a6f5a0', carry: '#ffc76a', result: '#fbf8ee', ink: '#f4f1e6', done: '#7f978c', accent: '#ffd36a', tick: '#a6f5a0', halo: '#fff3a8' } },
    shape: 'sticky', font: 'hand', frame: 'polaroid', transition: 'chalk', captionIn: 'fade',
  },
  {
    id: 'graph', name: 'Graph paper', nameMl: 'ഗ്രാഫ് പേപ്പർ', board: 'graph',
    palette: { dark: false, paper: '#f7fbff', pattern: '#cfe2f5', text: '#14325c', muted: '#4b6688', panel: '#ffffff', panelText: '#14325c', frame: '#1f6fd1', line: '#14325c', teal: '#12a4b3', cap: { ...LIGHT_CAP, now: '#1f6fd1', spoken: '#14325c' }, haloAlpha: 0.7 },
    shape: 'ribbon', font: 'rounded', frame: 'rounded', transition: 'slide', captionIn: 'slide',
  },
  {
    id: 'notebook', name: 'Notebook page', nameMl: 'നോട്ടുബുക്ക്', board: 'notebook',
    palette: { dark: false, paper: '#fffdf4', pattern: '#bcd3f0', text: '#22305a', muted: '#5f6a88', panel: '#fff6b8', panelText: '#2a2a2a', frame: '#d0453c', line: '#22305a', teal: '#12a4b3', cap: { ...LIGHT_CAP, now: '#b8322a' }, haloAlpha: 0.7 },
    shape: 'sticky', font: 'hand', frame: 'polaroid', transition: 'wipe', captionIn: 'pop',
  },
  {
    id: 'kasavu', name: 'Kerala kasavu', nameMl: 'കസവ്', board: 'kasavu',
    palette: { dark: false, paper: '#fbf3dc', pattern: '#c9a227', text: '#4a1d14', muted: '#7a5a3a', panel: '#fffaf0', panelText: '#4a1d14', frame: '#8a2a1b', line: '#8a2a1b', teal: '#1f8a7a', cap: { idle: '#5c3a2a', spoken: '#3b1a10', now: '#b3202a', next: '#c2a98f', sub: '#7a5a3a' }, haloAlpha: 0.7,
      roles: { carry: '#b35f00', tick: '#11813b' } },
    shape: 'ribbon', font: 'serif', frame: 'circle', transition: 'wipe', captionIn: 'fade',
  },
  {
    id: 'sunrise', name: 'Sunrise', nameMl: 'പ്രഭാതം', board: 'whiteboard',
    palette: { dark: false, paper: '#fff7ee', paper2: '#ffe9d6', text: '#3a1f5c', muted: '#6d5a80', panel: '#ffffff', panelText: '#3a1f5c', frame: '#f06a2a', line: '#3a1f5c', teal: '#12a4b3', cap: { ...LIGHT_CAP, now: '#c4420f', spoken: '#3a1f5c' }, haloAlpha: 0.7,
      roles: { c: '#0f8a18', carry: '#b35a00', tick: '#11813b' } },
    shape: 'bubble', font: 'rounded', frame: 'circle', transition: 'zoom', captionIn: 'pop',
  },
  {
    id: 'ocean', name: 'Deep ocean', nameMl: 'കടൽ', board: 'blackboard',
    palette: { dark: true, paper: '#0e1f3a', paper2: '#13294b', text: '#eef4ff', muted: '#a9bddb', panel: '#0a1830', panelText: '#eef4ff', frame: '#4cc9f0', line: '#a9c7f5', teal: '#4cc9f0', cap: { idle: '#d7e3f7', spoken: '#f4f8ff', now: '#4cc9f0', next: '#6f86a8', sub: '#9fb4d3' }, haloAlpha: 0.3,
      roles: { a: '#ff8a7a', b: '#c9a2ff', c: '#7ee0a0', carry: '#ffc46b', result: '#f4f8ff', ink: '#eef4ff', done: '#5f7596', accent: '#ff8a7a', tick: '#7ee0a0' } },
    shape: 'bubble', font: 'rounded', frame: 'rounded', transition: 'slide', captionIn: 'slide',
  },
  {
    id: 'mint', name: 'Mint fresh', nameMl: 'പുതിന', board: 'whiteboard',
    palette: { dark: false, paper: '#effaf5', text: '#123d33', muted: '#4c6f66', panel: '#ffffff', panelText: '#123d33', frame: '#0f9d78', line: '#123d33', teal: '#0f9d78', cap: { ...LIGHT_CAP, now: '#0b7358', spoken: '#123d33' }, haloAlpha: 0.7 },
    shape: 'sticky', font: 'hand', frame: 'circle', transition: 'wipe', captionIn: 'pop',
  },
  /* ---- V51.9.105 ---- */
  {
    id: 'neon', name: 'Neon', nameMl: 'നിയോൺ', board: 'neon',
    palette: { dark: true, paper: '#07051a', paper2: '#120a2e', pattern: '#3a1f7a', text: '#f5f0ff', muted: '#b8aee0', panel: '#0d0828', panelText: '#f5f0ff', frame: '#ff4fd8', line: '#7df9ff', teal: '#7df9ff', cap: { idle: '#ddd6ff', spoken: '#ffffff', now: '#7df9ff', next: '#6f66a0', sub: '#a99fd6' }, haloAlpha: 0.25, glow: true,
      roles: { a: '#ff5c8a', b: '#c58bff', c: '#5dffa0', carry: '#ffd24a', result: '#ffffff', ink: '#f5f0ff', done: '#6f66a0', accent: '#ff4fd8', tick: '#5dffa0', halo: '#7df9ff' } },
    shape: 'rounded', font: 'rounded', frame: 'circle', transition: 'zoom', captionIn: 'pop',
  },
  {
    id: 'ink', name: 'Paper & ink', nameMl: 'കടലാസും മഷിയും', board: 'ink',
    palette: { dark: false, paper: '#f6efdf', paper2: '#efe4cc', pattern: '#d9c9a6', text: '#1d2a44', muted: '#5e5644', panel: '#fbf6ea', panelText: '#1d2a44', frame: '#1d2a44', line: '#1d2a44', teal: '#2a6a73', cap: { idle: '#3d3a52', spoken: '#141c33', now: '#9c2318', next: '#a89f8a', sub: '#6a604c' }, haloAlpha: 0.6,
      roles: { a: '#9c2318', b: '#4b2f8f', c: '#1d6b3a', carry: '#8a4b00', accent: '#9c2318', tick: '#1d6b3a', halo: '#f0d98a' } },
    shape: 'sticky', font: 'hand', frame: 'polaroid', transition: 'wipe', captionIn: 'fade',
  },
  {
    id: 'comic', name: 'Comic', nameMl: 'കോമിക്', board: 'comic',
    palette: { dark: false, paper: '#fffbea', pattern: '#ffd84d', text: '#111111', muted: '#3d3d3d', panel: '#ffffff', panelText: '#111111', frame: '#e0262b', line: '#111111', teal: '#0c7cc4', cap: { idle: '#2b2b2b', spoken: '#111111', now: '#d0161b', next: '#9a9a9a', sub: '#555555' }, haloAlpha: 0.75, outline: 2.2,
      roles: { c: '#0f8a18', carry: '#b35a00', tick: '#11813b' } },
    shape: 'speech', font: 'rounded', frame: 'rounded', transition: 'zoom', captionIn: 'pop',
  },
  /* ---- V51.9.126 ---- */
  CINEMATIC,
];

/**
 * V51.9.156 — Pro template looks, after the open-source HyperFrames themes and blocks (heygen-com/hyperframes, Apache-2.0):
 * bold posters, a cobalt grid, a pulsing aurora, capsules, a blueprint and a spotlight stage, with kinetic titles,
 * iris / curtain / blinds / flash transitions and captions that rise or come into focus. Drawn by AI Guru's own engine
 * on the student's phone (HyperFrames itself needs a server with Chrome and FFmpeg). Only chosen by hand or through a
 * Pro template: the automatic look rotation (LOOKS) is unchanged.
 */
export const PRO_LOOKS: readonly ReelLook[] = [
  {
    id: 'pro-poster', name: 'Bold poster', nameMl: 'ബോൾഡ് പോസ്റ്റർ', board: 'poster', pro: true,
    palette: { dark: false, paper: '#fff4d6', pattern: '#111111', text: '#111111', muted: '#3b3424', panel: '#ffffff', panelText: '#111111', frame: '#d4202b', line: '#111111', teal: '#0b6fbf',
      cap: { idle: '#2b2b2b', spoken: '#111111', now: '#c4161f', next: '#9a9384', sub: '#4d4636' }, haloAlpha: 0.75, outline: 2,
      roles: { c: '#0f7d16', carry: '#a85300', tick: '#0f7d16', result: '#111111', ink: '#111111' } },
    shape: 'rounded', font: 'modern', frame: 'rounded', transition: 'blinds', captionIn: 'pop', titleIn: 'kinetic',
  },
  {
    id: 'pro-cobalt', name: 'Cobalt grid', nameMl: 'കോബാൾട്ട് ഗ്രിഡ്', board: 'cobalt', pro: true,
    palette: { dark: true, paper: '#061a4a', paper2: '#0a2766', pattern: '#2c5cc9', text: '#eef3ff', muted: '#a9bce8', panel: '#071840', panelText: '#eef3ff', frame: '#5ee1ff', line: '#9fc1ff', teal: '#5ee1ff',
      cap: { idle: '#d5e1ff', spoken: '#ffffff', now: '#5ee1ff', next: '#5b74ad', sub: '#9fb4e0' }, haloAlpha: 0.28, glow: true,
      roles: { a: '#ff8a8a', b: '#d3a8ff', c: '#7cf0a8', carry: '#ffc65c', result: '#ffffff', ink: '#eef3ff', done: '#5b74ad', accent: '#5ee1ff', tick: '#7cf0a8', halo: '#5ee1ff' } },
    shape: 'rounded', font: 'modern', frame: 'rounded', transition: 'iris', captionIn: 'rise', titleIn: 'type',
  },
  {
    id: 'pro-aurora', name: 'Aurora pulse', nameMl: 'അറോറ', board: 'aurora', pro: true,
    palette: { dark: true, paper: '#0b0620', paper2: '#140b33', text: '#f6f2ff', muted: '#bdb2e6', panel: '#120a2c', panelText: '#f6f2ff', frame: '#9d7bff', line: '#c9b8ff', teal: '#46e0c4',
      cap: { idle: '#e2dbff', spoken: '#ffffff', now: '#7ff0d8', next: '#6c6198', sub: '#a99fd6' }, haloAlpha: 0.25, glow: true,
      roles: { a: '#ff7fa6', b: '#c9a2ff', c: '#7ff0b8', carry: '#ffcf66', result: '#ffffff', ink: '#f6f2ff', done: '#6c6198', accent: '#7ff0d8', tick: '#7ff0b8', halo: '#c9b8ff' } },
    shape: 'bubble', font: 'rounded', frame: 'circle', transition: 'flash', captionIn: 'blur', titleIn: 'kinetic',
  },
  {
    id: 'pro-capsule', name: 'Capsule pop', nameMl: 'ക്യാപ്സ്യൂൾ', board: 'capsule', pro: true,
    palette: { dark: false, paper: '#fff1ec', pattern: '#ffb8a3', text: '#3a1430', muted: '#6e4a61', panel: '#ffffff', panelText: '#3a1430', frame: '#e8455a', line: '#3a1430', teal: '#0e8f8a',
      cap: { idle: '#4a2a40', spoken: '#2a0f22', now: '#c21f3a', next: '#c3a2b2', sub: '#7a5a6c' }, haloAlpha: 0.7,
      roles: { c: '#0f7d3a', carry: '#a8510a', tick: '#0f7d3a', result: '#2a0f22', ink: '#2a0f22' } },
    shape: 'bubble', font: 'bubbly', frame: 'circle', transition: 'curtain', captionIn: 'pop', titleIn: 'highlight',
  },
  {
    id: 'pro-blueprint', name: 'Blueprint lab', nameMl: 'ബ്ലൂപ്രിന്റ്', board: 'blueprint', pro: true,
    palette: { dark: true, paper: '#0d3b78', paper2: '#0b3369', pattern: '#7fb0ea', text: '#f1f7ff', muted: '#bcd3f2', panel: '#0a2f60', panelText: '#f1f7ff', frame: '#ffd166', line: '#cfe3ff', teal: '#7fe3ff',
      cap: { idle: '#dce9ff', spoken: '#ffffff', now: '#ffd166', next: '#6f8fbf', sub: '#a9c3e6' }, haloAlpha: 0.3,
      roles: { a: '#ffa3a3', b: '#e0bdff', c: '#9ff5b8', carry: '#ffd166', result: '#ffffff', ink: '#f1f7ff', done: '#6f8fbf', accent: '#ffd166', tick: '#9ff5b8', halo: '#ffd166' } },
    shape: 'rounded', font: 'modern', frame: 'rounded', transition: 'wipe', captionIn: 'slide', titleIn: 'underline',
  },
  {
    id: 'pro-stage', name: 'Spotlight stage', nameMl: 'സ്പോട്ട്‌ലൈറ്റ്', board: 'stage', pro: true,
    palette: { dark: true, paper: '#0a0a0f', paper2: '#16121c', text: '#f7f3ea', muted: '#bfb7a6', panel: '#121018', panelText: '#f7f3ea', frame: '#ffcc55', line: '#e8dfc8', teal: '#ffcc55',
      cap: { idle: '#e9e3d4', spoken: '#ffffff', now: '#ffcc55', next: '#6e6758', sub: '#a8a090' }, haloAlpha: 0.25, glow: true,
      roles: { a: '#ff8f7a', b: '#d7a8ff', c: '#8ff0a6', carry: '#ffcc55', result: '#ffffff', ink: '#f7f3ea', done: '#6e6758', accent: '#ffcc55', tick: '#8ff0a6', halo: '#ffe6a8' } },
    shape: 'rounded', font: 'elegant', frame: 'circle', transition: 'iris', captionIn: 'blur', titleIn: 'kinetic',
  },
  {
    id: 'pro-coral', name: 'Coral sunset', nameMl: 'പവിഴ സന്ധ്യ', board: 'aurora', pro: true,
    palette: { dark: false, paper: '#fff3ea', paper2: '#ffe0cf', text: '#4a1626', muted: '#7a4b55', panel: '#ffffff', panelText: '#4a1626', frame: '#e5533d', line: '#4a1626', teal: '#0f7f86',
      cap: { idle: '#5a2a36', spoken: '#3a0f1c', now: '#c2321c', next: '#d0a9a0', sub: '#7a5a5c' }, haloAlpha: 0.7,
      roles: { c: '#0f7d3a', carry: '#a8510a', tick: '#0f7d3a', result: '#3a0f1c', ink: '#3a0f1c' } },
    shape: 'ribbon', font: 'elegant', frame: 'circle', transition: 'curtain', captionIn: 'rise', titleIn: 'highlight',
  },
  {
    id: 'pro-news', name: 'Fact flash', nameMl: 'ഫാക്ട് ഫ്ലാഷ്', board: 'poster', pro: true,
    palette: { dark: false, paper: '#f4f6fb', pattern: '#c8102e', text: '#0e1424', muted: '#3c4458', panel: '#ffffff', panelText: '#0e1424', frame: '#c8102e', line: '#0e1424', teal: '#0b5fb0',
      cap: { idle: '#252c3d', spoken: '#0e1424', now: '#c8102e', next: '#9aa1b2', sub: '#4a5266' }, haloAlpha: 0.75, outline: 1.6,
      roles: { c: '#0f7d16', carry: '#a85300', tick: '#0f7d16', result: '#0e1424', ink: '#0e1424' } },
    shape: 'rounded', font: 'modern', frame: 'rounded', transition: 'blinds', captionIn: 'slide', titleIn: 'type',
  },
  {
    id: 'pro-kasavu-gold', name: 'Kasavu gold', nameMl: 'കസവ് ഗോൾഡ്', board: 'stage', pro: true,
    palette: { dark: true, paper: '#1a120a', paper2: '#2a1d0f', text: '#fbf3dc', muted: '#d6c49e', panel: '#22180c', panelText: '#fbf3dc', frame: '#e3b341', line: '#f0dca4', teal: '#e3b341',
      cap: { idle: '#efe2c2', spoken: '#fffaf0', now: '#ffd36a', next: '#7d6c4c', sub: '#c9b48a' }, haloAlpha: 0.28, glow: true,
      roles: { a: '#ff9a7a', b: '#e0b0ff', c: '#a6f0a0', carry: '#ffd36a', result: '#fffaf0', ink: '#fbf3dc', done: '#7d6c4c', accent: '#ffd36a', tick: '#a6f0a0', halo: '#ffe6a8' } },
    shape: 'ribbon', font: 'serif', frame: 'circle', transition: 'curtain', captionIn: 'fade', titleIn: 'underline',
  },
  {
    id: 'pro-mono', name: 'Clean mono', nameMl: 'ക്ലീൻ', board: 'capsule', pro: true,
    palette: { dark: false, paper: '#fafafa', pattern: '#e6e6e6', text: '#111111', muted: '#4a4a4a', panel: '#ffffff', panelText: '#111111', frame: '#111111', line: '#111111', teal: '#1f5fd1',
      cap: { idle: '#333333', spoken: '#111111', now: '#1f5fd1', next: '#a8a8a8', sub: '#555555' }, haloAlpha: 0.7,
      roles: { c: '#0f7d16', carry: '#a85300', tick: '#0f7d16', result: '#111111', ink: '#111111' } },
    shape: 'rounded', font: 'modern', frame: 'rounded', transition: 'slide', captionIn: 'rise', titleIn: 'underline',
  },
];

/** Every look a student can choose by hand (the automatic rotation uses LOOKS only). */
export const ALL_LOOKS: readonly ReelLook[] = [...LOOKS, ...PRO_LOOKS];

export const lookById = (id: string | null | undefined): ReelLook => ALL_LOOKS.find((l) => l.id === id) ?? CLASSIC;

/* ---------------- colours ---------------- */

function lin(v: number) { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  return 0.2126 * lin(parseInt(h.slice(0, 2), 16)) + 0.7152 * lin(parseInt(h.slice(2, 4), 16)) + 0.0722 * lin(parseInt(h.slice(4, 6), 16));
}
/** WCAG contrast ratio of two #rrggbb colours (1–21). */
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** whiteboard colour → this look's colour (item colours are fixed when a reel is built; looks re-map them when drawing). */
export function roleMap(look: ReelLook): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(look.palette.roles ?? {})) m.set((ROLE as Record<string, string>)[k].toLowerCase(), v);
  return m;
}

/** Colour of an item on this look's board. */
export function lookColor(c: string, look: ReelLook, map: Map<string, string>): string {
  if (!/^#[0-9a-f]{6}$/i.test(c)) return c;
  const hit = map.get(c.toLowerCase());
  if (hit) return hit;
  return look.palette.dark && luminance(c) < 0.05 ? look.palette.text : c;
}

/** Readability problems of a look (empty = passes): maths colours on the board, caption text on its card, labels. */
export function readability(look: ReelLook): string[] {
  const P = look.palette;
  const map = roleMap(look);
  const out: string[] = [];
  const bg = [P.paper, ...(P.paper2 ? [P.paper2] : [])];
  for (const role of ['a', 'b', 'c', 'carry', 'result', 'ink', 'accent', 'tick'] as const) {
    const col = lookColor(ROLE[role], look, map);
    // carries are small bold helper digits with a halo: the classic whiteboard's own orange (2.5:1) is the floor for them
    const min = role === 'carry' ? 2.3 : 3;
    for (const b of bg) if (contrast(col, b) < min) out.push(`${role} on the board ${contrast(col, b).toFixed(2)}`);
  }
  for (const [name, col] of [['spoken', P.cap.spoken], ['idle', P.cap.idle], ['now', P.cap.now]] as const) if (contrast(col, P.panel) < 4.5) out.push(`caption ${name} ${contrast(col, P.panel).toFixed(2)}`);
  if (contrast(P.panelText, P.panel) < 4.5) out.push('title text');
  if (contrast(P.frame, P.panel) < 3) out.push('pill label');
  if (contrast(P.text, P.paper) < 4.5) out.push('footer text');
  if (contrast(onColor(P.teal), P.teal) < 3) out.push('follow pill text');
  return out;
}

/* ---------------- V51.9.105: the student's own accent colour ---------------- */

/** Colours a student can pick (Auto = the look's own). */
export const ACCENTS = [
  { id: 'rose', hex: '#e8396b', name: 'Rose' },
  { id: 'orange', hex: '#f07a1a', name: 'Orange' },
  { id: 'gold', hex: '#e6b400', name: 'Gold' },
  { id: 'green', hex: '#1fa85a', name: 'Green' },
  { id: 'teal', hex: '#11a3a8', name: 'Teal' },
  { id: 'blue', hex: '#2f6fe0', name: 'Blue' },
  { id: 'violet', hex: '#7c4ddb', name: 'Violet' },
  { id: 'pink', hex: '#d94fc4', name: 'Pink' },
] as const;
export type AccentId = (typeof ACCENTS)[number]['id'];
export const accentById = (id: string | null | undefined) => ACCENTS.find((a) => a.id === id) ?? null;

function mix(hex: string, to: string, k: number): string {
  const a = hex.replace('#', ''), b = to.replace('#', '');
  return `#${[0, 2, 4].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')}`;
}

/** The accent shade (darker on light cards, lighter on dark ones) that reaches `min` contrast on `bg`. */
export function readableShade(hex: string, bg: string, min: number): string {
  const towards = luminance(bg) > 0.4 ? '#000000' : '#ffffff';
  for (let k = 0; k <= 1; k += 0.05) { const c = mix(hex, towards, k); if (contrast(c, bg) >= min) return c; }
  return towards;
}

/**
 * The look with the student's colour on the title/pill outline, the avatar ring and the word being spoken. The maths
 * colours are never touched, and each shade is adjusted until it passes the same readability rules as the look.
 */
export function withAccent(look: ReelLook, accent: string | null | undefined): ReelLook {
  const a = accentById(accent);
  if (!a) return look;
  const P = look.palette;
  return {
    ...look,
    id: look.id, // the look stays the same look (recent-looks memory, pins)
    palette: { ...P, frame: readableShade(a.hex, P.panel, 3), teal: readableShade(a.hex, P.paper, 3), cap: { ...P.cap, now: readableShade(a.hex, P.panel, 4.5) } },
  };
}

/** Text colour for a filled pill (follow pill, badges): white, or near-black when white would be hard to read. */
export const onColor = (bg: string): string => (contrast('#ffffff', bg) >= 3 ? '#ffffff' : '#10131a');

/* ---------------- fonts ---------------- */

/** The families of each font style: English, then its Malayalam partner (OFL; see public/fonts/reel/OFL-look-fonts.txt). */
export const FONT_FAMILIES: Record<FontKind, [latin: string, malayalam: string]> = {
  serif: ['AIGuruSerif', 'AIGuruMalayalam'],
  rounded: ['AIGuruRound', 'AIGuruRoundMl'],
  hand: ['AIGuruHand', 'AIGuruHandMl'],
  modern: ['AIGuruModern', 'AIGuruModernMl'],
  bubbly: ['AIGuruBubbly', 'AIGuruBubblyMl'],
  marker: ['AIGuruMarker', 'AIGuruMarkerMl'],
  elegant: ['AIGuruElegant', 'AIGuruElegantMl'],
  comic: ['AIGuruComic', 'AIGuruRoundMl'],
};

export const FONT_NAME: Record<FontKind, string> = {
  serif: 'Classic serif (Noto Serif)',
  rounded: 'Rounded (Baloo)',
  hand: 'Handwriting (Kalam · Chilanka)',
  modern: 'Modern clean (Lexend · Anek)',
  bubbly: 'Bubbly (Fredoka · Manjari)',
  marker: 'Marker pen (Patrick Hand · Gayathri)',
  elegant: 'Elegant (Playfair · Noto Serif Malayalam)',
  comic: 'Comic (Comic Neue · Baloo Chettan)',
};

/** Fonts for titles, captions and cards (all eight). */
export const CARD_FONTS: readonly FontKind[] = ['serif', 'rounded', 'hand', 'modern', 'bubbly', 'marker', 'elegant', 'comic'];
/** Fonts clear enough for the maths on the board (digits, signs). π and the root sign fall back to the serif. */
export const BOARD_FONTS: readonly FontKind[] = ['serif', 'rounded', 'hand', 'modern', 'bubbly', 'marker'];

const stack = (k: FontKind, tail: string) => { const [en, ml] = FONT_FAMILIES[k]; return `${en}, ${ml}, ${tail}`; };

/** Font stacks for the reel's cards and captions. */
export const LOOK_FONT: Record<FontKind, string> = {
  serif: 'AIGuruSerif, "Noto Serif", AIGuruMalayalam, "Noto Sans Malayalam", "DejaVu Serif", serif',
  rounded: stack('rounded', 'AIGuruSerif, AIGuruMalayalam, "Noto Sans Malayalam", sans-serif'),
  hand: stack('hand', 'AIGuruSerif, AIGuruMalayalam, "Noto Sans Malayalam", cursive'),
  modern: stack('modern', 'AIGuruSerif, AIGuruMalayalam, "Noto Sans Malayalam", sans-serif'),
  bubbly: stack('bubbly', 'AIGuruSerif, AIGuruMalayalam, "Noto Sans Malayalam", sans-serif'),
  marker: stack('marker', 'AIGuruSerif, AIGuruMalayalam, "Noto Sans Malayalam", cursive'),
  elegant: stack('elegant', 'AIGuruSerif, AIGuruMalayalam, "Noto Sans Malayalam", serif'),
  comic: stack('comic', 'AIGuruSerif, AIGuruMalayalam, "Noto Sans Malayalam", sans-serif'),
};

/** The maths font stack for a board font (the serif stays behind it for π and other signs a font lacks). */
export const boardStack = (k: FontKind | null | undefined): string => (!k || k === 'serif' ? MATH_FONT_DEFAULT : stack(k, MATH_FONT_DEFAULT));

/**
 * Runs `fn` with the board's maths in another font (building a reel measures its layout with it; drawing a frame
 * must use the same one). Puts the default back afterwards, so the live class and other reels are never affected.
 */
export function withBoardFont<T>(k: FontKind | null | undefined, fn: () => T): T {
  const prev = FONT.math;
  FONT.math = boardStack(k);
  try { return fn(); } finally { FONT.math = prev; }
}

/** Fonts that suit each look (Auto picks from these more often; every font can still be chosen by hand). */
export const LOOK_FONTS: Record<string, { card: FontKind[]; board: FontKind[] }> = {
  classic: { card: ['serif', 'modern', 'elegant'], board: ['modern'] },
  night: { card: ['serif', 'modern', 'elegant'], board: ['modern'] },
  chalk: { card: ['hand', 'marker'], board: ['hand', 'marker'] },
  graph: { card: ['rounded', 'modern'], board: ['modern', 'rounded'] },
  notebook: { card: ['hand', 'marker', 'bubbly'], board: ['hand', 'marker'] },
  kasavu: { card: ['serif', 'elegant'], board: [] },
  sunrise: { card: ['rounded', 'bubbly'], board: ['rounded', 'bubbly'] },
  ocean: { card: ['rounded', 'modern'], board: ['modern', 'rounded'] },
  mint: { card: ['hand', 'bubbly', 'marker'], board: ['bubbly', 'marker'] },
  neon: { card: ['rounded', 'modern'], board: ['modern', 'rounded'] },
  ink: { card: ['hand', 'elegant', 'marker'], board: ['hand'] },
  comic: { card: ['comic', 'bubbly', 'rounded'], board: ['bubbly', 'rounded'] },
  cinematic: { card: ['elegant', 'serif'], board: [] },
  /* V51.9.156 Pro templates */
  'pro-poster': { card: ['modern', 'comic'], board: ['modern'] },
  'pro-cobalt': { card: ['modern', 'rounded'], board: ['modern'] },
  'pro-aurora': { card: ['rounded', 'elegant'], board: ['rounded'] },
  'pro-capsule': { card: ['bubbly', 'rounded'], board: ['rounded', 'bubbly'] },
  'pro-blueprint': { card: ['modern', 'hand'], board: ['modern'] },
  'pro-stage': { card: ['elegant', 'serif'], board: [] },
  'pro-coral': { card: ['elegant', 'rounded'], board: [] },
  'pro-news': { card: ['modern'], board: ['modern'] },
  'pro-kasavu-gold': { card: ['serif', 'elegant'], board: [] },
  'pro-mono': { card: ['modern'], board: ['modern'] },
};

/** "#rrggbb" + alpha → rgba() */
export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}
