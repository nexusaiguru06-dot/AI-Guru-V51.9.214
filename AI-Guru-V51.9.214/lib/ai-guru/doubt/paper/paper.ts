/**
 * V51.9.98 — "Show your paper": a student holds a written page (their notes, homework,
 * a question paper, a printed sheet) in front of the camera and asks about it.
 *
 * Two AI steps, both through the student's Gemini key (or the on-device model offline):
 *   1. READ — the photo(s) → the page written out line by line, numbered, exactly as written
 *      (mistakes kept: we must be able to point at them). The student sees this and can fix
 *      any line we misread before asking. Bad photos (blurry, dark, cut off) are reported.
 *   2. ASK — every question is answered from the photo + the confirmed lines, naming the line
 *      numbers it talks about, pointing out mistakes on the paper, with two follow-up ideas.
 *
 * This file is pure (prompts, parsing, wording), so it is tested without a browser.
 */

export type PaperLang = 'english' | 'malayalam';

export type LineKind = 'heading' | 'text' | 'math' | 'diagram' | 'table';

export interface PaperLine {
  /** 1-based, across all pages. */
  n: number;
  page: number;
  text: string;
  kind: LineKind;
  /** The reader was not sure of a word in this line. */
  unclear?: boolean;
  /** The student corrected this line. */
  edited?: boolean;
}

export type PaperQuality = 'good' | 'blurry' | 'dark' | 'cut' | 'not-paper' | 'empty';

export interface PaperReading {
  quality: PaperQuality;
  subject: string;
  /** Language(s) the page is written in, e.g. "english", "malayalam", "mixed". */
  language: string;
  title: string;
  /** One line: what this page is. */
  summary: string;
  lines: PaperLine[];
  diagrams: string[];
  pages: number;
}

export interface PaperMistake {
  line: number;
  wrote: string;
  correct: string;
  why: string;
}

export interface PaperAnswer {
  answer: string;
  /** Paper lines the answer talks about. */
  lines: number[];
  mistakes: PaperMistake[];
  /** Two short follow-up questions the student might ask next. */
  next: string[];
}

export interface PaperTurn {
  role: 'student' | 'guru';
  text: string;
  answer?: PaperAnswer;
}

const SUBJECTS = ['maths', 'physics', 'chemistry', 'biology', 'science', 'social science', 'history', 'geography', 'economics', 'english', 'malayalam', 'hindi', 'computer', 'other'];
const KINDS: LineKind[] = ['heading', 'text', 'math', 'diagram', 'table'];
const QUALITIES: PaperQuality[] = ['good', 'blurry', 'dark', 'cut', 'not-paper', 'empty'];

/* ---------------- step 1: reading the page ---------------- */

export function readingSystemPrompt(pages: number): string {
  return `You read photos of a school student's paper for AI Guru, an Indian classroom app. The paper may be handwritten notes, homework, a worksheet, a question paper or a printed page, in English, Malayalam or both, in any subject.
Write out what is on the paper EXACTLY as written, line by line, top to bottom${pages > 1 ? `, page 1 first (there are ${pages} photos, one per page)` : ''}.
- Copy, do not correct. Keep the student's spelling mistakes, wrong numbers and wrong steps as they are — a teacher will point at them later.
- Malayalam stays in Malayalam script. Never translate or transliterate.
- Write mathematics in plain Unicode: x², √(b² − 4ac), ½, ×, ÷, ≤, π, θ, H₂O, fractions as (a)/(b) when written stacked. One equation or step per line.
- A word you cannot read: write [?] in its place and mark the line unclear. Never guess a whole line.
- A drawing (diagram, graph, figure, table outline): one line of kind "diagram" saying what it shows and its labels, e.g. "Diagram: right triangle ABC, right angle at B, AB = 3 cm, BC = 4 cm".
- Ignore the background, hands, fingers, desk and anything outside the paper.
Answer ONLY with JSON:
{"quality":"good|blurry|dark|cut|not-paper|empty","subject":"${SUBJECTS.join('|')}","language":"english|malayalam|mixed|other","title":"the page's heading or topic, or empty","summary":"one short line: what this page is","lines":[{"page":1,"text":"...","kind":"heading|text|math|diagram|table","unclear":false}]}
quality: "blurry" if much of the writing is hard to read, "dark" if too dark, "cut" if part of the writing runs off the photo, "not-paper" if there is no written paper, "empty" if the paper is blank.`;
}

