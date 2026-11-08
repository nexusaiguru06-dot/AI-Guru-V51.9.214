/**
 * V51.9.185 — messages the office sends by itself, through AI Guru's own Messages (server only):
 *  • fee reminders: a few days before the due date and on the day (once each), EVERY DAY of the grace period
 *    (V51.9.186: "day 2 of 5 · 3 days left"), and once when grace is over;
 *  • to a student whose link brought a friend in: "Congratulations! … joined with your link";
 *  • to that student when the friend pays: the commission gained, when it is paid, and the total so far.
 * They arrive in the student's Messages from the AI Guru office, like any office message.
 */
import { docs } from '../storage';
import { addMessage, newThread, OFFICE, threadIdFor, type Category, type Message, type ReceiptCard } from './core';
import { invoiceTotal } from '../admin/fees';
import { doubtLimitsOf, doubtWindow } from '../doubt/school-key';
import { readThread, saveThread, serial } from './store';
import { studentParty } from './people';
import type { AdminData } from '../admin/store';
import type { Student } from '../admin/fees';
import { dueMessage, duesOf, type DueStage } from '../admin/dues';
import { affiliateReport } from '../admin/affiliate';

const SENT = 'data/ai-guru/messages/auto-sent.json';
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** One message from the office into this student's Messages. */
export async function officeToStudent(st: Student, text: string, category: Category = 'other', action?: Message['action'], receipt?: ReceiptCard): Promise<void> {
  await serial(async () => {
    const t = (await readThread(threadIdFor('student-admin', st.id))) ?? newThread('student-admin', studentParty(st));
    addMessage(t, { at: new Date().toISOString(), from: 'admin', by: OFFICE, text, category, ...(action ? { action } : {}), ...(receipt ? { receipt } : {}) });
    if (category === 'money') t.category = 'money';
    await saveThread(t);
  });
}

/** Sends each message key only once (fee reminders): returns the keys that were new. */
async function claimKeys(keys: string[]): Promise<string[]> {
  if (!keys.length) return [];
  return docs.update<Record<string, string>, string[]>(SENT, (cur) => {
    const sent = { ...(cur ?? {}) };
    const fresh = keys.filter((k) => !sent[k]);
    const now = new Date().toISOString();
    for (const k of fresh) sent[k] = now;
    return { value: fresh.length ? sent : undefined, result: fresh };
  });
}

const NOTIFY: DueStage[] = ['soon', 'today', 'grace', 'over'];

/**
 * Fee reminders for every student (or one): each bill gets one message per stage it reaches. Safe to call often —
 * it runs when the office opens "Fees due" and when a student opens their account.
 */
export async function sendDueNotices(data: AdminData, today: string, onlyStudentId?: string): Promise<number> {
  const plans = [...data.yearly, ...data.monthly];
  let sent = 0;
  for (const st of data.students.filter((s) => !onlyStudentId || s.id === onlyStudentId)) {
    const dues = duesOf(st, data.invoices, plans, today, data.settings.plans.graceDays).filter((d) => NOTIFY.includes(d.stage));
    // only the most recent stage of each bill (no "due soon" after it is already overdue)
    // V51.9.186: the grace-period reminder goes every day of the grace period (one key per day); the others once per bill
    const keyOf = (d: (typeof dues)[number]) => (d.stage === 'grace' ? `due:${d.invoiceId}:grace:${today}` : `due:${d.invoiceId}:${d.stage}`);
    const fresh = await claimKeys(dues.map(keyOf));
    for (const d of dues.filter((x) => fresh.includes(keyOf(x)))) {
      await officeToStudent(st, dueMessage(st.name, d), 'money');
      sent++;
    }
  }
  return sent;
}

