import { redirect } from 'next/navigation';

/** One classroom: the old Motion Class page is now the "Whole textbook" view inside /ai-guru/classroom. */
export default function MotionClassPage() { redirect('/ai-guru/classroom?view=book'); }
