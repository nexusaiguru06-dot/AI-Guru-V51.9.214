import { redirect } from 'next/navigation';

/** One classroom: the old home page is now /ai-guru/classroom. */
export default function AIGuruPage() { redirect('/ai-guru/classroom'); }
