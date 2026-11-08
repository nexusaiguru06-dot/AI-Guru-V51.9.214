import { NextResponse } from 'next/server';
import { bad, denied } from '../guard';
import { newId, readData, update } from '@/lib/ai-guru/admin/store';
import { recordPayment } from '@/lib/ai-guru/admin/record-payment';
import { couponDiscount, csvOf, invoiceDue, invoicePaid, invoiceStatus, invoiceTotal, itemsFor, summarise, type Invoice } from '@/lib/ai-guru/admin/fees';
import { notifyCommission, sendPaymentReceipt } from '@/lib/ai-guru/messages/notify';
import { istToday } from '@/lib/ai-guru/admin/enrolment';

import { switchToUpfront } from '@/lib/ai-guru/admin/part-plan';
export const dynamic = 'force-dynamic';
const MODES = ['cash', 'upi', 'card', 'bank', 'cheque'];
const money = (x: unknown) => Math.round(Number(x) * 100) / 100;
const txt = (x: unknown, n = 80) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const sum = (items: Array<{ amount: number }>) => Math.round(items.reduce((a, x) => a + x.amount * 100, 0)) / 100;
const day = (x: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x ?? '')) ? String(x) : '');

/** GET — heads, invoices (with student names) and totals. GET ?format=csv — the fee register as a spreadsheet file. */
export async function GET(req: Request) {
  const d = await denied(req); if (d) return d;
  const data = await readData();
  const name = (id: string) => data.students.find((s) => s.id === id);
  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const rows = [['Student', 'Standard', 'Term', 'Total', 'Paid', 'Due', 'Status', 'Due date', 'Receipts']].concat(
      data.invoices.map((i) => [name(i.studentId)?.name ?? '', name(i.studentId)?.standard ?? '', i.term, String(invoiceTotal(i)), String(invoicePaid(i)), String(invoiceDue(i)), invoiceStatus(i), i.dueDate ?? '', i.payments.map((p) => p.receiptNo).join(' ')]));
    return new NextResponse(csvOf(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="fee-register.csv"' } });
  }
  return NextResponse.json({ ok: true, heads: data.heads, invoices: data.invoices, summary: summarise(data.invoices), school: data.school });
}

/**
 * POST { action, … }:
 *   head      { head: { id?, name, amount, standard } }   add or change a fee head
 *   removeHead{ id }
 *   invoice   { studentId, term, dueDate?, discount?, items? }   one student (items default to the heads of their standard)
 *   generate  { standard, term, dueDate? }   an invoice for every student of a standard that has none for this term
 *   pay       { invoiceId, amount, date, mode, note? }   records a payment and gives the receipt number
 *   removeInvoice { id }   only while nothing has been paid
 */
export async function POST(req: Request) {
  const d = await denied(req); if (d) return d;
  const b = await req.json().catch(() => ({}));
  switch (b.action) {
    case 'head': {
      const h = b.head ?? {}; const name = txt(h.name), amount = money(h.amount), standard = txt(h.standard, 8) || 'all';
      if (!name || !(amount > 0)) return bad('Fee head needs a name and an amount above zero');
      const r = await update((data) => { const i = data.heads.findIndex((x) => x.id === h.id); const v = { id: i >= 0 ? data.heads[i].id : newId('hd'), name, amount, standard }; if (i >= 0) data.heads[i] = v; else data.heads.push(v); return v; });
      return NextResponse.json({ ok: true, head: r });
    }
    case 'removeHead': { await update((data) => { data.heads = data.heads.filter((h) => h.id !== b.id); }); return NextResponse.json({ ok: true }); }
    case 'invoice': {
      const term = txt(b.term, 40);
      if (!term) return bad('Give the invoice a term, e.g. "Term 1 2026-27"');
      const r = await update((data) => {
        const st = data.students.find((s) => s.id === b.studentId);
        if (!st) return 'Student not found';
        if (data.invoices.some((i) => i.studentId === st.id && i.term === term)) return 'This student already has an invoice for that term';
        const items = Array.isArray(b.items) && b.items.length ? b.items.map((x: { name?: string; amount?: number }) => ({ name: txt(x.name), amount: money(x.amount) })).filter((x: { name: string; amount: number }) => x.name && x.amount > 0) : itemsFor(data.heads, st.standard);
        if (!items.length) return 'No fee heads apply to this standard yet. Add fee heads first';
        const cp = data.coupons.find((c) => c.code === st.coupon);
        const flatUsed = data.invoices.some((i) => i.studentId === st.id && i.coupon === st.coupon);
        const off = couponDiscount(cp, sum(items), flatUsed);
        const inv: Invoice = { id: newId('inv'), studentId: st.id, term, items, discount: Math.min(sum(items), Math.max(0, money(b.discount) || 0) + off), coupon: off > 0 ? st.coupon : undefined, dueDate: day(b.dueDate) || undefined, payments: [], createdAt: new Date().toISOString() };
        data.invoices.push(inv);
        return inv;
      });
      return typeof r === 'string' ? bad(r) : NextResponse.json({ ok: true, invoice: r });
    }
    case 'generate': {
      const term = txt(b.term, 40), standard = txt(b.standard, 8);
      if (!term || !standard) return bad('Choose a standard and a term');
      const n = await update((data) => {
        const items = itemsFor(data.heads, standard);
        if (!items.length) return -1;
        let c = 0;
        for (const s of data.students.filter((x) => x.standard === standard)) {
          if (data.invoices.some((i) => i.studentId === s.id && i.term === term)) continue;
          const cp = data.coupons.find((c) => c.code === s.coupon);
          const off = couponDiscount(cp, sum(items), data.invoices.some((i) => i.studentId === s.id && i.coupon === s.coupon));
          data.invoices.push({ id: newId('inv'), studentId: s.id, term, items, discount: off, coupon: off > 0 ? s.coupon : undefined, dueDate: day(b.dueDate) || undefined, payments: [], createdAt: new Date().toISOString() });
          c++;
        }
        return c;
      });
      return n < 0 ? bad('No fee heads apply to this standard yet. Add fee heads first') : NextResponse.json({ ok: true, created: n });
    }
    case 'pay': {
      const amount = money(b.amount), date = day(b.date), mode = MODES.includes(b.mode) ? b.mode : 'cash';
      const r = await update((data) => recordPayment(data, String(b.invoiceId ?? ''), amount, date, mode, txt(b.note, 120) || undefined));
      if (typeof r === 'string') return bad(r);
      // V51.9.185: the student whose link brought this one in hears about the commission at once
      if (r.commission) { const d = await readData(); const payer = d.invoices.find((i) => i.id === b.invoiceId)?.studentId; if (payer) await notifyCommission(d, r.commission, payer, istToday()).catch(() => undefined); }
      await sendPaymentReceipt(await readData(), r.id).catch(() => false); // V51.9.190: 🎉 Congratulations + receipt in Messages
      return NextResponse.json({ ok: true, payment: r });
    }
    case 'partsUpfront': {
      // V51.9.191: the part plan, all at once at the counter: the unpaid part bills become one all-at-once bill, paid now
      const date = day(b.date), mode = MODES.includes(b.mode) ? b.mode : 'cash';
      const r = await update((data) => {
        const sw = switchToUpfront(data, String(b.studentId ?? ''), date || istToday());
        if (typeof sw === 'string') return sw;
        const inv = data.invoices.find((i) => i.id === sw.invoiceId)!;
        return recordPayment(data, inv.id, invoiceTotal(inv), date, mode, txt(b.note, 120) || undefined);
      });
      if (typeof r === 'string') return bad(r);
      if (r.commission) await notifyCommission(await readData(), r.commission, String(b.studentId), istToday()).catch(() => undefined);
      await sendPaymentReceipt(await readData(), r.id).catch(() => false);
      return NextResponse.json({ ok: true, payment: r });
    }
    case 'removeInvoice': {
      const r = await update((data) => { const i = data.invoices.find((x) => x.id === b.id); if (!i) return 'Invoice not found'; if (invoicePaid(i) > 0) return 'Payments are recorded on this invoice, so it cannot be removed'; if ([...data.yearly, ...data.monthly].some((r) => r.invoiceId === i.id)) return 'This bill belongs to a monthly or yearly plan: remove it in the Monthly & yearly tab'; data.invoices = data.invoices.filter((x) => x.id !== b.id); return ''; });
      return r ? bad(r, 409) : NextResponse.json({ ok: true });
    }
  }
  return bad('Unknown action');
}
