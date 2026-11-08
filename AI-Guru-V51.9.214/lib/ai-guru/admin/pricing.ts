/**
 * V51.9.92: what each standard pays — the fee (from the fee heads), the price with a friend's code and with a class code,
 * and the commission the friend earns on that first bill. Shown to the admin next to the discount and commission settings,
 * so a change can be checked in rupees before it is saved. Pure.
 */
import { commissionOf, type AffiliateSettings } from './affiliate';
import { couponDiscount, invoiceTotal, itemsFor, type Coupon, type FeeHead } from './fees';
import type { GroupSettings } from './groups';

export interface PriceRow { standard: string; fee: number; friendPays: number; classPays: number; commission: number }

export function priceRows(heads: FeeHead[], standards: string[], aff: AffiliateSettings, groups: Pick<GroupSettings, 'discountPct'>): PriceRow[] {
  const friend: Coupon = { code: 'FRIEND', kind: aff.discountKind === 'flat' ? 'flat' : 'percent', value: aff.discountPct, used: 0, active: aff.enabled };
  const cls: Coupon = { code: 'CLASS', kind: 'percent', value: groups.discountPct, used: 0, active: true };
  return standards.map((standard) => {
    const fee = invoiceTotal({ items: itemsFor(heads, standard), discount: 0 });
    const friendPays = Math.round((fee - couponDiscount(friend, fee, false)) * 100) / 100;
    const classPays = Math.round((fee - couponDiscount(cls, fee, false)) * 100) / 100;
    return { standard, fee, friendPays, classPays, commission: aff.enabled ? commissionOf(friendPays, aff.commissionPct) : 0 };
  }).filter((r) => r.fee > 0);
}

/** Every standard that has students or its own fee head (plus "all" heads applied to each). */
export function priceTable(data: { heads: FeeHead[]; students: Array<{ standard: string }>; settings: { affiliate: AffiliateSettings; groups: GroupSettings } }): PriceRow[] {
  const stds = [...new Set([...data.students.map((s) => s.standard), ...data.heads.map((h) => h.standard)].filter((x) => x && x !== 'all'))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return priceRows(data.heads, stds, data.settings.affiliate, data.settings.groups);
}
