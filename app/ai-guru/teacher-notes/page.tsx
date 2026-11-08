'use client';
import { AiGuruTopNav } from '@/components/ai-guru/AiGuruTopNav';
import { FromMyTeacher } from '@/components/ai-guru/share/FromMyTeacher';

/** Student menu → Teachers Notes: the notes, worksheets and exams my own teacher sent to my class. */
export default function TeacherNotesPage() {
  return (
    <div className="min-h-screen bg-[#050b14] text-slate-100">
      <AiGuruTopNav activeLabel="Teachers Notes" />
      <main className="mx-auto max-w-3xl px-4 py-6"><h1 className="mb-3 text-xl font-extrabold">📘 Teachers Notes</h1><FromMyTeacher /></main>
    </div>
  );
}
