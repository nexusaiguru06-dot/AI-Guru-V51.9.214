/**
 * Addresses for the admin portal. States and districts come from the MIT-licensed dataset
 * "indian-states-districts" (codingmation); a district must belong to its state, a PIN code is six digits.
 */
import data from './india-districts.json';

export interface Address {
  line1: string;
  line2?: string;
  /** Village / town / locality. */
  area: string;
  postOffice?: string;
  district: string;
  state: string;
  pincode: string;
}

interface StateRow { code: string; name: string; districts: Array<{ code: string; name: string }> }
const STATES = data as StateRow[];

export const stateNames = (): string[] => STATES.map((s) => s.name).sort((a, b) => a.localeCompare(b));
export const districtsOf = (state: string): string[] => (STATES.find((s) => s.name === state)?.districts ?? []).map((d) => d.name);
export const isPincode = (p: string) => /^[1-9]\d{5}$/.test(p.trim());

export const emptyAddress = (): Address => ({ line1: '', line2: '', area: '', postOffice: '', district: '', state: 'Kerala', pincode: '' });

const clean = (s: unknown, max = 120) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function cleanAddress(a: Partial<Address> | undefined): Address {
  return { line1: clean(a?.line1), line2: clean(a?.line2), area: clean(a?.area), postOffice: clean(a?.postOffice), district: clean(a?.district), state: clean(a?.state), pincode: clean(a?.pincode, 6) };
}

/** What is wrong with an address (empty list = fine). `required` false lets a blank address through. */
export function addressProblems(a: Address, required = true): string[] {
  const empty = !a.line1 && !a.area && !a.pincode && !a.district && !a.postOffice;
  if (empty && !required) return [];
  const p: string[] = [];
  if (!a.area) p.push('Village or town is needed');
  if (!a.state || !STATES.some((s) => s.name === a.state)) p.push('Choose a state');
  else if (!districtsOf(a.state).includes(a.district)) p.push('Choose a district of ' + a.state);
  if (a.pincode && !isPincode(a.pincode)) p.push('PIN code must be 6 digits');
  return p;
}

export function formatAddress(a: Address): string {
  return [a.line1, a.line2, a.area, a.postOffice ? `PO ${a.postOffice}` : '', a.district, a.state, a.pincode].filter(Boolean).join(', ');
}
