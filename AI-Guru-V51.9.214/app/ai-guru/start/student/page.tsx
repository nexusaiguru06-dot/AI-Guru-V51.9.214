import type { Metadata } from 'next';
import { ChoiceList, StartShell } from '@/components/ai-guru/start/StartShell';

export const metadata: Metadata = { title: 'Student', description: 'Sign up, download your textbooks and study materials, add your AI key for unlimited doubts, and start your class.' };

/** V51.9.198 — the student's four steps, in order. */
export default function StudentStart() {
  return (
    <StartShell back="/ai-guru/start" backLabel="Back" title="Student" sub="Four steps. Do them in order the first time.">
      <ChoiceList numbered items={[
        { id: 'signup', href: '/ai-guru/student/signup', icon: '✍️', title: 'New? Sign up', text: 'Make your free account. Already have one? Sign in on the next page.' },
        { id: 'library', href: '/ai-guru/student/library', icon: '📥', title: 'Download your study materials', text: 'Your textbooks and their whiteboard notes, MCQs and revision are made by AI Guru’s teachers. Part 1 is free.' },
        { id: 'classroom', href: '/ai-guru/classroom', icon: '🎓', title: 'Classroom', text: 'Start the class: your AI teacher explains every paragraph on the whiteboard.' },
        { id: 'key', href: '/ai-guru/settings/gemini', icon: '🔑', title: 'Set your API key (for unlimited doubts)', text: 'The API setting is for unlimited doubt clearing. Without it you get a few free minutes a day. A key is free from Google.' },
      ]} />
      <p className="mt-6 text-center text-sm text-[color:var(--ag-muted)]">Already signed up? <a className="font-bold text-[color:var(--ag-accent-ink)] underline" href="/ai-guru/student">Sign in to My account</a></p>
    </StartShell>
  );
}
