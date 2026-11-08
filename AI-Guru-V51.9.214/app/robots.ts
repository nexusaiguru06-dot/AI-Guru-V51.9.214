import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/ai-guru/site';

/** Search engines may read the public lessons; accounts, portals and the API are private. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/ai-guru/learn'], disallow: ['/api/', '/ai-guru/admin', '/ai-guru/student', '/ai-guru/teacher', '/ai-guru/parent'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