export const READING_USER = 'Read this paper.';

/** Pulls the first JSON object out of a model reply (fences, prose around it, trailing commas). */
export function jsonFrom(raw: string): unknown {
  const s = String(raw ?? '').replace(/^﻿/, '');
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : s;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  const chunk = body.slice(a, b + 1);
  for (const candidate of [chunk, chunk.replace(/,\s*([}\]])/g, '$1')]) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next repair */
    }
  }
  return null;
}

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/\s+$/g, '').slice(0, max);

/** Model reply → a clean PaperReading (never throws; a reply that is not JSON becomes plain lines). */
export function parseReading(raw: string, pages = 1): PaperReading {
  const j = jsonFrom(raw) as Record<string, unknown> | null;
  if (!j) {
    const lines = String(raw ?? '').split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, 300);
    return { quality: lines.length ? 'good' : 'empty', subject: 'other', language: 'other', title: '', summary: '', diagrams: [], pages, lines: lines.map((text, i) => ({ n: i + 1, page: 1, text, kind: 'text' as const, ...(text.includes('[?]') ? { unclear: true } : {}) })) };
  }
  const rawLines = Array.isArray(j.lines) ? j.lines : [];
  const lines: PaperLine[] = [];
  for (const l of rawLines.slice(0, 400)) {
    const o = (typeof l === 'string' ? { text: l } : l) as Record<string, unknown>;
    const text = str(o?.text, 600).trim();
    if (!text) continue;
    const kind = KINDS.includes(o.kind as LineKind) ? (o.kind as LineKind) : /^(diagram|figure|graph|drawing)\b/i.test(text) ? 'diagram' : 'text';
    const page = Math.min(pages, Math.max(1, Math.round(Number(o.page) || 1)));
    lines.push({ n: lines.length + 1, page, text, kind, ...(o.unclear === true || text.includes('[?]') ? { unclear: true } : {}) });
  }
  const quality = QUALITIES.includes(j.quality as PaperQuality) ? (j.quality as PaperQuality) : lines.length ? 'good' : 'empty';
  const subject = SUBJECTS.includes(String(j.subject).toLowerCase()) ? String(j.subject).toLowerCase() : 'other';
  return {
    quality: !lines.length && quality === 'good' ? 'empty' : quality,
    subject,
    language: str(j.language, 30).toLowerCase() || 'other',
    title: str(j.title, 160).trim(),
    summary: str(j.summary, 300).trim(),
    lines,
    diagrams: lines.filter((l) => l.kind === 'diagram').map((l) => l.text),
    pages,
  };
}

/** The student fixes a misread line (empty text removes it). Line numbers are kept in order. */
export function editLine(r: PaperReading, n: number, text: string): PaperReading {
  const t = text.trim();
  const lines = r.lines
    .flatMap((l) => (l.n !== n ? [l] : t ? [{ ...l, text: t.slice(0, 600), edited: l.text !== t ? true : l.edited, unclear: l.text !== t ? false : l.unclear }] : []))
    .map((l, i) => ({ ...l, n: i + 1 }));
  return { ...r, lines };
}

/** Adds a line the reader missed, after line `after` (0 = at the top). */
export function insertLine(r: PaperReading, after: number, text: string): PaperReading {
  const t = text.trim();
  if (!t) return r;
  const page = r.lines.find((l) => l.n === after)?.page ?? 1;
  const lines = [...r.lines];
  lines.splice(Math.max(0, Math.min(after, lines.length)), 0, { n: 0, page, text: t.slice(0, 600), kind: 'text', edited: true });
  return { ...r, lines: lines.map((l, i) => ({ ...l, n: i + 1 })) };
}

