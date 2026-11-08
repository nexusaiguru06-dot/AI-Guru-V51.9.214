import type { Metadata } from 'next';
import MessagesApp from '@/components/ai-guru/messages/MessagesApp';

export const metadata: Metadata = { title: 'Messages', description: 'Messages with the AI Guru office, your teacher or your students.' };

/** V51.9.153 — Messages for students and teachers (?as=teacher opens the teacher's sign-in). The app's frame draws the menu. */
export default function MessagesPage() {
  return (
    <main className="min-h-screen bg-[#04101c] text-white">
      <MessagesApp />
    </main>
  );
}
