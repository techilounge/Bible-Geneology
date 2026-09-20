import type { Metadata } from 'next';
import Link from 'next/link';
import { SignOutCleanup } from '@/components/account/SignOutCleanup';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export const metadata: Metadata = {
  title: 'Signed out',
  description: 'You are signed out, and this browser no longer holds your progress.',
};

/**
 * The page that finishes a sign-out.
 *
 * The server has already cleared the session cookies; what is left is in
 * the browser, and only the browser can remove it. The Phase 13 exit gate
 * names local storage and caches, so both are cleared here and the page
 * reports when it is done.
 */
export default function SignedOutPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Account"
        title="You are signed out"
        lede="Your session has ended on this device."
      />
      <SignOutCleanup />
      <p>
        <Link href="/" className="underline" data-testid="keep-exploring">
          Keep exploring
        </Link>{' '}
        — the timeline, the people, the comparisons and the games all work without an
        account.
      </p>
    </PageShell>
  );
}