/** Numbered text of the page, as given to the teacher model. */
export function paperText(r: PaperReading): string {
  return r.lines.map((l) => `${r.pages > 1 ? `p${l.page} ` : ''}L${l.n}${l.kind === 'math' ? ' [math]' : l.kind === 'diagram' ? ' [drawing]' : l.kind === 'heading' ? ' [heading]' : ''}: ${l.text}${l.unclear ? ' (unclear)' : ''}${l.edited ? ' (corrected by the student)' : ''}`).join('\n');
}

const QUALITY_TEXT: Record<PaperQuality, { en: string; ml: string } | null> = {
  good: null,
  blurry: { en: 'The photo is blurry — some words may be misread. Hold the paper still, a little farther away, and take it again.', ml: 'ഫോട്ടോ മങ്ങിയിരിക്കുന്നു — ചില വാക്കുകൾ തെറ്റായി വായിച്ചിരിക്കാം. പേപ്പർ അനങ്ങാതെ പിടിച്ച് വീണ്ടും എടുക്കൂ.' },
  dark: { en: 'The photo is too dark. Move to the light (or turn on the torch) and take it again.', ml: 'ഫോട്ടോ ഇരുണ്ടതാണ്. വെളിച്ചത്തിലേക്ക് മാറി വീണ്ടും എടുക്കൂ.' },
  cut: { en: 'Part of the writing is cut off. Fit the whole page in the frame.', ml: 'എഴുത്തിന്റെ ഒരു ഭാഗം ഫ്രെയിമിന് പുറത്താണ്. പേജ് മുഴുവനും ഫ്രെയിമിൽ വരട്ടെ.' },
  'not-paper': { en: "I can't see a written paper in this photo. Hold the page in front of the camera.", ml: 'ഈ ഫോട്ടോയിൽ എഴുതിയ പേപ്പർ കാണുന്നില്ല. പേജ് ക്യാമറയുടെ മുന്നിൽ പിടിക്കൂ.' },
  empty: { en: "The paper looks blank — I couldn't find any writing.", ml: 'പേപ്പറിൽ എഴുത്ത് ഒന്നും കണ്ടില്ല.' },
};

export function qualityNote(q: PaperQuality, lang: PaperLang): string | null {
  const t = QUALITY_TEXT[q];
  return t ? t[lang === 'malayalam' ? 'ml' : 'en'] : null;
}

/** Retaking is the only sensible next step (nothing usable was read). */
export const mustRetake = (r: PaperReading) => r.quality === 'not-paper' || r.quality === 'empty' || r.lines.length === 0;

/* ---------------- step 2: answering ---------------- */

export interface AnswerContext {
  grade: string;
  boardName: string;
  gradeGuidance: string;
  languageLine: string;
  lang: PaperLang;
  /** The chapter being taught in class right now, when the student asks from the classroom. */
  lessonNote?: string;
  extracts?: Array<{ page: number; text: string }>;
}

