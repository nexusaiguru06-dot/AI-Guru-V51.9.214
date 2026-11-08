import type { Metadata } from 'next';
import { ContestRun } from '@/components/ai-guru/public/ContestRun';

export const metadata: Metadata = { title: 'Festival quizzes with bonus toffees', description: 'Onam, Children’s Day, Christmas and Republic Day quizzes in English and Malayalam with bonus toffees and a leaderboard.', alternates: { canonical: '/ai-guru/learn/contest' } };

export default function ContestPage() {
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-10 text-slate-100 sm:px-8"><div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center gap-3"><a href="/ai-guru/learn" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold">← Free lessons</a></header>
      <h1 className="mb-6 text-3xl font-extrabold">Festival quizzes</h1>
      <ContestRun />
    </div></main>
  );
}
