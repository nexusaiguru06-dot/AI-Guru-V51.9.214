/**
 * V51.9.153 — messages between the office (admin), teachers and students: pure rules (no I/O).
 *
 * Conversations ("threads"):
 *   sa:<studentId>                student ↔ office (the bot answers first)
 *   ta:<teacherKey>               teacher ↔ office (the bot answers first)
 *   ts:<teacherKey>:<studentId>   teacher ↔ their student (direct; the office can read it)
 *
 * The office never reads 5000 messages one by one: every thread has a CATEGORY with its own colour (fees and money
 * stand out in red whatever else was chosen), a status, and an unread count; the inbox shows only who wrote (name,
 * ID, colour) and opens the full conversation on a click. The bot asks the category first, answers from the office's
 * knowledge base when it can, and hands everything else to the office.
 */
import type { NoteAttachment } from './notes';

export type Role = 'student' | 'teacher' | 'admin';
export type Category = 'money' | 'technical' | 'app-help' | 'suggestion' | 'study' | 'other';
export type ThreadKind = 'student-admin' | 'teacher-admin' | 'teacher-student';
/** needs-reply: waiting for the office (or teacher) · bot: the bot's answer solved it · answered: replied · closed */
export type Status = 'needs-reply' | 'bot' | 'answered' | 'closed';

export interface Party { role: Exclude<Role, 'admin'>; id: string; name: string; code?: string }
export interface Message {
  id: string;
  at: string;
  from: Role | 'bot';
  /** Name shown on the bubble (a teacher's or student's name; "AI Guru office"; "AI Guru bot"). */
  by: string;
  text: string;
  category?: Category;
  /** The knowledge-base entry the bot answered with. */
  kb?: string;
  /** Bot only: buttons to show under this message. */
  ask?: 'solved';
  /** V51.9.154: a teacher's note sent with this message (download it, or teach it in the classroom). */
  note?: NoteAttachment;
  /** V51.9.188: tapping the message opens this page inside AI Guru (e.g. "🔑 Add my free Gemini key" → Settings). */
  action?: { label: string; href: string };
  /** V51.9.190: a fee receipt, shown as a receipt card (print / save as PDF). */
  receipt?: ReceiptCard;
}
/** V51.9.190 — what the receipt card in Messages shows. */
export interface ReceiptCard {
  receiptNo: string; date: string; amount: number; mode: string;
  /** AI Guru's transaction ID (UPI payments) and the bank's 12-digit UPI reference. */
  txnId?: string; utr?: string;
  forWhat: string; student: string; studentCode?: string; standard?: string;
  school: string; paidTo?: string; balance: number; total: number;
  confirmedBy?: 'office' | 'bank-alert' | 'statement';
  /** Parts 2–10 are open now (the student is enrolled). */
  allOpen: boolean;
  /** V51.9.195: the part(s) this payment opened, and the parts still to pay for. */
  opened?: string; stillToPay?: { parts: string; amount: number };
}
export interface ThreadSummary {
  id: string;
  kind: ThreadKind;
  /** The student or teacher who is not the office (for teacher–student: the student). */
  party: Party;
  /** teacher–student threads: the teacher. */
  teacher?: Party;
  category: Category;
  status: Status;
  lastAt: string;
  lastFrom: Message['from'];
  /** First words of the last message (for the expanded view only; the inbox list does not show it). */
  last: string;
  count: number;
  unread: Partial<Record<Role, number>>;
}
export interface Thread extends ThreadSummary { messages: Message[] }

/* ---------------- categories ---------------- */