export function answerSystemPrompt(r: PaperReading, c: AnswerContext): string {
  const extracts = c.extracts?.length
    ? `\nTEXTBOOK (the chapter the class is on; when the paper is about it, keep your answer consistent with it and mention the page):\n${c.extracts.slice(0, 10).map((e) => `[page ${e.page}] ${e.text}`).join('\n\n').slice(0, 9000)}\n`
    : '';
  return `You are AI Guru, a warm, patient Indian school teacher sitting next to a Class ${c.grade} student (${c.boardName}). The student is holding up their own paper and asking about it.
${c.gradeGuidance}
${c.languageLine}
${c.lessonNote ? `\nIn class right now: ${c.lessonNote}\n` : ''}
THE STUDENT'S PAPER${r.title ? ` — "${r.title}"` : ''} (${r.subject}${r.summary ? `; ${r.summary}` : ''}). You also see the photo${r.pages > 1 ? 's' : ''}. Lines read from it, checked by the student:
${paperText(r)}
${extracts}
HOW TO ANSWER
- Answer the student's question about THIS paper. Refer to lines by number ("in line 4…") so the app can highlight them. Quote the paper exactly when you point at something.
- The paper is the student's own work or notes and may contain mistakes. If what is written is wrong (a calculation, a step, a fact, a spelling of a key term), say so kindly, give the line, what is written, the correct version and why. Never call something a mistake unless you are sure; if a word was unclear, ask.
- You may explain with ordinary school knowledge for Class ${c.grade} (that is the point of clearing a doubt), but never claim the paper says something it does not, and keep every number on the paper exactly as written unless you are correcting it.
- If the question needs something that is not on the paper and not clear from the photo, say what is missing and ask the student to show it.
- If the student asks for the answer to homework, teach the method and give a hint for the next step first; give the full answer if they ask again.
- Keep it short and spoken-friendly: a few sentences, or numbered steps for working. Mathematics in plain Unicode (x², √, ÷, ½).
Answer ONLY with JSON:
{"answer":"your reply to the student","lines":[line numbers you talk about],"mistakes":[{"line":4,"wrote":"exactly as on the paper","correct":"the right version","why":"short reason"}],"next":["a short follow-up question the student may ask","another"]}
"mistakes" only for real mistakes on the paper (empty list otherwise). Write "answer", "why" and "next" in the student's language.`;
}

/** Model reply → PaperAnswer. A reply that is not JSON becomes the answer text itself. */
export function parseAnswer(raw: string, r: PaperReading): PaperAnswer {
  const j = jsonFrom(raw) as Record<string, unknown> | null;
  const valid = (n: unknown) => Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= r.lines.length;
  if (!j || typeof j.answer !== 'string') {
    const text = String(raw ?? '').replace(/```(?:json)?|```/g, '').trim();
    return { answer: text || '…', lines: linesMentioned(text, r), mistakes: [], next: [] };
  }
  const answer = str(j.answer, 6000).trim();
  const mistakes = (Array.isArray(j.mistakes) ? j.mistakes : [])
    .map((m) => m as Record<string, unknown>)
    .filter((m) => m && valid(m.line) && str(m.correct).trim())
    .slice(0, 8)
    .map((m) => ({ line: Number(m.line), wrote: str(m.wrote, 400).trim(), correct: str(m.correct, 400).trim(), why: str(m.why, 400).trim() }));
  const listed = (Array.isArray(j.lines) ? j.lines : []).filter(valid).map(Number);
  const lines = [...new Set([...listed, ...mistakes.map((m) => m.line), ...linesMentioned(answer, r)])].sort((a, b) => a - b);
  const next = (Array.isArray(j.next) ? j.next : []).map((x) => str(x, 160).trim()).filter(Boolean).slice(0, 3);
  return { answer, lines, mistakes, next };
}

/** "line 4", "lines 2 and 3", "L5", "വരി 4" → [4] / [2, 3] / [5] / [4] (only lines that exist). */
export function linesMentioned(text: string, r: PaperReading): number[] {
  const out = new Set<number>();
  const re = /(?:\blines?|\bL|വരി(?:കൾ)?)\s*(\d{1,3})(?:\s*(?:,|and|&|to|-|–|ഉം|മുതൽ)\s*(\d{1,3}))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    const range = /to|-|–|മുതൽ/.test(m[0]) && b > a && b - a < 20;
    for (const n of range ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a, b]) if (n >= 1 && n <= r.lines.length) out.add(n);
  }
  return [...out].sort((x, y) => x - y);
}

/** Conversation so far → Gemini `contents` (images go with the first student turn). */
export function chatContents(turns: PaperTurn[], images: Array<{ base64: string; mimeType: string }>): Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> {
  const out: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];
  turns.forEach((t, i) => {
    if (t.role === 'student') {
      const parts: Array<Record<string, unknown>> = [];
      if (i === 0 || !out.length) for (const im of images) parts.push({ inline_data: { mime_type: im.mimeType, data: im.base64 } });
      parts.push({ text: t.text });
      out.push({ role: 'user', parts });
    } else {
      out.push({ role: 'model', parts: [{ text: t.answer ? JSON.stringify({ answer: t.answer.answer, lines: t.answer.lines }) : t.text }] });
    }
  });
  return out;
}

