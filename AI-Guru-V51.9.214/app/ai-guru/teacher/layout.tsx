import { TeacherGate } from '@/components/ai-guru/teacher/TeacherGate';

/** V51.9.173 — every teacher page needs the teacher's (or the admin's) sign-in. */
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <TeacherGate>{children}</TeacherGate>;
}
