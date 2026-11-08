'use client';
import { districtsOf, stateNames, type Address } from '@/lib/ai-guru/admin/address';

const inp = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';

/** Address fields with state → district dropdowns (the district list follows the state). */
export function AddressForm({ value, onChange, legend }: { value: Address; onChange: (a: Address) => void; legend: string }) {
  const set = (k: keyof Address, v: string) => onChange({ ...value, [k]: v, ...(k === 'state' ? { district: '' } : {}) });
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">{legend}</legend>
      <label className="text-xs font-bold text-slate-300 sm:col-span-2">House / street<input className={inp} value={value.line1} onChange={(e) => set('line1', e.target.value)} /></label>
      <label className="text-xs font-bold text-slate-300 sm:col-span-2">Landmark (optional)<input className={inp} value={value.line2 ?? ''} onChange={(e) => set('line2', e.target.value)} /></label>
      <label className="text-xs font-bold text-slate-300">Village / town<input className={inp} value={value.area} onChange={(e) => set('area', e.target.value)} /></label>
      <label className="text-xs font-bold text-slate-300">Post office (optional)<input className={inp} value={value.postOffice ?? ''} onChange={(e) => set('postOffice', e.target.value)} /></label>
      <label className="text-xs font-bold text-slate-300">State<select className={inp} value={value.state} onChange={(e) => set('state', e.target.value)}><option value="">Choose…</option>{stateNames().map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-300">District<select className={inp} value={value.district} onChange={(e) => set('district', e.target.value)}><option value="">Choose…</option>{districtsOf(value.state).map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-300">PIN code<input className={inp} inputMode="numeric" maxLength={6} value={value.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} /></label>
    </fieldset>
  );
}
