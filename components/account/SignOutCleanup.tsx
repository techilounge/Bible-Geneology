'use client';

import { useEffect, useState } from 'react';
import { clearAttempts } from '@/components/games/progress-store';

/**
 * The browser's half of signing out.
 *
 * The server can clear its cookies and nothing else. The attempt log, any
 * other key this site wrote, and the service worker's caches all live in
 * the browser, and the Phase 13 exit gate names caches and local storage
 * specifically. So the signed-out page does the clearing, and says it
 * did.
 *
 * Every step is guarded: a private window, blocked site data or a
 * browser with no Cache API must still be able to sign out.
 */
const PREFIX = 'bible-timeline-explorer.';

export function SignOutCleanup() {
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    clearAttempts();

    try {
      const keys: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key !== null && key.startsWith(PREFIX)) keys.push(key);
      }
      for (const key of keys) window.localStorage.removeItem(key);
      window.sessionStorage.clear();
    } catch {
      // Storage is blocked, so there is nothing of ours in it either.
    }

    const caches = 'caches' in window ? window.caches : null;
    const done = caches
      ? caches
          .keys()
          .then((names) => Promise.all(names.map((name) => caches.delete(name))))
          .then(() => undefined)
          .catch(() => undefined)
      : Promise.resolve();

    let live = true;
    void done.then(() => {
      if (live) setCleared(true);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <p data-testid="cleanup" data-cleared={cleared ? 'yes' : 'pending'}>
      {cleared
        ? 'Your saved progress and cached pages have been removed from this browser.'
        : 'Clearing your saved progress and cached pages from this browser…'}
    </p>
  );
}
