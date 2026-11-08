'use client';

import { KeyNudge } from '@/components/ai-guru/student/KeyNudge';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isMathLike, newDerivation, playDerivationStep, playStepBar, playTemplateRow } from '@/lib/ai-guru/math/derivation-beat';
import { estimateSpeechMs, fitTiming } from '@/lib/ai-guru/patterns/verify';
import { planEquationSequence, planTemplateSolution, stepsFromSolution } from '@/lib/ai-guru/math/template-solver';
import { boardModeFor, boardModeLabel } from '@/lib/ai-guru/teaching/board-mode';
import { nextParagraphToTeach, paragraphIndexForSource, toIndexedSource } from '@/lib/ai-guru/lesson/paragraph-flow';
import { buildTeacherReadingMaterial } from '@/lib/ai-guru/lesson/teacher-run';
import { edgeVoiceFor, markTtsProviderDown, ttsProviderOrder } from '@/lib/ai-guru/tts/provider-order';
import { resolvePlayStart } from '@/lib/ai-guru/lesson/play-start';
import fixture from '@/fixtures/ai-guru/one-paragraph.json';
import type { AIGuruLesson, ParagraphSource, VisualAction, LanguageTrack } from '@/lib/ai-guru/lesson/types';
import type { TeachingControllerPort } from '@/lib/ai-guru/lesson/types';
import { AIGuruClassroomController } from '@/lib/ai-guru/teaching/classroom-controller';
import { buildTextbookPage, type TextbookPage } from '@/lib/ai-guru/lesson/textbook-cursor';
import { extractCourseMaterial, extractedDocumentToSources } from '@/lib/ai-guru/document/client';
import { createLessonDraft } from '@/lib/ai-guru/lesson/draft';
import { noteParagraphs, takeHandedNote, type HandedNote } from '@/lib/ai-guru/messages/notes';
import MathLikeAnimBoard, { type MathLikeAnimBoardHandle, type StepControlEvent } from './MathLikeAnimBoard';
import MotionTeachingBoard from './MotionTeachingBoard';
import { chapterIntroPlan } from '@/lib/ai-guru/motion-class/plan/chapter-intro';
import { PlayFab } from '@/components/ai-guru/PlayFab';
import { AiGuruTopNav } from '@/components/ai-guru/AiGuruTopNav';
import type { StudyMaterial, IndexedSource, MathTeachingStep } from '@/lib/ai-guru/material-studio/types';
import { generateMaterial } from '@/lib/ai-guru/material-studio/pipeline';
import type { BookAccess, PartSummary } from '@/lib/ai-guru/material-studio/locks';
import { ClassroomVisuals } from '@/components/ai-guru/visuals/ClassroomVisuals';
import { ClassroomDoubtDock } from '@/components/ai-guru/doubt/ClassroomDoubtDock';
import { ToffeeQuizDock } from '@/components/ai-guru/quiz/ToffeeQuizDock';
import { useTeacherTools } from '@/lib/ai-guru/ui/teacher-tools';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';
import { TEACH_LANGUAGE_KEY } from '@/lib/ai-guru/student/device-session';
import { loadProfile } from '@/lib/ai-guru/student/profile';
import MotionClassroom from '@/components/ai-guru/MotionClassroom';
import { TeacherQuizDock } from '@/components/ai-guru/share/TeacherQuizDock';
import { AttendanceBeacon } from '@/components/ai-guru/AttendanceBeacon';
import { orderedUsableKeys } from '@/lib/student-key';
import { getProvider } from '@/lib/ai-guru/byok-providers';
import { selectTeachingStrategy, type TeachingStrategyDecision } from '@/lib/ai-guru/teaching/strategy';
// Import directly from the defining module, not the '@/lib/ai-guru/math/universal'
// barrel (index.ts re-exports '../planner', which pulls in the Gemini planner and
// its @faiss-node/native dependency — a Node-only native addon that cannot be
// bundled for the browser and previously broke `next build`).
import { detectMathDomain } from '@/lib/ai-guru/math/universal/compiler';
import type { ReadyBook } from '@/lib/ai-guru/material-studio/ready';
import { ttsFetch } from '@/lib/ai-guru/tts/tts-fetch'; // V51.9.160: on-device Malayalam voice
import { FeeBanner } from '@/components/ai-guru/payments/FeeBanner';

const demoLesson = fixture as AIGuruLesson;

/** Extract the common Class 8–10 "prices/ages/quantities" pair-of-linear-equations
 * word-problem grammar. This is intentionally conservative: if two equations cannot
 * be reconstructed with the same two quantities, return null and let the authored
 * material/planner remain the source of truth. */
function extractPairEquationsFromWordProblem(text: string): string[] | null {
  const src = String(text || '').replace(/\s+/g, ' ').trim();
  const re = /(?:price of\s+)?(\d+)\s+([A-Za-z][A-Za-z-]*)\s+and\s+(\d+)\s+([A-Za-z][A-Za-z-]*)\s+(?:is|are|costs?|equals?)\s+(\d+(?:\.\d+)?)/gi;
  const rows: Array<{a:number; b:number; first:string; second:string; total:number}> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) rows.push({ a:Number(m[1]), first:m[2].toLowerCase(), b:Number(m[3]), second:m[4].toLowerCase(), total:Number(m[5]) });
  if (rows.length < 2) return null;
  const first = rows[0];
  const nouns = new Set([first.first, first.second]);
  const normalized = rows.slice(0, 4).filter(r => nouns.has(r.first) && nouns.has(r.second)).map(r => {
    if (r.first === first.first && r.second === first.second) return `${r.a}x + ${r.b}y = ${r.total}`;
    if (r.first === first.second && r.second === first.first) return `${r.b}x + ${r.a}y = ${r.total}`;
    return '';
  }).filter(Boolean);
  return normalized.length >= 2 ? normalized.slice(0, 2) : null;
}

/** Extract explicit equation lines from textbook prose when the material generator did not
 * populate mathSteps. This is deliberately conservative: only fragments containing =, a digit,
 * and at least one variable are accepted. */
