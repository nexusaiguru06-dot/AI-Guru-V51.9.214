'use client';

/**
 * Reel Studio: make a shareable maths reel (MP4) with the AI Guru motion engine.
 *  - Sum / problem: column + − × ÷ with carries, borrows, long division
 *  - Topic examples: algebra, fractions, %, exponents, quadratics, calculus,
 *    geometry, mensuration, statistics, probability, trigonometry
 *  - Chapter intro: "what is this chapter?" + a worked example
 * Voice-over: every step is explained aloud (English or Malayalam) through the
 * classroom's TTS chain; steps wait for the voice; captions light up word by word.
 * Preview is frame-exact with the exported MP4 (same draw function, same clock).
 */

import { spacedCode } from '@/lib/ai-guru/share/join-code';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  arithmeticLimitError,
  BRANCH_EXAMPLES,
  buildReel,
  CHAPTER_INTROS,
  clipMs,
  drawReelFrame,
  FORMAT_SIZE,
  mixReelAudio,
  reelSubtitleCues,
  SFX_RATE,
  STEP_LABEL,
  toSrt,
  toVtt,
  voiceScript,
  type Lang,
  type MotionReel,
  type ReelFormat,
  type ReelRequest,
  type VoiceClips,
  checkSummary,
  type ReelCheck,
} from '@/lib/ai-guru/reels/motion';
import { loadFontKind, loadReelFonts } from '@/lib/ai-guru/reels/motion/fonts';
import { isLocalOrigin, shareOrigin } from '@/lib/ai-guru/share/join-link';
import { clipCaption, shareClip } from '@/lib/ai-guru/share/clip';
import { exportMotionReelMp4 } from '@/lib/ai-guru/reels/motion/export';
import { synthesizeVoiceClips } from '@/lib/ai-guru/reels/motion/voice';
import { AiGuruTopNav } from './AiGuruTopNav';
import { StoryEditor } from './reels/StoryEditor';
import { ClassClipPanel } from './reels/ClassClipPanel';
import { ExplainerEditor } from './reels/ExplainerEditor';
import { loadScript, SAMPLE_EXPLAINERS, saveScript, type XScript } from '@/lib/ai-guru/reels/explainer/script';
import { explainerPhotosReady } from '@/lib/ai-guru/reels/explainer/draw';
import { AVATARS } from '@/lib/ai-guru/features';
import { ReelPreviewDialog, type PreviewState } from './reels/ReelPreviewDialog';
import { buildClipScenes, clipLang, loadClip, saveClip, type ClassClip } from '@/lib/ai-guru/reels/class-clip';
import { ReelDesigner } from './reels/design/ReelDesigner';
import { useDesign } from './reels/design/useDesign';
import { fitToParts } from '@/lib/ai-guru/reels/design/layer';
import type { StoryBoard } from '@/lib/ai-guru/reels/motion/recipes/story';
import { loadBoard, SAMPLE_STORIES, saveBoard } from '@/lib/ai-guru/reels/story/storyboard';
import { PhotoEditor } from './student/PhotoEditor';
import { loadLocalPhoto, PHOTO_EVENT, saveLocalPhoto, setLocalPrefs, showOnReels, type LocalPhoto } from '@/lib/ai-guru/student/photo';
import { reelPhoto } from '@/lib/ai-guru/student/photo-client';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';
import { loadProfile, PROFILE_EVENT } from '@/lib/ai-guru/student/profile';
import { StudentProfileButton } from '@/components/ai-guru/student/StudentProfileButton';
import { AVATAR_EVENT, loadLocalAvatar, type AvatarForReel } from '@/lib/ai-guru/teacher/avatar';
import { aiLipsyncVideo, fetchMyTeachersAvatar, loadTeacherAuth, preparedAvatar, SYNC_CONFIDENCE_MIN } from '@/lib/ai-guru/teacher/avatar-client';
import type { PreparedAvatar } from '@/lib/ai-guru/reels/motion/avatar-draw';
import { BLOCK_TEXT, loadStudentAvatar, STUDENT_AVATAR_EVENT, studentAvatarBlock, type StudentAvatar } from '@/lib/ai-guru/student/avatar';
import { StudentAvatarEditor } from './student/StudentAvatarEditor';
import { characterPhoto } from '@/lib/ai-guru/avatar/characters';
import { studentKey } from '@/lib/student-key';
import { groupRanges, reelMouthTrack } from '@/lib/ai-guru/reels/motion/lipsync';
import { levelOf, loadAccent, saveAccent, commonMistake, decorateReel, KIND_NAME, loadPins, savePins, secondWay, topicOf, type Pins, loadRecentLooks, newSeed, planStyle, REEL_KINDS, rememberLook, weeklySum, type ReelKind, type StyleChoices } from '@/lib/ai-guru/reels/motion/variety';
import { ACCENTS, ALL_LOOKS, BOARD_FONTS, CARD_FONTS, FONT_NAME, withAccent, withBoardFont } from '@/lib/ai-guru/reels/motion/look';
import { CAMERAS, type CameraKind } from '@/lib/ai-guru/reels/motion/camera';
import { MOVES_NAME, MOVES_SETTINGS, readMovesSetting, saveMovesSetting, type MovesSetting } from '@/lib/ai-guru/reels/motion/camera-presets';
import { ENDING_NAME, ENDINGS, OPENER_NAME, OPENERS, type EndingKind, type OpenerKind } from '@/lib/ai-guru/reels/motion/recipes/hooks';
import { MUSIC_NAME, MUSICS, PACK_NAME, SFX_PACKS, type MusicKind, type SfxPack } from '@/lib/ai-guru/reels/motion/sfx';
import { POSES, type Pose } from '@/lib/ai-guru/reels/motion/mascot';
import { seasonById, seasonFor } from '@/lib/ai-guru/reels/motion/season';
// V51.9.135: the Opus-inspired style library
import { StyleLibraryPanel } from './reels/StyleLibraryPanel';
import { StockVideoPanel, stockFrame, useStockClip } from './reels/StockVideoPanel';
import { VideoShelf, WhiteboardParts } from './reels/MyReelsShelves';
import { RawReelPanel } from './reels/RawReels';
import { WayTabs } from './reels/ReelsHub';
import { addPart, addVideo, thumbFromBlob } from '@/lib/ai-guru/reels/my-reels';
import { clipPassage, loadChosenRecipe, recipeChoices, saveChosenRecipe, styledLlm, type OpusCard } from '@/lib/ai-guru/reels/opus/library';
import { makeScript, type Llm } from '@/lib/ai-guru/reels/explainer/script';

type Mode = 'sum' | 'branch' | 'chapter' | 'story' | 'class' | 'explainer';
type VoiceState =
  | { status: 'off' }
  | { status: 'loading'; done: number; total: number }
  | { status: 'ready'; clips: VoiceClips; providers: string[]; failed: number; lastError?: string }
  | { status: 'failed'; error: string };

const SUM_EXAMPLES = ['478 + 356', '503 − 278', '347 × 26', '7385 ÷ 6', '1260 ÷ 12', '52 − 87'];
const FORMATS: Array<{ id: ReelFormat; label: string }> = [
  { id: 'vertical', label: 'Reel / Short 9:16' },
  { id: 'square', label: 'Square 1:1' },
  { id: 'landscape', label: 'YouTube 16:9' },
];
const LANG_NAME: Record<Lang, string> = { en: 'English', ml: 'Malayalam' };
const MODE_NAME: Record<Mode, string> = { sum: 'A sum (+ − × ÷)', branch: 'A topic example', chapter: 'A chapter intro', story: 'A story', class: 'A part of a class', explainer: 'An explainer' };
const MODE_ICON: Record<Mode, string> = { sum: '➕', branch: '📐', chapter: '📘', story: '📖', class: '🎓', explainer: '🎬' };
const MODE_ABOUT: Record<Mode, string> = {
  sum: 'Type any sum — the digits move and the voice explains each step.',
  branch: 'A worked example from algebra, geometry, statistics …',
  chapter: 'What a chapter is about, then one example.',
  story: 'A history, literature or Malayalam story told in pictured shots.',
  class: 'A part of a class sent from the whiteboard (🎬 Edit) or a class file.',
  explainer: 'A cinematic explainer: one sentence per screen, word by word, over stars, planets and light.',
};
const other = (l: Lang): Lang => (l === 'en' ? 'ml' : 'en');

function slug(s: string) {
  return s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 48) || 'ai-guru-reel';
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const CAMERA_NAME: Record<CameraKind, string> = { steady: 'Steady', punch: 'Punch-in per step', drift: 'Slow drift', focus: 'Close-ups' };
const POSE_NAME: Record<Pose, string> = { idle: 'Waving hello', think: 'Thinking', ask: 'Asking', cheer: 'Cheering' };

