/**
 * V51.9.183 — recording a fee payment on a bill: receipt number, the referrer's commission, and enrolment on the first
 * payment. Used by the office's Fees tab and by the UPI payment confirmation, so both follow the same rules.
 * Call inside store.update(). Returns an error text, or the payment.
 */
import { newId, type AdminData } from './store';
import { commissionFor } from './affiliate';
import { paymentProblems, receiptNumber, type Payment } from './fees';

export function recordPayment(data: AdminData, invoiceId: string, amount: number, date: string, mode: Payment['mode'], note?: string): string | Payment {
  const inv = data.invoices.find((i) => i.id === invoiceId);
  if (!inv) return 'Invoice not found';
  const p = paymentProblems(inv, amount, date);
  if (p.length) return p.join('. ');
  const pay: Payment = { id: newId('pay'), amount, date, mode, receiptNo: receiptNumber(++data.receiptCounter, Number(date.slice(0, 4))), note };
  const owner = data.students.find((x) => x.id === inv.studentId);
  const com = owner ? commissionFor(owner, data.students, amount, date, data.settings.affiliate) : undefined;
  if (com) pay.commission = com;
  inv.payments.push(pay);
  // V51.9.92: the first payment enrols the student (a trial student is unlocked at once).
  if (owner && !owner.enrolled) owner.enrolled = { on: date, by: 'payment' };
  return pay;
}
