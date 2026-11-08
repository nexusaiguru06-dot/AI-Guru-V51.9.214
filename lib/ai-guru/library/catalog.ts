/**
 * V51.9.95: the shared study-material library ("the cloud"). Every book uploaded in Material Studio — by the admin or by a
 * student — and every material made for it is kept on the server. A student finds the books of their own syllabus and
 * standard (entered at sign-up), checks the first pages, and downloads them one by one. Pure helpers, no I/O.
 */
import type { IndexedDocument } from '../material-studio/types';

/** Same values as Material Studio's syllabus list. */
export const SYLLABI: Array<[string, string]> = [['kerala', 'Kerala State (SCERT)'], ['cbse', 'CBSE (NCERT)'], ['tamilnadu', 'Tamil Nadu'], ['karnataka', 'Karnataka'], ['icse', 'ICSE'], ['other', 'Other']];
/** Medium of instruction = the language of the textbook. Same values as Material Studio's languages. */
export const MEDIUMS: Array<[string, string]> = [['english', 'English medium'], ['malayalam', 'Malayalam medium'], ['tamil', 'Tamil medium'], ['hindi', 'Hindi medium']];

/** "SCERT Kerala", "Kerala State" → "kerala"; "NCERT"/"CBSE" → "cbse"; anything else → its lower-case letters. */
export function syllabusKey(s: string | undefined): string {
  const x = String(s ?? '').toLowerCase();
  if (!x.trim()) return '';
  if (/cbse|ncert/.test(x)) return 'cbse';
  if (/icse|cisce/.test(x)) return 'icse';
  if (/kerala|scert|keral/.test(x)) return 'kerala';
  if (/tamil\s*nadu|tn\b|samacheer/.test(x)) return 'tamilnadu';
  if (/karnataka|ktbs/.test(x)) return 'karnataka';
  return x.replace(/[^a-z0-9]/g, '');
}
/** "Std 8", "Class 8", "8" → "8"; "LKG" stays "lkg". */
export const gradeKey = (g: string | undefined) => { const x = String(g ?? '').toLowerCase(); const n = x.match(/\d+/); return n ? String(Number(n[0])) : x.replace(/[^a-z]/g, ''); };
export const syllabusLabel = (k: string | undefined) => SYLLABI.find(([v]) => v === syllabusKey(k))?.[1] ?? (k || '—');

/** V51.9.107: 'guest' = made without signing in (private to that browser; see library/guest.ts). */
export interface Owner { kind: 'admin' | 'student' | 'guest'; id?: string; name?: string; via?: 'studio' | 'cloud' }

/** A book matches a student when the syllabus and the standard are the same. The medium only orders the list. */
export const bookMatches = (doc: Pick<IndexedDocument, 'syllabus' | 'grade'>, st: { syllabus?: string; standard: string }) =>
  !!st.syllabus && syllabusKey(doc.syllabus) === syllabusKey(st.syllabus) && gradeKey(doc.grade) === gradeKey(st.standard);

export const mediumOf = (doc: Pick<IndexedDocument, 'sourceLanguage'>) => String(doc.sourceLanguage || '').toLowerCase();

/** Who made it, as students see it (a student's full name is never shown to other students). */
export const ownerLabel = (o?: Owner) => (!o || o.kind === 'admin' ? 'AI Guru' : 'Made by a student');
