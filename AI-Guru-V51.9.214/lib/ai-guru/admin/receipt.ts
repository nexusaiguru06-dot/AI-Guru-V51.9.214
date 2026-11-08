import { formatAddress, type Address } from './address';
import { invoiceTotal, rupees, type Invoice, type Payment, type Student } from './fees';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The printable fee receipt (a complete HTML page that opens the print box). */
export function receiptHtml(school: { name: string; address: Address }, st: Pick<Student, 'name' | 'standard' | 'admissionNo' | 'guardianName' | 'address'> | undefined, i: Invoice, p: Payment): string {
  const before = i.payments.filter((x) => x.receiptNo <= p.receiptNo).reduce((a, x) => a + x.amount, 0);
  const balance = Math.max(0, Math.round((invoiceTotal(i) - before) * 100) / 100);
  return `<!doctype html><title>${esc(p.receiptNo)}</title><body style="font:15px system-ui;max-width:560px;margin:24px auto;color:#111"><h2 style="margin:0">${esc(school.name || 'Fee receipt')}</h2><div style="color:#555">${esc(formatAddress(school.address))}</div><hr><h3>Receipt ${esc(p.receiptNo)}</h3><p>Date: ${esc(p.date)}<br>Student: <b>${esc(st?.name ?? '')}</b> (Std ${esc(st?.standard ?? '')}, Adm. ${esc(st?.admissionNo || '-')})<br>Guardian: ${esc(st?.guardianName || '-')}<br>Address: ${esc(st ? formatAddress(st.address) : '')}</p><table style="width:100%;border-collapse:collapse">${i.items.map((x) => `<tr><td style="padding:4px 0">${esc(x.name)}</td><td align=right>${esc(rupees(x.amount))}</td></tr>`).join('')}${i.discount ? `<tr><td>Discount</td><td align=right>- ${esc(rupees(i.discount))}</td></tr>` : ''}<tr><td style="border-top:1px solid #999;padding-top:6px"><b>${esc(i.term)} total</b></td><td align=right style="border-top:1px solid #999"><b>${esc(rupees(invoiceTotal(i)))}</b></td></tr></table><p style="font-size:18px">Paid now (${esc(p.mode)}): <b>${esc(rupees(p.amount))}</b><br>Balance after this payment: <b>${esc(rupees(balance))}</b></p><p style="color:#777;font-size:12px">Computer-generated receipt.</p><script>window.print()</script>`;
}
