import type { Metadata } from 'next';
import { ChoiceList, StartShell } from '@/components/ai-guru/start/StartShell';

export const metadata: Metadata = { title: 'Teacher', description: 'Teacher sign-up and sign-in for AI Guru.' };

/** V51.9.198 — the ways in for a teacher. */
export default function TeacherStart() {
  return (
    <StartShell back="/ai-guru/start" backLabel="Back" title="Teacher" sub="Choose how you teach with AI Guru.">
      <ChoiceList items={[
        { id: 'school-join', href: '/ai-guru/school-teacher/join', icon: '🏫', title: 'School teacher? Sign up', text: 'Your school works with AI Guru: sign up with the school ID for your subject and standards.' },
        { id: 'school-signin', href: '/ai-guru/school-teacher', icon: '🔐', title: 'School teacher sign-in', text: 'Open your study materials, exams and students.' },
        { id: 'class', href: '/ai-guru/teacher', icon: '📊', title: 'Class teacher portal', text: 'With a class code: your students’ quiz results, attendance and question sets.' },
      ]} />
    </StartShell>
  );
}