export const CATEGORIES: Category[] = ['money', 'technical', 'app-help', 'study', 'suggestion', 'other'];
export const CATEGORY_INFO: Record<Category, { en: string; ml: string; icon: string; color: string; bg: string }> = {
  money: { en: 'Fees & payments', ml: 'ഫീസ്, പണമിടപാട്', icon: '💰', color: '#f43f5e', bg: 'bg-rose-500/15 border-rose-400/60 text-rose-100' },
  technical: { en: 'Technical problem', ml: 'സാങ്കേതിക പ്രശ്നം', icon: '🛠', color: '#f59e0b', bg: 'bg-amber-500/15 border-amber-400/60 text-amber-100' },
  'app-help': { en: 'How to use the app', ml: 'ആപ്പ് ഉപയോഗിക്കാൻ സഹായം', icon: '❓', color: '#22d3ee', bg: 'bg-cyan-500/15 border-cyan-400/60 text-cyan-100' },
  study: { en: 'Study doubt', ml: 'പഠന സംശയം', icon: '📚', color: '#a78bfa', bg: 'bg-violet-500/15 border-violet-400/60 text-violet-100' },
  suggestion: { en: 'Suggestion', ml: 'നിർദേശം', icon: '💡', color: '#34d399', bg: 'bg-emerald-500/15 border-emerald-400/60 text-emerald-100' },
  other: { en: 'Something else', ml: 'മറ്റുള്ളവ', icon: '💬', color: '#94a3b8', bg: 'bg-slate-500/15 border-slate-400/50 text-slate-100' },
};

const WORDS: Record<Exclude<Category, 'other'>, RegExp> = {
  money: /\b(fees?|payments?|pay|paid|paying|refund\w*|money|rupees?|rs|inr|upi|gpay|google pay|phonepe|paytm|invoice|receipt|discount|coupon|charges?|subscription|monthly plan|yearly plan|commission|payout|bank|fee due|amount due)\b|₹|പണം|ഫീസ്|രൂപ|പേയ്മെന്റ്|തുക|റീഫണ്ട്|കിഴിവ്|ബാക്കി/i,
  technical: /\b(error|errors|not working|doesn'?t work|does not work|crash\w*|bug|stuck|freez\w*|loading|blank|slow|hang\w*|can'?t (?:open|login|sign in|see|hear)|cannot (?:open|login|sign in|see|hear)|login|log in|sign ?in|password|pin|otp|voice|sound|audio|video|download\w*|upload\w*|black screen|white screen|404|500)\b|പ്രവർത്തിക്കുന്നില്ല|തകരാർ|ശബ്ദം|ലോഗിൻ/i,
  'app-help': /\b(how (?:do|can|to)|where (?:is|do|can)|what is the|how does|help me use|tutorial|guide|explain the app|which button)\b|എങ്ങനെ|എവിടെ/i,
  study: /\b(chapter|lesson|question|answer|solve|sum|equation|formula|doubt|explain|meaning|exam|homework|maths?|physics|chemistry|biology|english|textbook)\b|സംശയം|പാഠം|ചോദ്യം|ഉത്തരം/i,
  suggestion: /\b(suggest\w*|idea|feature|please add|would be (?:nice|good|great)|improve\w*|better if|wish|request)\b|നിർദേശം|ചേർക്കണം/i,
};

/** Categories the words point to, strongest first ("money" whenever money is mentioned). */
export function detectCategories(text: string): Category[] {
  return (Object.keys(WORDS) as Array<Exclude<Category, 'other'>>).filter((c) => WORDS[c].test(text));
}
/** The thread's category: money wins whenever money is mentioned; otherwise what the writer chose; otherwise the words. */
export function categoryFor(text: string, chosen?: Category, previous?: Category): Category {
  const found = detectCategories(text);
  if (found.includes('money') || previous === 'money') return 'money';
  if (chosen) return chosen;
  return found[0] ?? previous ?? 'other';
}

/* ---------------- knowledge base and the bot's answer ---------------- */

export interface KbEntry {
  id: string;
  category: Category;
  /** The question as people ask it. */
  question: string;
  /** Extra words that point to this answer (comma separated in the editor). */
  keywords: string[];
  answer: string;
  answerMl?: string;
  /** Who it is for. */
  audience?: 'all' | 'student' | 'teacher';
  updatedAt?: string;
}

const STOP = new Set('a an the is are am was were be to of in on at for and or but my me i you your it this that with how what why when where do does did can could will would please hi hello sir madam mam ma am pls plz there here have has had not no yes ok okay from by as so if into about'.split(' '));
export const tokens = (s: string) => s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/u, '');

