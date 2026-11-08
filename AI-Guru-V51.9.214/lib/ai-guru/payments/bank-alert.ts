/**
 * V51.9.190 — UPI payments confirmed automatically, from the school's own bank.
 *
 * A family pays the school's UPI ID and types the 12-digit UPI reference (UTR) their app shows. The bank also tells the
 * school: an e-mail alert ("Rs.900.00 has been credited … UPI transaction reference number is 123456789012"), an SMS,
 * or a line in the account statement. AI Guru reads those (sent in by the school's own Gmail script / SMS forwarder with
 * a secret, or a statement the office uploads) and confirms a payment ONLY when the bank's credit has the same UTR AND
 * the same amount as the family's claim. Either can arrive first. Anything that does not match exactly stays for the
 * office to check — nothing is guessed. Pure parsing here; the store and matching are below.
 *
 * Written for AI Guru (no code taken from other payment projects).
 */
import { docs } from '../storage';
import { rowKey } from '../storage/rows';

export interface BankCredit { amount: number; utr: string; vpa?: string; at?: string }
export type AlertSource = 'email' | 'sms' | 'statement';
export interface BankAlert extends BankCredit {
  id: string; source: AlertSource; receivedAt: string;
  /** First words of the alert or the statement line (for the office). */
  text: string;
  status: 'unmatched' | 'matched' | 'mismatch';
  claimId?: string; note?: string;
}

const squash = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const money = (s: string) => Math.round(Number(s.replace(/,/g, '')) * 100) / 100;

/** Reads a bank credit alert (e-mail or SMS text). Null when it is not a credit, or has no amount or no 12-digit UPI ref. */
export function parseBankCredit(raw: string): BankCredit | null {
  const t = squash(String(raw ?? '')).slice(0, 4000);
  // V51.9.195: requests, mandates, reversals and failures are not money received
  if (/\b(mandate|autopay|auto-pay|collect|request(?:ed|s)?|reversal|reversed|refund(?:ed)?|failed|declined|unsuccessful|e-?mandate|will be (?:debited|credited))\b/i.test(t)) return null;
  const credited = t.search(/\b(credited|deposited|credit(?:ed)? to)\b/i);
  // "received" counts only when it is about the account ("received in your a/c …", "a/c … has received")
  const recv = /\b(?:a\/c|acct|account)\b.{0,40}\breceived\b|\breceived\b.{0,40}\b(?:a\/c|acct|account)\b/i.exec(t);
  const credit = credited >= 0 ? credited : recv ? recv.index : -1;
  if (credit < 0) return null;
  const debit = t.search(/\b(debited|debit|withdrawn|spent|sent|paid to)\b/i);
  if (debit >= 0 && debit < credit) return null; // about money leaving the account
  const amt = t.match(/(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  if (!amt) return null;
  const amount = money(amt[1]);
  if (!(amount > 0)) return null;
  const ref = t.match(/(?:upi\s*(?:transaction\s*)?(?:ref(?:erence)?\.?\s*(?:no\.?|number|id)?|txn\.?\s*(?:id|no\.?))|utr\s*(?:no\.?)?|rrn|ref(?:erence)?\.?\s*(?:no\.?|number))\D{0,12}(\d{12})\b/i)
    ?? t.match(/\bupi[/-](?:cr[/-])?(\d{12})\b/i)
    ?? t.match(/\(upi\s*(\d{12})\)/i);
  const utr = ref?.[1]; // V51.9.195: a bare 12-digit number is never taken as the UPI reference
  if (!utr) return null;
  const vpa = t.match(/\b(?:vpa|from)\s+([a-z0-9._-]{2,}@[a-z][a-z0-9]{1,})\b/i)?.[1];
  const date = t.match(/\bon\s+(\d{2})[-/](\d{2})[-/](\d{2,4})\b/);
  const at = date ? `${date[3].length === 2 ? `20${date[3]}` : date[3]}-${date[2]}-${date[1]}` : undefined;
  return { amount, utr, ...(vpa ? { vpa: vpa.toLowerCase() } : {}), ...(at ? { at } : {}) };
}

/** Splits one CSV line (quotes allowed). */
function cells(line: string): string[] {
  const out: string[] = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if ((c === ',' || c === '\t' || c === ';') && !q) { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Reads the credits in a bank statement (CSV / delimited text, as HDFC NetBanking and most banks download it): the row
 * with a "Narration/Description" and a "Deposit/Credit" column is the header; each row with a deposit and a 12-digit UPI
 * reference (in the reference column or the narration) is one credit.
 */
export function parseStatement(text: string): Array<BankCredit & { line: string }> {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20000);
  const hi = lines.findIndex((l) => /narration|description|particulars|remarks/i.test(l) && /deposit|credit|\bcr\b/i.test(l));
  if (hi < 0) return [];
  const head = cells(lines[hi]).map((h) => h.toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const cNar = col(/narration|description|particulars|remarks/), cRef = col(/ref|chq|cheque|utr/), cDep = col(/deposit|credit|\bcr\b/), cDate = col(/^date|txn date|transaction date|value/);
  const out: Array<BankCredit & { line: string }> = [];
  for (const line of lines.slice(hi + 1)) {
    const c = cells(line);
    const amount = money(String(c[cDep] ?? '').replace(/[^\d.,]/g, ''));
    if (!(amount > 0)) continue;
    const refDigits = String(c[cRef] ?? '').replace(/\D/g, '');
    const fromRef = refDigits.length >= 12 ? refDigits.slice(-12) : undefined;
    const nar = String(c[cNar] ?? '');
    const fromNar = nar.match(/(?<!\d)(\d{12})(?!\d)/)?.[1];
    const utr = fromNar && (!fromRef || fromRef === fromNar) ? fromNar : fromRef;
    if (!utr || !/upi/i.test(nar + line)) continue; // only UPI credits
    const vpa = nar.split(/[-/\s]+/).find((x) => /^[a-z0-9._]{2,}@[a-z][a-z0-9]{1,}$/i.test(x))?.toLowerCase(); // narration parts: UPI-NAME-vpa@bank-IFSC-UTR-note
    const d = String(c[cDate] ?? '').match(/(\d{2})[-/](\d{2})[-/](\d{2,4})/);
    out.push({ amount, utr, ...(vpa ? { vpa } : {}), ...(d ? { at: `${d[3].length === 2 ? `20${d[3]}` : d[3]}-${d[2]}-${d[1]}` } : {}), line: line.slice(0, 200) });
  }
  return out;
}

const DIR = 'data/ai-guru/payments/bank-alerts';
const keyOf = (utr: string) => rowKey(DIR, `utr_${utr}`);
export const getAlert = (utr: string) => docs.get<BankAlert>(keyOf(utr));
export const allAlerts = async () => (await docs.values<BankAlert>(DIR)).filter((a) => a && a.utr).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
export const saveAlert = (a: BankAlert) => docs.put(keyOf(a.utr), a);

/** Keeps a bank credit once per UTR. Returns the stored alert and whether it is new. */
export async function keepAlert(c: BankCredit, source: AlertSource, text: string): Promise<{ alert: BankAlert; fresh: boolean }> {
  return docs.update<BankAlert, { alert: BankAlert; fresh: boolean }>(keyOf(c.utr), (cur) => {
    if (cur) return { value: cur, result: { alert: cur, fresh: false } };
    const a: BankAlert = { ...c, id: `utr_${c.utr}`, source, receivedAt: new Date().toISOString(), text: squash(text).slice(0, 240), status: 'unmatched' };
    return { value: a, result: { alert: a, fresh: true } };
  });
}

/** Same money, to the paisa. */
export const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.005;