/** "Congratulations! Arjun joined with your link" — to the student whose link or code brought a friend in. */
export async function notifyJoinedUnder(data: AdminData, friend: Student): Promise<void> {
  const ref = friend.referredBy ? data.students.find((s) => s.id === friend.referredBy) : undefined;
  if (!ref) return;
  const n = data.students.filter((s) => s.referredBy === ref.id).length;
  const first = ref.name.split(' ')[0] || ref.name;
  await officeToStudent(ref, `🎉 Congratulations, ${first}! ${friend.name}${friend.standard ? ` (Std ${friend.standard}${friend.school ? `, ${friend.school}` : ''})` : ''} joined AI Guru with your link. ${n === 1 ? 'Your first friend has joined!' : `${n} friends have joined with your link.`} When they pay their fee, you get a reward — you will get a message here.`);
}

/** "You earned ₹45 from Arjun's fee payment" — to the referrer, with the payout day and the total so far. */
export async function notifyCommission(data: AdminData, commission: { affiliateId: string; amount: number; payoutDate: string }, payerId: string, today: string): Promise<void> {
  const ref = data.students.find((s) => s.id === commission.affiliateId);
  const payer = data.students.find((s) => s.id === payerId);
  if (!ref || !payer || !(commission.amount > 0)) return;
  const r = affiliateReport(ref.id, data.students, data.invoices, today);
  const first = ref.name.split(' ')[0] || ref.name;
  await officeToStudent(ref, `💰 ${first}, ${payer.name} paid their fee — you gained ${inr(commission.amount)} commission. ${commission.payoutDate <= today ? 'It is ready to collect now at the school office.' : `It will be paid on ${commission.payoutDate} at the school office.`}\nTotal gained so far: ${inr(r.totals.earned)} · waiting to be paid: ${inr(r.totals.pending + r.totals.dueNow)} · already paid to you: ${inr(r.totals.paidOut)}. Details: My account → Invite your friends → For parents.`, 'money');
}

/** V51.9.188 — "add your own free Gemini key" reminders; tapping one opens Settings → Your AI keys. */
export const KEY_ACTION: NonNullable<Message['action']> = { label: '🔑 Add my free Gemini key', href: '/ai-guru/settings/gemini' };
export type KeyNudge = 'welcome' | 'last' | 'over' | 'enrolled' | 'weekly';

/** Pure: which key reminder (if any) this student is due today. The welcome is sent at sign-up. */
export function keyNudgeFor(st: Pick<Student, 'createdAt' | 'enrolled' | 'keySeenAt'>, days: number, today: string): { kind: KeyNudge; key: string } | null {
  if (st.keySeenAt) return null; // their browser has their own key
  const w = doubtWindow(st.createdAt, days, today, !!st.enrolled);
  if (w.open) return w.dayNo === w.days && w.days > 1 ? { kind: 'last', key: 'last' } : null;
  if (st.enrolled && w.days && w.dayNo <= w.days) return { kind: 'enrolled', key: 'enrolled' };
  const after = w.dayNo - w.days; // days since the trial ended (1 = the first day after)
  if (w.days > 0 && after === 1) return { kind: 'over', key: 'over' };
  return after > 1 && after % 7 === 1 ? { kind: 'weekly', key: `weekly:${today}` } : null;
}

export function keyNudgeText(first: string, kind: KeyNudge, t: { days: number; perDay: number; minutes: number; afterPerDay?: number; afterMinutes?: number }, until: string): string {
  const after = t.afterPerDay ? ` You can still clear doubts for ${(t as { dailyMinutes?: number }).dailyMinutes ?? (t.afterPerDay * (t.afterMinutes ?? 5))} minutes a day on AI Guru’s key.` : '';
  const how = 'It is free: open Google AI Studio, sign in with a Google account, press “Create API key”, copy it and paste it in Settings → Your AI keys. Tap this message to open Settings.';
  if (kind === 'welcome') return t.days > 0
    ? `👋 Welcome, ${first}! For your first ${t.days} days you can ask doubts free — by camera, voice or typing (${t.perDay} a day, up to ${t.minutes} minutes each), until ${until}. Add your own free Gemini key to ask doubts any time, with no limit.\n${how}`
    : `👋 Welcome, ${first}! To ask doubts by camera, voice or typing, add your own free Gemini key.\n${how}`;
  if (kind === 'last') return `⏳ ${first}, today is the last day of your free doubt clearing trial. From tomorrow, add your own free Gemini key for unlimited doubt clearing.${after}\n${how}`;
  if (kind === 'enrolled') return `🎉 ${first}, you are enrolled! Add your own free Gemini key to ask doubts without limits.${after}\n${how}`;
  if (kind === 'over') return `🔑 ${first}, your free doubt clearing trial has ended. Add your own free Gemini key to keep asking doubts by camera, voice or typing.${after}\n${how}`;
  return `🔑 Reminder, ${first}: add your own free Gemini key to ask doubts by camera, voice or typing.\n${how}`;
}

