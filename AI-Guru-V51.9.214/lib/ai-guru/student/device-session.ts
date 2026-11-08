/**
 * V51.9.182 (newcomer review) — tying this device to the signed-in student, and untying it at sign-out.
 *
 * Quizzes, attendance and reels on a device are saved under `ai-guru:student-id`. Before, only the "My account" page set
 * it to the account, and signing out left it (and the name, school and place) behind — so on a shared phone a sibling's
 * work landed on the first child's record, and the sign-up form came pre-filled with the first child's details.
 */
import { PROFILE_KEY } from './profile';
import { STUDENT_ID_KEY } from '../motion-class/interactive/progress';

const NAME_KEY = 'ai-guru:student-name';
/** The account id this device is tied to (set at sign-in / sign-up, removed at sign-out). */
export const ACCOUNT_KEY = 'ai-guru:account-on-device';
/** The teaching language the classroom opens in: 'ml' or 'en' (from the student's medium). */
export const TEACH_LANGUAGE_KEY = 'ai-guru:teach-language';

const ls = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

/** The visitor id quizzes were saved under on this device before signing in (sent so the server can move them). */
export function visitorIdOnDevice(): string {
  const s = ls(); if (!s) return '';
  const id = s.getItem(STUDENT_ID_KEY) ?? '';
  return id && id !== s.getItem(ACCOUNT_KEY) ? id : '';
}

/** After sign-in or sign-up: this device now saves work under the account. */
export function adoptAccount(a: { quizId?: string; name?: string; medium?: string }) {
  const s = ls(); if (!s || !a.quizId) return;
  try {
    s.setItem(STUDENT_ID_KEY, a.quizId);
    s.setItem(ACCOUNT_KEY, a.quizId);
    if (a.name) s.setItem(NAME_KEY, a.name);
    if (a.medium) s.setItem(TEACH_LANGUAGE_KEY, a.medium === 'malayalam' ? 'ml' : 'en');
  } catch { /* storage full or blocked: the account still works */ }
  try { window.dispatchEvent(new Event('aig-signed-in')); } catch { /* not in a browser */ }
}

/** Whether a signed-in account is tied to this device (so forms must not pre-fill its details for someone else). */
export const accountOnDevice = (): boolean => !!ls()?.getItem(ACCOUNT_KEY);

/** At sign-out: the next person on this phone starts as a new visitor, with nothing of the last student's filled in. */
export function forgetAccountOnDevice() {
  const s = ls(); if (!s) return;
  try {
    if (s.getItem(ACCOUNT_KEY)) {
      if (s.getItem(STUDENT_ID_KEY) === s.getItem(ACCOUNT_KEY)) s.removeItem(STUDENT_ID_KEY);
      for (const k of [ACCOUNT_KEY, NAME_KEY, PROFILE_KEY, TEACH_LANGUAGE_KEY]) s.removeItem(k);
    }
  } catch { /* blocked storage: nothing to clear */ }
}
