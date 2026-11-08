import type { Metadata } from 'next';
import { SchoolTeacherPortal } from '@/components/ai-guru/teacher/SchoolTeacherPortal';

export const metadata: Metadata = { title: 'School teacher portal · AI Guru', robots: { index: false } };

/** V51.9.193 — the portal of a teacher at a contracted school (sign in with the teacher ID TS-…). */
export default function Page() {
  return (
    <main className="min-h-screen bg-[#06101c] text-slate-100">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-extrabold">🏫 School teacher portal </h1>
        <SchoolTeacherPortal />
      </div>
    </main>
  );
}
