'use client';

import { useEffect, useState } from 'react';
import { readAttempts } from '@/components/games/progress-store';

/**
 * Carrying a browser's progress into an account.
 *
 * Someone plays for a week signed out and then signs in; losing that week
 * is the bug this exists to prevent. The log is read here, in the
 * browser, because that is the only place it is, and handed to the server
 * action in a hidden field.
 *
 * The merge itself is a set union (`lib/account/merge.ts`), so pressing
 * this twice adds nothing the second time. With scripting off the field
 * stays empty and the button says so rather than pretending.
 */
export function SyncProgress({ action }: { action: (data: FormData) => void }) {
  const [payload, setPayload] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const attempts = readAttempts();
    setCount(attempts.length);
    setPayload(JSON.stringify(attempts));
  }, []);

  if (payload === null || count === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]" data-testid="sync-none">
        This browser is not holding any rounds that your account does not already have.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="attempts" value={payload} />
      <button
        type="submit"
        data-testid="sync-progress"
        className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        Add {count} {count === 1 ? 'round' : 'rounds'} from this browser
      </button>
      <span className="text-sm text-[var(--color-text-secondary)]">
        Rounds your account already has are not counted twice.
      </span>
    </form>
  );
}