/** The best knowledge-base answer for a message (null when nothing fits well enough). */
export function matchKb(text: string, kb: KbEntry[], o: { category?: Category; role?: Exclude<Role, 'admin'> } = {}): { entry: KbEntry; score: number } | null {
  const words = new Set(tokens(text).map(stem));
  if (!words.size) return null;
  let best: { entry: KbEntry; score: number } | null = null;
  for (const e of kb) {
    if (o.role && e.audience && e.audience !== 'all' && e.audience !== o.role) continue;
    const kw = e.keywords.flatMap((k) => tokens(k)).map(stem);
    const qw = tokens(e.question).map(stem);
    const kwHits = new Set(kw.filter((w) => words.has(w))).size;
    const qHits = new Set(qw.filter((w) => words.has(w))).size;
    // a keyword is a strong sign; question words help; the chosen category breaks ties
    const score = kwHits * 2 + qHits + (o.category && e.category === o.category ? 0.5 : 0);
    const enough = kwHits >= 1 && score >= 2.5 && qHits + kwHits >= Math.min(2, words.size);
    if (enough && (!best || score > best.score)) best = { entry: e, score };
  }
  return best;
}

/** Starting answers the office can edit (only about the app itself — fees and prices are for the office to add). */
export const SEED_KB: KbEntry[] = [
  { id: 'kb-pin', category: 'technical', question: 'I forgot my PIN / I cannot sign in', keywords: ['pin', 'forgot', 'sign in', 'login', 'password'], answer: 'On the sign-in box press "Forgot PIN?". The office sets a new PIN and tells you or your parent. Until then you can still use the app without signing in.', answerMl: 'സൈൻ-ഇൻ ബോക്സിൽ "Forgot PIN?" അമർത്തുക. ഓഫീസ് പുതിയ PIN തരും.', audience: 'student' },
  { id: 'kb-voice', category: 'technical', question: 'The voice is not coming in the class', keywords: ['voice', 'sound', 'audio', 'hear', 'speak'], answer: 'Check the volume of your device first. If the class says "voice unavailable", open Settings → Local TTS (or add your free Gemini key in Settings) and start the class again. The board still teaches with captions without voice.', answerMl: 'ആദ്യം ശബ്ദം കൂട്ടിയിട്ടുണ്ടോ എന്ന് നോക്കുക. "voice unavailable" എന്ന് കാണുന്നുവെങ്കിൽ Settings → Local TTS തുറക്കുക.' },
  { id: 'kb-reel', category: 'app-help', question: 'How do I make a reel from my class?', keywords: ['reel', 'video', 'mp4', 'share', 'instagram', 'whatsapp'], answer: 'In the class press 🎬 Edit on the board (or Send to Reel Studio after a solution). The Reel Studio opens with three ways: design it yourself, pick a style, or Google Flow. Press 👁 Preview & post to make the MP4.', answerMl: 'ക്ലാസിൽ ബോർഡിലെ 🎬 Edit അമർത്തുക. Reel Studio-യിൽ മൂന്നു വഴികളുണ്ട്.' },
  { id: 'kb-speed', category: 'app-help', question: 'The teaching is too fast', keywords: ['fast', 'speed', 'slow', 'wait', 'next step'], answer: 'On top of the whiteboard set Speed (slower) and Wait (1 to 10 seconds before the next step). The board also has ⏮ ⏸ ⏭ to go step by step.', answerMl: 'വൈറ്റ്ബോർഡിന് മുകളിൽ Speed, Wait എന്നിവ മാറ്റുക.' },
  { id: 'kb-join', category: 'app-help', question: 'How can my friend join?', keywords: ['join', 'friend', 'invite', 'code', 'link', 'qr'], answer: 'Share your reel or your join link: the QR code and the join code at the end of every reel open the sign-up page. Your friend can also type the code at the /j page.', answerMl: 'നിങ്ങളുടെ റീലിലെ QR കോഡ് അല്ലെങ്കിൽ ജോയിൻ കോഡ് സുഹൃത്തിന് നൽകുക.' },
];

/* ---------------- threads ---------------- */

