import type { Metadata } from 'next';
import Link from 'next/link';
import { syncProgressAction } from '@/app/account/actions';
import { SignOutButton } from '@/components/account/SignOutButton';
import { SyncProgress } from '@/components/account/SyncProgress';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { summarise } from '@/lib/progress';
import {
  accountsEnabled,
  getAccountAttempts,
  getCurrentUser,
  getFavourites,
  getProfile,
} from '@/lib/services/account';

export const metadata: Metadata = {
  title: 'Your account',
  description:
    'Favourites, saved comparisons and progress, for readers who want them kept. Nothing on this site requires an account.',
};

/**
 * The account page, which has to make sense in three states: no accounts
 * configured at all, configured and signed out, and signed in.
 *
 * The first is not an error. Requirement section 46 puts exploration
 * ahead of accounts, so a deployment with no Supabase renders this page
 * and says plainly what is unavailable rather than failing.
 */
export const dynamic = 'force-dynamic';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const addedRaw = Array.isArray(params.added) ? params.added[0] : params.added;
  const added = addedRaw === undefined ? null : Number.parseInt(addedRaw, 10);

  const enabled = accountsEnabled();
  const user = await getCurrentUser();

  if (!enabled) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Account"
          title="Accounts are not configured here"
          lede="This deployment has no account service attached, so there is nothing to sign in to."
        />
        <p
          data-testid="accounts-unavailable"
          className="max-w-2xl rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4"
        >
          Everything the site does works without an account. Your progress in the games is
          kept in this browser, and the timeline, people, comparisons and discoveries have
          never needed one.
        </p>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Account"
          title="You are not signed in"
          lede="An account keeps your favourites and progress across browsers. Nothing else here needs one."
        />
        <div>
          <Link
            href="/account/sign-in"
            data-testid="go-sign-in"
            className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Sign in
          </Link>
        </div>
      </PageShell>
    );
  }

  const [profile, favourites, attempts] = await Promise.all([
    getProfile(),
    getFavourites(),
    getAccountAttempts(),
  ]);
  const progress = summarise(attempts);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Account"
        title={profile?.displayName ?? user.email ?? 'Your account'}
        lede="What this account is keeping for you, and how to take it away again."
      />

      {added !== null && Number.isFinite(added) ? (
        <p role="status" data-testid="sync-result">
          {added === 0
            ? 'Nothing new to add: your account already had those rounds.'
            : `Added ${added} ${added === 1 ? 'round' : 'rounds'} from this browser.`}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Progress</h2>
        <p data-testid="account-progress">
          Level {progress.level}, {progress.xp} XP, {progress.answered} answered and{' '}
          {progress.correct} right.
        </p>
        <SyncProgress action={syncProgressAction} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Favourites</h2>
        {favourites.length === 0 ? (
          <p data-testid="no-favourites" className="text-[var(--color-text-secondary)]">
            Nothing saved yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="favourites">
            {favourites.map((favourite) => (
              <li key={`${favourite.entityType}:${favourite.entityId}`}>
                {favourite.entityType}: {favourite.entityId}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Signing out</h2>
        <p className="max-w-2xl text-[var(--color-text-secondary)]">
          Signing out clears this browser&rsquo;s copy of your progress and its cached
          pages, as well as your session.
        </p>
        <SignOutButton />
      </section>
    </PageShell>
  );
}