export default function MotionReelStudio({ way = 'design' }: { way?: 'design' | 'style' | 'stock' } = {}) {
  const [mode, setMode] = useState<Mode>('sum');
  const [sum, setSum] = useState('478 + 356');
  const [branchId, setBranchId] = useState(BRANCH_EXAMPLES[0].id);
  const [chapterId, setChapterId] = useState(CHAPTER_INTROS[0].id);
  // V51.9.119: the Reel designer (drag, resize, recolour; added text, stickers, shapes, characters, photos)
  const designApi = useDesign();
  const [designOn, setDesignOn] = useState(true);
  // V51.9.124: the explainer script (kept on this device), and its fonts (the serif and the label font)
  const [xscript, setXscript] = useState<XScript>(() => (typeof window === 'undefined' ? null : loadScript()) ?? SAMPLE_EXPLAINERS[0].script);
  const applyX = useCallback((s: XScript) => {
    const shots = s.shots.filter((x) => (x.text.en || x.text.ml || '').trim());
    if (!shots.length) return;
    const next = { ...s, shots };
    setXscript(next);
    saveScript(next);
  }, []);
  const [xVer, setXVer] = useState(0);
  const [xFonts, setXFonts] = useState(false);
  useEffect(() => {
    if (mode !== 'explainer') return;
    let live = true;
    void Promise.all([loadFontKind('elegant'), loadFontKind('modern')]).then(() => { if (live) setXFonts(true); });
    return () => { live = false; };
  }, [mode]);
  /** Bumped when the shot strip reorders the story, so the story editor shows the new order. */
  const [storyVer, setStoryVer] = useState(0);
  // V51.9.118: the story told in pictured shots (kept on this device). The editor only shows once "📖 Story" is picked,
  // so reading the saved one here does not change the server's first page.
  const [story, setStory] = useState<StoryBoard>(() => (typeof window === 'undefined' ? null : loadBoard()) ?? SAMPLE_STORIES[0].board);
  const applyStory = useCallback((b: StoryBoard) => {
    const shots = b.shots.filter((x) => (x.narration.en || x.narration.ml || '').trim());
    if (!shots.length) return;
    const next = { ...b, shots };
    setStory(next);
    saveBoard(next);
  }, []);
  const [lang, setLang] = useState<Lang>('en');
  // V51.9.120: a part of a class sent from the whiteboard (🎬 Edit as reel) or opened from a class file
  const [clip, setClip] = useState<ClassClip | null>(() => (typeof window === 'undefined' ? null : loadClip()));
  const changeClip = useCallback((c: ClassClip | null) => {
    setClip(c);
    if (c) { saveClip(c); setLang(clipLang(c)); }
  }, []);
  useEffect(() => {
    // opened by the whiteboard: show the class part at once, in its language
    if (new URLSearchParams(window.location.search).get('from') !== 'class') return;
    const t = setTimeout(() => { const c = loadClip(); if (c) { setClip(c); setLang(clipLang(c)); setMode('class'); void addPart(c).catch(() => undefined); } }, 0);
    return () => clearTimeout(t);
  }, []);
  // V51.9.135: the class part → an explainer script in the chosen style (the student's AI; the lesson stays the facts)
  const writeExplainerInStyle = async (card: OpusCard) => {
    if (!clip) return;
    const passage = clipPassage(clip);
    if (!passage.trim()) { setOpusNote('This class part has no text to turn into an explainer.'); return; }
    setOpusWriting(true);
    setOpusNote('');
    try {
      const llm: Llm = async (system, user) => {
        const { callAiGuruText } = await import('@/lib/ai-guru/byok-providers');
        return (await callAiGuruText(system, user, { json: true, maxOutputTokens: 8000, task: 'Explainer reel script (style library)' })).text;
      };
      const r = await makeScript(passage, styledLlm(llm, card), { standard: loadProfile()?.standard, title: clip.title });
      applyX(r.script);
      setXVer((v) => v + 1);
      setMode('explainer');
      setOpusNote(r.by === 'ai' ? `✓ ${r.script.shots.length} shots written in the “${card.name}” style from “${clip.title}”. Check them in the explainer editor.` : r.note ?? 'No AI key: the class text was split into sentences. Check them in the explainer editor.');
    } catch (e) {
      setOpusNote((e as Error).message);
    } finally {
      setOpusWriting(false);
    }
  };
  const [voiceOn, setVoiceOn] = useState(true);
  const [secondLine, setSecondLine] = useState(false);
  const [format, setFormat] = useState<ReelFormat>('vertical');
  // V51.9.136: the speed controller — seconds a finished step stays before the next one (baked into the MP4)
  const [stepGap, setStepGap] = useState(0);
  useEffect(() => { void Promise.resolve().then(() => { try { const n = Number(localStorage.getItem('aiGuruReelStepGapSec')); if (n >= 0 && n <= 10) setStepGap(Math.round(n)); } catch { /* not remembered */ } }); }, []);
  const chooseGap = (g: number) => { setStepGap(g); try { localStorage.setItem('aiGuruReelStepGapSec', String(g)); } catch { /* not remembered */ } };
  // Share clip (V51.9.76): trim to 40 s and add an end card with the student's own link. Off by default: nothing changes unless it is ticked.
  const [clipOn, setClipOn] = useState(false);
  /** V51.9.90: the student's link replaces @aiguru on every frame of the video. */
  const [linkOn, setLinkOn] = useState(true);
  // V51.9.99: the student's photo on the reel (footer + "Shared by" on the closing cards)
  const [myPhoto, setMyPhoto] = useState<LocalPhoto | null>(null);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [photoEdit, setPhotoEdit] = useState(false);
  // V51.9.125: the details (name, school, WhatsApp) can be changed here, so the footer follows them
  const [profVer, setProfVer] = useState(0);
  const profile = useMemo(() => (typeof window === 'undefined' ? null : loadProfile()), [myPhoto, profVer]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const sync = () => { setMyPhoto(loadLocalPhoto()); void reelPhoto().then(setPhotoImg); };
    const prof = () => setProfVer((v) => v + 1);
    sync();
    window.addEventListener(PHOTO_EVENT, sync);
    window.addEventListener(PROFILE_EVENT, prof);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(PHOTO_EVENT, sync); window.removeEventListener(PROFILE_EVENT, prof); window.removeEventListener('storage', sync); };
  }, []);
  // V51.9.100: the teacher's face (and voice) in the corner — a choice, off until switched on.
  // On a teacher's computer: their own avatar (saved in My avatar). For a student: their class teacher's face (when
  // shared; face only, free lip-sync), or the student's OWN avatar — made on this phone, voice with their own key (BYOK).
  // Students never use the AI Guru PC's voice or AI lip-sync, so their reels cannot cost the company anything.
  const [mine, setMine] = useState<AvatarForReel | null>(null);
  const [classAvatar, setClassAvatar] = useState<AvatarForReel | null>(null);
  const [myAv, setMyAv] = useState<StudentAvatar | null>(null);
  const [avEdit, setAvEdit] = useState(false);
  const [faceWho, setFaceWho] = useState<'off' | 'teacher' | 'me'>('off');
  const faceOn = AVATARS && faceWho !== 'off'; // V51.9.122: avatars are switched off app-wide (lib/ai-guru/features.ts)
  const [teacherVoiceOn, setTeacherVoiceOn] = useState(true);
  const [prepared, setPrepared] = useState<PreparedAvatar | null>(null);
  useEffect(() => {
    if (!AVATARS) return;
    const sync = () => { setMine(loadLocalAvatar()); setMyAv(loadStudentAvatar()); };
    sync();
    window.addEventListener(AVATAR_EVENT, sync);
    window.addEventListener(STUDENT_AVATAR_EVENT, sync);
    void fetchMyTeachersAvatar().then(setClassAvatar);
    return () => { window.removeEventListener(AVATAR_EVENT, sync); window.removeEventListener(STUDENT_AVATAR_EVENT, sync); };
  }, []);
  // the student's own avatar can be used only while every condition holds (photo + guardian, own key, voice opt-in)
  const myBlock = myAv ? studentAvatarBlock({ photo: myPhoto, hasOwnKey: studentKey.hasUsableKey(), voiceOptIn: studentKey.getTtsOptIn(), character: myAv.character }) : null;
  const myAvatar: AvatarForReel | null = useMemo(() => {
    if (!myAv || myBlock) return null;
    // V51.9.103: a character instead of the student's photo
    const photo = myAv.character ? characterPhoto(myAv.character) : myPhoto?.dataUrl;
    return photo ? { id: 'me', name: profile?.name ?? '', style: 'lipsync', marks: myAv.marks, photo, hasVoice: false, hasVideo: false, at: myAv.at } : null;
  }, [myAv, myBlock, myPhoto, profile]);
  const teacherAv = mine ?? classAvatar;
  const avatar = !AVATARS ? null : faceWho === 'me' ? myAvatar : faceWho === 'teacher' ? teacherAv : null;
  const byok = AVATARS && faceWho === 'me' && myAvatar && myAv ? { voice: myAv.voice } : null;
  useEffect(() => {
    if (!avatar || !faceOn) return;
    let live = true;
    void preparedAvatar(avatar).then((p) => { if (live) setPrepared(p); }).catch(() => { if (live) setPrepared(null); });
    return () => { live = false; };
  }, [avatar, faceOn]);
  const face = faceOn && avatar ? prepared : null;
  // the teacher's cloned voice: only on the teacher's own computer (students never call the AI Guru PC's worker)
  const teacherVoice = useMemo(() => (AVATARS && faceWho === 'teacher' && mine && teacherVoiceOn && mine.hasVoice ? { avatarId: mine.id, auth: loadTeacherAuth() } : null), [faceWho, teacherVoiceOn, mine]);
  // V51.9.101: every reel different — a seed per reel picks look, opener, ending, music, camera, pose and pace.
  const [variety, setVariety] = useState<{ seed: number; recent: string[]; classLooks?: Record<string, number> }>({ seed: 1, recent: [] }); // the real seed is set after the page opens (the server and the browser must draw the same first page)
  // V51.9.105: looks classmates used today (so a class's reels spread across the looks), and the student's own colour
  const classLooks = useRef<Record<string, number>>({});
  const shownLook = useRef('');
  const freshVariety = () => ({ seed: newSeed(), recent: loadRecentLooks(), classLooks: classLooks.current });
  const [accent, setAccent] = useState<string | null>(null);
  // V51.9.161: camera presets per step (kept on this device; the class board uses the same setting)
  const [moves, setMoves] = useState<MovesSetting>(() => (typeof window === 'undefined' ? 'auto' : readMovesSetting()));
  const pickMoves = (v: MovesSetting) => { setMoves(v); saveMovesSetting(v); };
  useEffect(() => { void Promise.resolve().then(() => setAccent(loadAccent())); }, []);
  const pickAccent = (id: string | null) => setAccent(saveAccent(id));
  const [choices, setChoices] = useState<StyleChoices>({});
  const [kind, setKind] = useState<ReelKind>('normal');
  const [badgesOn, setBadgesOn] = useState(true);
  const [stats, setStats] = useState<{ toffees?: number; streak?: number; className?: string; classCode?: string; topper?: boolean }>({});
  // 🎲 always gives a different look from the one on screen (and still avoids the last 5 downloaded)
  const shuffle = () => setVariety({ ...freshVariety(), recent: [...new Set([shownLook.current, ...loadRecentLooks()])].filter(Boolean) });
  const choose = (patch: Partial<StyleChoices>) => setChoices((c) => ({ ...c, ...patch }));
  // V51.9.102 "My style": pinned favourites stay on every new reel (on this phone); the rest keeps changing
  const [pins, setPins] = useState<Pins>({});
  useEffect(() => { void Promise.resolve().then(() => setPins(loadPins())); }, []);
  const togglePin = (key: keyof Pins, current: string) => {
    setPins((p) => {
      const next = { ...p } as Record<string, string>;
      if (next[key]) delete next[key];
      else next[key] = current;
      return savePins(next as Pins);
    });
    setChoices((c) => { const n = { ...c }; delete n[key]; return n; });
  };
  // V51.9.135: a style from the library sits between My style (pins) and the student's own picks for this reel
  const [opusStyle, setOpusStyle] = useState<OpusCard | null>(null);
  useEffect(() => { void Promise.resolve().then(() => setOpusStyle(loadChosenRecipe())); }, []);
  const chooseOpus = (card: OpusCard | null) => {
    setOpusStyle(card);
    saveChosenRecipe(card);
    // a new style shows at once: the hand-picked choices of this reel give way to it (pins and the season switch stay)
    setChoices((c) => (c.season === false ? { season: false } : {}));
  };
  const [opusWriting, setOpusWriting] = useState(false);
  const [opusNote, setOpusNote] = useState('');
  const effChoices: StyleChoices = useMemo(() => ({ ...pins, ...(opusStyle ? recipeChoices(opusStyle) : {}), ...choices }), [pins, opusStyle, choices]);
  const [ref, setRef] = useState('');
  const [fontsReady, setFontsReady] = useState(false);
  const [voice, setVoice] = useState<VoiceState>({ status: 'off' });
  const [playing, setPlaying] = useState(false);
  // V51.9.157 Way 4: the student's stock video behind the reel (kept on this device only)
  const stock = useStockClip();
  const bgClip = way === 'stock' ? stock.clip : null;
  const [time, setTime] = useState(0);
  const [exporting, setExporting] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [video, setVideo] = useState<{ url: string; blob: Blob; name: string; check?: ReelCheck; made?: unknown[] } | null>(null);
  // V51.9.121: the preview window (see it before posting) and the ＋ New reel chooser
  const [previewOpen, setPreviewOpen] = useState(false);
  const [chooser, setChooser] = useState(false);
  // V51.9.97: a reel the self-check flagged is shared only after a second, deliberate tap
  const [shareAnyway, setShareAnyway] = useState(false);
  // bumping this asks the TTS again for the steps that have no voice (good clips are cached)
  const [voiceTry, setVoiceTry] = useState(0);
  const remakeRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode } | null>(null);
  const clockRef = useRef<{ start: number; from: number } | null>(null);

  useEffect(() => {
    loadReelFonts().then(() => setFontsReady(true));
    fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/me', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j?.affiliate?.enabled && j.affiliate.code) setRef(j.affiliate.code);
      // V51.9.101: numbers for the badges and the "my toffees" ending
      if (j?.student) setStats((s) => ({ ...s, toffees: j.learning?.toffees || undefined, streak: j.rewards?.streak?.current || undefined, classCode: j.student.coupon || undefined }));
    }).catch(() => undefined);
    fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/class', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j?.class?.name) setStats((s) => ({ ...s, className: j.class.name, topper: j.class.mine?.rank === 1 }));
    }).catch(() => undefined);
    // this phone's recent looks, and (signed in) the looks classmates used today — waited for at most 1.5 s
    const counts = fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/class-looks', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.counts) classLooks.current = j.counts; }).catch(() => undefined);
    void Promise.race([counts, new Promise((r) => setTimeout(r, 1500))]).then(() => setVariety({ seed: newSeed(), recent: loadRecentLooks(), classLooks: classLooks.current }));
  }, []);
  // V51.9.107: the site's address is known only in the browser; reading it while the server draws the page made the two differ
  const pageOrigin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => '');
  // V51.9.150: the public address when it is set (a localhost link opens nothing on other phones)
  const origin = shareOrigin(pageOrigin);
  const clipLink = `${origin}${ref ? `/j/${ref}` : '/ai-guru/student/signup'}`; // short link: readable on screen

  const shortLink = clipLink.replace(/^https?:\/\//, '');

  const requestFor = useCallback(
    (l: Lang): ReelRequest => {
      if (mode === 'sum') return { kind: 'arithmetic', text: sum, lang: l };
      if (mode === 'branch') return { kind: 'branch', id: branchId, lang: l };
      if (mode === 'story') return { kind: 'story', board: story, lang: l };
      if (mode === 'explainer') return { kind: 'explainer', script: xscript, lang: l };
      if (mode === 'class') return { kind: 'scenes', title: clip?.title ?? 'Class', build: () => { if (!clip) throw new Error('Open a class part first: 🎬 Edit as reel on the class whiteboard, or a class file.'); return buildClipScenes(clip); }, lang: l };
      const ch = CHAPTER_INTROS.find((c) => c.id === chapterId)!;
      return { kind: 'intro', intro: ch.intro[l], lang: l, example: { branchId: ch.exampleId, lang: l } };
    },
    [mode, sum, branchId, chapterId, story, clip, xscript],
  );
  const request = useMemo(() => requestFor(lang), [requestFor, lang]);
  // a new reel gets a new look (the language or format alone does not change it)
  // (a story keeps its look while its words are edited: only another story gives a new one)
  const reelKey = `${mode}|${sum}|${branchId}|${chapterId}|${kind}|${mode === 'story' ? story.title.en : mode === 'class' ? clip?.madeAt ?? '' : mode === 'explainer' ? xscript.title.en : ''}`;
  const lastKey = useRef(reelKey);
  useEffect(() => {
    if (lastKey.current === reelKey) return;
    lastKey.current = reelKey;
    setVariety({ seed: newSeed(), recent: loadRecentLooks(), classLooks: classLooks.current });
    setChoices((c) => (c.season === false ? { season: false } : {})); // a new reel: only pinned favourites carry over
  }, [reelKey]);
  // weekly challenge: the class's problem of the week; duet: the student's own avatar answers
  const pickKind = (k: ReelKind) => {
    setKind(k);
    if (k === 'weekly' && stats.classCode) { setMode('sum'); setSum(weeklySum(stats.classCode)); }
    if (k === 'duet') setFaceWho('me');
  };
  const kindBlock = (k: ReelKind): string | null => {
    if ((k === 'spot-mistake' || k === 'two-ways') && mode !== 'sum') return 'for sums';
    if (k === 'spot-mistake' && !commonMistake(sum)) return 'this sum has no common mistake';
    if (k === 'two-ways' && !secondWay(sum)) return 'no second way for this sum';
    if (k === 'weekly' && !stats.classCode) return 'join a class first';
    if (k === 'duet' && (!classAvatar || !myAvatar)) return 'needs your teacher’s shared face and your own avatar';
    return null;
  };
  // V51.9.102: the style fits the lesson (geometry → graph paper and close-ups, a chapter intro → night board and drift …)
  const topic = useMemo(() => topicOf(request.kind === 'branch' ? { kind: 'branch', branch: BRANCH_EXAMPLES.find((b) => b.id === request.id)?.branch } : { kind: request.kind === 'story' || request.kind === 'explainer' ? 'intro' : request.kind === 'scenes' ? 'derivation' : request.kind }), [request]);
  // V51.9.105: and the class level (Std 1–4 bright and playful … Std 9–12 calmer)
  // (the profile is on this device only, so the level is used once the page runs here: the server's first page must match)
  const inBrowser = useSyncExternalStore(() => () => {}, () => true, () => false);
  const level = useMemo(() => (inBrowser ? levelOf(profile?.standard) : null), [profile, inBrowser]);
  const style = useMemo(() => planStyle(variety.seed, { recent: variety.recent, hasFace: faceWho !== 'off', choices: effChoices, topic, level, classLooks: variety.classLooks }), [variety, faceWho, effChoices, topic, level]);
  // V51.9.106: the reel's fonts (cards and board) load when first used; the board's layout is measured with its font
  const [loadedFonts, setLoadedFonts] = useState('');
  useEffect(() => {
    let live = true;
    void Promise.all([loadFontKind(style.font), loadFontKind(style.boardFont)]).then(() => { if (live) setLoadedFonts(`${style.font}|${style.boardFont}`); });
    return () => { live = false; };
  }, [style.font, style.boardFont]);
  const boardFont = style.boardFont;
  const boardReady = ['serif', 'rounded', 'hand'].includes(boardFont) || loadedFonts.endsWith(`|${boardFont}`);
  const season = seasonFor(new Date());
  // content kinds that change what is on screen
  const effVoiceOn = voiceOn && kind !== 'speed-run';
  const effSecondLine = secondLine || kind === 'bilingual';
  const sumText = mode === 'sum' ? sum : undefined;
  const badges = useMemo(() => {
    if (!badgesOn || mine) return [];
    const b: string[] = [];
    if (stats.toffees) b.push(`${stats.toffees} TOFFEES`);
    if (stats.streak && stats.streak > 1) b.push(`${stats.streak}-DAY STREAK`);
    if (stats.topper) b.push('CLASS TOPPER');
    if (stats.className) b.push(stats.className);
    return b;
  }, [badgesOn, stats, mine]);

  // Pass 1: the reel without voice (gives the script and a silent fallback).
  const base = useMemo((): { reel: MotionReel | null; error: string | null } => {
    if (!fontsReady || !boardReady) return { reel: null, error: null };
    if (request.kind === 'arithmetic') {
      const err = arithmeticLimitError(request.text);
      if (err) return { reel: null, error: err };
    }
    try {
      return { reel: withBoardFont(boardFont, () => buildReel(request, { stepPauseMs: stepGap * 1000 })), error: null };
    } catch (e) {
      return { reel: null, error: (e as Error).message };
    }
  }, [request, fontsReady, boardReady, boardFont, stepGap]);

  // V51.9.101: everything the voice must say: the lesson plus the opener, the ending and the closing cards
  const decorate = useCallback(
    (r: MotionReel, voiceMs?: (spoken: string) => number | undefined): MotionReel => {
      // V51.9.124: an explainer keeps its own cinematic look: no classic opener or ending
      const d = r.parts[0]?.explainer ? r : decorateReel(r, { style, kind, lang, sum: sumText, name: profile?.name, toffees: stats.toffees, streak: stats.streak, className: stats.className, hasFace: faceWho !== 'off', voiceMs });
      // V51.9.150: every reel ends with the join card and the QR code (a video cannot be tapped); the short clip also trims to 40 s
      return shareClip(d, { link: clipLink, lang, voiceMs, variant: style.seed, name: profile?.name, maxMs: clipOn ? undefined : Number.MAX_SAFE_INTEGER });
    },
    [style, kind, lang, sumText, profile, stats, faceWho, clipOn, clipLink],
  );
  const draft = useMemo(() => { try { return base.reel ? withBoardFont(boardFont, () => decorate(base.reel!)) : null; } catch { return null; } }, [base.reel, decorate, boardFont]);
  const scriptKey = useMemo(() => (draft ? voiceScript(draft).join('\u0001') : ''), [draft]);
  // in a duet the teacher's question is not spoken in the student's own (BYOK) voice
  const byokSkip = useMemo(() => new Set((draft?.parts ?? []).filter((p) => p.group === 'duet-ask').flatMap((p) => p.captions.map((c) => c.say ?? '')).filter(Boolean)), [draft]);

  // Voice-over clips for every step.
  useEffect(() => {
    if (!effVoiceOn || !base.reel) {
      setVoice({ status: 'off' });
      return;
    }
    const ctl = new AbortController();
    const script = voiceScript(draft ?? base.reel);
    setVoice({ status: 'loading', done: 0, total: script.length });
    synthesizeVoiceClips(script, lang, {
      signal: ctl.signal,
      onProgress: (p) => setVoice({ status: 'loading', ...p }),
      teacher: teacherVoice,
      byok,
      byokSkip,
      edgeVoices: AVATARS && faceWho === 'teacher' && teacherAv?.edge && !teacherVoice ? teacherAv.edge : null,
    })
      .then((r) => {
        if (!r.clips.size) setVoice({ status: 'failed', error: r.lastError || 'No voice provider answered.' });
        else setVoice({ status: 'ready', clips: r.clips, providers: r.providers, failed: r.failed.length, lastError: r.lastError });
      })
      .catch((e) => {
        if (!ctl.signal.aborted) setVoice({ status: 'failed', error: (e as Error).message });
      });
    return () => ctl.abort();
  }, [base.reel, scriptKey, effVoiceOn, lang, voiceTry, teacherVoice, byok?.voice, faceWho, teacherAv?.edge?.ml]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pass 2: the reel timed to the voice, with the optional second-language caption line.
  const clips = voice.status === 'ready' ? voice.clips : null;
  const reel = useMemo((): MotionReel | null => {
    if (!base.reel) return null;
    return withBoardFont(boardFont, () => {
      let r: MotionReel;
      try {
        r = buildReel(request, {
          voiceMs: clips ? (t) => (clips.has(t) ? clipMs(clips.get(t)!) : undefined) : undefined,
          subtitleFrom: effSecondLine ? requestFor(other(lang)) : undefined,
          stepPauseMs: stepGap * 1000,
        });
      } catch {
        r = base.reel!;
      }
      const vm = clips ? (t: string) => (clips.has(t) ? clipMs(clips.get(t)!) : undefined) : undefined;
      try { return decorate(r, vm); } catch { return shareClip(r, { link: clipLink, lang, voiceMs: vm, maxMs: clipOn ? undefined : Number.MAX_SAFE_INTEGER }); }
    });
  }, [base.reel, request, clips, effSecondLine, requestFor, lang, clipOn, clipLink, decorate, boardFont, stepGap]);

  // the bubble's mouth, frame by frame from this reel's voice (the same track the MP4 export uses)
  const duetRanges = useMemo(() => (reel && kind === 'duet' ? groupRanges(reel, 'duet-ask') : []), [reel, kind]);
  const inDuet = useCallback((t: number) => duetRanges.some(([a, b]) => t >= a && t < b), [duetRanges]);
  const teacher = useMemo(() => (face && reel ? { avatar: face, track: reelMouthTrack(reel, clips, 30, (t) => !inDuet(t)) } : null), [face, reel, clips, inDuet]);
  // duet: the class teacher's face asks (face only, free lip-sync; the student's own avatar answers)
  const [duetFace, setDuetFace] = useState<PreparedAvatar | null>(null);
  useEffect(() => {
    if (kind !== 'duet' || !classAvatar) return;
    let live = true;
    void preparedAvatar({ ...classAvatar, style: 'lipsync' }).then((p) => { if (live) setDuetFace(p); }).catch(() => {});
    return () => { live = false; };
  }, [kind, classAvatar]);
  const duet = useMemo(() => (kind === 'duet' && duetFace && reel ? { avatar: duetFace, track: reelMouthTrack(reel, clips, 30, inDuet) } : null), [kind, duetFace, reel, clips, inDuet]);
  // speed run: the stopwatch runs over the lesson itself
  const stopwatch = useMemo(() => {
    if (!reel || kind !== 'speed-run') return null;
    let t = 0, from = -1, to = 0;
    for (const p of reel.parts) {
      const lesson = !['opener', 'ending', 'end-card', 'qr-card', 'reveal', 'way-2', 'duet-ask'].includes(p.group ?? '');
      if (lesson && from < 0) from = t;
      if (lesson) to = t + p.durationMs;
      t += p.durationMs;
    }
    return from < 0 ? null : { from, to };
  }, [reel, kind]);
  useEffect(() => { shownLook.current = style.look.id; }, [style.look.id]);
  // the card font rides on the look (redrawn once its file has loaded)
  const lookObj = useMemo(() => ({ ...withAccent(style.look, accent), font: style.font }), [style.look, accent, style.font, loadedFonts]); // eslint-disable-line react-hooks/exhaustive-deps
  const look = { look: lookObj, camera: style.camera, moves, badges, season: style.season, duet, stopwatch, boardFont };

  const stopAudio = () => {
    try {
      audioRef.current?.src.stop();
      void audioRef.current?.ctx.close();
    } catch {
      /* already stopped */
    }
    audioRef.current = null;
  };

  const draw = useCallback(
    (t: number) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !reel) return;
      // V51.9.157: the stock clip follows the reel's clock (playing: it runs and is nudged back when it drifts; still: it seeks)
      const bgVideo = stockFrame(bgClip, t, playing);
      // the preview shows the frame exactly as the MP4 will be: footer, details and photo included
      drawReelFrame(ctx, reel, t, { bgVideo, format, stepLabel: STEP_LABEL[lang], handle: linkOn ? shortLink : undefined, footer: format !== 'square', download: true, student: profile, photo: photoImg, teacher, ...look, design: fitToParts(designApi.design, reel.parts.length), designStill: !playing && designOn });
    },
    [bgClip, stock.tick, reel, format, lang, linkOn, shortLink, photoImg, profile, teacher, look.look, look.camera, look.badges, look.season, look.duet, look.stopwatch, look.boardFont, designApi.design, playing, designOn, xFonts], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    setPlaying(false);
    stopAudio();
    setTime(0);
    setVideo((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
  }, [reel, format]);

  useEffect(() => {
    draw(time);
  }, [draw, time]);

  useEffect(() => {
    if (!playing || !reel) return;
    let raf = 0;
    const loop = () => {
      const clk = clockRef.current!;
      const t = clk.from + (performance.now() - clk.start);
      if (t >= reel.durationMs) {
        setTime(reel.durationMs);
        setPlaying(false);
        stopAudio();
        return;
      }
      setTime(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, reel]);

  const play = () => {
    if (!reel) return;
    const from = time >= reel.durationMs - 50 ? 0 : time;
    clockRef.current = { start: performance.now(), from };
    try {
      const ctx = new AudioContext({ sampleRate: SFX_RATE });
      const samples = mixReelAudio(reel, clips, { musicKind: style.music, pack: style.pack });
      const buf = ctx.createBuffer(1, samples.length, SFX_RATE);
      buf.copyToChannel(samples, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0, from / 1000);
      audioRef.current = { ctx, src };
    } catch {
      /* preview without sound */
    }
    setPlaying(true);
  };
  const pause = () => {
    setPlaying(false);
    stopAudio();
    stock.clip?.el.pause();
  };

  /** What a video was made from: when any of these changes, the preview makes it again. */
  const madeFrom: unknown[] = [reel, designApi.design, lookObj, format, linkOn, photoImg, teacher, bgClip?.url, bgClip?.start, bgClip?.shade];
  const doExport = async () => {
    if (!reel) return;
    if (mode === 'explainer') await Promise.all([loadFontKind('elegant'), loadFontKind('modern'), explainerPhotosReady(xscript.shots)]).catch(() => undefined); // V51.9.124
    pause();
    setMessage(null);
    setExporting(0);
    let faceUrl: string | null = null;
    try {
      // V51.9.100: AI lip-sync first when the teacher chose it (needs the GPU PC); otherwise / on failure the photo lip-sync
      let faceVideo: HTMLVideoElement | null = null;
      let faceNote = '';
      if (teacher && faceWho === 'teacher' && mine && avatar?.style === 'ai' && clips?.size) {
        setMessage('Making the AI lip-sync of the teacher’s face on the GPU PC… (this can take a few minutes)');
        try {
          const ai = await aiLipsyncVideo(reel, clips, loadTeacherAuth());
          faceUrl = ai.url;
          if (ai.syncConfidence !== null && ai.syncConfidence < SYNC_CONFIDENCE_MIN) faceNote = ` The AI lip-sync scored ${ai.syncConfidence.toFixed(1)} (under ${SYNC_CONFIDENCE_MIN}), so the photo lip-sync was used.`;
          else faceVideo = ai.video;
        } catch (e) {
          faceNote = ` AI lip-sync not available (${(e as Error).message.slice(0, 90)}), so the photo lip-sync was used.`;
        }
        setMessage(null);
      }
      const res = await exportMotionReelMp4(reel, { format, stepLabel: STEP_LABEL[lang], handle: linkOn ? shortLink : undefined, voices: clips, onProgress: setExporting, teacher, faceVideo, bgVideo: bgClip ? { el: bgClip.el, start: bgClip.start, shade: bgClip.shade } : null, style: { ...look, musicKind: style.music, pack: style.pack, design: fitToParts(designApi.design, reel.parts.length) } });
      const name = `${slug(reel.title)}-${lang}-${format}.mp4`;
      setVideo((v) => {
        if (v) URL.revokeObjectURL(v.url);
        return { url: URL.createObjectURL(res.blob), blob: res.blob, name, check: res.check, made: madeFrom };
      });
      setShareAnyway(false);
      // V51.9.152: kept in My reels (preview, download again, delete)
      void thumbFromBlob(res.blob).then((thumb) => addVideo({ title: reel.title, way, name, blob: res.blob, seconds: res.durationMs / 1000, thumb })).catch(() => undefined);
      const about = `${name} (${(res.durationMs / 1000).toFixed(1)} s, ${res.videoCodec}${res.audioCodec ? ' + ' + res.audioCodec : ', no audio'}${clips ? ', with voice-over' : ''}${teacher ? `, ${faceVideo ? 'AI lip-synced' : 'lip-synced'} teacher` : ''})${faceNote}`;
      // V51.9.121: not downloaded by itself any more: the preview shows it first, with Share and Download
      setMessage(res.check && !res.check.ok ? `Made ${about}, but the check found a problem. Make it again, or download / share it anyway.` : `Made ${about}.`);
      rememberLook(style.look.id); // the next reels will not reuse this look for a while
      // V51.9.105: tell the class (only the look's id), so classmates' next reels lean to other looks today
      if (stats.classCode) {
        void fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/class-looks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ look: style.look.id }) }).catch(() => undefined);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setExporting(null);
      if (faceUrl) URL.revokeObjectURL(faceUrl);
    }
  };

  /** "Make it again": when a voice step is missing, fetch the voice again first, then export. */
  const remake = () => {
    const voiceProblem = video?.check?.problems.some((p) => p.kind === 'voice-missing');
    if (voiceOn && voiceProblem) {
      remakeRef.current = true;
      setMessage('Fetching the missing voice steps again…');
      setVoiceTry((n) => n + 1);
    } else void doExport();
  };
  useEffect(() => {
    if (!remakeRef.current || voice.status === 'loading') return;
    remakeRef.current = false;
    if (reel) void doExport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.status, reel]);

  const copyCaption = async () => {
    if (!reel) return;
    try { await navigator.clipboard.writeText(clipCaption(reel.title, clipLink, lang)); setMessage('Caption with your link copied. Paste it when you post.'); } catch { setMessage('Could not copy; select the caption text below.'); }
  };

  const doCaptions = (kind: 'srt' | 'vtt') => {
    if (!reel) return;
    const cues = reelSubtitleCues(reel);
    const text = kind === 'srt' ? toSrt(cues) : toVtt(cues);
    download(new Blob([text], { type: kind === 'srt' ? 'application/x-subrip' : 'text/vtt' }), `${slug(reel.title)}-${lang}.${kind}`);
  };

  /** V51.9.121: 👁 Preview & post — makes the MP4 when it is new or out of date, then shows it. */
  const fresh = !!video?.made && video.made.length === madeFrom.length && video.made.every((v, i) => v === madeFrom[i]);
  const openPreview = () => {
    if (!reel) return;
    setPreviewOpen(true);
    if (!fresh && exporting === null) void doExport();
  };
  const previewState: PreviewState = exporting !== null
    ? { phase: 'making', progress: exporting, note: message?.startsWith('Making the AI lip-sync') ? message : undefined }
    : video && fresh ? { phase: 'ready', url: video.url, blob: video.blob, name: video.name, check: video.check }
      : { phase: 'error', message: message || 'The reel could not be made.' };
  const doShare = async () => {
    if (!video || !reel) return;
    if (video.check && !video.check.ok && !shareAnyway) {
      setShareAnyway(true);
      setMessage('This reel has a problem (see the check above). Tap Share again to send it anyway, or make it again.');
      return;
    }
    const file = new File([video.blob], video.name, { type: 'video/mp4' });
    const text = clipCaption(reel.title, clipLink, lang); // the caption always carries the student's link
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, title: reel.title });
      else {
        await navigator.clipboard?.writeText(text);
        setMessage('Caption copied. Upload the downloaded MP4 to Instagram, YouTube Shorts or WhatsApp.');
      }
    } catch {
      /* user cancelled */
    }
  };

  const { width, height } = FORMAT_SIZE[format];
  // the preview's size on screen (the designer's handles sit exactly over it)
  const cssW = format === 'landscape' ? 520 : format === 'square' ? 400 : 340;
  const cssH = Math.round((cssW * height) / width);
  const chip = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-violet-600 text-white' : 'bg-white/[0.06] text-white/70 hover:bg-white/10'}`;
  const voiceLine =
    voice.status === 'loading'
      ? `Preparing ${LANG_NAME[lang]} voice… ${voice.done}/${voice.total}`
      : voice.status === 'ready'
        ? `Voice ready (${voice.providers.join(', ')})${voice.failed ? ` — ${voice.failed} step(s) silent: ${voice.lastError?.slice(0, 120) ?? ''}` : ''}`
        : voice.status === 'failed'
          ? `Voice unavailable: ${voice.error.slice(0, 160)}. Check Settings → Local TTS. The reel still works without voice.`
          : null;

  return (
    <div className="min-h-screen bg-[#04101c] text-white">
      <AiGuruTopNav activeLabel="Reel Studio" />
      <main className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        {/* V51.9.121: one bar — what to make, and see it / post it */}
        <div className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#04101c]/95 px-4 py-2.5 backdrop-blur lg:col-span-2" data-studio-bar>
          <h1 className="mr-1 text-xl font-bold">{way === 'style' ? '✦ Pick a style' : way === 'stock' ? '🎞 Stock video background' : '🖐 Design it yourself'}</h1>
          <button onClick={() => setChooser(true)} className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-semibold hover:bg-white/10">＋ New reel</button>
          <span className="hidden truncate text-xs text-white/45 sm:inline">{MODE_NAME[mode]}{reel ? ` · ${reel.title}` : ''}</span>
          {/* V51.9.152: the ways (this page is one of them) */}
          <WayTabs active={way} />
          <span className="ml-auto flex items-center gap-2">
            <StudentProfileButton inline />
            {voice.status === 'loading' && <span className="text-xs text-white/50">voice {voice.done}/{voice.total}…</span>}
            <button disabled={!reel || voice.status === 'loading' || exporting !== null} onClick={openPreview} className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-sm font-extrabold disabled:opacity-40" title="Make the MP4 and watch it before you download or share it">
              {exporting !== null ? `Making… ${Math.round(exporting * 100)}%` : '👁 Preview & post'}
            </button>
          </span>
        </div>
        {chooser && (
          <div className="fixed inset-0 z-[10035] flex items-start justify-center bg-black/60 p-4 pt-20" onClick={() => setChooser(false)} role="dialog" aria-label="New reel">
            <div className="w-full max-w-lg space-y-2 rounded-2xl border border-white/15 bg-[#0a1424] p-4" onClick={(e) => e.stopPropagation()} data-new-reel>
              <div className="flex items-center"><h2 className="flex-1 text-base font-extrabold">What should the reel show?</h2><button onClick={() => setChooser(false)} className="px-2 text-white/60" aria-label="Close">✕</button></div>
              {(['sum', 'branch', 'chapter', 'story', 'explainer', 'class'] as Mode[]).map((m) => (
                <button key={m} onClick={() => { setMode(m); setChooser(false); }} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${mode === m ? 'border-violet-400 bg-violet-500/15' : 'border-white/10 hover:bg-white/5'}`}>
                  <span className="text-2xl">{MODE_ICON[m]}</span>
                  <span><span className="block text-sm font-bold">{MODE_NAME[m]}</span><span className="block text-xs text-white/55">{MODE_ABOUT[m]}</span></span>
                </button>
              ))}
            </div>
          </div>
        )}
        {previewOpen && reel && (
          <ReelPreviewDialog state={previewState} title={reel.title} caption={clipCaption(reel.title, clipLink, lang)}
            onClose={() => setPreviewOpen(false)} onEdit={() => setPreviewOpen(false)} editLabel="✏️ Change it" />
        )}
        <section className="min-w-0 space-y-5">
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/65" data-way-hint>
            {way === 'stock'
              ? <>Find a free clip on <b>Pexels</b> or <b>Pixabay</b>, download it, and upload it below: it plays behind your lesson. Open a part from the whiteboard, choose a style if you like, then <b>👁 Preview &amp; post</b>.</>
              : way === 'style'
              ? <>Open a part from the whiteboard below, then choose a style in the <b>✦ Style library</b>: the look, camera, pace, music and fonts change at once. Then <b>👁 Preview &amp; post</b>.</>
              : <>Open a part from the whiteboard below, then <b>right-click</b> (or long-press) anything on the preview: colours, bigger / smaller, background, cards; add text, stickers and shapes from the panel. Then <b>👁 Preview &amp; post</b>.</>}
          </p>
          {way === 'stock' && <StockVideoPanel api={stock} suggest={reel?.title} />}
          {/* V51.9.207: the raw reels moved here from the Reel Studio tray: a part opens in the editor, an MP4 becomes the video behind the lesson (stock way) */}
          <RawReelPanel way={way}
            onUsePart={(c) => { changeClip(c); setMode('class'); }}
            onUseVideo={way === 'stock' ? (blob, name) => stock.load(new File([blob], name, { type: blob.type || 'video/mp4' })) : undefined}
            useVideoLabel="Use as the video behind my lesson" />
          <WhiteboardParts compact onOpen={(c) => { changeClip(c); setMode('class'); }} activeMadeAt={mode === 'class' ? clip?.madeAt : undefined} />
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" data-reel-content>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white/45">In this reel</span>
              <span className="rounded-md bg-violet-500/25 px-2 py-0.5 text-xs font-semibold text-violet-100">{MODE_NAME[mode]}</span>
              <button className="ml-auto text-xs text-cyan-300 underline" onClick={() => setChooser(true)}>change</button>
            </div>

          {mode === 'class' && <ClassClipPanel clip={clip} onChange={changeClip} />}

          {mode === 'explainer' && <ExplainerEditor key={xVer} applied={xscript} onApply={applyX} lang={lang} standard={profile?.standard} styleRecipe={opusStyle} />}

          {mode === 'story' && <StoryEditor key={storyVer} applied={story} onApply={applyStory} lang={lang} standard={profile?.standard} />}

          {mode === 'sum' && (
            <div className="space-y-2">
              <input
                value={sum}
                onChange={(e) => setSum(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-lg outline-none focus:border-violet-400"
                placeholder="e.g. 347 × 26"
              />
              <div className="flex flex-wrap gap-2">
                {SUM_EXAMPLES.map((s) => (
                  <button key={s} className={chip(sum === s)} onClick={() => setSum(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'branch' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {BRANCH_EXAMPLES.map((b) => (
                <button key={b.id} onClick={() => setBranchId(b.id)} className={`text-left ${chip(branchId === b.id)}`}>
                  <div className="text-[11px] uppercase tracking-wide opacity-70">{b.branch}</div>
                  <div className="text-sm">{b.input.title}</div>
                </button>
              ))}
            </div>
          )}

          {mode === 'chapter' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {CHAPTER_INTROS.map((c) => (
                <button key={c.id} onClick={() => setChapterId(c.id)} className={`text-left ${chip(chapterId === c.id)}`}>
                  <div className="text-[11px] uppercase tracking-wide opacity-70">{c.klass}</div>
                  <div className="text-sm">{c.intro[lang].heading}</div>
                </button>
              ))}
            </div>
          )}

          </div>
          {/* V51.9.135: Opus-inspired styles for any reel */}
          <StyleLibraryPanel defaultOpen={way !== 'stock'} mode={mode} active={opusStyle} onChoose={chooseOpus}
            onWriteExplainer={mode === 'class' && clip ? (c) => void writeExplainerInStyle(c) : undefined}
            writeBusy={opusWriting} writeNote={opusNote} />
          {mode === 'explainer' && opusStyle && <p className="-mt-3 text-xs text-white/45">Explainers keep their cinematic picture; the style sets how ✨ Write the script writes, and the music and pace.</p>}
          {/* V51.9.119: the long list of choices is folded away; the reel is designed on the preview */}
          <details className="group rounded-xl border border-white/10 bg-white/[0.03]">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
              <span className="font-bold">🎨 Style & voice</span>
              <span className="text-xs text-white/50">{LANG_NAME[lang]} · {voiceOn ? 'voice' : 'music only'} · {FORMATS.find((f) => f.id === format)?.label} · {style.look.name}</span>
              <span className="ml-auto text-xs text-white/40 group-open:hidden">Show ▾</span><span className="ml-auto hidden text-xs text-white/40 group-open:inline">Hide ▴</span>
            </summary>
          <div className="space-y-3 border-t border-white/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-xs text-white/50">Voice + captions</span>
              <button className={chip(lang === 'en')} onClick={() => setLang('en')}>English</button>
              <button className={chip(lang === 'ml')} onClick={() => setLang('ml')}>Malayalam</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-xs text-white/50">Voice-over</span>
              <button className={chip(voiceOn)} onClick={() => setVoiceOn(true)}>🔊 Explain each step</button>
              <button className={chip(!voiceOn)} onClick={() => setVoiceOn(false)}>Music only</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-xs text-white/50">Second line</span>
              <button className={chip(!secondLine)} onClick={() => setSecondLine(false)}>{LANG_NAME[lang]} only</button>
              <button className={chip(secondLine)} onClick={() => setSecondLine(true)}>
                + {LANG_NAME[other(lang)]} line
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2" data-step-gap>
              <span className="w-28 text-xs text-white/50" title="Time to read and think: each finished step stays this long before the next one starts (also in the MP4)">Next step after</span>
              <select value={stepGap} onChange={(e) => chooseGap(Number(e.target.value))} className="rounded-lg border border-white/10 bg-[#0b1426] px-2 py-1.5 text-xs" aria-label="Time before the next step">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((g) => <option key={g} value={g}>{g === 0 ? 'no wait (fast reel)' : `${g} s`}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-xs text-white/50">Format</span>
              {FORMATS.map((f) => (
                <button key={f.id} className={chip(format === f.id)} onClick={() => setFormat(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-xs text-white/50">Share clip</span>
              <button className={chip(!clipOn)} onClick={() => setClipOn(false)} title="The whole lesson, then the end card with your link and a QR code">Full video + QR</button>
              <button className={chip(clipOn)} onClick={() => setClipOn(true)} title="Up to 40 s of the lesson plus an AI Guru end card with your link and a QR code">✂ Short clip + QR</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-xs text-white/50">My link</span>
              <button className={chip(linkOn)} onClick={() => setLinkOn(true)} title="Your link is written at the top of every frame, so it survives forwarding and screen recordings">On every frame</button>
              <button className={chip(!linkOn)} onClick={() => setLinkOn(false)}>Only in the end card</button>
              <span className="break-all text-xs text-white/40">{shortLink}</span>
              {isLocalOrigin(origin) && <span className="w-full text-xs text-amber-200" data-local-link-warning>⚠ This is a local address: it opens only on this computer, so nobody else can join from your reel. Set the app’s public address (NEXT_PUBLIC_SITE_URL).</span>}
              {ref && <span className="rounded-md border border-dashed border-cyan-400/50 px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-amber-200" title="Your join code: shown under the QR at the end and in the caption, for anyone who cannot scan or tap">{spacedCode(ref)}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-xs text-white/50">My photo</span>
              {myPhoto ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={myPhoto.dataUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-cyan-400/60" />
                  <button className={chip(showOnReels(myPhoto))} onClick={() => (myPhoto.guardianOk ? setLocalPrefs({ onReels: true }) : setPhotoEdit(true))}>On the reel</button>
                  <button className={chip(!showOnReels(myPhoto))} onClick={() => setLocalPrefs({ onReels: false })}>Off</button>
                  <button className="text-xs text-cyan-300 underline" onClick={() => setPhotoEdit(true)}>Change</button>
                </>
              ) : (
                <button className={chip(false)} onClick={() => setPhotoEdit(true)} title="Your photo next to your name at the bottom, and “Shared by” on the closing cards">📷 Add my photo</button>
              )}
            </div>
            {AVATARS && <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 text-xs text-white/50">Face in the corner</span>
              <button className={chip(faceWho === 'off')} onClick={() => setFaceWho('off')}>Off</button>
              {teacherAv && (
                <button className={chip(faceWho === 'teacher')} onClick={() => setFaceWho('teacher')} title="A small bubble in the bottom corner; the lips move with the voice">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={teacherAv.photo} alt="" className="mr-1 inline h-5 w-5 rounded-full object-cover align-middle" />
                  {mine ? 'My face' : `${teacherAv.name || 'Teacher'}’s face`}
                </button>
              )}
              {!mine && (myAvatar ? (
                <>
                  <button className={chip(faceWho === 'me')} onClick={() => setFaceWho('me')} title="Your own avatar: lips drawn on this phone, voice with your own Gemini key">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={myAvatar.photo} alt="" className="mr-1 inline h-5 w-5 rounded-full object-cover align-middle" />My avatar
                  </button>
                  <button className="text-xs text-cyan-300 underline" onClick={() => setAvEdit(true)}>Edit</button>
                </>
              ) : (
                <button className={chip(false)} onClick={() => setAvEdit(true)} title="Made on this phone with your own AI key — AI Guru does not pay for avatars">🧑‍🎓 Make my avatar</button>
              ))}
              {faceWho === 'teacher' && mine?.hasVoice && (
                <>
                  <button className={chip(teacherVoiceOn)} onClick={() => setTeacherVoiceOn(true)} title="Each step in your own voice (needs the teacher-voice worker on the AI Guru PC)">🎙 My voice</button>
                  <button className={chip(!teacherVoiceOn)} onClick={() => setTeacherVoiceOn(false)}>Classroom voice</button>
                </>
              )}
              {faceOn && avatar && <span className="text-xs text-white/40">{faceWho === 'me' ? 'lips on this phone · voice with your own key' : avatar.style === 'ai' ? 'AI lip-sync on export (GPU PC), photo lip-sync in the preview' : avatar.style === 'still' ? 'photo + glowing ring' : 'lips move with the voice'}</span>}
            </div>}
            {AVATARS && myAv && myBlock && !mine && <p className="text-xs text-amber-300">My avatar is paused: {BLOCK_TEXT[myBlock]}</p>}
            {teacherVoice && voice.status === 'ready' && !voice.providers.includes('teacher-voice') && (
              <p className="text-xs text-amber-300">Your own voice is not available right now (the voice worker on the AI Guru PC is off{!loadTeacherAuth() ? ', or open My avatar in this tab first' : ''}), so the classroom voice is used.</p>
            )}
            {byok && voice.status === 'ready' && !voice.providers.some((p) => p.startsWith('my-key')) && (
              <p className="text-xs text-amber-300">Your key did not answer (check Settings → Your keys), so the free classroom voice is used.</p>
            )}
            {/* V51.9.101: make every reel different (V51.9.121: folded — most students leave it on Auto) */}
            <details className="rounded-lg border border-violet-400/20 bg-violet-500/[0.06]">
            <summary className="cursor-pointer px-2.5 py-2 text-xs font-semibold text-violet-200">More choices — look, opener, ending, music, camera, fonts ({style.look.name})</summary>
            <div className="space-y-2 p-2.5 pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-28 text-xs font-semibold text-violet-200">Make it different</span>
                <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold">{style.look.name}</span>
                <button className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold" onClick={shuffle} title="A new look, opener, ending, music and camera">🎲 Shuffle</button>
                {season && (
                  <button className={chip(choices.season !== false)} onClick={() => choose({ season: choices.season === false })} title="A seasonal theme, on by date">
                    🎉 {seasonById(season)?.name} theme {choices.season === false ? 'off' : 'on'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-28 text-xs text-white/50">Reel type</span>
                <select value={kind} onChange={(e) => pickKind(e.target.value as ReelKind)} className="w-full max-w-full rounded-lg border border-white/10 bg-[#0b1426] px-2 py-1.5 text-xs sm:w-auto">
                  {REEL_KINDS.filter((k) => AVATARS || k !== 'duet').map((k) => { const why = kindBlock(k); return <option key={k} value={k} disabled={!!why}>{KIND_NAME[k]}{why ? ` (${why})` : ''}</option>; })}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ['look', 'Look', ALL_LOOKS.map((l) => [l.id, l.pro ? `★ ${l.name} (Pro)` : l.name]), style.look.id, style.look.name],
                  ['opener', 'Opener', [...OPENERS.filter((k) => k !== 'avatar' || faceOn).map((k) => [k, OPENER_NAME[k]]), ['none', 'No opener']], style.opener, style.opener === 'none' ? 'none' : OPENER_NAME[style.opener]],
                  ['ending', 'Ending', [...ENDINGS.map((k) => [k, ENDING_NAME[k]]), ['none', 'No ending']], style.ending, style.ending === 'none' ? 'none' : ENDING_NAME[style.ending]],
                  ['music', 'Music', MUSICS.map((k) => [k, MUSIC_NAME[k]]), style.music, MUSIC_NAME[style.music]],
                  ['pack', 'Sounds', SFX_PACKS.map((k) => [k, PACK_NAME[k]]), style.pack, PACK_NAME[style.pack]],
                  ['camera', 'Camera', CAMERAS.map((k) => [k, CAMERA_NAME[k]]), style.camera, CAMERA_NAME[style.camera]],
                  ['pose', 'Deepa’s pose', POSES.map((k) => [k, POSE_NAME[k]]), style.pose, POSE_NAME[style.pose]],
                  ['font', 'Writing font', CARD_FONTS.map((k) => [k, FONT_NAME[k]]), style.font, FONT_NAME[style.font].split(' (')[0]],
                  ['boardFont', 'Numbers font', BOARD_FONTS.map((k) => [k, FONT_NAME[k]]), style.boardFont, FONT_NAME[style.boardFont].split(' (')[0]],
                ] as Array<[keyof Pins, string, string[][], string, string]>).map(([key, label, opts, current, currentName]) => {
                  const pinned = pins[key];
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs text-white/60">
                      <span className="w-24">{label}</span>
                      <select value={pinned ?? choices[key] ?? 'auto'} disabled={!!pinned} onChange={(e) => choose({ [key]: e.target.value } as Partial<StyleChoices>)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1426] px-2 py-1.5 text-xs text-white disabled:opacity-70">
                        <option value="auto">Auto ({currentName})</option>
                        {opts.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                      </select>
                      <button onClick={() => togglePin(key, choices[key] && choices[key] !== 'auto' ? String(choices[key]) : current)} className={`rounded-md px-1.5 py-1 ${pinned ? 'bg-amber-400 text-black' : 'bg-white/10 text-white/50 hover:text-white'}`} title={pinned ? 'Pinned to My style: stays on every new reel. Tap to unpin.' : 'Pin to My style: keep this on every new reel'}>📌</button>
                    </div>
                  );
                })}
              </div>
              {/* V51.9.161: camera presets — one move per step, flavoured by the look (🎬 cinematic: slow and soft; whiteboard: punchy) */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                <span className="w-28 text-white/50">Camera moves</span>
                <select value={moves} onChange={(e) => pickMoves(e.target.value as MovesSetting)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b1426] px-2 py-1.5 text-xs text-white" aria-label="Camera moves" data-camera-moves title="One camera move per step: push-in, pull-out reveal, pan follow, tilt-down steps, split focus, breathe; Lively adds crash zoom, whip pan, dutch tilt and rack focus. Auto uses them when Camera is Steady; Calm or Lively use them always.">
                  {MOVES_SETTINGS.map((m) => <option key={m} value={m}>{m === 'auto' ? 'Auto (lively in videos)' : MOVES_NAME[m]}</option>)}
                </select>
                {style.camera !== 'steady' && moves === 'auto' && <span className="w-full text-[11px] text-white/40">Auto keeps the {CAMERA_NAME[style.camera]} camera’s own moves; pick Calm or Lively to use these instead.</span>}
              </div>
              {/* V51.9.105: my colour — the outline, the word being spoken and the face ring (the maths keeps its colours) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="w-28 text-xs text-white/50">My colour</span>
                <button onClick={() => pickAccent(null)} className={`rounded-full px-2 py-1 text-[11px] ${!accent ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'}`}>Auto</button>
                {ACCENTS.map((a) => (
                  <button key={a.id} onClick={() => pickAccent(a.id)} aria-label={a.name} title={`${a.name} — on every reel, on this phone`} className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-[#0b1426] ${accent === a.id ? 'ring-2 ring-white' : ''}`} style={{ background: a.hex }} />
                ))}
              </div>
              {Object.keys(pins).length > 0 && <p className="text-xs text-amber-200/80">📌 My style: {Object.keys(pins).length} pinned — they stay on every reel; everything else still changes.</p>}
              {!mine && badges.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={badgesOn} onChange={(e) => setBadgesOn(e.target.checked)} /> Show my badges: {badges.slice(0, 2).join(' · ')}</label>
              )}
              {kind === 'speed-run' && <p className="text-xs text-white/40">Speed run: the lesson plays faster with a stopwatch and music (no voice-over).</p>}
            </div>
            </details>
          </div>
          </details>
          {voiceLine && (
            <p className={`text-xs ${voice.status === 'failed' ? 'text-amber-300' : 'text-white/60'}`}>{voiceLine}</p>
          )}

          {base.error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{base.error}</p>}

          <details className="rounded-xl border border-white/10 bg-white/[0.03] text-sm">
            <summary className="cursor-pointer px-3 py-2.5 font-bold">📋 Caption & subtitles</summary>
            <div className="space-y-2 border-t border-white/10 p-3">
              <div className="flex flex-wrap gap-2">
                <button disabled={!reel} onClick={copyCaption} className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs disabled:opacity-40">📋 Copy caption + link</button>
                <button disabled={!reel} onClick={() => doCaptions('srt')} className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs disabled:opacity-40">CC .srt</button>
                <button disabled={!reel} onClick={() => doCaptions('vtt')} className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs disabled:opacity-40">CC .vtt</button>
              </div>
              {reel && <textarea readOnly value={clipCaption(reel.title, clipLink, lang)} className="h-20 w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70" />}
            </div>
          </details>
          {video?.check && <CheckPanel check={video.check} busy={exporting !== null || voice.status === 'loading'} onRemake={remake} onDownload={() => download(video.blob, video.name)} />}
          {message && <p className="text-sm text-white/70">{message}</p>}
          {/* V51.9.152: this way's finished reels: preview, download again, delete */}
          <VideoShelf ways={[way]} title={way === 'style' ? '⭐ My styled reels' : way === 'stock' ? '⭐ My stock-video reels' : '⭐ My designed reels'} testId="mine" empty="Make your reel with 👁 Preview & post: every finished reel is kept here." />
        </section>

        <section className="flex flex-col items-center gap-3 lg:sticky lg:top-4 lg:self-start">
          <ReelDesigner api={designApi} on={designOn} setOn={setDesignOn} reel={reel} time={time} seek={(t) => { pause(); setTime(t); }}
            format={format} footer={format !== 'square'} cssW={cssW} cssH={cssH} cardParts={mode !== 'explainer'}
            onReorderShots={mode === 'story' ? (from, to) => { const shots = [...story.shots]; const [x] = shots.splice(from, 1); shots.splice(to, 0, x); applyStory({ ...story, shots }); setStoryVer((v) => v + 1); } : undefined}
            below={
          <div className="flex w-full items-center gap-2">
            <button onClick={playing ? pause : play} disabled={!reel} aria-label={playing ? 'Pause the reel' : 'Play the reel'} className="min-h-[40px] min-w-[44px] rounded-lg bg-white/10 px-3 py-1.5 text-sm disabled:opacity-40">
              {playing ? '❚❚' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={reel?.durationMs ?? 1}
              value={time}
              aria-label="Position in the reel"
              aria-valuetext={`${(time / 1000).toFixed(1)} seconds`}
              onChange={(e) => {
                pause();
                setTime(Number(e.target.value));
              }}
              className="flex-1"
            />
            <span className="w-20 text-right text-xs tabular-nums text-white/60">
              {(time / 1000).toFixed(1)} / {((reel?.durationMs ?? 0) / 1000).toFixed(1)}s
            </span>
          </div>
            }>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="rounded-2xl bg-white shadow-2xl"
            style={{ width: cssW, height: cssH }}
          />
          </ReelDesigner>
        </section>
      </main>
      {avEdit && (
        <StudentAvatarEditor photo={myPhoto} name={profile?.name ?? ''} onEditPhoto={() => { setAvEdit(false); setPhotoEdit(true); }} onClose={() => { setAvEdit(false); setMyAv(loadStudentAvatar()); }} />
      )}
      {photoEdit && (
        <PhotoEditor current={myPhoto?.dataUrl ?? null} prefs={{ onReels: myPhoto ? myPhoto.onReels : true, guardianOk: !!myPhoto?.guardianOk }}
          onSave={async (image, prefs) => { const dataUrl = image ?? myPhoto?.dataUrl; if (!dataUrl) return 'Add a photo first.'; if (!saveLocalPhoto({ dataUrl, ...prefs })) return 'This browser could not keep the photo.'; }}
          onRemove={async () => { saveLocalPhoto({ dataUrl: null }); }}
          onClose={() => setPhotoEdit(false)} />
      )}
    </div>
  );
}

/** V51.9.97 — what the self-check found in the MP4 just made. */
function CheckPanel({ check, busy, onRemake, onDownload }: { check: ReelCheck; busy: boolean; onRemake: () => void; onDownload: () => void }) {
  if (!check.checked) return <p className="text-xs text-white/40">{checkSummary(check)}</p>;
  if (check.ok) {
    return (
      <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200" title={check.problems.map((p) => p.message).join(' ')}>
        {checkSummary(check)}
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
      <div className="font-semibold">⚠ The check found a problem in this MP4</div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs">
        {check.problems.map((p, i) => (
          <li key={i} className={p.severity === 'error' ? 'text-amber-100' : 'text-amber-100/60'}>{p.message}</li>
        ))}
      </ul>
      <p className="text-xs text-amber-100/70">Most often a voice step that did not record. “Make it again” asks for the missing voice again and makes a new MP4.</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={onRemake} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40">↻ Make it again</button>
        <button onClick={onDownload} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs">⬇ Download anyway</button>
      </div>
    </div>
  );
}