export const threadIdFor = (kind: ThreadKind, a: string, b?: string) => (kind === 'student-admin' ? `sa:${a}` : kind === 'teacher-admin' ? `ta:${a}` : `ts:${a}:${b}`);
export const OFFICE = 'AI Guru office';
export const BOT = 'AI Guru helper';

export function newThread(kind: ThreadKind, party: Party, teacher?: Party, at = new Date().toISOString()): Thread {
  const id = kind === 'teacher-student' ? threadIdFor(kind, teacher!.id, party.id) : threadIdFor(kind, party.id);
  return { id, kind, party, ...(teacher ? { teacher } : {}), category: 'other', status: 'closed', lastAt: at, lastFrom: 'admin', last: '', count: 0, unread: {}, messages: [] };
}

/** Who else reads this thread (gets an unread mark) when `from` writes. */
function readersOf(t: Thread, from: Message['from']): Role[] {
  if (t.kind === 'teacher-student') return from === 'teacher' ? ['student'] : from === 'student' ? ['teacher'] : ['teacher', 'student'];
  const user: Role = t.kind === 'student-admin' ? 'student' : 'teacher';
  if (from === 'admin' || from === 'bot') return [user];
  return ['admin'];
}

/** Adds a message and updates the summary (category, status, unread). */
export function addMessage(t: Thread, m: Omit<Message, 'id'> & { id?: string }): Message {
  const msg: Message = { ...m, id: m.id ?? `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
  t.messages.push(msg);
  t.count = t.messages.length;
  t.lastAt = msg.at;
  t.lastFrom = msg.from;
  t.last = msg.text.slice(0, 140);
  if (msg.from === 'student' || msg.from === 'teacher') {
    // money stays red while the matter is open; once the office has answered, a new question gets its own colour
    const open = t.count > 1 && (t.status === 'needs-reply' || t.status === 'bot');
    t.category = categoryFor(msg.text, msg.category, open ? t.category : undefined);
    msg.category = t.category;
    t.status = 'needs-reply';
  } else if (msg.from === 'admin') t.status = 'answered';
  else if (msg.from === 'bot' && msg.kb) t.status = 'bot'; // the bot answered; the office gets it only if the writer says it did not help
  for (const r of readersOf(t, msg.from)) t.unread[r] = (t.unread[r] ?? 0) + 1;
  return msg;
}

export const markRead = (t: Thread, role: Role) => { t.unread[role] = 0; };
export const summaryOf = (t: Thread): ThreadSummary => { const { messages, ...s } = t; void messages; return s; };

/** The office's inbox: newest first; needs-reply before the rest; filters by category, status, role and search. */
export function inbox(list: ThreadSummary[], f: { category?: Category | 'all'; status?: Status | 'all' | 'open'; kind?: ThreadKind | 'all'; q?: string } = {}): ThreadSummary[] {
  const q = (f.q ?? '').trim().toLowerCase();
  return list
    .filter((t) => !f.category || f.category === 'all' || t.category === f.category)
    .filter((t) => !f.status || f.status === 'all' || (f.status === 'open' ? t.status === 'needs-reply' : t.status === f.status))
    // teacher–student conversations are the teacher's: the office sees them only when it asks for them
    .filter((t) => (!f.kind || f.kind === 'all' ? t.kind !== 'teacher-student' : t.kind === f.kind))
    .filter((t) => !q || [t.party.name, t.party.code ?? '', t.party.id, t.teacher?.name ?? '', t.teacher?.code ?? ''].some((x) => x.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.status === 'needs-reply' && b.kind !== 'teacher-student') - Number(a.status === 'needs-reply' && a.kind !== 'teacher-student') || b.lastAt.localeCompare(a.lastAt));
}

/** Counts for the office's coloured legend. */
export function counts(list: ThreadSummary[]): Record<Category, { open: number; all: number }> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, { open: 0, all: 0 }])) as Record<Category, { open: number; all: number }>;
  for (const t of list) if (t.kind !== 'teacher-student') { out[t.category].all++; if (t.status === 'needs-reply') out[t.category].open++; }
  return out;
}

export const MAX_TEXT = 2000;
export const cleanText = (s: unknown) => String(s ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_TEXT);
