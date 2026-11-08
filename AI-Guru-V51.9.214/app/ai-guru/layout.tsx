import { AiGuruShell } from '@/components/ai-guru/AiGuruShell';

/** V51.9.115: every AI Guru page has the main menu (see AiGuruShell). */
export default function AiGuruLayout({ children }: { children: React.ReactNode }) {
  return <AiGuruShell>{children}</AiGuruShell>;
}
