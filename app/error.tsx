'use client';

import { useEffect } from 'react';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';

/**
 * The error boundary says what failed and offers a way forward. It never
 * shows a partial or guessed result in place of the real one: a chart drawn
 * from half a dataset is worse than no chart, because it looks like an answer.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Error"
        title="Something went wrong loading this page"
        lede="Nothing was shown rather than showing part of it. Partial chronology data looks like an answer, which is worse than none."
      />
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
      {error.digest ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          Reference: {error.digest}
        </p>
      ) : null}
    </PageShell>
  );
}
