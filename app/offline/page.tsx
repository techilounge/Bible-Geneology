import type { Metadata } from 'next';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'This page needs a connection.',
};

/**
 * Shown by the service worker when a navigation fails offline.
 *
 * It offers nothing from the cache, deliberately. The alternative would be a
 * chronology the reader cannot date, and a number you cannot account for is
 * the one thing this app must not show.
 */
export default function OfflinePage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Offline"
        title="You are offline"
        lede="This page needs a connection. Rather than showing you a saved copy of the chronology, which might be out of date without saying so, it is showing you nothing."
      />
      <p className="text-[var(--color-text-secondary)]">
        Reconnect and reload, and everything will be exactly as current as the source
        data.
      </p>
    </PageShell>
  );
}
