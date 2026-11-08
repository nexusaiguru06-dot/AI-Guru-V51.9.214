import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join AI Guru',
  description: 'Make your free AI Guru account: animated lessons in Malayalam and English, quizzes that earn toffees, and a discount if a friend invited you.',
  openGraph: { title: 'Join AI Guru', description: 'A friend invited you to learn on AI Guru. Sign up and get a discount on fees.' },
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) { return children; }
