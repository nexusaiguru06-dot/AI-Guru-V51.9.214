import type { Metadata, Viewport } from 'next';
import './globals.css';
import './ai-guru-theme.css';
import { THEME_BOOT } from '../lib/ai-guru/theme';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '../lib/ai-guru/site';
import ServiceWorkerRepair from '../components/pwa/ServiceWorkerRepair';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: 'website', siteName: SITE_NAME, title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESCRIPTION, locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
  // V51.9.197: installable as an app with the AI Guru logo on the home screen
  manifest: '/app-manifest',
  icons: { apple: '/app-icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { themeColor: '#06101c' };

/** V51.9.197: Chrome offers to install the app once, early; keep that offer for our own "Download the app?" card. */
const INSTALL_BOOT = "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__aigInstall=e;window.dispatchEvent(new Event('aig-install-ready'))});window.addEventListener('appinstalled',function(){window.__aigInstall=null;try{localStorage.setItem('aig_app','installed')}catch(e){}});";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="night" suppressHydrationWarning>
      <head>
        {/* V51.9.169: Day / Night — the saved theme is applied before the page draws (no flash) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: INSTALL_BOOT }} />
        {/* V51.9.169: Sora (headings), Noto Sans (English), Noto Sans Malayalam, Kalam (logo) — hosted with the app */}
        <link rel="stylesheet" href="/fonts/ag/fonts.css" />
        {/* Chilanka (Malayalam handwriting, SMC, OFL) — hosted with the app, so it works offline. V51.9.181: the extra
            copy from fonts.googleapis.com is gone; it only added an outside request (and failed where Google is blocked). */}
        <link rel="stylesheet" href="/fonts/chilanka/chilanka.css" />
      </head>
      {/* V51.9.169: Noto Sans for English and Noto Sans Malayalam / Chilanka for Malayalam (set in ai-guru-theme.css) */}
      <body>
        <ServiceWorkerRepair />
        {children}
      </body>
    </html>
  );
}
