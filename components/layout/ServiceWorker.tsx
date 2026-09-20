'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only.
 *
 * In development a cached shell mostly serves to confuse: a change that is
 * not appearing sends someone hunting through their own code rather than
 * their browser's cache.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('Service worker registration failed', error);
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => {
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
