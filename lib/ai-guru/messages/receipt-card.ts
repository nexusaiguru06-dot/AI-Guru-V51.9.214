/**
 * V51.9.190 — the fee receipt a student gets in Messages, as a printable page ("Print / save as PDF"). Pure.
 */
import type { ReceiptCard } from './core';

const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const rupee = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDate = (d: string) => { const t = Date.parse(`${d}T00:00:00Z`); return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : d; };
export const CONFIRMED_BY: Record<string, string> = { 'bank-alert': 'Confirmed automatically by the bank', statement: 'Confirmed from the bank statement', office: 'Confirmed by the school office' };

/** The rows of the receipt, in order (the card in Messages and the printed page use the same). */
export function receiptRows(r: ReceiptCard): Array<[string, string]> {
  return [
    ['Receipt number', r.receiptNo],
    ...(r.txnId ? [['Transaction ID', r.txnId] as [string, string]] : []),
    ...(r.utr ? [['UPI reference (UTR)', r.utr] as [string, string]] : []),
    ['Date', fmtDate(r.date)],
    ['Student', `${r.student}${r.studentCode ? ` · ${r.studentCode}` : ''}${r.standard ? ` · Std ${r.standard}` : ''}`],
    ['Paid for', r.forWhat],
    ['Payment mode', r.mode],
    ...(r.paidTo ? [['Paid to', r.paidTo] as [string, string]] : []),
    ['Bill total', rupee(r.total)],
    ['Balance on this bill', r.balance > 0 ? rupee(r.balance) : 'Nil — this bill is paid'],
    ...(r.opened ? [['Now open', `${r.opened} of every book`] as [string, string]] : []),
    ...(r.stillToPay ? [['Still to pay', `${r.stillToPay.parts}: ${rupee(r.stillToPay.amount)} — when you are ready`] as [string, string]] : []),
  ];
}

export function receiptCardHtml(r: ReceiptCard): string {
  const rows = receiptRows(r).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt ${esc(r.receiptNo)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef4fb;font:15px/1.5 "Noto Sans","Noto Sans Malayalam",system-ui,sans-serif;color:#0f172a}
.card{max-width:560px;margin:24px auto;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,.15)}
.top{background:linear-gradient(135deg,#0e7490,#7c3aed);color:#fff;padding:26px 28px}
.top h1{margin:0;font-size:22px}.top p{margin:4px 0 0;opacity:.85;font-size:13px}
.amount{padding:22px 28px 6px;text-align:center}.amount b{display:block;font-size:40px;color:#047857}.amount span{color:#475569;font-size:13px}
.congrats{margin:10px 28px;padding:12px 14px;border-radius:14px;background:#ecfdf5;color:#065f46;font-weight:700;text-align:center}
table{width:calc(100% - 56px);margin:8px 28px 18px;border-collapse:collapse}th,td{padding:9px 0;border-bottom:1px dashed #cbd5e1;text-align:left;vertical-align:top}
th{color:#64748b;font-weight:600;width:44%}td{font-weight:700}.ok{margin:0 28px 22px;color:#0e7490;font-size:13px;text-align:center}
.foot{background:#f8fafc;padding:12px 28px;color:#64748b;font-size:12px;text-align:center}@media print{body{background:#fff}.card{box-shadow:none;margin:0 auto}}
</style></head><body><div class="card">
<div class="top"><h1>${esc(r.school)}</h1><p>Fee receipt · AI Guru</p></div>
<div class="amount"><b>${esc(rupee(r.amount))}</b><span>received on ${esc(fmtDate(r.date))}</span></div>
<div class="congrats">🎉 Congratulations, ${esc(r.student.split(' ')[0] || r.student)}!${r.allOpen ? ' All ten parts are open for you.' : r.opened ? ` ${esc(r.opened)} is open for you.` : ''}</div>
<table>${rows}</table>
${r.confirmedBy ? `<p class="ok">✔ ${esc(CONFIRMED_BY[r.confirmedBy] ?? '')}</p>` : ''}
<div class="foot">This receipt was made by AI Guru. Keep it for your records.</div>
</div><script>setTimeout(function(){try{print()}catch(e){}},400)</script></body></html>`;
}