/** Sends the key reminders due today (each once), to every student or one. Safe to call often. */
export async function sendKeyNudges(data: AdminData, today: string, onlyStudentId?: string): Promise<number> {
  const t = doubtLimitsOf(data.settings);
  let sent = 0;
  for (const st of data.students.filter((s) => !onlyStudentId || s.id === onlyStudentId)) {
    const n = keyNudgeFor(st, t.days, today);
    if (!n) continue;
    const [fresh] = await claimKeys([`key:${st.id}:${n.key}`]);
    if (!fresh) continue;
    await officeToStudent(st, keyNudgeText(st.name.split(' ')[0] || st.name, n.kind, t, doubtWindow(st.createdAt, t.days, today).until), 'other', KEY_ACTION);
    sent++;
  }
  return sent;
}

/** The welcome at sign-up: free doubt clearing in the trial, and how to add a key. */
export async function sendKeyWelcome(data: AdminData, st: Student, today: string): Promise<void> {
  const [fresh] = await claimKeys([`key:${st.id}:welcome`]);
  if (!fresh) return;
  const t = doubtLimitsOf(data.settings);
  await officeToStudent(st, keyNudgeText(st.name.split(' ')[0] || st.name, 'welcome', t, doubtWindow(st.createdAt, t.days, today).until), 'other', KEY_ACTION);
}

/** V51.9.186 — the daily run (Cloud Scheduler → /api/ai-guru/cron/fee-reminders): when it last ran and what it sent. */
const LAST_RUN = 'data/ai-guru/messages/daily-reminders.json';
export interface DailyRun { at: string; date: string; sent: number }
export const readLastRun = () => docs.get<DailyRun>(LAST_RUN);
export async function runDailyReminders(data: AdminData, today: string): Promise<DailyRun> {
  // V51.9.191: part bills for anyone who still needs them, so their reminders go out too
  const { partPlanOf, ensurePartBills } = await import('../admin/part-plan');
  if (partPlanOf(data.settings.access).enabled) { const { update, readData } = await import('../admin/store'); await update((d) => { ensurePartBills(d); }); data = await readData(); }
  const sent = (await sendDueNotices(data, today)) + (await sendKeyNudges(data, today).catch(() => 0)); // V51.9.188: key reminders too
  // V51.9.195: any school commission a payment missed (e.g. the receipt step failed) is added now — each payment once
  const { recordSchoolCommission } = await import('../schools/commission');
  const linked = new Set(data.students.filter((st) => st.schoolLink).map((st) => st.id));
  for (const inv of data.invoices.filter((i) => linked.has(i.studentId))) for (const p of inv.payments) await recordSchoolCommission(data, p.id).catch(() => false);
  const run = { at: new Date().toISOString(), date: today, sent };
  await docs.put(LAST_RUN, run);
  return run;
}

/**
 * V51.9.190 — "🎉 Congratulations!" with the fee receipt, to the student's Messages, after every recorded payment (a UPI
 * payment confirmed by the bank or the office, or one paid at the counter). Each payment once.
 */
