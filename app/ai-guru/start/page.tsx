import type { Metadata } from 'next';
import { ChoiceList, StartShell } from '@/components/ai-guru/start/StartShell';

export const metadata: Metadata = { title: 'Get started', description: 'How do you want to use AI Guru: as a student, a teacher or a parent?' };

/** V51.9.198 — "Get started": who is using AI Guru. */
export default function StartPage() {
  return (
    <StartShell back="/" backLabel="Home" title="How do you want to use AI Guru?" sub="Choose one. You can come back and change it any time.">
      <ChoiceList items={[
        { id: 'student', href: '/ai-guru/start/student', icon: '🎒', title: 'Student', text: 'Learn your textbook with an animated AI teacher, ask doubts and take quizzes.' },
        { id: 'teacher', href: '/ai-guru/start/teacher', icon: '🧑‍🏫', title: 'Teacher', text: 'See your students’ progress, edit study materials and set exams.' },
        { id: 'parent', href: '/ai-guru/parent', icon: '👪', title: 'Parent', text: 'Follow your child’s classes, quizzes and weekly report.' },
      ]} />
    </StartShell>
  );
}