/* ---------------- one-tap questions ---------------- */

export interface QuickAsk {
  id: 'explain' | 'check' | 'summary' | 'quiz' | 'hint' | 'meaning';
  label: { en: string; ml: string };
  /** What is sent (in the student's language, so it reads naturally in the chat). */
  ask: { en: string; ml: string };
}

export const QUICK_ASKS: QuickAsk[] = [
  { id: 'explain', label: { en: '📖 Explain this page', ml: '📖 ഈ പേജ് വിശദീകരിക്കൂ' }, ask: { en: 'Explain this page to me step by step.', ml: 'ഈ പേജ് എനിക്ക് പടിപടിയായി വിശദീകരിച്ചു തരൂ.' } },
  { id: 'check', label: { en: '✅ Check my work', ml: '✅ എന്റെ ഉത്തരം പരിശോധിക്കൂ' }, ask: { en: 'Check my paper for mistakes. Tell me each mistake, the line, and the correct version.', ml: 'എന്റെ പേപ്പറിൽ തെറ്റുകളുണ്ടോ എന്ന് നോക്കൂ. ഓരോ തെറ്റും, ഏത് വരിയിലാണെന്നും, ശരിയായത് എന്താണെന്നും പറയൂ.' } },
  { id: 'hint', label: { en: "💡 I'm stuck — a hint", ml: '💡 ഒരു സൂചന തരൂ' }, ask: { en: "I'm stuck. Give me only a hint for the next step, not the full answer.", ml: 'ഞാൻ കുടുങ്ങി. മുഴുവൻ ഉത്തരം വേണ്ട, അടുത്ത പടിക്ക് ഒരു സൂചന മാത്രം തരൂ.' } },
  { id: 'summary', label: { en: '📝 Short notes', ml: '📝 ചുരുക്കം' }, ask: { en: 'Summarise this paper in 3 to 5 short points I can revise.', ml: 'ഈ പേപ്പർ റിവിഷന് പറ്റിയ 3–5 ചെറിയ പോയിന്റുകളായി ചുരുക്കി തരൂ.' } },
  { id: 'quiz', label: { en: '❓ Quiz me', ml: '❓ എന്നോട് ചോദിക്കൂ' }, ask: { en: "Ask me 3 short questions on this paper to test me. Don't give the answers until I reply.", ml: 'ഈ പേപ്പറിൽ നിന്ന് എന്നെ പരീക്ഷിക്കാൻ 3 ചെറിയ ചോദ്യങ്ങൾ ചോദിക്കൂ. ഞാൻ മറുപടി പറയും വരെ ഉത്തരം പറയരുത്.' } },
  { id: 'meaning', label: { en: '🔤 What does this word mean?', ml: '🔤 ഈ വാക്കിന്റെ അർത്ഥം?' }, ask: { en: 'Which words on this paper might be new to me? Explain the meaning of the important ones simply.', ml: 'ഈ പേപ്പറിലെ പ്രധാന പുതിയ വാക്കുകളുടെ അർത്ഥം ലളിതമായി പറഞ്ഞു തരൂ.' } },
];

export const quickAsk = (id: QuickAsk['id'], lang: PaperLang) => {
  const q = QUICK_ASKS.find((x) => x.id === id)!;
  return q.ask[lang === 'malayalam' ? 'ml' : 'en'];
};

/** A short text of the reading for the live voice session (so it remembers the page after it is put down). */
export function liveNote(r: PaperReading): string {
  return `[The student just showed this paper${r.title ? ` titled "${r.title}"` : ''} (${r.subject}). It was read line by line and the student checked it:\n${paperText(r)}\nAnswer their spoken questions about this paper; refer to line numbers, keep every number exactly as written, and point out real mistakes kindly.]`;
}

/** For the offline (on-device) model: one plain prompt, no JSON. */
export function offlinePrompt(question: string, r: PaperReading | null): string {
  return r?.lines.length ? `My paper says:\n${paperText(r)}\n\nMy question: ${question}` : question;
}
