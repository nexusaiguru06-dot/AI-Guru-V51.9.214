/**
 * V51.9.107 — the sign-up form's details, kept on the device even without an account, for the reels' footer
 * ("Anu Thomas · Std 8", "GHSS Aluva, Aluva, Ernakulam"). Pure.
 */
import type { StudentProfile } from './profile';

export interface SignupFields { name: string; standard: string; school: string; place: string; district: string }

/** The device profile after typing on the sign-up form: typed fields win, empty ones keep what the device had. null = nothing typed. */
export function deviceProfileFrom(f: SignupFields, had: StudentProfile): StudentProfile | null {
  const t = (v: string) => v.replace(/\s+/g, ' ').trim();
  const name = t(f.name), standard = t(f.standard), school = t(f.school);
  const place = [t(f.place), t(f.district)].filter(Boolean).join(', ');
  if (!name && !standard && !school && !place) return null;
  return { ...had, name: name || had.name, standard: standard || had.standard, school: school || had.school, place: place || had.place };
}