export async function sendPaymentReceipt(data: AdminData, paymentId: string, paidTo?: string): Promise<boolean> {
  const inv = data.invoices.find((i) => i.payments.some((p) => p.id === paymentId));
  const p = inv?.payments.find((x) => x.id === paymentId);
  const st = inv ? data.students.find((s) => s.id === inv.studentId) : undefined;
  if (!inv || !p || !st) return false;
  // V51.9.193: a contracted school's student — the school's and the teacher's commission (once per payment)
  if (st.schoolLink) await (await import('../schools/commission')).recordSchoolCommission(data, paymentId).catch(() => false);
  const [fresh] = await claimKeys([`receipt:${paymentId}`]);
  if (!fresh) return false;
  const total = invoiceTotal(inv);
  const paidSoFar = inv.payments.filter((x) => x.receiptNo <= p.receiptNo).reduce((a, x) => a + x.amount, 0);
  const balance = Math.max(0, Math.round((total - paidSoFar) * 100) / 100);
  const first = st.name.split(' ')[0] || st.name;
  // V51.9.195 (review): say exactly what is open now and what is still to pay — never "all parts open" after one part
  const { partPlanOf, paidPartsList, openedParts, paidOldWay, monthOfPart } = await import('../admin/part-plan');
  const months = partPlanOf(data.settings.access).months;
  const onPlan = partPlanOf(data.settings.access).enabled && !paidOldWay(st.id, data.invoices);
  const allParts = paidPartsList(data.settings.access.freeParts);
  const opened = onPlan ? openedParts(st.id, data.invoices, data.settings.access.freeParts) : [];
  const allOpen = onPlan ? allParts.length > 0 && allParts.every((x) => opened.includes(x)) : !!st.enrolled;
  const left = onPlan ? allParts.filter((x) => !opened.includes(x)) : [];
  const leftDue = onPlan ? Math.round(data.invoices.filter((i) => i.studentId === st.id && i.partBill?.part && left.includes(i.partBill.part)).reduce((a, i) => a + (invoiceTotal(i) - i.payments.reduce((b, x) => b + x.amount, 0)), 0) * 100) / 100 : 0;
  const nowOpen = inv.partBill?.all ? `Parts ${allParts[0]}–${allParts[allParts.length - 1]}` : inv.partBill?.part ? `Part ${inv.partBill.part} (${monthOfPart(months, inv.partBill.part)})` : '';
  const partsWord = (xs: number[]) => (xs.length === 1 ? `Part ${xs[0]} (${monthOfPart(months, xs[0])})` : `Parts ${xs.join(', ')}`);
  const receipt: ReceiptCard = {
    receiptNo: p.receiptNo, date: p.date, amount: p.amount, mode: p.mode.toUpperCase(), ...(p.txnId ? { txnId: p.txnId } : {}), ...(p.utr ? { utr: p.utr } : {}),
    forWhat: inv.term, student: st.name, ...(st.studentCode ? { studentCode: st.studentCode } : {}), ...(st.standard ? { standard: st.standard } : {}),
    school: data.school.name || 'AI Guru', ...(paidTo ? { paidTo } : {}), balance, total, ...(p.confirmedBy ? { confirmedBy: p.confirmedBy } : {}), allOpen,
    ...(nowOpen && !allOpen ? { opened: nowOpen } : {}), ...(left.length ? { stillToPay: { parts: partsWord(left), amount: leftDue } } : {}),
  };
  const openLine = allOpen ? ' All ten parts of every book are open for you now — happy learning! 📚' : nowOpen ? ` ${nowOpen} of every book is open for you now — happy learning! 📚` : '';
  const leftLine = left.length ? ` Still to pay when you are ready: ${partsWord(left)} (${inr(leftDue)}).` : '';
  const text = `🎉 Congratulations, ${first}! Your payment of ${inr(p.amount)} for “${inv.term}” is successful.${openLine}${balance > 0 ? ` Balance on this bill: ${inr(balance)}.` : ''}${leftLine}\nReceipt ${p.receiptNo}${p.txnId ? ` · Transaction ID ${p.txnId}` : ''} · ${p.date}`;
  await officeToStudent(st, text, 'money', undefined, receipt);
  // V51.9.192: a paid part's study materials are made for the student automatically (and shared in the library)
  if (inv.partBill) {
    try {
      const m = await import('../library/part-materials');
      const r = await m.makePaidPartMaterials(data, st, inv);
      if (r) await officeToStudent(st, m.partMaterialsText(first, r), 'other', { label: '📚 Open My books', href: '/ai-guru/student/library' });
    } catch { /* the receipt is sent; materials can still be made in Material Studio */ }
  }
  return true;
}
