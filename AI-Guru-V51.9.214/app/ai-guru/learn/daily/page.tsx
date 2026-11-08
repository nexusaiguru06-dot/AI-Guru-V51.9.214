import type { Metadata } from 'next';
import { DailyChallenge } from '@/components/ai-guru/public/DailyChallenge';

export const metadata: Metadata = { title: 'Daily five-minute challenge', description: 'Five Maths and Science questions every day, in English and Malayalam. Keep your streak and challenge a friend. Free, no sign-up.', alternates: { canonical: '/ai-guru/learn/daily' } };

export default function DailyPage() {
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-10 text-slate-100 sm:px-8"><div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center gap-3"><a href="/ai-guru/learn" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold">← Free lessons</a></header>
      <h1 className="text-3xl font-extrabold">Daily five-minute challenge</h1><p className="mb-6 text-slate-400">Same five questions for everyone today.</p>
      <DailyChallenge />
    </div></main>
  );
}
