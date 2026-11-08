/** The public address of the app, for link previews, the sitemap and shared links. Set NEXT_PUBLIC_SITE_URL in production (e.g. https://aiguru.example). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
/** The short invite link for a referral code. */
export const inviteLink = (origin: string, code?: string) => `${origin}${code ? `/j/${code}` : '/ai-guru/student/signup'}`;
export const SITE_NAME = 'AI Guru';
export const SITE_TAGLINE = 'Your own AI teacher for Maths and Science';
export const SITE_DESCRIPTION = 'AI Guru is an AI classroom for school students everywhere: step-by-step animated lessons in Malayalam and English, quizzes that earn toffees, and reports for parents and teachers.';
