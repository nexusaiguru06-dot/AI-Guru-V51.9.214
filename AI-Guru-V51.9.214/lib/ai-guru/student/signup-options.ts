/** V51.9.184 — choices on the sign-up page for country and mother tongue (shared by the page and the server check). */
export const COUNTRIES = ['India', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Kuwait', 'Bahrain', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Singapore', 'Malaysia', 'Other'] as const;
export const MOTHER_TONGUES: ReadonlyArray<readonly [string, string]> = [
  ['Malayalam', 'മലയാളം'], ['Tamil', 'தமிழ்'], ['Kannada', 'ಕನ್ನಡ'], ['Telugu', 'తెలుగు'], ['Hindi', 'हिन्दी'], ['English', 'English'],
  ['Tulu', 'Tulu'], ['Konkani', 'Konkani'], ['Marathi', 'मराठी'], ['Bengali', 'বাংলা'], ['Urdu', 'اردو'], ['Arabic', 'العربية'], ['Other', 'Other'],
];
export const isCountry = (c: string) => (COUNTRIES as readonly string[]).includes(c);
export const isMotherTongue = (m: string) => MOTHER_TONGUES.some(([v]) => v === m);
