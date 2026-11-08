'use client';

import { useEffect } from 'react';

/** Installs the repaired service worker and forces stale V51.x workers to update. */
export default function ServiceWorkerRepair() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    const repair = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        await registration.update();
        if (!cancelled && registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch (error) {
        console.warn('[AI Guru] service-worker repair failed; continuing network-only', error);
      }
    };
    void repair();
    return () => { cancelled = true; };
  }, []);

  return null;
}