function extractEquationCandidates(text: string): string[] {
  const src = String(text || '').replace(/\r/g, ' ');
  const chunks = src.split(/(?:\n|(?<=[.!?;]))\s+/).map(s => s.trim()).filter(Boolean);
  const out: string[] = [];
  const add = (candidate: string) => {
    let x = candidate.replace(/^[^0-9A-Za-z(−-]*/,'').replace(/[,:;.!?]+$/,'').trim();
    x = x.replace(/\s+/g,' ');
    // Strip common prose prefixes while preserving the mathematical expression.
    x = x.replace(/^(?:that is|so|therefore|we have|we get|gives|equation\s*\(?\d+\)?\s*[:.]?)\s*/i,'');
    if (x.length > 100) return;
    if (!/=/.test(x) || !/\d/.test(x) || !/[A-Za-z]/.test(x)) return;
    if (!out.some(v => v.replace(/\s+/g,'') === x.replace(/\s+/g,''))) out.push(x);
  };
  for (const chunk of chunks) {
    if (!chunk.includes('=')) continue;
    // A chunk may contain two equations separated by words. Split around likely equation boundaries.
    const matches = chunk.match(/[0-9A-Za-z().+\-−×*/^²³√\s]{1,70}\s*=\s*[0-9A-Za-z().+\-−×*/^²³√\s]{1,35}/g);
    if (matches?.length) matches.forEach(add); else add(chunk);
  }
  return out.slice(0, 6);
}


/** Build a short, deterministic concept bridge before the algebra rows.  The board must
 * explain what the symbols mean before asking the learner to manipulate them.  This is
 * intentionally local/grammar-based: it does not invent a mathematical fact from an LLM. */
function buildEquationConceptIntro(sourceText: string, equations: string[]): Array<{ text: string; label: string; labelMl: string; en: string; ml: string }> {
  const text = String(sourceText || '').replace(/\s+/g, ' ').trim();
  if (!text || !equations.length) return [];
  const out: Array<{ text: string; label: string; labelMl: string; en: string; ml: string }> = [];
  const seen = new Set<string>();
  const add = (textValue: string, label: string, labelMl: string, en: string, ml: string) => {
    const key = textValue.replace(/\s+/g, '').toLowerCase();
    if (!textValue.trim() || seen.has(key)) return;
    seen.add(key); out.push({ text: textValue, label, labelMl, en, ml });
  };

  // Always establish the role of variables before symbolic manipulation.
  add(
    'A variable stands for an unknown quantity.',
    'What is a variable?',
    'ചരം എന്താണ്?',
    'A variable is a symbol that stands for a quantity we do not know yet.',
    'നമുക്ക് ഇപ്പോൾ അറിയാത്ത ഒരു അളവിനെ സൂചിപ്പിക്കുന്ന ചിഹ്നമാണ് ചരം.'
  );

  // Explicit textbook definitions such as: "Taking the number of black beads as x".
  const definitionRe = /(?:taking|let|denote|denoting|call|calling)\s+(?:the\s+)?(.{2,90}?)\s+as\s+([xy])\b/gi;
  let m: RegExpExecArray | null;
  while ((m = definitionRe.exec(text))) {
    const meaning = m[1].replace(/^(?:number|price|quantity)\s+of\s+/i, (x) => x).trim().replace(/[,:;]+$/, '');
    const v = m[2].toLowerCase();
    add(
      `${v} = ${meaning}`,
      `Define ${v}`,
      `${v} നിർവചിക്കുക`,
      `Let ${v} represent ${meaning}. We will use ${v} instead of writing the full quantity each time.`,
      `${v} എന്നത് ${meaning} നെ സൂചിപ്പിക്കട്ടെ. ഇനി ഈ അളവിന് പകരം ${v} ഉപയോഗിക്കാം.`
    );
  }

  // Textbook often defines the second quantity relationally: "the number of white is x - 10".
  const relationalRe = /(?:the\s+)?(?:number|price|quantity)\s+of\s+([A-Za-z][A-Za-z -]{1,50}?)\s+(?:is|are|equals?)\s+([^.;]{1,50})/gi;
  while ((m = relationalRe.exec(text))) {
    const noun = m[1].trim();
    const expr = m[2].trim();
    if (!/[xy]/i.test(expr) || !/[0-9]/.test(expr)) continue;
    add(
      `${noun} = ${expr}`,
      'Relate the quantities',
      'അളവുകൾ തമ്മിലുള്ള ബന്ധം',
      `The ${noun} is related to the unknown by ${expr}.`,
      `${noun} എന്ന അളവ് ${expr} എന്ന രീതിയിൽ അജ്ഞാത അളവുമായി ബന്ധപ്പെട്ടിരിക്കുന്നു.`
    );
  }

  // For price/quantity pair problems, infer x and y from the nouns in the first statement.
  if (/[xy]/i.test(equations.join(' '))) {
    const pair = /(?:price\s+of|cost\s+of|number\s+of|there\s+are)\s+\d+\s+([A-Za-z][A-Za-z-]*)\s+and\s+\d+\s+([A-Za-z][A-Za-z-]*)/i.exec(text);
    if (pair) {
      add(`x = unit value of ${pair[1]}`, 'Define x', 'x നിർവചിക്കുക', `Let x be the unit value of a ${pair[1]}.`, `${pair[1]} ഒന്നിന്റെ വില/അളവ് x ആക്കാം.`);
      add(`y = unit value of ${pair[2]}`, 'Define y', 'y നിർവചിക്കുക', `Let y be the unit value of a ${pair[2]}.`, `${pair[2]} ഒന്നിന്റെ വില/അളവ് y ആക്കാം.`);
    }
    if (equations.length >= 2) {
      add('Two equations describe two conditions.', 'Why two equations?', 'രണ്ട് സമവാക്യങ്ങൾ എന്തിന്?', 'Each equation represents one condition from the problem. Together they determine the unknown quantities.', 'ചോദ്യത്തിലെ ഓരോ നിബന്ധനയും ഓരോ സമവാക്യമായി എഴുതാം. രണ്ട് സമവാക്യങ്ങളും ചേർന്നാണ് അജ്ഞാത അളവുകൾ കണ്ടെത്തുന്നത്.');
    }
  }

  // Connect the words to the first equation. This is the missing pedagogical bridge in the screenshot.
  const first = equations[0];
  if (first) {
    add(
      `Translate the information: ${first}`,
      'Form the equation',
      'സമവാക്യം രൂപപ്പെടുത്താം',
      `Now translate the words in the problem into the equation ${first}.`,
      `ഇപ്പോൾ ചോദ്യത്തിലെ വിവരങ്ങളെ ${first} എന്ന സമവാക്യമായി എഴുതാം.`
    );
  }
  return out.slice(0, 6);
}

function inferTextbookGrade(lesson: AIGuruLesson): number {
  const haystack = `${lesson.title || ''} ${lesson.paragraphs[0]?.source?.bookId || ''}`.toLowerCase();
  const arabic = haystack.match(/(?:class|standard|grade|std)[\s._-]*(1[0-2]|[1-9])\b/i);
  if (arabic) return Math.max(1, Math.min(12, Number(arabic[1])));
  const romanMap: Record<string, number> = { i:1, ii:2, iii:3, iv:4, v:5, vi:6, vii:7, viii:8, ix:9, x:10, xi:11, xii:12 };
  const roman = haystack.match(/(?:class|standard|grade|std)[\s._-]*(xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/i);
  if (roman) return romanMap[roman[1].toLowerCase()] || 12;
  return 9;
}

function buildTeacherReadingPage(lesson: AIGuruLesson, section: StudyMaterial['sections'][number], paragraphIndex?: number, pageOverride?: number): TextbookPage | null {
  const sourceText = String(section.teachingPass?.sourceText || section.sourceText || section.content || '').trim();
  const paragraph = typeof paragraphIndex === 'number'
    ? lesson.paragraphs[paragraphIndex]
    : lesson.paragraphs.find(p => {
      const text = String(p.source?.text || '').trim();
      return Boolean(sourceText && text && (text === sourceText || text.includes(sourceText) || sourceText.includes(text)));
    });
  const pageNumber = Number.isFinite(pageOverride) && Number(pageOverride) >= 1 ? Number(pageOverride) : (paragraph?.source?.pageNumber ?? 1);
  // V51.9.8 fix: include EVERY paragraph on the same textbook page so offline/template
  // solvers can still see the problem statement (e.g. beads total) when Teacher Reading
  // has advanced past the opening sentence. Without this, section 2+ only carried the
  // current line, deriveDeterministicProblem failed, and the class fell back to text-only.
  const pageParas = lesson.paragraphs.filter(p => Number(p.source?.pageNumber) === pageNumber);
  const rawParagraphs: Array<{ id?: string; text: string; isHeading?: boolean }> = [];
  if (section.heading?.trim()) rawParagraphs.push({ id: `${section.id || 'section'}-heading`, text: section.heading.trim(), isHeading: true });
  if (pageParas.length) {
    for (const p of pageParas) {
      const t = String(p.source?.text || '').trim();
      if (t) rawParagraphs.push({ id: p.id || `page-${pageNumber}-${rawParagraphs.length}`, text: t });
    }
  } else {
    const textbookText = String(paragraph?.source?.text || sourceText).trim();
    if (textbookText) rawParagraphs.push({ id: paragraph?.id || section.id || 'section-source', text: textbookText });
  }
  if (!rawParagraphs.length) return null;
  return buildTextbookPage(pageNumber, rawParagraphs);
}

function ReferencePanel({ source, pdfUrl, pageImageBase }: { source: ParagraphSource; pdfUrl?: string; pageImageBase?: string }) {
  const b = source.boundingBox;
  const [imageFailed, setImageFailed] = useState(false);
  // Rendered page image first, then any image baked into the source, then the
  // PDF iframe. Only the first two actually follow the paragraph as teaching
  // moves; the iframe is kept as a last resort for books with no stored PDF.
  const rendered = pageImageBase ? `${pageImageBase}?page=${source.pageNumber}` : source.pageImage || '';
  useEffect(() => { setImageFailed(false); }, [rendered]);
  return <div data-ai-guru-reference-page data-page={String(source.pageNumber)} className="ag-light-native relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white">
    <div className="absolute left-4 top-4 z-20 rounded-full border border-black/10 bg-black/75 px-3 py-1 text-xs text-white">PDF Reference · Page {source.pageNumber}</div>
    {rendered && !imageFailed ? <img key={rendered} src={rendered} onError={() => setImageFailed(true)} className="h-full w-full object-contain" alt={`Textbook page ${source.pageNumber}`} /> : pdfUrl ? <iframe key={`pdf-${source.pageNumber}`} title={`PDF page ${source.pageNumber}`} src={`${pdfUrl}#page=${source.pageNumber}&view=FitH`} className="h-full w-full" /> : <div className="flex h-full items-center justify-center p-10 text-slate-700" style={{ fontFamily: 'Chilanka, Noto Sans Malayalam, Nirmala UI, sans-serif' }}><em>{source.text}</em></div>}
    {b && <div className="pointer-events-none absolute border-2 border-yellow-300 bg-yellow-200/15 shadow-[0_0_0_9999px_rgba(0,0,0,.15)]" style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.width}%`, height: `${b.height}%` }} />}
  </div>;
}

async function postJson(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let j: any = null;
  const raw = await r.text();
  try { j = raw ? JSON.parse(raw) : null; } catch { /* keep raw response for diagnostics */ }
  if (!r.ok || j?.ok === false) {
    const detail = String(j?.error || raw || 'Request failed').trim();
    throw new Error(`${url} HTTP ${r.status}: ${detail.slice(0, 500)}`);
  }
  return j;
}

function isMalayalam(text: string) { return /[\u0D00-\u0D7F]/.test(text); }


/** Convert the Gemini video-grounded planner's canvas nodes to the existing
 * classroom whiteboard primitives. This is the missing V51 bridge: previously
 * the classroom selected/logged a referral video but never consumed /math/plan. */
function plannerNodeToAction(n: any): VisualAction | null {
  const kind=String(n?.kind||'');
  const rawX=Number(n?.x ?? 100), rawY=Number(n?.y ?? 100);
  const rawW=Number(n?.width ?? 180), rawH=Number(n?.height ?? 80);
  const x=Math.max(24,Math.min(920,Number.isFinite(rawX)?rawX:100));
  const y=Math.max(28,Math.min(650,Number.isFinite(rawY)?rawY:100));
  const durationMs=Math.max(180,Number(n?.durationMs ?? 700));
  // Model coordinates are English-oriented estimates. Give bilingual labels a
  // safe footprint so Malayalam glyphs do not wrap into the next visual node.
  const w=Math.max(260,Math.min(760,Number.isFinite(rawW)?rawW:260));
  const h=Math.max(58,Math.min(240,Number.isFinite(rawH)?rawH:80));
  if(kind==='latex') return {type:'latex',id:String(n.id),latex:String(n.latex||n.content||''),x:48,y,width:Math.min(900,w),height:h,fontSize:Math.max(22,Math.min(30,Number(n?.style?.fontSize??26))),durationMs,placement:'flow'};
  if(kind==='text') { const content=String(n.content||'').trim(); if(!content || content.length>60) return null; return {type:'write',id:String(n.id),content,x:48,y,width:Math.min(900,w),height:h,fontSize:Math.max(22,Math.min(28,Number(n?.style?.fontSize??24))),durationMs,placement:'flow'}; }
  if(kind==='shape') return {type:'shape',id:String(n.id),shape:(['rectangle','circle','triangle'].includes(n.shape)?n.shape:'rectangle'),x,y,width:w,height:h,strokeWidth:Number(n?.style?.strokeWidth??3),durationMs};
  if(kind==='line'||kind==='arrow') return {type:'line',id:String(n.id),startX:Number(n.startX??x),startY:Number(n.startY??y),endX:Number(n.endX??x+w),endY:Number(n.endY??y),strokeWidth:Number(n?.style?.strokeWidth??3),durationMs};
  if(kind==='highlight') return {type:'highlight',id:String(n.id),targetId:String(n.targetId||''),x,y,width:w,height:h,durationMs};
  if(kind==='erase') return {type:'erase',id:String(n.id),targetId:String(n.targetId||''),durationMs};
  if(kind==='transform' && n.from && n.to) return {type:'transform',id:String(n.id),fromId:String(n.from),toId:String(n.to),durationMs};
  if(kind==='graph' && n.graph) return {type:'chart',id:String(n.id),chartType:'line',x,y,width:w,height:h,data:{labels:(n.graph.x||[]).map(String),legends:[String(n.graph.title||'')],series:[(n.graph.y||[]).map(Number)]},durationMs};
  return null;
}

export default function AIGuruClassroom({ embedded = false }: { embedded?: boolean } = {}) {
  const [lesson, setLesson] = useState<AIGuruLesson>(demoLesson);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [state, setState] = useState('idle');
  const [language, setLanguage] = useState<'English' | 'മലയാളം'>('English');
  // V51.9.182 (newcomer review): a Malayalam-medium student's class opens in Malayalam (set at sign-up / sign-in)
  useEffect(() => { try { if (localStorage.getItem(TEACH_LANGUAGE_KEY) === 'ml') setLanguage('മലയാളം'); } catch { /* storage blocked */ } }, []);
  // ...and a signed-in student sees which teacher's class they are in
  const [myClass, setMyClass] = useState<{ name: string; teacher?: string } | null>(null);
  useEffect(() => { fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/class', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.class?.name) setMyClass({ name: String(j.class.name), teacher: j.class.teacher ? String(j.class.teacher) : undefined }); }).catch(() => undefined); }, []);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [qa, setQa] = useState('');
  const [teachingLog, setTeachingLog] = useState<Array<{ t: number; msg: string; level: 'info' | 'ok' | 'warn' | 'err' }>>([]);
  const [showTeachingLog, setShowTeachingLog] = useState(false);
  const [classStatus, setClassStatus] = useState<'STOPPED'|'PLAYING'|'PAUSED'|'ERROR'|'COMPLETED'>('STOPPED');
  /** V51.9.180 (UX review): engine status, the teaching log and the QA check are behind "Teacher tools". */
  const [teacherTools, toggleTeacherTools] = useTeacherTools();
  const boardSectionRef = useRef<HTMLElement | null>(null);
  // V51.9.180: on a phone the board is under the header; when the class starts, bring it into view if it is not.
  useEffect(() => {
    if (classStatus !== 'PLAYING' || typeof window === 'undefined' || window.innerWidth >= 768) return;
    const el = boardSectionRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.4) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [classStatus]);
  const [pipelineStage, setPipelineStage] = useState('Ready');
  // V51.6.6: General Class depth. Detailed is the default teacher-led mode.
  const [classDetail, setClassDetail] = useState<'standard'|'detailed'>('detailed');
  const pushLog = (msg: string, level: 'info' | 'ok' | 'warn' | 'err' = 'info') => {
    setTeachingLog(prev => {
      const next = [...prev, { t: Date.now(), msg, level }];
      return next.slice(-250); // retain enough history for diagnosis/download
    });
  };
  const [pageInput, setPageInput] = useState('1');
  // Manual PDF page navigation is independent of the nearest indexed paragraph.
  // This lets the reference pane display page 10 even when extraction produced no paragraph starting on page 10.
  const [referencePageOverride, setReferencePageOverride] = useState<number | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  // V51.9.93: parts 2–5 of a book are locked for a student who has not paid (the server sends no text or content for them).
  const [bookParts, setBookParts] = useState<PartSummary[]>([]);
  const [bookAccess, setBookAccess] = useState<BookAccess | null>(null);
  const [lockNotice, setLockNotice] = useState<number | null>(null);
  const [pageImageBase, setPageImageBase] = useState<string>();
  const [chapters, setChapters] = useState<Array<{ id: string; title: string; startPage: number; endPage: number }>>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
  const [indexedDocumentMeta, setIndexedDocumentMeta] = useState<{ subject: string; pageCount: number; sourceCount: number; chapterCount: number }>({ subject: '', pageCount: 0, sourceCount: 0, chapterCount: 0 });
  const [teachingProgress, setTeachingProgress] = useState({ unit: 0, total: 0 });
  const [teachingStrategy, setTeachingStrategy] = useState<TeachingStrategyDecision | null>(null);
  const [activeReferralVideo, setActiveReferralVideo] = useState<string | null>(null);
  const [activeMathStep, setActiveMathStep] = useState<MathTeachingStep | null>(null);
  const [activeCaption, setActiveCaption] = useState('');
  const [activeCaptionLanguage, setActiveCaptionLanguage] = useState<'english'|'malayalam'>('english');
  const [teachingHistory, setTeachingHistory] = useState<Array<{ key: string; paragraph: number; heading: string; step: MathTeachingStep; captionEnglish: string; captionMalayalam?: string; language: 'english'|'malayalam' }>>([]);
  const [showLessonIndex, setShowLessonIndex] = useState(false);
  // V51.9.141: Esc closes the index
  useEffect(() => {
    if (!showLessonIndex) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowLessonIndex(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showLessonIndex]);
  const [showThreeB1B, setShowThreeB1B] = useState(false);
  /** V51.9.51: the lesson board is Motion Class (templates for every subject); the old board stays one click away until parity is confirmed. */
  // V51.9.145: the Motion Class board is the only lesson board (the old 3B1B board is gone from the class).
  const boardEngine = 'motion' as const;
  /** V51.9.86: the whole-textbook class (formerly the separate Motion Class page) shown inside this classroom. */
  const [wholeBook, setWholeBook] = useState(false);
  // V51.9.116: the textbooks made ready to teach in the Material Studio, shown in the strip above the lesson
  const [readyBooks, setReadyBooks] = useState<ReadyBook[] | null>(null);
  const [openBookId, setOpenBookId] = useState<string | null>(null);
  /** V51.9.187: the shelf is this signed-in student's downloaded books ("My books") */
  const [shelfMine, setShelfMine] = useState(false);
  /** V51.9.154: a teacher's note opened from Messages (▶ Teach it in the classroom); teaching starts on "Start teaching". */
  const [teachNote, setTeachNote] = useState<(HandedNote & { started?: boolean }) | null>(null);
  const [bookLoaded, setBookLoaded] = useState<string | null>(null);
  const [startBook, setStartBook] = useState<string | null>(null);
  const openBookRef = useRef<((id: string) => void) | null>(null);
  const teachRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    let off = false;
    fetch('/api/ai-guru/material-studio/ready').then((r) => r.json()).then((j) => { if (!off) { setReadyBooks(Array.isArray(j?.books) ? j.books : []); setShelfMine(!!j?.mine); } }).catch(() => { if (!off) setReadyBooks([]); });
    return () => { off = true; };
  }, []);
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get('view') === 'book') setWholeBook(true); } catch { /* ignore */ } }, []);
  // V51.9.183: no book chosen yet → open a ready textbook of the student's own standard (its free Part 1 is open to
  // everyone, with all its study materials), instead of the built-in sample lesson. The sample stays only when the
  // school has no ready textbook yet.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !readyBooks?.length || openBookId) return;
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get('materialDocument') || q.get('teach') || window.localStorage.getItem('ai-guru:material-document')) return;
    } catch { return; }
    autoOpened.current = true;
    const std = (loadProfile().standard || '').replace(/^std\.?\s*/i, '').trim();
    const pick = readyBooks.find((b) => std && String(b.grade) === std) ?? readyBooks[0];
    openBookRef.current?.(pick.id);
  }, [readyBooks, openBookId]);
  const toggleWholeBook = () => { stop(); setWholeBook((v) => { const n = !v; try { window.history.replaceState(null, '', n ? '/ai-guru/classroom?view=book' : '/ai-guru/classroom'); } catch { /* ignore */ } return n; }); };
  const [threeB1BRun, setThreeB1BRun] = useState<{ material: StudyMaterial; index: number; nonce: number } | null>(null);
  /** Bumped on EVERY Play press so the board always starts a fresh run (a retry used to reuse the old board and do nothing). */
  const runNonceRef = useRef(0);
  const [studentId] = useState(() => {
    if (typeof window === 'undefined') return 'local-student';
    const key = 'ai-guru:student-id';
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const id = `student:${crypto.randomUUID()}`;
    window.localStorage.setItem(key, id);
    return id;
  });
  const boardRef = useRef<MathLikeAnimBoardHandle | null>(null);
  /** Run token: stop() / a repeat bump it so an older teaching loop ends instead of running on. */
  const runIdRef = useRef(0);
  const runCounterRef = useRef(0);
  const pausedRef = useRef(false);
  const pauseWaitersRef = useRef<Array<() => void>>([]);
  const skipRef = useRef(false);
  const audioSettleRef = useRef<(() => void) | null>(null);
  /** Every answer that has been drawn on the board (kept, never deleted) - used by the R (repeat) icon. */
  const sectionsRef = useRef<Map<string, { material: StudyMaterial; index: number; runNo: number }>>(new Map());
  const latestSectionKeyRef = useRef('');
  const [paused, setPaused] = useState(false);
  // V51.9.56: the textbook page can be folded away so the two boards get the whole width (phones).
  const [refCollapsed, setRefCollapsed] = useState<boolean>(() => { try { return localStorage.getItem('aiGuruRefCollapsed') === '1'; } catch { return false; } });
  const toggleRef = () => setRefCollapsed((c) => { const n = !c; try { localStorage.setItem('aiGuruRefCollapsed', n ? '1' : '0'); } catch { /* not remembered */ } return n; });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  /** Lesson paragraphs already taught in this run - guarantees the lesson only ever moves forward. */
  const taughtRef = useRef<Set<number>>(new Set());

  const paragraph = lesson.paragraphs[paragraphIndex] ?? lesson.paragraphs[0];
  const visuals = useMemo(() => language === 'മലയാളം' ? paragraph?.malayalam.visuals ?? [] : paragraph?.english.visuals ?? [], [paragraph, language]);
  const paragraphPage = paragraph?.source?.pageNumber ?? 1;
  const currentPage = referencePageOverride ?? paragraphPage;
  const pageCount = useMemo(() => Math.max(1, ...lesson.paragraphs.map(p => p.source.pageNumber || 1)), [lesson]);
  // Chapters used to be assumed to be exactly 30 pages long, which had nothing
  // to do with the real book: on the SCERT Class 9 Mathematics textbook that
  // reported "Chapter 1, pages 1-30" while the actual first chapter ends far
  // earlier. When Material Studio has indexed the book, its chapter map is the
  // truth; the fixed-width guess is only used when no map exists.
  const realChapter = chapters.find(c => currentPage >= c.startPage && currentPage <= c.endPage);
  const chapterIndex = realChapter ? chapters.indexOf(realChapter) : Math.floor((currentPage - 1) / 30);
  const chapterStart = realChapter ? realChapter.startPage : chapterIndex * 30 + 1;
  const chapterEnd = realChapter ? realChapter.endPage : Math.min(pageCount, chapterStart + 29);
  /** V51.9.93: the locked part a page belongs to (0 = open). */
  const lockedPartOf = (page: number) => { const p = bookParts.find((x) => page >= x.startPage && page <= x.endPage); return p?.locked ? p.index : 0; };
  /** Teaching from `page` stops before the first locked page after it. */
  const openEndFrom = (page: number, end: number) => { const firstLocked = bookParts.filter((x) => x.locked && x.startPage > page).sort((a, b) => a.startPage - b.startPage)[0]; return firstLocked ? Math.min(end, firstLocked.startPage - 1) : end; };
  const currentLockedPart = lockedPartOf(currentPage);
  const chapterTitle = realChapter?.title;
  const chapterParagraphsFor3B1B = useMemo(() => lesson.paragraphs.filter(p => { const page = p.source.pageNumber || 1; return page >= chapterStart && page <= chapterEnd; }).slice(0, 18), [chapterEnd, chapterStart, lesson.paragraphs]);
  const chapterSummaryFor3B1B = useMemo(() => chapterParagraphsFor3B1B.map(p => p.source.text).join(' ').replace(/\s+/g, ' ').slice(0, 7000), [chapterParagraphsFor3B1B]);
  const chapterTopicsFor3B1B = useMemo(() => [...new Set(chapterParagraphsFor3B1B.map(p => (p as any).heading).filter(Boolean).map(String))].slice(0, 20), [chapterParagraphsFor3B1B]);
  const textbookContextFor3B1B = useMemo(() => {
    const current = paragraph?.source?.text || '';
    return `Chapter: ${chapterTitle || lesson.title}\nCurrent textbook page: ${currentPage}\nCurrent passage: ${current}\nChapter context: ${chapterSummaryFor3B1B}`.slice(0, 11000);
  }, [chapterSummaryFor3B1B, chapterTitle, currentPage, lesson.title, paragraph]);

  useEffect(() => { setPageInput(String(currentPage)); }, [currentPage]);
  useEffect(() => {
    let cancelled = false;
    const loadStudioContext = async (chosen?: string) => {
      try {
        const params = new URLSearchParams(chosen ? '' : window.location.search);
        if (!chosen && params.get('teach') === 'note' && takeHandedNote()) return; // V51.9.154: the teacher's note is the lesson
        const requestedDocumentId = chosen || params.get('materialDocument');
        const documentId = requestedDocumentId || window.localStorage.getItem('ai-guru:material-document');
        if (!documentId) return;
        if (requestedDocumentId) window.localStorage.setItem('ai-guru:material-document', requestedDocumentId);
        setOpenBookId(documentId);
        setSelectedMaterial(null);
        setMaterials([]);
        // V51.9.95: a book downloaded from the library is kept on this device; when the network fails, read that copy.
        const kept = async (url: string) => {
          try { const r = await fetch(url); if (r.ok || r.status < 500) return r; throw new Error(String(r.status)); }
          catch (e) { try { const hit = await (await caches.open('ai-guru-library-v1')).match(url); if (hit) return hit; } catch { /* no cache */ } throw e; }
        };
        const [sourceResponse, materialResponse] = await Promise.all([
          kept(`/api/ai-guru/material-studio/sources/${encodeURIComponent(documentId)}`),
          kept(`/api/ai-guru/material-studio/materials?documentId=${encodeURIComponent(documentId)}`),
        ]);
        const sourceJson = await sourceResponse.json();
        const materialJson = await materialResponse.json();
        if (cancelled) return;
        if (sourceResponse.ok && sourceJson.ok && sourceJson.document?.sources?.length) {
          const sources: ParagraphSource[] = sourceJson.document.sources.map((source: any, i: number) => ({
            bookId: documentId, chapterIndex: 0, paragraphIndex: i, pageNumber: source.page, text: source.text, pageImage: '',
          }));
          setLesson(createLessonDraft(sources, sourceJson.document.fileName));
          setParagraphMaterialCache({}); // paragraph ids are index-based, not book-scoped, and would collide with a cache from a previously loaded book
          setParagraphIndex(0);
          setPdfUrl(`/api/ai-guru/material-studio/pdf/${encodeURIComponent(documentId)}`);
          setPageImageBase(`/api/ai-guru/material-studio/page-image/${encodeURIComponent(documentId)}`);
          setBookParts(Array.isArray(sourceJson.document.parts) ? sourceJson.document.parts : []);
          setBookAccess(sourceJson.document.access ?? null);
          const sourceChapters = Array.isArray(sourceJson.document.chapters) ? sourceJson.document.chapters : [];
          setChapters(sourceChapters);
          setIndexedDocumentMeta({
            subject: String(sourceJson.document.subject || ''),
            pageCount: Number(sourceJson.document.pageCount || 0),
            sourceCount: Number(sourceJson.document.sources?.length || 0),
            chapterCount: sourceChapters.length,
          });
        }
        if (materialResponse.ok && materialJson.ok) {
          const loadedMaterials = materialJson.materials || [];
          setMaterials(loadedMaterials);
          const requested = params.get('material');
          const requestedMaterial = loadedMaterials.find((m: StudyMaterial) => m.id === requested);
          // BUGFIX (General Class hijack): previously fell back to loadedMaterials[0]
          // when no 'whiteboard-notes' (General Class) material existed yet — e.g. a
          // Problems and Formulae material. That silently became selectedMaterial and,
          // per teachParagraph() below, hijacked the main ▶ Play button away from the
          // general classroom video/Visual-DNA pipeline. Only auto-select a material
          // here if it was explicitly requested (materialDocument link) or is itself a
          // General Class material; otherwise leave selectedMaterial null so General
          // Class plays normally and other material types stay opt-in via their own
          // card in the Study Materials rail.
          const preferredMaterial = (requestedMaterial && !requestedMaterial.locked ? requestedMaterial : null) || loadedMaterials.find((m: StudyMaterial & { locked?: boolean }) => m.type === 'whiteboard-notes' && !m.locked) || null; // V51.9.93: never a locked stub
          setSelectedMaterial(preferredMaterial);
        }
        if (chosen) setBookLoaded(documentId);
      } catch { /* Studio context is optional; the normal V43 classroom remains unchanged. */ }
    };
    void loadStudioContext();
    // V51.9.116: a ready book clicked in the strip loads here, without leaving the page
    openBookRef.current = (id: string) => { cancelled = false; void loadStudioContext(id); };
    return () => { cancelled = true; };
  }, []);
  // V51.9.154: a note from the teacher (Messages → ▶ Teach it in the classroom) becomes this class's lesson
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('teach') !== 'note') return;
    const n = takeHandedNote();
    if (!n) return;
    const paras = noteParagraphs(n.body);
    if (!paras.length) return;
    const bookId = `note:${Date.now()}`;
    const sources: ParagraphSource[] = [n.title, ...paras].map((text, i) => ({ bookId, chapterIndex: 0, paragraphIndex: i, pageNumber: 1, text, pageImage: '' }));
    void Promise.resolve().then(() => {
      setOpenBookId(null);
      setSelectedMaterial(null);
      setMaterials([]);
      setChapters([]);
      setBookParts([]);
      setBookAccess(null);
      setPageImageBase(undefined);
      setPdfUrl(undefined);
      setIndexedDocumentMeta({ subject: '', pageCount: 1, sourceCount: sources.length, chapterCount: 0 });
      setLesson(createLessonDraft(sources, n.title));
      setParagraphMaterialCache({});
      setParagraphIndex(0);
      setReferencePageOverride(null);
      setTeachNote(n);
      setState(`📝 ${n.title}${n.from ? ` · from ${n.from}` : ''} · ${paras.length} part${paras.length === 1 ? '' : 's'} · press Start teaching`);
    });
  }, []);
  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);
  useEffect(() => {
    void postJson('/api/ai-guru/session', { action: 'save', studentId, lessonId: lesson.id, state: { paragraphId: paragraph?.id, pageNumber: currentPage } }).catch(() => undefined);
  }, [studentId, lesson.id, paragraph?.id, currentPage]);

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  };

  const releasePauseWaiters = () => { pauseWaitersRef.current.splice(0).forEach(r => r()); };

  /** # icon: hold the lesson here - the next step is not shown until the continue (tick) icon is pressed. */
  const pauseTeaching = () => {
    pausedRef.current = true;
    setPaused(true); setClassStatus('PAUSED'); setPipelineStage('Paused');
    audioRef.current?.pause();
  };

  /** Tick icon: when paused, carry on; when playing, skip the rest of this step's narration and go to the next step. */
  const continueTeaching = () => {
    if (pausedRef.current) {
      pausedRef.current = false;
      setPaused(false); setClassStatus('PLAYING');
      void audioRef.current?.play().catch(() => undefined);
      releasePauseWaiters();
      return;
    }
    skipRef.current = true;
    if (audioSettleRef.current) { audioRef.current?.pause(); audioSettleRef.current(); }
  };


  /** Split explanation into short teaching steps for the board (not one wall of text). */
  const splitIntoSteps = (raw: string): string[] => {
    const text = String(raw || '').trim();
    if (!text) return [];
    // Prefer explicit newlines / numbered steps, else sentence boundaries, else chunks.
    let parts = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (parts.length <= 1) {
      parts = text.split(/(?<=[.!?।])\s+|(?=\\n)|(?=\d+\.|\(\d+\))/).map(s => s.trim()).filter(Boolean);
    }
    if (parts.length <= 1 && text.length > 120) {
      const words = text.split(/\s+/);
      parts = [];
      for (let i = 0; i < words.length; i += 18) parts.push(words.slice(i, i + 18).join(' '));
    }
    return parts.length ? parts : [text];
  };

  const writeStepsOnBoard = async (steps: string[], idPrefix: string, opts?: { italic?: boolean; label?: string }) => {
    if (opts?.label) {
      try {
        await boardRef.current?.reveal({
          type: 'write', id: `${idPrefix}-label`, content: opts.label,
          x: 40, y: 40, width: 920, fontSize: 18, durationMs: 300,
        } as VisualAction);
      } catch { /* continue */ }
    }
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const numbered = steps.length > 1 ? `${i + 1}. ${step}` : step;
      try {
        await boardRef.current?.reveal({
          type: 'write',
          id: `${idPrefix}-step-${i}`,
          content: numbered,
          x: 40, y: 60 + i * 40,
          width: 920,
          fontSize: opts?.italic ? 18 : 20,
          fontStyle: opts?.italic ? 'italic' : undefined,
          durationMs: 350,
        } as VisualAction);
      } catch (e) {
        pushLog(`Board step write failed: ${e instanceof Error ? e.message : String(e)}`, 'warn');
      }
      await new Promise<void>(r => window.setTimeout(r, 120));
    }
  };

  /** Split mixed Malayalam+English so English words are spoken with an English voice.
   *  Example: "ഒരു പെട്ടിയിൽ ആകെ 100 beads ഉണ്ട്" -> ml segment, then en "beads", then ml. */
  const splitMixedLanguageSegments = (text: string, track: LanguageTrack): Array<{ text: string; track: LanguageTrack }> => {
    const t = String(text || '').trim();
    if (!t) return [];
    if (track !== 'malayalam') return [{ text: t, track }];
    // Latin letter runs of length >= 2 (beads, white, black, table, chair, equation, …) keep English pronunciation.
    // Single letters (x, y, a, b) and pure numbers stay with the surrounding Malayalam voice.
    const re = /[A-Za-z][A-Za-z'\-]{1,}/g;
    const segments: Array<{ text: string; track: LanguageTrack }> = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      if (m.index > last) {
        const ml = t.slice(last, m.index).trim();
        if (ml) segments.push({ text: ml, track: 'malayalam' });
      }
      segments.push({ text: m[0], track: 'english' });
      last = m.index + m[0].length;
    }
    if (last < t.length) {
      const ml = t.slice(last).trim();
      if (ml) segments.push({ text: ml, track: 'malayalam' });
    }
    return segments.length ? segments : [{ text: t, track }];
  };

  const speakTextOnce = async (text: string, track: LanguageTrack, preferred?: 'edge' | 'google-cloud' | 'sarvam' | 'piper') => {
    if (!text?.trim()) return;
    if (skipRef.current) { skipRef.current = false; return; }
    const languageCode = track === 'malayalam' ? 'ml-IN' : 'en-IN';
    // Settings → Local TTS decides the order. Auto = Edge first (English AND Malayalam), local Piper right behind it,
    // then cloud fallbacks. Browser TTS is never used. A provider that just failed is tried last for a few minutes.
    const fallbackProviders = ttsProviderOrder(track);
    const providers = preferred
      ? [preferred, ...fallbackProviders.filter(p => p !== preferred)]
      : fallbackProviders;
    const edgeVoice = edgeVoiceFor(languageCode);
    const preview = text.trim().slice(0, 48).replace(/\s+/g, ' ');
    pushLog(`TTS start (${track}): "${preview}${text.trim().length > 48 ? '…' : ''}"`, 'info');

    for (const provider of providers) {
      try {
        pushLog(`Calling ${provider} TTS…`, 'info');
        const controller = new AbortController();
        // Edge's handshake alone can take up to 10 s on a slow link (server limit 18 s); other providers stay at 8 s.
        const fetchTimer = window.setTimeout(() => controller.abort(), provider === 'edge' ? 20000 : 8000);
        let result: any;
        try {
          const r = await ttsFetch('/api/ai-guru/tts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              provider,
              text,
              languageCode,
              speaker: provider === 'edge' ? edgeVoice : provider === 'sarvam' ? 'shubh' : undefined,
              apiKey: provider === 'sarvam' ? getProvider('sarvam')?.key : undefined,
            }),
            signal: controller.signal,
          });
          result = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
          if (!r.ok || result?.ok === false) throw new Error(result?.error || `${provider} HTTP ${r.status}`);
        } finally {
          window.clearTimeout(fetchTimer);
        }
        if (!result?.result?.audioBase64) throw new Error(`${provider} returned no audio`);
        if (skipRef.current) { skipRef.current = false; return; }
        pushLog(`${provider} audio received (${Math.round((result.result.audioBase64.length * 0.75) / 1024)} KB) — playing…`, 'ok');
        await new Promise<void>((resolve, reject) => {
          const mime = result.result.format === 'wav' ? 'audio/wav' : result.result.format === 'webm' ? 'audio/webm' : 'audio/mpeg';
          const audio = new Audio(`data:${mime};base64,${result.result.audioBase64}`);
          audioRef.current = audio;
          setSpeaking(true);
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            window.clearTimeout(playTimer);
            if (audioSettleRef.current === done) audioSettleRef.current = null;
            if (audioRef.current === audio) audioRef.current = null;
            setSpeaking(false);
            resolve();
          };
          const failed = (msg: string) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(playTimer);
            if (audioSettleRef.current === done) audioSettleRef.current = null;
            if (audioRef.current === audio) audioRef.current = null;
            setSpeaking(false);
            reject(new Error(msg));
          };
          // Safety: never hang teaching if onended never fires (autoplay / empty audio).
          // While the student has the lesson paused the timer must not fire (it would fall through to the next voice).
          let playTimer = 0;
          const armTimer = () => window.setTimeout(() => { if (pausedRef.current && !settled) { playTimer = armTimer(); return; } failed(`${provider} playback timed out`); }, 120000);
          playTimer = armTimer();
          audioSettleRef.current = done;
          audio.onended = done;
          audio.onerror = () => failed(`${provider} audio playback failed`);
          void audio.play().catch(() => failed(`${provider} audio.play() rejected`));
        });
        const okMsg = provider === 'edge'
          ? `Voice OK: Edge TTS (${edgeVoice})`
          : `Voice OK: fell back to ${provider}`;
        setQa(okMsg);
        pushLog(okMsg, 'ok');
        return;
      } catch (error) {
        const msg = `${provider} TTS failed: ${error instanceof Error ? error.message : String(error)}`;
        setQa(`${msg} — trying next…`);
        pushLog(msg, 'warn');
        // A synthesis failure (not a playback hiccup) demotes this provider briefly so a blocked network cannot stall every sentence.
        if (!/playback|audio\.play|metadata/i.test(msg)) markTtsProviderDown(provider);
        // Try the next server-side provider. Never fall back to browser TTS.
      }
    }

    // Browser SpeechSynthesis last resort (no server / Edge / Piper).
    try {
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
      if (synth && text.trim()) {
        pushLog('Falling back to browser voice…', 'warn');
        await new Promise<void>((resolve) => {
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = languageCode;
          utter.rate = 0.95;
          const voices = synth.getVoices?.() || [];
          const prefer = voices.find(v => v.lang?.toLowerCase().startsWith(languageCode.slice(0, 2).toLowerCase()));
          if (prefer) utter.voice = prefer;
          let settled = false;
          const done = () => { if (settled) return; settled = true; setSpeaking(false); resolve(); };
          utter.onend = done;
          utter.onerror = done;
          setSpeaking(true);
          synth.cancel();
          synth.speak(utter);
          window.setTimeout(done, Math.max(3000, text.split(/\s+/).length * 400));
        });
        setQa('Voice OK: browser SpeechSynthesis');
        pushLog('Voice OK: browser SpeechSynthesis', 'ok');
        return;
      }
    } catch (e) {
      pushLog(`Browser voice failed: ${e instanceof Error ? e.message : String(e)}`, 'warn');
    }

    setSpeaking(false);
    const finalMsg = `No TTS available for ${track === 'malayalam' ? 'Malayalam' : 'English'}. Install Piper in Settings → Local TTS, or fix Edge network. Browser voice also unavailable.`;
    setQa(finalMsg);
    pushLog(finalMsg, 'err');
  };

  const speakText = async (text: string, track: LanguageTrack, preferred?: 'edge' | 'google-cloud' | 'sarvam' | 'piper') => {
    if (!text?.trim()) return;
    if (skipRef.current) { skipRef.current = false; return; }
    stopAudio();
    const segments = splitMixedLanguageSegments(text, track);
    for (const seg of segments) {
      if (skipRef.current) { skipRef.current = false; return; }
      await speakTextOnce(seg.text, seg.track, preferred);
    }
  };

  const visualForAction = (action: any): VisualAction | undefined => {
    const id = String(action.elementId ?? action.id ?? action.targetId ?? action.toId ?? '');
    return visuals.find(v => v.id === id || ('targetId' in v && v.targetId === id) || ('toId' in v && v.toId === id));
  };

  const executeActions = async (actions: any[]) => {
    for (const action of actions) {
      if (action.type === 'speech') {
        await speakText(action.text, isMalayalam(action.text) ? 'malayalam' : 'english');
        continue;
      }
      const visual = visualForAction(action);
      if (visual) await boardRef.current?.reveal(visual);
    }
  };

  const controller = useMemo(() => {
    const port: TeachingControllerPort = {
      showReference: async (source) => {
        const idx = lesson.paragraphs.findIndex(p => String((p.source as any)?.id || '') === String((source as any)?.id || '') || (Number(p.source?.pageNumber || 0) === Number(source?.pageNumber || 0) && String(p.source?.text || '').trim() === String(source?.text || '').trim()));
        if (idx >= 0) {
          setParagraphIndex(idx);
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }
      },
      playActions: executeActions,
      playSpeechWithCues: async (text, _cues, lang) => { await speakText(text, lang); },
      pause: () => { audioRef.current?.pause(); },
      resume: () => { void audioRef.current?.play(); },
      resetVisuals: () => boardRef.current?.reset(),
    };
    return new AIGuruClassroomController(port, { onStateChange: snapshot => setState(snapshot.state) });
    // The controller is recreated when the paragraph/visual set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paragraph, visuals]);

  const play = async () => {
    if (currentLockedPart) { setLockNotice(currentLockedPart); return; }
    setBusy(true);
    stopAudio();
    boardRef.current?.reset();
    try {
      await controller.start(lesson, paragraphIndex);
    } catch (e) {
      setState(e instanceof Error ? e.message : 'Playback error');
    } finally {
      setBusy(false);
    }
  };

  /** Generates (or reuses a cached) single-paragraph "whiteboard-notes"
   *  material for the CURRENT paragraph and teaches it through the same
   *  Material Studio BYOK pipeline that powers playMaterial(). Previously
   *  createLessonDraft() left every imported paragraph's english/malayalam
   *  tracks permanently empty, and only material-studio's whiteboard-notes
   *  path ever filled them, so "▶ Teach paragraph" produced silent, empty
   *  playback for any imported book. This makes every paragraph teachable
   *  without a separate trip through Material Studio, using the exact same
   *  key pool, teaching spec (quote paragraph -> explain in English with
   *  graphics -> replay the same graphics in the teaching language) and
   *  section renderer as a saved material. */
  const [paragraphMaterialCache, setParagraphMaterialCache] = useState<Record<string, StudyMaterial>>({});
  const teachParagraph = async () => {
    taughtRef.current = new Set();
    // The textbook cursor is authoritative: start from the page the student is LOOKING at.
    // (A page with no extracted text starts at the next readable passage.)
    const start = resolvePlayStart(lesson.paragraphs, paragraphIndex, referencePageOverride);
    if (!start) { setState('This lesson has no readable paragraphs yet.'); return; }
    const startParagraph = lesson.paragraphs[start.index];
    if (!startParagraph) return;
    const lockedHere = lockedPartOf(start.page) || currentLockedPart;
    if (lockedHere) { setLockNotice(lockedHere); setState((bookAccess as { partPrice?: number } | null)?.partPrice ? `Part ${lockedHere} opens when you pay for it.` : `Part ${lockedHere} opens when you are enrolled.`); return; }
    setTeachingLog([]);
    setClassStatus('PLAYING');
    setPipelineStage('Teacher Reading · 3B1B Video-DNA planning');
    setState(`Teacher Reading · preparing ${(startParagraph as any).heading || lesson.title}`);
    pushLog('▶ Play pressed — starting General Class Teacher Reading.', 'info');
    if (start.note) pushLog(start.note, 'warn');
    pushLog(`Textbook reference locked to page ${start.page} (paragraph ${start.index + 1}/${lesson.paragraphs.length}).`, 'ok');
    pushLog('Textbook supplies WHAT; Chapter → Lesson → Beat Video-DNA supplies HOW.', 'ok');
    // Rule 1 of lib/ai-guru/lesson/paragraph-flow.ts: a source whose id IS the lesson-paragraph id maps
    // straight back to that paragraph (no page-local guessing, no text matching, no ambiguity).
    // One section per textbook paragraph from the cursor to the END OF THE CHAPTER. A single-section material made the
    // run loop report "completed normally" after one paragraph, so the class stopped by itself.
    const syntheticMaterial: StudyMaterial = buildTeacherReadingMaterial({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      paragraphs: lesson.paragraphs as any,
      startIndex: start.index,
      startPage: start.page,
      endPage: openEndFrom(start.page, chapterEnd), // V51.9.93: never runs into a locked part
      language: language === 'മലയാളം' ? 'malayalam' : 'english',
    });
    pushLog(`Teacher Reading queued ${syntheticMaterial.sections.length} passage(s) · page ${start.page} → end of chapter (page ${chapterEnd}).`, 'info');
    if (start.requestedPage === null) setReferencePageOverride(null);
    setParagraphIndex(start.index);
    setTeachingProgress({ unit: 1, total: syntheticMaterial.sections.length });
    stopAudio();
    runNonceRef.current += 1;
    setThreeB1BRun({ material: syntheticMaterial, index: 0, nonce: runNonceRef.current });
    setShowThreeB1B(true);
  };

  const playMaterial = async (material: StudyMaterial) => {
    if ((material as StudyMaterial & { locked?: boolean }).locked) { setLockNotice((material as StudyMaterial & { part?: number }).part || 2); return; }
    taughtRef.current = new Set();
    controller.stop();
    runIdRef.current += 1;
    pausedRef.current = false;
    setPaused(false);
    releasePauseWaiters();
    audioSettleRef.current?.();
    stopAudio();
    setSelectedMaterial(material);

    // General Class is now a textbook-reading class. Problems & Formulae keeps its
    // dedicated practice runtime; all other material types use the 3B1B
    // Teacher-Reading pipeline as the primary visual teaching mechanism.
    if (material.type !== 'problems-formulae' && material.sections.length) {
      // Start from the paragraph/page the teacher is currently showing.  The
      // old code always used section 0, which silently jumped page 7 → page 1
      // as soon as Play was pressed.
      const playStart = resolvePlayStart(lesson.paragraphs, paragraphIndex, referencePageOverride);
      if (playStart?.note) pushLog(playStart.note, 'warn');
      const currentParagraphIndex = playStart?.index ?? paragraphIndex;
      // Declared here (not inside the fallback block below) because the "Playback anchor" log line also reads it.
      const currentParagraph = lesson.paragraphs[currentParagraphIndex] || paragraph;
      let startIndex = material.sections.findIndex(section => {
        const match = sourceParagraphMatch(material, section);
        return match?.index === currentParagraphIndex;
      });

      // A saved material can legitimately cover only another page/paragraph. Never
      // interpret that as "start at section 0": doing so is the second source of the
      // page-7 → page-1 jump. If the current textbook paragraph is not represented in
      // the saved material, build a one-paragraph Teacher-Reading section for the
      // paragraph that is actually visible. This keeps the textbook cursor authoritative.
      let runMaterial = material;
      if (startIndex < 0) {
        if (currentParagraph) {
          // Keep the physical page the student selected. If page 7 has no extracted paragraph, Play must not
          // rewrite the reference to page 9. Teach on from here to the end of the chapter (not just one paragraph).
          runMaterial = {
            ...buildTeacherReadingMaterial({
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              paragraphs: lesson.paragraphs as any,
              startIndex: currentParagraphIndex,
              startPage: playStart?.page || currentParagraph.source.pageNumber || currentPage,
              endPage: chapterEnd,
              language: language === 'മലയാളം' ? 'malayalam' : 'english',
              title: (currentParagraph as any).heading || material.title || lesson.title,
            }),
            id: `teacher-reading:${lesson.id}:${currentParagraph.id}`,
          };
        }
        startIndex = 0;
      }

      const startSection = runMaterial.sections[startIndex];
      const startMatch = startSection ? sourceParagraphMatch(runMaterial, startSection) : undefined;
      if (startMatch) {
        // Keep an explicit physical-page selection. This is important for scanned
        // or diagram-only pages that have no extracted paragraph.
        if (!playStart || playStart.requestedPage === null) setReferencePageOverride(null);
        setParagraphIndex(startMatch.index);
        setTeachingProgress({ unit: 1, total: runMaterial.sections.length });
      }
      setTeachingLog([]);
      setClassStatus('PLAYING');
      setPipelineStage('Teacher Reading · 3B1B Video-DNA');
      pushLog(`▶ Playback anchor: requested page ${playStart?.requestedPage ?? playStart?.page ?? currentPage} · teaching cursor page ${currentParagraph.source.pageNumber ?? currentPage} · reference page ${playStart?.page ?? currentPage}`, 'info');
      setState('Teacher Reading · English → Malayalam → explanation → visual');
      pushLog(`▶ General Class started · section ${startIndex + 1}/${runMaterial.sections.length} · page ${startMatch?.page ?? currentPage}`, 'info');
      pushLog('Textbook supplies WHAT; Chapter → Lesson → Beat Video-DNA supplies HOW.', 'ok');
      runNonceRef.current += 1;
      setThreeB1BRun({ material: runMaterial, index: startIndex, nonce: runNonceRef.current });
      setShowThreeB1B(true);
      setBusy(false);
      return;
    }

    const firstMatch = material.sections.length ? sourceParagraphMatch(material, material.sections[0]) : undefined;
    if (firstMatch) {
      setParagraphIndex(firstMatch.index);
      setTeachingProgress({ unit: 0, total: material.sections.length });
    }
    setBusy(true);
    try {
      await playStudyMaterial(material);
    } finally {
      setBusy(false);
    }
  };

  const playStudyMaterial = async (material: StudyMaterial) => playStudyMaterialFrom(material, 0);

  const playStudyMaterialFrom = async (material: StudyMaterial, startIndex: number, opts?: { repeatKey?: string; continueAfter?: boolean; runNo?: number }) => {
      const myRun = ++runIdRef.current;
      const cancelled = () => runIdRef.current !== myRun;
      const runNo = opts?.runNo ?? ++runCounterRef.current;
      const waitIfPaused = async () => { while (pausedRef.current && !cancelled()) await new Promise<void>(r => pauseWaitersRef.current.push(r)); };
      // A material is taught through the existing V43 board. The source
      // paragraph is read first, then the English explanation, then the
      // selected teaching-language explanation. The SAME visual actions are
      // reused for both language passes; no second graphics engine exists.
      setTeachingLog([]);
      setClassStatus('PLAYING'); setPipelineStage('Material playback');
      pushLog(`Play pressed · material "${material.title}" · ${material.sections.length} section(s)`, 'info');
      setBusy(true);
      try {
      for (let index = startIndex; index < material.sections.length; index++) {
        if (cancelled()) return;
        await waitIfPaused();
        if (cancelled()) return;
        try {
        const section = material.sections[index];
        const sectionKey = opts?.repeatKey && index === startIndex ? opts.repeatKey : `${material.id}-${index}-r${runNo}`;
        const sectionQuestion = [
          section.heading, section.sourceText, section.content, section.contentTranslation,
          // the verified solution lines carry the real equations/operations the selector needs
          ...(Array.isArray(section.mathSteps) ? section.mathSteps.map((st: MathTeachingStep) => `${st.before} ${st.operation} ${st.after}`) : []),
        ].filter(Boolean).join('\n');
        // V51.6 isolation: Problems and Formulae is a practice-material mode. Its
        // visuals were authored with the dedicated 20-reference DNA library in
        // Material Studio, so playback must NOT re-enter general classroom
        // template selection and mix the two visual grammars.
        const detectedDomain = detectMathDomain(sectionQuestion);
        const sectionStrategy: TeachingStrategyDecision = material.type === 'problems-formulae'
          ? { strategy:'step_by_step', reason:"Problems and Formulae practice mode: use the material's pre-authored problem-solving visuals; classroom template selection is bypassed.", domain:detectedDomain, confidence:'high', solverRequired:true, visualEngine:'universal-math' }
          : selectTeachingStrategy({ question: sectionQuestion, domain: detectedDomain, grade: inferTextbookGrade(lesson) });
        // V51.8.8: deterministic math comes before the network visual planner. If the
        // textbook contains a solvable equation/problem, we can start immediately and do not
        // waste startup time on /math/plan. Gemini remains an optional enrichment layer.
        const problemText = String(section.teachingPass?.sourceText || section.sourceText || section.heading || sectionQuestion || '').trim();
        let deterministicPlan = material.type === 'problems-formulae' ? planTemplateSolution(problemText) : null;
        // General Class must also recognize textbook concept passages that contain an
        // equation chain (e.g. "forming equations"). Those are not solver requests,
        // but they still have a deterministic visual sequence. Never send such a passage
        // to the generic spatial planner merely because a style referral was selected.
        const extractedEquations = extractEquationCandidates(sectionQuestion);
        const pair = extractPairEquationsFromWordProblem(sectionQuestion);
        if (!deterministicPlan && pair && pair.length >= 2) {
          deterministicPlan = planTemplateSolution(pair.join(' and '));
        }
        if (!deterministicPlan && extractedEquations.length >= 2) {
          deterministicPlan = planEquationSequence(extractedEquations);
          if (deterministicPlan) pushLog(`Textbook equation sequence detected (${extractedEquations.length} equations) — using deterministic template grammar`, 'ok');
        }
        if (!deterministicPlan && sectionStrategy.solverRequired && extractedEquations.length === 1) {
          deterministicPlan = planTemplateSolution(extractedEquations[0]);
        }
        if (deterministicPlan) pushLog(`Deterministic math solution ready (${deterministicPlan.family}) — visual planner can be skipped`, 'ok');
        setTeachingStrategy(sectionStrategy);
        setActiveReferralVideo(sectionStrategy.referral?.file ?? null);
        pushLog(`Teaching strategy: ${sectionStrategy.strategy} — ${sectionStrategy.reason}`, 'info');
        if (sectionStrategy.referral) pushLog(`Visual template grammar selected: ${sectionStrategy.referral.originalFilename}`, 'ok');
        setPipelineStage(sectionStrategy.referral ? 'General visual planning' : (material.type==='problems-formulae' ? 'Problems & Formulae practice' : 'Lesson planning'));
        // General classroom visual templates may invoke the compact visual planner.
        // V51.6 Problems and Formulae never enters this branch, preventing style mixing.
        // The user's BYOK key is sent only for this request and is not persisted server-side.
        let groundedPlan: any = null;
        if (material.type !== 'problems-formulae' && !deterministicPlan) {
          const byok = orderedUsableKeys()[0]?.key;
          if (byok) {
            try {
              const grounded = await postJson('/api/ai-guru/math/plan', { question: sectionQuestion, grade: inferTextbookGrade(lesson), domain: sectionStrategy.domain, language: material.teachingLanguage === 'malayalam' ? 'malayalam' : 'english', hasActualProblem: sectionStrategy.solverRequired, apiKey: byok, agnesApiKey: getProvider('agnes')?.key, sarvamApiKey: getProvider('sarvam')?.key });
              groundedPlan = grounded.plan;
              pushLog(`Visual planner provider: ${String(groundedPlan?.plannerProvider || grounded.source || 'gemini')}`, groundedPlan?.plannerProvider && groundedPlan.plannerProvider !== 'gemini' ? 'warn' : 'ok');
              const evidence = groundedPlan?.referenceGrounding?.evidence || [];
              const gNodes = Array.isArray(groundedPlan?.nodes) ? groundedPlan.nodes : [];
              const gSteps = Array.isArray(groundedPlan?.steps) ? groundedPlan.steps : [];
              const spatialKinds = new Set(['shape','line','arrow','graph','highlight','transform']);
              const spatialNodes = gNodes.filter((n:any) => spatialKinds.has(String(n?.kind||'')));
              const spatialCount = spatialNodes.length;
              const spatialKindCount = new Set(spatialNodes.map((n:any)=>String(n?.kind||''))).size;
              const longTextCount = gNodes.filter((n:any)=>String(n?.kind||'')==='text' && String(n?.content||'').trim().length>60).length;
              const mathCount = gNodes.filter((n:any) => String(n?.kind||'') === 'latex').length;
              const visualQa = groundedPlan?.generalVisualQa;
              if (Array.isArray(visualQa?.attempts)) {
                for (const qa of visualQa.attempts) {
                  const reason = Array.isArray(qa.failures) && qa.failures.length ? ` · ${qa.failures.join('; ')}` : '';
                  pushLog(`Visual QA pass ${qa.attempt}/3: ${qa.ok ? 'PASS ✓' : 'FAIL'} · spatial ${qa.spatialCount}/${qa.requiredSpatial} · kinds ${(qa.spatialKinds||[]).length} · symbolic ${qa.symbolicCount} · long text ${qa.longTextCount}${reason}`, qa.ok ? 'ok' : 'warn');
                }
              }
              pushLog(`General visual plan · ${gSteps.length} beat(s) · ${gNodes.length} node(s) · ${spatialCount} spatial visual(s) · ${spatialKindCount} spatial kind(s) · ${mathCount} math node(s)`, 'info');
              // General Class uses local Visual DNA; an MP4 watch is intentionally NOT required.
              if (groundedPlan?.referenceGrounding?.watched && evidence.length) pushLog(`Optional reference video evidence · ${evidence.length} temporal beat(s)`, 'ok');
              else pushLog('General Teaching DNA active · no MP4 watch required', 'ok');
              // A plan made only of positioned text is exactly the broken "some text only" classroom.
              // Do not let it replace the verified renderer: narration can still use it, but board playback falls back.
              if (spatialCount < 3 || spatialKindCount < 2 || longTextCount > 0) {
                pushLog(`General visual plan rejected: needs real 1B3B-like spatial teaching (got ${spatialCount} spatial nodes/${spatialKindCount} kinds; long prose nodes=${longTextCount}).`, 'warn');
                groundedPlan = null;
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              // The server visual planner is an enrichment layer, not the only teaching
              // path. A transient provider/QA/HTTP failure must never make the classroom
              // appear frozen when the textbook material already contains verified
              // mathSteps or authored visuals. Fall back to the deterministic material
              // renderer for this section and make the failure explicit in the log.
              // Problems & Formulae remains isolated and never enters this branch.
              pushLog(`General visual planner unavailable — using textbook material fallback: ${msg}`, 'warn');
              groundedPlan = null;
            }
          }
        } else if (deterministicPlan) {
          pushLog('General visual planner skipped: verified deterministic solution will render immediately.', 'info');
        }
        const real = (section.visuals || []).filter((v: any) => v && typeof v.type === 'string' && typeof v.id === 'string') as VisualAction[];
        // V51.1 WHITEBOARD CONTRACT: never manufacture a prose `write` action from section content.
        // If a material has no authored visuals, captions/TTS still teach it while the board stays clean.
        const actions: VisualAction[] = real;
        // Nothing is deleted to show the next answer: this answer gets its own block below the earlier ones,
        // starting with the question/problem extracted from the PDF.
        const sectionProblem = String(section.teachingPass?.sourceText || section.sourceText || section.heading || '').trim();
        boardRef.current?.beginSection(sectionKey, { label: `Answer ${index + 1}`, heading: section.heading, problem: sectionProblem, replace: Boolean(opts?.repeatKey && index === startIndex) });
        sectionsRef.current.set(sectionKey, { material, index, runNo });
        if (!(opts?.repeatKey && index === startIndex)) latestSectionKeyRef.current = sectionKey;
        setTeachingSource(material, section);
        { const taughtMatch = sourceParagraphMatch(material, section); if (taughtMatch) taughtRef.current.add(taughtMatch.index); }
        // Commit the textbook-reference change before any narration starts.
        // React state updates are asynchronous; without yielding one frame the
        // voice could begin while the previous page was still on screen.
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        setTeachingProgress({ unit: index + 1, total: material.sections.length });
        const teachingPage = sourceParagraphPage(material, section);
        setState(`material · paragraph ${index + 1}/${material.sections.length} · page ${teachingPage ?? '—'} · source reading`);
        // SEPARATED TEACHING RUNTIME:
        // Source paragraph stays in the textbook reference pane.
        // Whiteboard contains only mathematical visual actions.
        // Captions and TTS are independent from the mathematical canvas.
        // Worked solution in the board template. When the problem is one the deterministic solver knows and can
        // verify (linear / quadratic / pair of equations / identities / surds / integer arithmetic) EVERY step and
        // the final check are computed here, not left to the model. Otherwise the lesson's own steps are used,
        // drawn in the very same template look.
        // Use the already-computed deterministic plan. If it was not available, retain
        // authored mathSteps as the next source of truth. Do not re-run the solver here.
        let plan = deterministicPlan;
        if (plan) pushLog(`Using verified ${plan.family} derivation on the teaching board`, 'ok');
        const planRows = plan ? new Map(plan.rows.map(r => [`tpl-${r.id}`, r])) : null;
        const mathSteps: MathTeachingStep[] = plan ? stepsFromSolution(plan) : (Array.isArray(section.mathSteps) ? section.mathSteps : []);
        if (plan) pushLog(`Worked solution (${plan.family}): ${plan.rows.length} rows, answer self-checked`, 'ok');
        const visualById = new Map(actions.map((action:any) => [String(action.id), action]));
        setActiveMathStep(null);
        setActiveCaption('');
        setActiveCaptionLanguage('english');

        // The board is a derivation column: only real mathematics is drawn on it, in order.
        // Narrative/preface "steps" (e.g. a label like "Dynamic GeoGebra Model") stay in the
        // caption panel + voice and never become fake solution lines.
        const boardableSteps = mathSteps.filter(st => isMathLike(st.before) || isMathLike(st.after));
        const lastBoardableStep = boardableSteps[boardableSteps.length - 1];
        const derivation = newDerivation(sectionKey);

        // V51.8.10 pedagogical bridge: explain the meaning of the variable and how the
        // words become the first equation BEFORE showing operations such as "Combine like terms".
        // This path is deterministic and therefore works even when the visual AI planner is unavailable.
        if (deterministicPlan || extractedEquations.length) {
          const introEquations = pair && pair.length >= 2 ? pair : extractedEquations;
          const introRows = buildEquationConceptIntro(problemText, introEquations);
          const introLang = material.teachingLanguage === 'malayalam' ? 'malayalam' as const : 'english' as const;
          for (let ii = 0; ii < introRows.length; ii++) {
            if (cancelled()) return;
            await waitIfPaused();
            if (cancelled()) return;
            const intro = introRows[ii];
            const boardText = intro.text.length <= 80 ? intro.text : (introLang === 'malayalam' ? intro.ml : intro.en);
            setActiveCaption(introLang === 'malayalam' ? intro.ml : intro.en);
            setActiveCaptionLanguage(introLang);
            pushLog(`Concept bridge ${ii + 1}/${introRows.length}: ${intro.en}`, 'info');
            await playTemplateRow(boardRef.current, derivation.key, {
              id: `concept-${ii + 1}`, kind: 'note', text: boardText,
              label: introLang === 'malayalam' ? intro.labelMl : intro.label,
              labelMl: intro.labelMl, ordinal: 0, captionEn: intro.en, captionMl: intro.ml,
            } as any, undefined, introLang);
            try { await speakText(introLang === 'malayalam' ? intro.ml : intro.en, introLang); }
            catch (e) { pushLog(`Concept narration failed: ${e instanceof Error ? e.message : String(e)}`, 'warn'); }
          }
        }

        // The selected template decides how this section is drawn on the single whiteboard.
        const sectionBoardMode = plan ? 'derivation' : boardModeFor(sectionStrategy);
        pushLog(`Whiteboard mode: ${boardModeLabel(sectionBoardMode)}`, 'info');

        if (material.type !== 'problems-formulae' && groundedPlan && Array.isArray(groundedPlan.steps) && groundedPlan.steps.length) {
          setState(`material · paragraph ${index + 1}/${material.sections.length} · video-grounded visual teaching`);
          setPipelineStage('General teaching visuals');
          pushLog(`Playing ${groundedPlan.steps.length} general-teaching Visual-DNA beat(s)`, 'ok');
          // Final browser-side layout guard. General-teaching text is deliberately rendered
          // as FLOW content (one row below the previous row), not as absolutely-positioned
          // diagram labels. This is important for Malayalam because model-estimated canvas
          // coordinates/widths routinely underestimate glyph width. Spatial nodes (shapes,
          // lines, arrows, graphs) remain on the 1000x700 figure.
          const normalizePlannerNodes = (rawNodes:any[]) => {
            const nodes=rawNodes.map((n:any)=>({ ...n }));
            const occupied:Array<{x:number;y:number;w:number;h:number}>=[];
            const isText=(n:any)=>['text','latex'].includes(String(n?.kind||''));
            const overlaps=(a:any,b:{x:number;y:number;w:number;h:number}) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
            for(const n of nodes){
              if(!isText(n)) continue;
              n.width=Math.max(260,Math.min(760,Number(n.width)||260));
              n.height=Math.max(58,Math.min(240,Number(n.height)||80));
              n.x=Math.max(24,Math.min(920-n.width,Number(n.x)||24));
              n.y=Math.max(28,Math.min(650,Number(n.y)||28));
              let guard=0;
              while(occupied.some(o=>overlaps(n,o)) && guard++<12){
                n.y+=Math.min(74,Math.max(54,n.height+12));
                if(n.y+n.height>676){ n.y=28; n.x=Math.min(920-n.width,n.x+Math.min(120,n.width*0.35)); }
              }
              occupied.push({x:n.x,y:n.y,w:n.width,h:n.height});
            }
            return nodes;
          };
          const normalizedNodes=normalizePlannerNodes(Array.isArray(groundedPlan.nodes)?groundedPlan.nodes:[]);
          const nodeMap = new Map(normalizedNodes.map((n:any)=>[String(n.id),n]));
          for (let gi=0; gi<groundedPlan.steps.length; gi++) {
            if (cancelled()) { pushLog(`RUN CANCELLED · before beat ${gi+1}/${groundedPlan.steps.length} · run token changed`, 'err'); return; }
            await waitIfPaused();
            if (cancelled()) { pushLog(`RUN CANCELLED · after pause at beat ${gi+1}/${groundedPlan.steps.length} · run token changed`, 'err'); return; }
            const gs:any=groundedPlan.steps[gi];
            const narration=String(gs.narration||'').trim();
            pushLog(`VIDEO BEAT ${gi+1}/${groundedPlan.steps.length} · ${(gs.visualIds||[]).length} visual id(s) · narration ${narration.length} chars`, 'info');
            setActiveCaption(narration);
            setActiveCaptionLanguage(material.teachingLanguage==='malayalam'?'malayalam':'english');
            for (const id of (gs.visualIds||[])) {
              const action=plannerNodeToAction(nodeMap.get(String(id)));
              if (!action) { pushLog(`RENDER skip · unsupported/missing node ${String(id)}`, 'warn'); continue; }
              pushLog(`RENDER ${String((action as any).type)} · ${String((action as any).id)}`, 'info');
              try { await boardRef.current?.reveal(action); pushLog(`RENDER ok · ${String((action as any).id)}`, 'ok'); }
              catch(e) { pushLog(`Grounded visual failed: ${e instanceof Error?e.message:String(e)}`,'warn'); }
            }
            if (narration) {
              try { await speakText(narration, material.teachingLanguage==='malayalam'?'malayalam':'english'); }
              catch(e) { pushLog(`Grounded narration failed: ${e instanceof Error?e.message:String(e)}`,'warn'); }
            }
          }
        } else if (mathSteps.length) {
          setState(`material · paragraph ${index + 1}/${material.sections.length} · visual math steps`);
          setPipelineStage(material.type === 'problems-formulae' ? 'Problems & Formulae practice' : 'General teaching fallback visuals');
          pushLog(`§${index + 1} ${mathSteps.length} ${material.type === 'problems-formulae' ? 'practice' : 'general-teaching fallback'} math step(s) — visual sequence`, 'info');

          for (let stepIndex=0; stepIndex<mathSteps.length; stepIndex++) {
            if (cancelled()) return;
            await waitIfPaused(); // # icon: the next step is not shown while paused
            if (cancelled()) return;
            skipRef.current = false;
            const step=mathSteps[stepIndex];
            setActiveMathStep(step);
            const useMalayalam = material.teachingLanguage === 'malayalam' && Boolean(step.captionMalayalam);
            // Captions are mandatory for every step in every template: fall back to the operation, then to "Step n".
            const caption = (useMalayalam ? String(step.captionMalayalam) : String(step.captionEnglish || step.operation || '')).trim() || `Step ${stepIndex + 1}`;
            const captionLang = useMalayalam ? 'malayalam' as const : 'english' as const;
            derivation.lang = captionLang;
            let rowsDrawn = 0; // rows (each with caption + icons) this step put on the board
            let playable: any[] = []; // picture actions drawn during the narration of this step
            setActiveCaption(caption);
            setActiveCaptionLanguage(useMalayalam ? 'malayalam' : 'english');
            setTeachingHistory(prev => {
              const key = `${material.id}:${index}:${step.id}`;
              const item = { key, paragraph: index + 1, heading: section.heading, step, captionEnglish: String(step.captionEnglish || step.operation), captionMalayalam: step.captionMalayalam, language: useMalayalam ? 'malayalam' as const : 'english' as const };
              const exists = prev.some(x => x.key === key);
              return exists ? prev.map(x => x.key === key ? item : x) : [...prev, item];
            });
            setState(`material · paragraph ${index + 1}/${material.sections.length} · step ${stepIndex + 1}/${mathSteps.length}`);
            pushLog(`§${index + 1} step ${stepIndex + 1}/${mathSteps.length}: ${step.before} → ${step.after}`, 'info');

            const stepVisuals=(step.visualIds||[]).map(id=>visualById.get(String(id))).filter(Boolean) as any[];
            // Board grammar = approved visual-derivation template (see lib/ai-guru/math/derivation-beat.ts):
            // starting line -> highlight -> one operation tag -> new line (pink pulse, then settles) -> answer in green.
            try {
              // Pre-authored NON-text visuals (shapes, lines, charts) still play; their text
              // twins are skipped because the derivation column already draws those lines.
              // 'visual' templates (geometry, graphs, statistics ...) play the authored visuals in
              // full, text labels included; the derivation column is only the fallback for a step
              // that has no authored visuals.
              if (plan) {
                const planRow = planRows?.get(step.id);
                if (planRow) { await playTemplateRow(boardRef.current, derivation.key, planRow, undefined, captionLang); rowsDrawn += 1; }
              }
              const visualTemplate = !plan && sectionBoardMode === 'visual' && stepVisuals.length > 0;
              // Flow text is drawn by the derivation column; positioned diagram labels (placement 'absolute') belong to
              // the figure and always play.
              const isFlowText = (a: any) => (a?.type === 'write' || a?.type === 'latex') && a?.placement !== 'absolute';
              playable = (plan ? [] : stepVisuals).filter((a: any) => visualTemplate || !isFlowText(a));
              // Timing contract: with narration, the picture is drawn WHILE the caption is spoken, fitted to its length.
              if (!caption || !playable.length) {
                for (const action of playable) {
                  try { await boardRef.current?.reveal(action); }
                  catch (e) { pushLog(`Step visual failed: ${e instanceof Error ? e.message : String(e)}`, 'warn'); }
                }
                playable = [];
              }
              if (!plan && !visualTemplate && (isMathLike(step.before) || isMathLike(step.after))) {
                rowsDrawn += await playDerivationStep(boardRef.current, derivation, {
                  before: step.before, after: step.after, operation: step.operation, isLast: step === lastBoardableStep,
                });
              }
              // Geometry / graph / visual templates, narrative steps, or a step that added no new line: it still gets
              // its own captioned row with the # √ ⟲ ^ icons - the controls are mandatory in every template.
              if (!rowsDrawn) {
                await playStepBar(boardRef.current, derivation.key, { id: step.id || `s${stepIndex}`, n: stepIndex + 1, caption, text: isMathLike(step.after) ? String(step.after) : undefined }, stepIndex, captionLang);
              }
            } catch (e) {
              pushLog(`Math visual beat failed: ${e instanceof Error ? e.message : String(e)}`, 'warn');
            }

            let picture: Promise<void> = Promise.resolve();
            if (playable.length) {
              const fitted = fitTiming(playable, Math.min(14000, Math.max(1500, estimateSpeechMs(caption, captionLang))));
              picture = (async () => {
                for (const action of fitted) {
                  if (cancelled()) return;
                  try { await boardRef.current?.reveal(action); }
                  catch (e) { pushLog(`Step visual failed: ${e instanceof Error ? e.message : String(e)}`, 'warn'); }
                }
              })();
            }
            if(caption) {
              pushLog(`§${index + 1} caption/audio: ${caption.slice(0,70)}${caption.length>70?'…':''}`,'info');
              try { await speakText(caption, useMalayalam ? 'malayalam' : 'english'); }
              catch(e) { pushLog(`Caption narration failed: ${e instanceof Error ? e.message : String(e)}`,'warn'); }
            }
            await picture; // never move on while the picture is still being drawn
            await new Promise<void>(r=>window.setTimeout(r,220));
          }
        } else {
          // V51.8.8: if no authored mathSteps survived generation, recover explicit
          // equations from the textbook passage and show them as real teaching rows.
          // Captions alone are not a teaching board, and generic shapes are not a solution.
          const recoveredEquations = extractPairEquationsFromWordProblem(sectionQuestion) ?? extractEquationCandidates(sectionQuestion);
          if (!plan && recoveredEquations.length) {
            const fallbackRows = recoveredEquations.slice(0, 4);
            pushLog(`Recovered ${fallbackRows.length} equation row(s) from textbook source for board fallback`, 'ok');
            const fallbackDerivation = newDerivation(sectionKey);
            for (let ri = 0; ri < fallbackRows.length; ri++) {
              if (cancelled()) return;
              const eq = fallbackRows[ri];
              await playDerivationStep(boardRef.current, fallbackDerivation, { before: ri ? fallbackRows[ri - 1] : '', after: eq, operation: ri === 0 ? 'Given' : `Equation ${ri + 1}`, isLast: ri === fallbackRows.length - 1 });
            }
          }
          // Legacy compatibility: keep ONLY meaningful diagram actions. A lone
          // generic rectangle is usually a planner/template placeholder, not a
          // mathematical explanation; never present it as the lesson visual.
          const meaningfulLegacyActions = actions.filter((a:any) => {
            if (a?.type !== 'shape') return true;
            const w = Number(a.width || 0), h = Number(a.height || 0);
            const semantic = String(a.label || a.role || '').trim();
            const looksPlaceholder = a.shape === 'rectangle' && !semantic && !a.targetId;
            return !looksPlaceholder && Boolean(semantic || a.placement === 'absolute') && w >= 40 && h >= 40;
          });
          setState(`material · paragraph ${index + 1}/${material.sections.length} · visual teaching`);
          pushLog(`§${index + 1} legacy material — visuals only on board; prose moved to caption`, 'info');
          for(const action of meaningfulLegacyActions) {
            // Legacy material is the most common source of text walls. Keep diagrams/shapes/charts,
            // but only allow text onto the board when it is mathematical or an explicitly positioned
            // short diagram label. Full explanations remain in activeCaption + TTS below.
            const a:any = action;
            const isText = a?.type === 'write' || a?.type === 'latex';
            const content = String(a?.content ?? a?.text ?? '').trim();
            const shortDiagramLabel = a?.placement === 'absolute' && content.length <= 48 && !/[.!?].+/.test(content);
            if (isText && !isMathLike(content) && !shortDiagramLabel) {
              pushLog(`Suppressed prose whiteboard action: ${content.slice(0,60)}${content.length>60?'…':''}`, 'info');
              continue;
            }
            try { await boardRef.current?.reveal(action); }
            catch(e) { pushLog(`Visual reveal failed: ${e instanceof Error ? e.message : String(e)}`,'warn'); }
          }
          const english=section.teachingPass?.englishExplanation || section.content || '';
          const translated=section.teachingPass?.translatedExplanation || section.contentTranslation || '';
          const useMalayalam=material.teachingLanguage==='malayalam' && Boolean(translated);
          const legacyLang=useMalayalam ? 'malayalam' as const : 'english' as const;
          // Older materials have no mathSteps: split the explanation into short steps so every step still gets a
          // caption and the # √ ⟲ ^ icons (mandatory in every template).
          const pieces=splitIntoSteps(useMalayalam ? translated : english);
          const captions=pieces.length ? pieces : [String(section.heading || 'Step 1')];
          for(let i=0;i<captions.length;i++) {
            if (cancelled()) return;
            await waitIfPaused();
            if (cancelled()) return;
            skipRef.current=false;
            const caption=captions[i];
            setActiveCaption(caption);
            setActiveCaptionLanguage(legacyLang);
            await playStepBar(boardRef.current, sectionKey, { id: `legacy-${i}`, n: i + 1, caption }, i, legacyLang);
            try { await speakText(caption,legacyLang); }
            catch(e) { pushLog(`Caption narration failed: ${e instanceof Error ? e.message : String(e)}`,'warn'); }
          }
        }
        pushLog(`§${index + 1} section complete — teaching history retained for scrolling`, 'ok');
        await new Promise<void>(r => window.setTimeout(r, 300));
        if (opts?.repeatKey && !opts.continueAfter) break; // R on an earlier answer replays just that answer
        } catch (sectionErr) {
          const msg = sectionErr instanceof Error ? sectionErr.message : String(sectionErr);
          pushLog(`§${index + 1} error (continuing to next): ${msg}`, 'err');
        }
      }
      if (cancelled()) return;
      if (opts?.repeatKey && !opts.continueAfter) { setState('answer repeated'); return; }
      setTeachingProgress({ unit: material.sections.length, total: material.sections.length });
      setState(`material · ${material.title} · section batch complete`);
      pushLog(`Teaching batch complete · ${material.title}`, 'ok');

      // Auto-continue: if this material only covered part of the lesson, move to the next paragraph.
      const lastSection = material.sections[material.sections.length - 1];
      const lastMatch = lastSection ? sourceParagraphMatch(material, lastSection) : undefined;
      // Strictly forward: after everything already taught in this run (never repeats a paragraph).
      const nextIdx = nextParagraphToTeach({ lastMatched: lastMatch?.index, fallbackCurrent: paragraphIndex, taught: taughtRef.current, total: lesson.paragraphs.length });
      if (nextIdx !== null) {
        setClassStatus('PLAYING'); setPipelineStage('Auto-continuing lesson');
        pushLog(`Continuing to next paragraph (${nextIdx + 1}/${lesson.paragraphs.length})…`, 'info');
        setParagraphIndex(nextIdx);
        await new Promise<void>(r => window.setTimeout(r, 600));
        // Prefer remaining sections of the same material if any match the next paragraph
        const nextStart = material.sections.findIndex((section: any) => sourceParagraphMatch(material, section)?.index === nextIdx);
        if (nextStart >= 0) {
          await playStudyMaterialFrom(material, nextStart, { runNo });
        } else {
          // Auto-teach the next lesson paragraph (BYOK / cache) without requiring another click.
          pushLog(`Auto-teaching lesson paragraph ${nextIdx + 1}…`, 'info');
          setState(`material · auto-continuing to paragraph ${nextIdx + 1}`);
          try {
            const nextPara = lesson.paragraphs[nextIdx];
            if (nextPara) {
              let nextMat = paragraphMaterialCache[nextPara.id];
              if (!nextMat && orderedUsableKeys().length) {
                const source: IndexedSource = toIndexedSource(nextPara as any, lesson.paragraphs as any);
                nextMat = await generateMaterial(lesson.id, 'whiteboard-notes', [source], material.teachingLanguage === 'malayalam' ? 'malayalam' : 'english', undefined, 'all', [], classDetail);
                setParagraphMaterialCache(prev => ({ ...prev, [nextPara.id]: nextMat! }));
              }
              if (nextMat?.sections?.length) {
                setSelectedMaterial(nextMat);
                await playStudyMaterialFrom(nextMat, 0, { runNo });
              } else {
                pushLog('Could not build teaching for next paragraph — press Play to retry.', 'warn');
              }
            }
          } catch (e) {
            pushLog(`Auto-continue failed: ${e instanceof Error ? e.message : String(e)}`, 'err');
          }
        }
      } else {
        // End-of-lesson is completion, not a stop. STOPPED is reserved for an explicit
        // user/navigation cancellation. This prevents a normal class ending from looking
        // like the student pressed Stop.
        setClassStatus('COMPLETED'); setPipelineStage('Complete');
        pushLog('Lesson completed normally — no user stop was requested.', 'ok');
      }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setClassStatus('ERROR'); setPipelineStage('Error');
        setState(`error · ${msg}`);
        pushLog(`Teaching stopped: ${msg}`, 'err');
      } finally {
        if (runIdRef.current === myRun) setBusy(false);
      }
  };

  /** The four icons after every step's caption: # pause · tick continue · R repeat · ^ move up / down. */
  const handleStepControl = (e: StepControlEvent) => {
    if (e.action === 'pause') { pauseTeaching(); return; }
    if (e.action === 'continue') { continueTeaching(); return; }
    if (e.action === 'up' || e.action === 'down') { boardRef.current?.moveStep(e.sectionKey, e.rowId, e.action); return; }
    if (e.action === 'repeat') {
      const info = sectionsRef.current.get(e.sectionKey);
      if (!info) return;
      // End whatever is running, then replay THIS answer in place from its first line. The other answers stay untouched.
      pausedRef.current = false;
      setPaused(false); setClassStatus('PLAYING');
      releasePauseWaiters();
      audioSettleRef.current?.();
      stopAudio();
      const isLatest = e.sectionKey === latestSectionKeyRef.current;
      void playStudyMaterialFrom(info.material, info.index, { repeatKey: e.sectionKey, continueAfter: isLatest, runNo: info.runNo });
    }
  };

  /** Resolve a material unit back to the EXACT indexed paragraph.  Page-only
   * matching is not sufficient because a page can contain many paragraphs.
   * The reference pane must follow the paragraph currently being taught, even
   * when the next unit starts on a different page. */
  // V51.9.116: a ready book clicked in the strip starts its class once its pages are in (from the first page)
  useEffect(() => { teachRef.current = teachParagraph; });
  useEffect(() => {
    if (!startBook || bookLoaded !== startBook) return;
    const t = setTimeout(() => { setStartBook(null); void teachRef.current?.(); }, 50);
    return () => clearTimeout(t);
  }, [bookLoaded, startBook]);
  const openReadyBook = (b: ReadyBook) => {
    if (b.id === openBookId && bookLoaded === b.id) { stop(); void teachRef.current?.(); return; }
    stop();
    if (wholeBook) toggleWholeBook();
    setBookLoaded(null);
    setStartBook(b.id);
    try { window.history.replaceState(null, '', `/ai-guru/classroom?materialDocument=${encodeURIComponent(b.id)}`); } catch { /* ignore */ }
    openBookRef.current?.(b.id);
  };
  const sourceParagraphMatch = (material: StudyMaterial, section: any) => {
    const ids = [
      ...(Array.isArray(section.sourceIds) ? section.sourceIds : []),
      ...(Array.isArray(section.teachingPass?.sourceIds) ? section.teachingPass.sourceIds : []),
    ].map(String);
    const sourceHit = material.sources.find(s => ids.includes(String(s.id)));
    const sourceText = String(section.teachingPass?.sourceText || section.sourceText || '').trim();
    const textHit = sourceText
      ? material.sources.find(s => String(s.text || '').trim() === sourceText)
      : undefined;
    const hit = sourceHit || textHit;
    if (!hit) return undefined;

    // Direct id -> exact text -> page-local number (see lib/ai-guru/lesson/paragraph-flow.ts).
    const index = paragraphIndexForSource(hit as any, lesson.paragraphs as any, sourceText);
    if (index === undefined) return undefined;
    return { index, page: Number(hit.page || 1) };
  };

  // When Classroom is opened from Material Studio, position the textbook reference
  // at the FIRST source paragraph of the selected material exactly once per material.
  // IMPORTANT: do not depend on paragraphIndex here. The previous implementation did,
  // so every manual page change (for example page 7) re-ran this effect and snapped
  // the textbook back to the first section (often page 1).
  const autoPositionedMaterialRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedMaterial) {
      autoPositionedMaterialRef.current = null;
      return;
    }
    if (showThreeB1B || referencePageOverride !== null || !lesson.paragraphs.length || !selectedMaterial.sections.length) return;
    if (autoPositionedMaterialRef.current === selectedMaterial.id) return;

    const firstSection = selectedMaterial.sections[0];
    const match = sourceParagraphMatch(selectedMaterial, firstSection);
    autoPositionedMaterialRef.current = selectedMaterial.id;
    if (match) {
      stopAudio();
      setReferencePageOverride(null);
      setParagraphIndex(match.index);
      setTeachingProgress({ unit: 0, total: selectedMaterial.sections.length });
      setState(`material ready · page ${match.page} · ${selectedMaterial.title}`);
    }
  }, [selectedMaterial?.id, lesson.paragraphs, showThreeB1B, referencePageOverride]);

  const sourceParagraphPage = (material: StudyMaterial, section: any): number | undefined =>
    sourceParagraphMatch(material, section)?.page;

  /** Move both the textbook reference image and the lesson cursor together.
   * This is deliberately paragraph-aware: when teaching crosses from page 82
   * to page 83, page 83 becomes visible before its new paragraph is spoken. */
  const setTeachingSource = (material: StudyMaterial, section: any) => {
    const match = sourceParagraphMatch(material, section);
    if (!match) return;
    stopAudio();
    setReferencePageOverride(null);
    setParagraphIndex(match.index);
  };

  const setParagraphPage = (page: number) => {
    const idx = lesson.paragraphs.findIndex(p => (p.source.pageNumber || 1) === page);
    if (idx >= 0) setParagraphIndex(idx);
  };

  const sourceLanguageForMaterial = (_material: StudyMaterial): 'english' | 'malayalam' => {
    // The current V43 voice runtime has English + Malayalam tracks. For other
    // source languages, the source is still displayed exactly and English is
    // used only as the safe speech fallback until that language voice is added.
    return _material.sources.some(s => /[\u0D00-\u0D7F]/.test(s.text)) ? 'malayalam' : 'english';
  };

  const stop = (reason = 'user/navigation stop') => {
    setShowThreeB1B(false);
    setClassStatus('STOPPED'); setPipelineStage('Stopped');
    pushLog(`■ Class stopped · ${reason} · run token ${runIdRef.current}→${runIdRef.current + 1}`, 'info');
    controller.stop();
    runIdRef.current += 1; // ends any teaching loop that is still running
    pausedRef.current = false;
    setPaused(false);
    releasePauseWaiters();
    audioSettleRef.current?.();
    stopAudio();
    // The board is NOT cleared here: everything already taught stays above, scrollable.
    setActiveMathStep(null);
    setActiveCaption('');
    setState('idle');
    setTeachingProgress({ unit: 0, total: 0 });
    setBusy(false);
  };

  const goToPage = async (raw: number) => {
    const maxPage = Math.max(pageCount, indexedDocumentMeta.pageCount || 0, 1);
    const page = Math.max(1, Math.min(maxPage, Math.floor(raw)));
    // ODL-style repair path: if the indexed document has no source on the exact
    // physical page, OCR that page from the stored PDF before falling back to the
    // nearest paragraph. This fixes the observed "page 7 has no extracted
    // paragraph" case without making the entire book depend on OCR.
    let target = lesson.paragraphs.findIndex(p => (p.source.pageNumber || 1) === page);
    if (target < 0) {
      const documentId = typeof window !== 'undefined' ? window.localStorage.getItem('ai-guru:material-document') : null;
      if (documentId) {
        try {
          setBusy(true);
          setState(`OCR repairing page ${page}…`);
          pushLog(`Page ${page} has no indexed passage — running targeted OCR repair.`, 'warn');
          const r = await fetch(`/api/ai-guru/material-studio/repair-page/${encodeURIComponent(documentId)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ page }) });
          const j = await r.json();
          if (r.ok && j.ok && j.document?.sources) {
            const sources: ParagraphSource[] = j.document.sources.map((source: any, i: number) => ({
              bookId: documentId, chapterIndex: 0, paragraphIndex: i, pageNumber: source.page, text: source.text, pageImage: '',
            }));
            const repairedLesson = createLessonDraft(sources, j.document.fileName);
            setLesson(repairedLesson);
            setChapters(Array.isArray(j.document.chapters) ? j.document.chapters : []);
            setIndexedDocumentMeta(m => ({ ...m, pageCount: Number(j.document.pageCount || m.pageCount), sourceCount: sources.length, chapterCount: Array.isArray(j.document.chapters) ? j.document.chapters.length : m.chapterCount }));
            target = repairedLesson.paragraphs.findIndex(p => (p.source.pageNumber || 1) === page);
            if (target >= 0) pushLog(`OCR recovered page ${page} (${j.sourceCount || 1} passage${Number(j.sourceCount) === 1 ? '' : 's'}).`, 'ok');
          } else {
            pushLog(`Targeted OCR could not recover page ${page}: ${String(j?.error || 'unknown error')}`, 'warn');
          }
        } catch (error) {
          pushLog(`Targeted OCR failed for page ${page}: ${error instanceof Error ? error.message : String(error)}`, 'warn');
        } finally { setBusy(false); }
      }
    }
    if (target < 0) {
      for (let i = lesson.paragraphs.length - 1; i >= 0; i--) {
        if ((lesson.paragraphs[i].source.pageNumber || 1) <= page) { target = i; break; }
      }
    }
    if (target < 0) target = 0;
    stop();
    if (target !== paragraphIndex) setParagraphIndex(target);
    setReferencePageOverride(page);
    setPageInput(String(page));
    setState(target >= 0 && (lesson.paragraphs[target]?.source.pageNumber || 1) === page ? `page ${page} · OCR recovered` : `page ${page}`);
  };

  const loadPdf = async (file: File) => {
    setBusy(true);
    try {
      const url = URL.createObjectURL(file);
      setPdfUrl(old => { if (old) URL.revokeObjectURL(old); return url; });
      const extracted = await extractCourseMaterial(file);
      const sources = extractedDocumentToSources(extracted, `book:${Date.now()}`);
      const draft = createLessonDraft(sources, file.name.replace(/\.[^.]+$/, ''));
      // A directly uploaded PDF becomes the sole classroom source. Never allow a
      // previously indexed Material Studio document/material to leak into this class.
      window.localStorage.removeItem('ai-guru:material-document');
      setSelectedMaterial(null);
      setMaterials([]);
      setChapters([]);
      setPageImageBase(undefined);
      setIndexedDocumentMeta({ subject: '', pageCount: Math.max(1, ...sources.map(s => s.pageNumber || 1)), sourceCount: sources.length, chapterCount: 0 });
      setLesson(draft);
      setParagraphMaterialCache({}); // see note above — a new book reuses the same index-based paragraph ids
      setParagraphIndex(0);
      setReferencePageOverride(null);
      boardRef.current?.reset();
      setPageInput('1');
      setState(`book loaded · ${Math.max(1, ...sources.map(s => s.pageNumber || 1))} pages · ${sources.length} paragraphs`);
    } catch (e) { setState(e instanceof Error ? e.message : 'Extraction failed'); }
    finally { setBusy(false); }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const j = await postJson('/api/ai-guru/generate-lesson', { source: paragraph.source, title: lesson.title, lessonId: lesson.id });
      setLesson(j.lesson);
      setParagraphMaterialCache({});
      setParagraphIndex(0);
      boardRef.current?.reset();
      setQa(`Generated. Math checks: ${j.mathChecks?.filter((x: any) => x.valid).length ?? 0}/${j.mathChecks?.length ?? 0}. Visual QA: ${j.pipeline?.visualQA?.status ?? 'pending'}.`);
      setState('lesson generated');
    } catch (e) { setState(e instanceof Error ? e.message : 'Generation failed'); }
    finally { setBusy(false); }
  };

  const runQA = async () => {
    setBusy(true);
    try {
      const j = await postJson('/api/ai-guru/qa', { lesson, paragraphId: paragraph.id });
      const board = document.querySelector('[data-ai-guru-visual-board]') as HTMLElement | null;
      const svg = board?.querySelector('svg');
      const renderedText = svg?.textContent ?? '';
      const expectedMalayalamVisual = language === 'മലയാളം' && visuals.some(v => v.type === 'write' && /[\u0D00-\u0D7F]/.test(v.content));
      const malayalamTextVisible = !expectedMalayalamVisual || /[\u0D00-\u0D7F]/.test(renderedText);
      const objectCount = svg?.querySelectorAll('text,path,line,circle,rect,polygon,polyline').length ?? 0;
      const renderedVisual = visuals.length === 0 ? 'No visual actions generated' : objectCount > 0 ? `Rendered visuals: ${objectCount} objects` : 'RENDERED VISUAL QA FAILED: whiteboard has no drawable objects';
      const malayalamCheck = expectedMalayalamVisual && !malayalamTextVisible ? 'MALAYALAM RENDER QA FAILED' : 'Malayalam visual path OK';
      const visual = j.visualQA?.status ? `Visual Step QA: ${j.visualQA.status}` : '';
      setQa([...j.items.map((x: any) => `${x.severity.toUpperCase()}: ${x.message}`), visual, renderedVisual, malayalamCheck].filter(Boolean).join(' • ') || 'QA passed');
    } catch (e) { setQa(e instanceof Error ? e.message : 'QA failed'); }
    finally { setBusy(false); }
  };

  const askDoubt = async () => {
    const question = window.prompt('Ask AI Guru about this paragraph:');
    if (!question?.trim()) return;
    setBusy(true);
    try { const j = await postJson('/api/ai-guru/doubt', { lesson, paragraphId: paragraph.id, question, language: language === 'മലയാളം' ? 'malayalam' : 'english' }); setQa(j.doubt?.answer ?? j.doubt?.explanation ?? 'Doubt answered.'); }
    catch (e) { setQa(e instanceof Error ? e.message : 'Doubt failed'); }
    finally { setBusy(false); }
  };

  const assess = async () => {
    setBusy(true);
    try { const j = await postJson('/api/ai-guru/assessment', { lesson, paragraphId: paragraph.id }); const items = j.assessment?.items ?? []; setQa(items.length ? `Assessment ready: ${items.length} question${items.length === 1 ? '' : 's'}.` : 'No assessment item generated.'); }
    catch (e) { setQa(e instanceof Error ? e.message : 'Assessment failed'); }
    finally { setBusy(false); }
  };

  const makeVoice = async () => {
    setBusy(true);
    try {
      const track: LanguageTrack = language === 'മലയാളം' ? 'malayalam' : 'english';
      await speakText(track === 'malayalam' ? paragraph.malayalam.text : paragraph.english.text, track);
      setQa('Voice requested: Edge TTS → Google Cloud TTS → configured fallback providers. Browser TTS is disabled.');
    } catch (e) { setQa(e instanceof Error ? e.message : 'Voice failed'); }
    finally { setBusy(false); }
  };

  if (!paragraph) return null;

  const materialIcons: Record<string, string> = {
    'whiteboard-notes': '▤', 'ppt-slides': '▣', 'mcq-quiz': '✓', 'flashcards': '◇',
    'worksheet': '▦', 'mind-map': '⌘', 'previous-year': '▥',
  };
  const materialLabels: Record<string, { title: string; subtitle: string }> = {
    'whiteboard-notes': { title: 'Smart Notes', subtitle: 'Summary' },
    'ppt-slides': { title: 'PPT Slides', subtitle: 'Class presentation' },
    'mcq-quiz': { title: 'MCQ Quiz', subtitle: 'Practice questions' },
    'flashcards': { title: 'Flashcards', subtitle: 'Key concepts' },
    'worksheet': { title: 'Worksheet', subtitle: 'Exercises' },
    'mind-map': { title: 'Mind Map', subtitle: 'Visual summary' },
    'previous-year': { title: 'Previous Year', subtitle: 'Questions' },
  };
  const fallbackMaterials = [
    { id: 'fallback-notes', type: 'whiteboard-notes', title: 'Smart Notes' },
    { id: 'fallback-ppt', type: 'ppt-slides', title: 'PPT Slides' },
    { id: 'fallback-mcq', type: 'mcq-quiz', title: 'MCQ Quiz' },
    { id: 'fallback-sheet', type: 'worksheet', title: 'Worksheet' },
    { id: 'fallback-flash', type: 'flashcards', title: 'Flashcards' },
  ];
  const indexEntries = chapters.length
    ? chapters.map((chapter, i) => ({ ...chapter, number: i + 1 }))
    : [{ id: 'current', title: chapterTitle || lesson.title, startPage: chapterStart, endPage: chapterEnd, number: chapterIndex + 1 }];

  const NavIcon = ({ children }: { children: ReactNode }) => <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] text-base text-white/75">{children}</span>;
  const ToolbarButton = ({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) => <button onClick={onClick} className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${active ? 'border-violet-400/60 bg-violet-500/20 text-white' : 'border-white/10 bg-white/[0.035] text-white/65 hover:bg-white/[0.08] hover:text-white'}`}>{children}</button>;

  // The selected template decides how the class is drawn on the single whiteboard.
  const boardMode = boardModeFor(teachingStrategy);

  return <main className="ai-guru-classroom min-h-screen bg-[#06101c] pb-44 text-white md:pb-32" style={{ fontFamily: 'Noto Sans, Chilanka, Noto Sans Malayalam, Nirmala UI, sans-serif' }}>
    {!embedded && <AiGuruTopNav activeLabel="RAG Classroom" />}
    <div className="flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_60%_10%,rgba(77,72,180,.12),transparent_35%),#06101c]">
      {/* V51.9.170: the classroom's second side menu is gone — 11 of its 12 tabs led nowhere and its panel showed
          made-up numbers (study time, model, sync). The main menu above has every page. */}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOP HEADER — V51.9.180 (UX review): only working controls. The sample profile ("Arjun · Class 9"), the
            notification badge, the search box and the second theme switch did nothing and are gone; the quiz and the
            reward counts sit here instead of floating over the lesson. */}
        {/* V51.9.181 (UX review item 6): one slim bar under the site menu — the page name and the class's own controls */}
        <header className="flex min-h-[52px] flex-wrap items-center gap-2 border-b border-white/10 bg-[#071526]/95 px-3 py-1.5 sm:gap-4 lg:px-6">
          <h1 className="hidden text-base font-semibold sm:block">Classroom</h1>
          <h1 className="sr-only sm:hidden">Classroom</h1>
          {myClass && <a href="/ai-guru/teacher-notes" className="min-w-0 max-w-[14rem] truncate rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-100" title="Your teacher's class" data-my-class>🏫 {myClass.name}{myClass.teacher ? ` · ${myClass.teacher}` : ''}</a>}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <label className="flex min-h-[40px] items-center gap-1 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-xs">
              <span className="sr-only">Teaching language</span><span aria-hidden>◉</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value as 'English' | 'മലയാളം')} className="bg-transparent py-2 text-xs text-white outline-none" data-ai-guru-language>
                <option value="English">English</option>
                <option value="മലയാളം">Malayalam</option>
              </select>
            </label>
            <ToffeeQuizDock grade={inferTextbookGrade(lesson)} language={language === 'മലയാളം' ? 'malayalam' : 'english'} />
          </div>
        </header>
        {/* V51.9.185: fee due / grace over */}
        {!embedded && <div className="px-2.5"><FeeBanner /></div>}
        {teachNote && (
          <section className="mx-2.5 mt-2.5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm text-amber-50" data-teach-note>
            <span className="text-2xl">📝</span>
            <span className="min-w-0 flex-1"><b>{teachNote.title}</b><span className="block text-xs text-amber-100/80">A note from {teachNote.from || 'your teacher'} · {Math.max(0, lesson.paragraphs.length - 1)} part{lesson.paragraphs.length === 2 ? '' : 's'} · the teacher reads and explains it on the whiteboard.</span></span>
            <button onClick={() => { setTeachNote({ ...teachNote, started: true }); void teachParagraph(); }} className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-extrabold text-[#1a1200]" data-teach-note-start>{teachNote.started ? '↻ Teach it again' : '▶ Start teaching'}</button>
            <a href="/ai-guru/messages" className="text-xs text-amber-100/70 underline">Back to messages</a>
          </section>
        )}

        {/* SUBJECT STRIP */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-white/10 bg-[#071526] px-3 py-2 lg:px-4">
          <button onClick={toggleWholeBook} aria-pressed={wholeBook} title="Open a whole textbook PDF and have it taught chapter by chapter, with reading order, questions, exports and 3D heading intros" className={`sticky left-0 z-10 shrink-0 rounded-lg px-4 py-2 text-xs font-extrabold ${wholeBook ? 'bg-cyan-400 text-[#04121f]' : 'border border-cyan-300/40 text-cyan-200 hover:bg-cyan-300/10'}`}>{wholeBook ? '← Back to the lesson' : '📚 Whole textbook'}</button>
          {/* V51.9.116: the subject list is gone; only the textbooks made ready to teach in the Material Studio are here. Click one to start its class. */}
          {readyBooks === null ? <span className="shrink-0 px-3 py-2 text-xs text-white/40">Looking for your ready textbooks…</span>
            : readyBooks.length === 0 && shelfMine ? <a href="/ai-guru/student/library?welcome=1" className="shrink-0 rounded-lg bg-emerald-400 px-4 py-2 text-xs font-extrabold text-[#04121f]" data-download-first>📥 Download your textbooks first — they appear here, click one to start the class</a>
            : readyBooks.length === 0 ? (openBookId && indexedDocumentMeta.sourceCount > 0
              // V51.9.180: a book of this browser's own (not in the shared list) is open — say so, not "nothing is ready"
              ? <><span className="flex max-w-[22rem] shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white" data-open-book><span aria-hidden>▶</span><span className="min-w-0"><span className="block truncate font-bold">{lesson.title}</span><span className="block truncate text-[10px] opacity-80">Open now · {indexedDocumentMeta.pageCount || pageCount} pages</span></span></span>
                <a href="/ai-guru/student/library" className="shrink-0 rounded-lg border border-dashed border-white/20 px-3 py-2 text-xs text-white/70 hover:text-white">📥 My Textbooks</a></>
              : myClass
                // V51.9.182 (re-check): a student in a class is not asked to upload books
                ? <span className="shrink-0 rounded-lg border border-dashed border-white/20 px-4 py-2 text-xs text-white/70" data-empty-shelf>Your school’s textbooks will appear here. Until then, try the sample lesson below.</span>
                : <a href="/ai-guru/student/library" className="shrink-0 rounded-lg border border-dashed border-white/20 px-4 py-2 text-xs text-white/70 hover:text-white">No textbook yet — download yours from My Textbooks →</a>)
            : readyBooks.map((b) => {
              const isOpen = b.id === openBookId;
              const loading = startBook === b.id;
              return <button key={b.id} onClick={() => openReadyBook(b)} aria-pressed={isOpen}
                title={`${b.title}${b.subject ? ` · ${b.subject}` : ''}${b.grade ? ` · Std ${b.grade}` : ''} · ${b.pageCount} pages · ${b.materials} study material${b.materials === 1 ? '' : 's'} — click to start the class`}
                className={`flex max-w-[22rem] shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium ${isOpen ? 'bg-violet-600 text-white shadow-[0_5px_18px_rgba(124,58,237,.22)]' : 'bg-white/[0.06] text-white/80 hover:bg-white/[0.1]'}`}>
                <span aria-hidden>{loading ? '⏳' : isOpen ? '▶' : '📘'}</span>
                <span className="min-w-0"><span className="block truncate font-bold">{b.title}</span><span className="block truncate text-[10px] opacity-70">{[b.subject, b.grade && `Std ${b.grade}`, `${b.pageCount}p`, `${b.materials} materials`].filter(Boolean).join(' · ')}</span></span>
              </button>;
            })}
          {shelfMine && !!readyBooks?.length && <a href="/ai-guru/student/library" className="shrink-0 rounded-lg border border-dashed border-emerald-300/40 px-3 py-2 text-xs text-emerald-200 hover:text-white" data-more-books>📥 More books</a>}
        </div>
        {materials.length > 0 && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/10 bg-[#081321] px-4 py-1.5 text-[10px] text-white/45">
          <span className="text-cyan-200">Created: {indexedDocumentMeta.subject || 'Current subject'}</span>
          <span>{indexedDocumentMeta.pageCount || pageCount} pages</span>
          <span>{indexedDocumentMeta.sourceCount || lesson.paragraphs.length} indexed paragraphs</span>
          <span>{indexedDocumentMeta.chapterCount || chapters.length} chapters</span>
          <span>{materials.length} study materials</span>
        </div>}

        {/* one classroom: the whole-textbook class (what used to be "Motion Class") opens here, in the same screen, with the same doubt pane, quiz and menu */}
        {wholeBook ? (<div className="min-h-0 flex-1 overflow-auto"><MotionClassroom embedded /></div>) : (<>
        {/* STUDY MATERIALS RAIL — V51.9.187: above the textbook page and the whiteboard, so every material of the book is in view */}
        <section className="mx-2.5 mt-2.5 rounded-xl border border-cyan-300/10 bg-[#091827]" data-materials-rail>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2"><div><span className="font-semibold text-sm">Study materials</span><span className="ml-2 text-[10px] text-white/50">Made from your textbook</span></div><span className="flex gap-3"><a href="/ai-guru/student/library" className="text-[10px] font-bold text-emerald-300 hover:text-white">📥 My books · download study materials</a><a href="/ai-guru/material-studio" className="text-[10px] text-cyan-300 hover:text-white">Open Material Studio →</a></span></div>
          <div className="flex gap-2 overflow-x-auto p-2">
            {selectedMaterial && selectedMaterial.type !== 'whiteboard-notes' && <button onClick={() => { stop(); setSelectedMaterial(null); }} className="flex min-w-[130px] items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-3 py-2.5 text-left text-emerald-100 hover:bg-emerald-300/15"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-lg">↩</span><span className="min-w-0"><span className="block truncate text-xs font-semibold">General Class</span><span className="block truncate text-[10px] text-emerald-200/60">Exit {materialLabels[String(selectedMaterial.type)]?.title || selectedMaterial.type} mode</span></span></button>}
            {(materials.length ? materials : fallbackMaterials).map((material: any) => {
              const type = String(material.type || 'whiteboard-notes');
              const label = materialLabels[type] || { title: material.title || type, subtitle: 'Study material' };
              const isReal = materials.some(m => m.id === material.id);
              if (material.locked) return <button key={material.id} onClick={() => setLockNotice(material.part || 2)} title="Opens when you are enrolled" className="group flex min-w-[150px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.015] px-3 py-2.5 text-left opacity-80 hover:border-amber-300/30"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-lg">🔒</span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-white/70">{material.title || label.title}</span><span className="block truncate text-[10px] text-amber-200/70">Part {material.part} · opens when enrolled</span></span></button>;
              return <button key={material.id} disabled={!isReal} onClick={() => isReal && void playMaterial(material)} className={`group flex min-w-[150px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selectedMaterial?.id === material.id ? 'border-cyan-300/60 bg-cyan-300/10' : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.06]'} ${!isReal ? 'opacity-75' : ''}`}><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-lg text-violet-300">{materialIcons[type] || '▣'}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-white/85">{material.title || label.title}</span><span className="block truncate text-[10px] text-white/35">{label.subtitle} · {material.sections?.length || 0} units{material.sources?.length ? ` · pp. ${Math.min(...material.sources.map((s:any) => s.page))}–${Math.max(...material.sources.map((s:any) => s.page))}` : ''}</span></span>{isReal && <span className="ml-auto text-[9px] text-emerald-300">QA {material.qa?.score ?? '—'}</span>}</button>;
            })}
            <a href="/ai-guru/student/library" className="flex min-w-[120px] items-center justify-center rounded-xl border border-dashed border-white/15 px-4 text-xs text-white/60 hover:text-white">More in My books →</a>
          </div>
        </section>
        {/* CLASSROOM WORKSPACE */}
        <div className={`grid min-h-0 flex-1 grid-cols-1 gap-2.5 overflow-auto p-2.5 md:grid-rows-1 ${refCollapsed ? 'md:grid-cols-[minmax(0,auto)_minmax(0,1fr)]' : 'md:grid-cols-2'}`}>
          {/* TEXTBOOK REFERENCE */}
          {/* V51.9.180 (UX review): on a phone the whiteboard comes first and the textbook page follows it */}
          <section className={`order-2 flex min-w-0 flex-col overflow-hidden rounded-xl border border-cyan-300/10 bg-[#0a1828] shadow-[0_12px_45px_rgba(0,0,0,.18)] md:order-none ${refCollapsed ? 'md:min-h-[560px]' : 'min-h-[420px] md:min-h-[560px]'}`} aria-label="Textbook page">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
              <div className="flex items-center gap-2 font-semibold"><button type="button" onClick={toggleRef} className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-white/80 hover:bg-white/20" title={refCollapsed ? 'Show the textbook page' : 'Hide the textbook page to give the boards more room'} aria-expanded={!refCollapsed}>{refCollapsed ? '▶ Show' : '◀ Hide'}</button>Textbook <span className="text-white/40">(Page {currentPage})</span></div>
              <div className={`flex items-center gap-1.5${refCollapsed ? ' hidden' : ''}`} data-ai-guru-page-jump>
                <ToolbarButton onClick={() => goToPage(currentPage - 1)}>‹</ToolbarButton>
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const raw = (e.currentTarget.elements.namedItem('pageJump') as HTMLInputElement)?.value;
                    const n = Number(raw);
                    if (Number.isFinite(n) && n >= 1) goToPage(n);
                  }}
                >
                  <input
                    name="pageJump"
                    type="number"
                    min={1}
                    max={Math.max(1, pageCount, indexedDocumentMeta.pageCount || 0)}
                    defaultValue={currentPage}
                    key={currentPage}
                    className="w-14 rounded-md border border-white/15 bg-black/30 px-1.5 py-1 text-center text-[11px] text-white outline-none focus:border-cyan-400/50"
                    aria-label="Go to page number"
                  />
                  <span className="text-[11px] text-white/40">/ {Math.max(pageCount, indexedDocumentMeta.pageCount || 0)}</span>
                  <button type="submit" className="rounded-md bg-cyan-500/90 px-2 py-1 text-[10px] font-semibold text-black hover:bg-cyan-400">Go</button>
                </form>
                <ToolbarButton onClick={() => goToPage(currentPage + 1)}>›</ToolbarButton>
              </div>
            </div>
            <div className={`min-h-0 flex-1 p-2${refCollapsed ? ' hidden' : ''}`}>
              <ReferencePanel source={referencePageOverride ? {...paragraph.source, pageNumber: referencePageOverride, boundingBox: undefined} : paragraph.source} pdfUrl={pdfUrl} pageImageBase={pageImageBase} />
            </div>
            <div className={`border-t border-white/10 bg-[#071321] px-3 py-2 text-xs text-white/45${refCollapsed ? ' hidden' : ''}`}>
              <div className="mb-1 flex items-center justify-between gap-2"><span>Teaching reference</span><span>Page {currentPage} / {Math.max(pageCount, indexedDocumentMeta.pageCount || 0)}</span></div>
              {teachingProgress.total > 0 && <div className="mb-2">
                <div className="flex items-center justify-between text-[9px] text-cyan-200/70"><span>Study progress</span><span>{teachingProgress.unit} / {teachingProgress.total} paragraphs</span></div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${(teachingProgress.unit / Math.max(1, teachingProgress.total)) * 100}%` }} /></div>
              </div>}
              <div className="line-clamp-2 text-white/65" style={{ fontFamily: 'Chilanka, Noto Sans Malayalam, Nirmala UI, sans-serif' }}>{paragraph.source.text}</div>
            </div>
            <div className={`flex gap-1.5 overflow-x-auto border-t border-white/10 p-2${refCollapsed ? ' hidden' : ''}`}>
              {lesson.paragraphs.slice(Math.max(0, paragraphIndex - 2), paragraphIndex + 4).map((p, i) => <button key={p.id} onClick={() => { stop(); setReferencePageOverride(null); setParagraphIndex(lesson.paragraphs.indexOf(p)); }} className={`h-12 min-w-[48px] rounded-lg border p-1 text-[9px] ${p.id === paragraph.id ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-white/10 bg-white/[0.03] text-white/40'}`}>{(lesson.paragraphs.indexOf(p) + 1)}<div className="mt-1 truncate">p.{p.source.pageNumber}</div></button>)}
            </div>
          </section>

          {/* WHITEBOARD */}
          <section ref={boardSectionRef} className="order-1 flex min-h-[560px] min-w-0 scroll-mt-2 flex-col overflow-hidden rounded-xl border border-cyan-300/10 bg-[#0a1828] shadow-[0_12px_45px_rgba(0,0,0,.18)] md:order-none" aria-label="Whiteboard" data-classroom-board>
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${classStatus === 'PLAYING' ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300' : classStatus === 'PAUSED' ? 'border-amber-400/50 bg-amber-500/15 text-amber-300' : classStatus === 'ERROR' ? 'border-red-400/50 bg-red-500/15 text-red-300' : classStatus === 'COMPLETED' ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200' : 'border-white/20 bg-white/5 text-white/70'}`} data-class-status={classStatus}>● {{ STOPPED: 'Not started', PLAYING: 'Class is on', PAUSED: 'Paused', COMPLETED: 'Finished', ERROR: 'Stopped — try again' }[classStatus]}</span>
                {teacherTools && <span className="hidden max-w-[260px] truncate text-[10px] text-white/45 lg:block">{pipelineStage || 'Ready'}</span>}
              </div>
              {/* V51.9.180 (UX review): the doubt button lives here, in the board's own bar — it used to float over the board's corner, under the camera/mic pane */}
              <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                <button onClick={askDoubt} disabled={busy} className="min-h-[36px] shrink-0 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-[0_6px_20px_rgba(59,130,246,.3)] hover:brightness-110 disabled:opacity-60" data-ask-doubt>✦ Ask AI a doubt</button>
              </div>
              {teacherTools && <div className="ml-2 hidden text-[10px] text-white/35 xl:block">{state.replaceAll('_', ' ') || 'Ready'}</div>}
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col bg-[#0b1017]">
              {showThreeB1B && threeB1BRun && (() => {
                const runSection = threeB1BRun.material.sections[threeB1BRun.index];
                if (!runSection) return null;
                const runMatch = sourceParagraphMatch(threeB1BRun.material, runSection);
                const teacherPage = buildTeacherReadingPage(lesson, runSection, runMatch?.index, runMatch?.page);
                const teacherPageJson = teacherPage ? JSON.stringify(teacherPage) : undefined;
                const nextIndex = threeB1BRun.index + 1;
                const handleBoardStatus = (status: 'planning' | 'ready' | 'playing' | 'completed' | 'error', detail?: string) => {
                    if (status === 'planning') { setClassStatus('PLAYING'); setPipelineStage('Teacher Reading · 3B1B planning'); }
                    else if (status === 'ready') { setClassStatus('PLAYING'); setPipelineStage('Teacher Reading · teacher ready'); }
                    else if (status === 'playing') { setClassStatus('PLAYING'); setPipelineStage(`Teacher Reading · section ${threeB1BRun.index + 1}/${threeB1BRun.material.sections.length}`); }
                    else if (status === 'completed') {
                      if (nextIndex < threeB1BRun.material.sections.length) {
                        const nextSection = threeB1BRun.material.sections[nextIndex];
                        const nextMatch = sourceParagraphMatch(threeB1BRun.material, nextSection);
                        if (nextMatch) {
                          setReferencePageOverride(null);
                          setParagraphIndex(nextMatch.index);
                          setTeachingProgress({ unit: nextIndex + 1, total: threeB1BRun.material.sections.length });
                          setTeachingSource(threeB1BRun.material, nextSection);
                        }
                        pushLog(`Teacher Reading advanced to section ${nextIndex + 1}/${threeB1BRun.material.sections.length} · same textbook flow`, 'ok');
                        runNonceRef.current += 1;
                        setThreeB1BRun({ material: threeB1BRun.material, index: nextIndex, nonce: runNonceRef.current });
                      } else {
                        setClassStatus('COMPLETED');
                        setPipelineStage('Complete');
                        setState('Teacher Reading completed normally');
                        pushLog('Teacher Reading completed normally — no user stop was requested.', 'ok');
                      }
                    } else if (status === 'error') {
                      // Keep board mounted; never call stop() — that was mis-logged as user close.
                      setClassStatus('ERROR'); setPipelineStage('Teacher Reading error');
                      if (detail) { pushLog(`Teacher Reading error: ${detail}`, 'err'); setState(detail.slice(0, 160)); }
                    }
                  };
                const passage = String(runSection.sourceText || runSection.content || '').trim();
                return <>
                {<MotionTeachingBoard
                  key={`m:${threeB1BRun.material.id}:${threeB1BRun.index}:${threeB1BRun.nonce}`}
                  passage={passage}
                  figuresBase={pageImageBase ? pageImageBase.replace('/page-image/', '/page-figures/') : undefined}
                  pages={[runMatch?.page ?? teacherPage?.pageNumber].filter((n): n is number => typeof n === 'number' && n > 0)}
                  heading={runSection.heading || undefined}
                  chapterTitle={chapterTitle || lesson.title}
                  grade={inferTextbookGrade(lesson)}
                  language={language === 'മലയാളം' ? 'malayalam' : 'english'}
                  passageMalayalam={runSection.contentTranslation || runSection.teachingPass?.translatedExplanation || ''}
                  materialId={threeB1BRun.material.id}
                  sectionId={runSection.id}
                  autoPlay
                  paused={paused}
                  bilingual
                  chapterIntro={threeB1BRun.index === 0 ? chapterIntroPlan(chapterTitle || lesson.title, threeB1BRun.material.sections.map((sec: any) => ({ heading: sec.heading || undefined, text: String(sec.sourceText || sec.content || '') }))) : null}
                  onPausedChange={(p) => { pausedRef.current = p; setPaused(p); setClassStatus(p ? 'PAUSED' : 'PLAYING'); setPipelineStage(p ? 'Paused' : 'Teacher Reading'); }}
                  onNotice={(message, level) => pushLog(message, level)}
                  onStatus={(status, detail) => handleBoardStatus(status, detail)}
                  onCue={(text, cueLanguage) => { setActiveCaption(text); setActiveCaptionLanguage(cueLanguage); }}
                  onClose={() => { setShowThreeB1B(false); setThreeB1BRun(null); if (classStatus === 'PLAYING' || classStatus === 'PAUSED') stop('Teacher Reading closed by user'); }}
                  onRegenerate={() => { setParagraphMaterialCache({}); runNonceRef.current += 1; setThreeB1BRun({ material: threeB1BRun.material, index: threeB1BRun.index, nonce: runNonceRef.current }); }}
                />}
                </>;
              })()}

              {/* The selected template decides how the class is drawn on this single board. */}
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 py-1.5 text-[10px]" data-ai-guru-reference-template data-board-mode={boardMode}>
                <span className={`min-w-0 truncate text-white/45${(showThreeB1B && boardEngine === 'motion') || !teacherTools ? ' hidden' : ''}`}>{pipelineStage} · Board: <b className="text-cyan-200/90">{showThreeB1B ? 'Chapter → Lesson → Beat Video-DNA' : boardModeLabel(boardMode)}</b>{showThreeB1B && <span className="ml-1 text-cyan-300/60">· textbook content, original visual construction</span>}</span>
                <span className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <span className="flex overflow-hidden rounded-md border border-white/15" title="General Class depth">
                    <button type="button" onClick={() => { setClassDetail('standard'); setParagraphMaterialCache({}); }} className={`px-2 py-1 text-[10px] ${classDetail === 'standard' ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/45'}`}>Standard</button>
                    <button type="button" onClick={() => { setClassDetail('detailed'); setParagraphMaterialCache({}); }} className={`px-2 py-1 text-[10px] ${classDetail === 'detailed' ? 'bg-violet-500/25 text-violet-200' : 'text-white/45'}`}>Detailed</button>
                  </span>
                  <button type="button" onClick={() => { stop(); boardRef.current?.reset(); sectionsRef.current.clear(); latestSectionKeyRef.current = ''; }} className="shrink-0 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-[10px] text-white/55 hover:text-white" title="Erase every answer on the board">Clear board</button>
                  <button type="button" onClick={() => setShowLessonIndex((v) => !v)} className="shrink-0 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-500/20" aria-pressed={showLessonIndex}>{showLessonIndex ? 'Close contents' : 'Contents'}</button>
                  {teacherTools && <button type="button" onClick={() => setShowTeachingLog(v => !v)} className="shrink-0 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200 hover:bg-cyan-500/20">{showTeachingLog ? 'Hide log' : 'Teaching log'}</button>}
                  <button type="button" onClick={() => { if (teacherTools) setShowTeachingLog(false); toggleTeacherTools(); }} aria-pressed={teacherTools} className={`shrink-0 rounded-md border px-2 py-1 text-[10px] ${teacherTools ? 'border-amber-300/50 bg-amber-300/15 text-amber-100' : 'border-white/15 text-white/50 hover:text-white'}`} title="Show the engine status, the teaching log and the QA check" data-teacher-tools>Teacher tools</button>
                </span>
              </div>
              <div className={`flex shrink-0 flex-wrap items-center gap-x-4 gap-y-0.5 border-b border-white/5 px-3 py-1 text-[10px] font-semibold text-white/40${(showThreeB1B && boardEngine === 'motion') ? ' hidden' : ''}`} data-ai-guru-step-legend>
                <span><b className="text-[#e0523d]">#</b> pause</span><span><b className="text-[#2e9e5b]">√</b> continue</span><span><b className="text-[#a04fc7]">⟲</b> start again</span><span><b className="text-[#3b82f6]">^</b> move up / down <span className="font-normal text-white/60">(Shift-click or long-press = down)</span></span>
              </div>
              <div className={`relative min-h-0 ${(showThreeB1B && boardEngine === 'motion') && !showTeachingLog ? 'h-14 flex-none' : 'flex-1'}`} data-ai-guru-teaching-scroll>
                <div className="absolute inset-0"><MathLikeAnimBoard ref={boardRef} items={visuals} onControl={handleStepControl} /></div>
              {showTeachingLog && <div className="absolute bottom-3 left-3 right-3 top-3 z-30 flex flex-col overflow-hidden rounded-xl border border-cyan-400/25 bg-[#030912]/95 shadow-2xl backdrop-blur" data-ai-guru-pipeline-log>
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <div><b className="text-xs text-cyan-200">Teaching Pipeline Log</b><span className="ml-2 text-[10px] text-white/40">{classStatus} · {pipelineStage}</span></div>
                  <div className="flex gap-1">
                    <button onClick={() => navigator.clipboard?.writeText(teachingLog.map(x => `${new Date(x.t).toLocaleTimeString()} [${x.level.toUpperCase()}] ${x.msg}`).join('\n'))} className="rounded border border-white/15 px-2 py-1 text-[10px] text-white/65">Copy</button>
                    <button onClick={() => { const text = teachingLog.map(x => `${new Date(x.t).toISOString()} [${x.level.toUpperCase()}] ${x.msg}`).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=`ai-guru-teaching-log-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(a.href); }} className="rounded border border-white/15 px-2 py-1 text-[10px] text-white/65">Download</button>
                    <button onClick={() => setTeachingLog([])} className="rounded border border-white/15 px-2 py-1 text-[10px] text-white/65">Clear</button>
                    <button onClick={() => setShowTeachingLog(false)} className="rounded border border-red-400/20 px-2 py-1 text-[10px] text-red-200">Close</button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-5">
                  {teachingLog.length === 0 ? <div className="text-white/35">No events yet. Press Play to trace PDF → RAG → video grounding → planner → renderer → TTS.</div> : teachingLog.map((x,i) => <div key={`${x.t}-${i}`} className={x.level==='err'?'text-red-300':x.level==='warn'?'text-amber-300':x.level==='ok'?'text-emerald-300':'text-slate-300'}><span className="mr-2 text-white/30">{new Date(x.t).toLocaleTimeString()}</span>{x.msg}</div>)}
                </div>
              </div>}
              {activeCaption && !(showThreeB1B && boardEngine === 'motion') && <div className="pointer-events-none absolute left-5 top-5 z-40 w-[min(460px,52%)] rounded-xl border border-cyan-300/25 bg-[#02070d]/88 px-4 py-2.5 text-[14px] leading-6 text-cyan-50 shadow-2xl backdrop-blur" style={{ fontFamily: activeCaptionLanguage === 'malayalam' ? 'Noto Sans Malayalam, Nirmala UI, Chilanka, sans-serif' : 'inherit' }} lang={activeCaptionLanguage === 'malayalam' ? 'ml' : 'en'} data-ai-guru-live-caption>
                <div className="mb-0.5 text-[8px] font-bold uppercase tracking-widest text-cyan-300/60">{activeCaptionLanguage === 'malayalam' ? 'Malayalam explanation' : 'Teacher explanation'}</div>
                {activeCaption}
              </div>}
              </div>
              <div className={`shrink-0 border-t border-white/10 bg-[#071018] px-4 py-2 text-[12px] leading-5 text-cyan-50/90${(showThreeB1B && boardEngine === 'motion') ? ' hidden' : ''}`} style={{ fontFamily: 'Chilanka, Noto Sans Malayalam, Nirmala UI, sans-serif' }} aria-live="polite" data-ai-guru-caption>
                {paused && <div className="mb-0.5 text-[11px] font-semibold text-amber-300">⏸ Paused — press √ to show the next step</div>}
                {activeCaption || activeMathStep?.captionEnglish || <span className="text-white/50">Press Start class. The lesson is drawn on this board, from the textbook page beside it.</span>}
              </div>
            </div>
            <div className={`flex items-center justify-between border-t border-white/10 bg-[#071321] px-3 py-2 text-[11px] text-white/45${(showThreeB1B && boardEngine === 'motion') ? ' hidden' : ''}`}>
              <span>Teaching language: <b className="text-white/70">{language}</b></span><span>{speaking ? '● Speaking' : '● Ready'} · {selectedMaterial?.title || 'Current lesson'}</span>
            </div>
          </section>

          {/* FAR-RIGHT INDEX BOARD — collapsible */}
          {/* V51.9.141: ends above the control dock, and closes from its top bar (✕), with Esc, or with the Index button */}
          {showLessonIndex && <aside className="fixed bottom-32 right-3 top-24 z-40 flex w-[300px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-cyan-300/25 bg-[#0a1828] shadow-[0_18px_60px_rgba(0,0,0,.55)]" data-lesson-index>
            {(
              <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex border-b border-white/10">
              <h2 className="flex-1 bg-violet-600/90 px-3 py-3 text-xs font-semibold text-white">Contents</h2>
              <button type="button" onClick={() => setShowLessonIndex(false)} className="shrink-0 border-l border-white/10 px-3 text-base font-bold text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close the contents" title="Close (Esc)" data-close-index>✕</button>
            </div>
            <div className="border-b border-white/10 p-3">
              <div className="text-[10px] uppercase tracking-[.18em] text-white/35">{selectedMaterial ? 'Created Material' : `Chapter ${chapterIndex + 1}`}</div>
              <h2 className="mt-1 text-sm font-semibold leading-5">{selectedMaterial?.title || chapterTitle || lesson.title}</h2>
              {selectedMaterial && <div className="mt-1 text-[10px] text-cyan-200/70">{materialLabels[String(selectedMaterial.type)]?.title || selectedMaterial.type} · {selectedMaterial.sections.length} units · {selectedMaterial.sources.length ? `${Math.min(...selectedMaterial.sources.map(s => s.page))}–${Math.max(...selectedMaterial.sources.map(s => s.page))} pages` : 'source pages pending'}</div>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {selectedMaterial ? <div className="space-y-1">
                {selectedMaterial.sections.map((section, i) => {
                  const match = sourceParagraphMatch(selectedMaterial, section);
                  const active = match?.index === paragraphIndex;
                  return <button key={section.id} onClick={() => { stop(); if (match) setParagraphIndex(match.index); setSelectedMaterial(selectedMaterial); }} className={`w-full rounded-lg border px-2 py-2 text-left ${active ? 'border-violet-400/40 bg-violet-500/15 text-white' : 'border-transparent bg-white/[0.02] text-white/55 hover:bg-white/[0.05]'}`}>
                    <div className="flex items-start gap-2"><span className="text-cyan-300">○</span><span className="min-w-0 flex-1 text-[11px] font-medium">{i + 1}. {section.heading}</span><span className="text-[9px] text-white/30">p.{match?.page ?? '—'}</span></div>
                    {(section.teachingPass?.sourceText || section.sourceText) && <div className="mt-1 ml-4 line-clamp-2 text-[9px] text-white/35">{section.teachingPass?.sourceText || section.sourceText}</div>}
                  </button>;
                })}
              </div> : indexEntries.map(ch => <div key={ch.id} className="mb-1">
                <button onClick={() => goToPage(ch.startPage)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${ch.id === realChapter?.id || (indexEntries.length === 1 && ch.id === 'current') ? 'bg-violet-500/15 text-white' : 'text-white/55 hover:bg-white/[0.05]'}`}><span className="text-cyan-300">○</span><span className="min-w-0 flex-1 truncate">{ch.number}. {ch.title}</span><span className="text-[9px] text-white/25">›</span></button>
                {(ch.id === realChapter?.id || indexEntries.length === 1) && <div className="ml-5 border-l border-white/10 pl-2">
                  {lesson.paragraphs.slice(Math.max(0, paragraphIndex - 1), paragraphIndex + 6).map((p, j) => <button key={p.id} onClick={() => { stop(); setReferencePageOverride(null); setParagraphIndex(lesson.paragraphs.indexOf(p)); }} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] ${p.id === paragraph.id ? 'bg-blue-500/15 text-blue-300' : 'text-white/40 hover:text-white/75'}`}><span>○</span><span className="truncate">{j + 1}. {p.source.text}</span></button>)}
                </div>}
              </div>)}
            </div>
            <div className="border-t border-white/10 p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] text-white/40"><span>Lesson progress</span><span>{paragraphIndex + 1} / {lesson.paragraphs.length}</span></div>
              <div className="h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-500" style={{ width: `${((paragraphIndex + 1) / Math.max(1, lesson.paragraphs.length)) * 100}%` }} /></div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-white/30"><span>Page {currentPage}</span><span>{chapterTitle || `Chapter ${chapterIndex + 1}`}</span></div>
            </div>
            <button type="button" onClick={() => setShowLessonIndex(false)} className="border-t border-white/10 px-3 py-2 text-[10px] text-cyan-300 hover:text-white">Close contents</button>
          </div>
            )}
          </aside>}
        </div>

        {/* V51.9.96: colourful pictures (drawings, molecules, simulations, maps) for the paragraph being taught */}
        {!currentLockedPart && <ClassroomVisuals text={`${chapterTitle || ''} ${paragraph?.source?.text || ''}`} subject={indexedDocumentMeta?.subject} malayalam={language === 'മലയാളം'} />}

        {/* V51.9.93: a locked part (Part 1 is the free trial) */}
        {(lockNotice || currentLockedPart) ? (() => { const n = lockNotice || currentLockedPart; const part = bookParts.find((x) => x.index === n); const free = bookAccess?.freeParts ?? [1]; const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`; const pay = bookAccess?.due ? inr(bookAccess.due) : bookAccess?.monthly ? `${inr(bookAccess.monthly)} a month, or ${inr(bookAccess.yearly ?? 0)} a year${bookAccess.yearlyReductionPct ? ` (${bookAccess.yearlyReductionPct}% off)` : ''},` : bookAccess?.fee ? inr(bookAccess.fee) : ''; return (
          <section role="status" className="mx-2.5 mb-2.5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
            <span className="text-2xl">🔒</span>
            <span className="min-w-0 flex-1"><b>Part {n}{part ? ` (pages ${part.startPage}–${part.endPage})` : ''} {bookAccess?.why === 'lapsed' ? 'is locked: your grace period is over, please make payment to continue.' : (bookAccess as { partPrice?: number } | null)?.partPrice ? 'opens when you pay for it.' : 'opens when you are enrolled.'}</b><span className="block text-xs text-amber-100/80">{free.length ? `${free.length > 1 ? 'Parts' : 'Part'} ${free.join(', ')} ${free.length > 1 ? 'are' : 'is'} open for you: textbook, whiteboard notes, MCQ and revision.` /* V51.9.195 */ : ''} {bookAccess?.signedIn ? ((bookAccess as { partPrice?: number }).partPrice ? `Pay ${pay || 'the part fee'} by UPI from “My account”, or at the school office${bookAccess.studentCode ? ` with your Student ID ${bookAccess.studentCode}` : ''}: the next part opens in every book at once (or pay for all parts together and save).` /* V51.9.194: fees are paid by part */ : `Pay ${pay || 'the fee'} by UPI from “My account”, or at the school office${bookAccess.studentCode ? ` with your Student ID ${bookAccess.studentCode}` : ''}, to open all five parts.`) : 'Sign up or sign in to enrol.'}</span><span className="block text-xs text-amber-100/70">ഈ ഭാഗം ഫീസ് അടച്ചാൽ തുറക്കും. {free.length ? `ഭാഗം ${free.join(', ')} സൗജന്യം.` : ''}</span></span>
            <a href={bookAccess?.signedIn ? '/ai-guru/student#pay' : '/ai-guru/student/signup'} className="rounded-lg bg-amber-300 px-3 py-2 text-xs font-extrabold text-[#1a1200]" data-lock-pay>{bookAccess?.signedIn ? '💳 Pay by UPI' : 'Sign up free'}</a>
            {!bookAccess?.signedIn && <a href="/ai-guru/student" className="rounded-lg border border-amber-200/40 px-3 py-2 text-xs font-bold">Sign in</a>}
            {lockNotice && !currentLockedPart && <button onClick={() => setLockNotice(null)} className="text-xs text-amber-100/70 underline">Close</button>}
          </section>); })() : null}

        </>)}

        {/* SESSION / PLAYER CONTROL */}
        <footer className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-[#061321] px-4 py-2.5 lg:px-6">
          <div className="min-w-[200px] flex-1"><div className="text-[10px] text-white/35">CURRENT LESSON</div><div className="mt-0.5 truncate text-xs font-semibold">{lesson.title}</div><div className="text-[10px] text-white/35">{paragraph.source.text.slice(0, 75)}{paragraph.source.text.length > 75 ? '…' : ''}</div></div>
          <div className="hidden w-56 md:block"><div className="flex justify-between text-[10px] text-white/35"><span>Lesson Progress</span><span>{Math.round(((paragraphIndex + 1) / Math.max(1, lesson.paragraphs.length)) * 100)}%</span></div><div className="mt-1.5 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-500" style={{ width: `${((paragraphIndex + 1) / Math.max(1, lesson.paragraphs.length)) * 100}%` }} /></div></div>
          <div className="flex items-center gap-1.5"><button onClick={() => { stop(); setParagraphIndex(i => Math.max(0, i - 1)); }} className="rounded-full p-2 text-white/60 hover:bg-white/10">|◀</button><button disabled={busy} data-ai-guru-teach onClick={() => void teachParagraph()} className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-lg shadow-[0_0_25px_rgba(124,58,237,.35)] disabled:opacity-50">▶</button><button onClick={() => { stop(); setParagraphIndex(i => Math.min(lesson.paragraphs.length - 1, i + 1)); }} className="rounded-full p-2 text-white/60 hover:bg-white/10">▶|</button></div>
          <div className="flex items-center gap-1.5"><ToolbarButton onClick={() => setLanguage('English')} active={language === 'English'}>EN</ToolbarButton><ToolbarButton onClick={() => setLanguage('മലയാളം')} active={language === 'മലയാളം'}>ML</ToolbarButton><ToolbarButton onClick={stop}>■</ToolbarButton></div>
          <div className="hidden items-center gap-2 text-[10px] lg:flex"><button onClick={() => void makeVoice()} className="rounded-lg border border-white/10 px-2.5 py-2 text-white/60 hover:text-white">🔊 Voice</button></div>
          {teacherTools && <div className="flex items-center gap-1"><label className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2 text-[10px] text-white/55 hover:text-white">Import PDF<input type="file" accept="application/pdf,.docx,.pptx" className="hidden" onChange={e => e.target.files?.[0] && loadPdf(e.target.files[0])} /></label><button disabled={busy} onClick={generate} className="rounded-lg bg-cyan-300 px-2.5 py-2 text-[10px] font-semibold text-black disabled:opacity-50">Generate</button>{teacherTools && <button disabled={busy} onClick={runQA} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2 text-[10px] text-white/55">QA check</button>}</div>}
        </footer>
        {qa && teacherTools && <div className="mx-2.5 mb-2.5 max-h-20 overflow-auto rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[10px] text-white/55">{qa}</div>}
      </div>
    </div>
    {/* V51.9.171: the main Play button, floating beside the camera / mic pane (the footer one stays too) */}
    <PlayFab state={classStatus} busy={busy} lessonTitle={lesson.title} onStart={() => void teachParagraph()} onPause={pauseTeaching} onContinue={continueTeaching} />
    <ClassroomDoubtDock grade={inferTextbookGrade(lesson)} language={language === 'മലയാളം' ? 'malayalam' : 'english'} />
    <AttendanceBeacon />
    {!embedded && <KeyNudge />}
    <TeacherQuizDock />
  </main>;
}
