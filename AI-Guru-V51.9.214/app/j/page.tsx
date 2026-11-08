/**
 * V51.9.91: /j — type a join code instead of scanning the QR. For a student who sees the reel on the same phone, on a TV, or
 * on a printed poster. A plain HTML form (works without JavaScript on any phone): /j?code=anja k7q2 → /j/ANJAK7Q2.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cleanCode, isCode } from '@/lib/ai-guru/share/join-code';

export const metadata: Metadata = {
  title: 'Enter your code',
  description: 'Got a code from a friend or your teacher? Type it here to join AI Guru.',
};

export default async function JoinWithCode({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const sp = await searchParams;
  const typed = Array.isArray(sp.code) ? sp.code[0] : sp.code;
  const code = cleanCode(typed);
  if (typed !== undefined && isCode(code)) redirect(`/j/${code}`);
  const wrong = typed !== undefined && typed.trim() !== '';
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <form action="/j" method="get" className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-xl">
        <p className="text-sm font-extrabold tracking-[0.3em] text-cyan-300">AI GURU</p>
        <h1 className="mt-3 text-2xl font-extrabold">Enter your code</h1>
        <p className="mt-1 text-sm text-slate-300">From a friend’s video, a score card or your teacher’s poster.</p>
        
        <label htmlFor="code" className="sr-only">Code</label>
        <input
          id="code"
          name="code"
          defaultValue={typed ?? ''}
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={20}
          placeholder="ANJA K7Q2"
          className="mt-5 w-full rounded-2xl border-2 border-dashed border-cyan-400/60 bg-slate-900 px-4 py-4 text-center font-mono text-3xl font-bold uppercase tracking-[0.25em] text-amber-200 placeholder:text-slate-600 focus:border-cyan-300 focus:outline-none"
        />
        {wrong && <p className="mt-2 text-sm text-rose-300">That doesn’t look like a code. It has 4–12 letters and numbers.</p>}
        <button type="submit" className="mt-4 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 py-3 text-lg font-bold">Join</button>
        <p className="mt-4 text-xs text-slate-400">No code? <a href="/ai-guru/student/signup" className="font-bold text-cyan-300 underline">Sign up without one</a></p>
      </form>
    </main>
  );
}
