import type { MetadataRoute } from 'next';
import { LESSONS } from '@/lib/ai-guru/public/lessons';
import { SITE_URL } from '@/lib/ai-guru/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/ai-guru`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/ai-guru/learn`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...LESSONS.map((l) => ({ url: `${SITE_URL}/ai-guru/learn/${l.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...['daily', 'revise', 'contest'].map((x) => ({ url: `${SITE_URL}/ai-guru/learn/${x}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...LESSONS.map((l) => ({ url: `${SITE_URL}/ai-guru/learn/revise/${l.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6 })),
    { url: `${SITE_URL}/ai-guru/lab3d`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/ai-guru/safety`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/ai-guru/student/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
