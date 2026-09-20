import type { Metadata } from 'next';
import Link from 'next/link';
import { sendMagicLink, signInWithGoogle } from '@/app/account/actions';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { safeNext } from '@/lib/account';
import { accountsEnabled, getCurrentUser } from '@/lib/services/account';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to keep favourites, saved comparisons and progress across browsers. Nothing on this site requires it.',
};

/**
 * Signing in, which nothing on this site requires.
 *
 * Two ways in, both of which end at `/auth/callback`: a link mailed to an
 * address, and Google. Neither asks for a password, so there is no
 * password here to leak, reuse or reset.
 *
 * Both forms are plain forms posting to server actions, so the page works
 * with scripting off, and the outcome comes back in the address rather
 * than in component state for the same reason.
 */
const MESSAGES: Record<string, string> = {
  unavailable: 'Accounts are not configured on this deployment, so signing in is off.',
  email: 'That does not look like an email address. Check it and try again.',
  send: 'The link could not be sent just now. Try again in a moment.',
  google: 'Google sign-in could not be started. Try the email link instead.',
  link: 'That link has already been used or has expired. Ask for a new one.',
  'slow-down':
    'That is a lot of sign-in links in a short time. Wait a couple of minutes and try again.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const next = safeNext(one('next'));
  const error = one('error');
  const sent = one('sent') === '1';
  const enabled = accountsEnabled();
  const user = await getCurrentUser();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Account"
        title="Sign in"
        lede="An account keeps your favourites, saved comparisons and progress across browsers. Everything else on this site works without one, and always will."
      />

      {user ? (
        <p data-testid="already-signed-in">
          You are already signed in as {user.email ?? 'your account'}.{' '}
          <Link href="/account" className="underline">
            Go to your account
          </Link>
          .
        </p>
      ) : null}

      {error && MESSAGES[error] ? (
        <p
          role="alert"
          data-testid="sign-in-error"
          className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4"
        >
          {MESSAGES[error]}
        </p>
      ) : null}

      {sent ? (
        <p
          role="status"
          data-testid="link-sent"
          className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-surface-raised)] p-4"
        >
          Check your email. The link signs you in on this device and expires shortly.
        </p>
      ) : null}

      {enabled ? (
        <div className="flex max-w-md flex-col gap-6">
          <form action={sendMagicLink} className="flex flex-col gap-3">
            <input type="hidden" name="next" value={next} />
            <label htmlFor="email" className="font-medium">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              data-testid="email"
              className="min-h-11 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-3"
            />
            <p className="text-sm text-[var(--color-text-secondary)]">
              We send a link rather than asking for a password, so there is no password to
              lose.
            </p>
            <button
              type="submit"
              data-testid="send-link"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              Email me a link
            </button>
          </form>

          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              data-testid="google"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-surface-overlay)] px-4 font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              Continue with Google
            </button>
          </form>
        </div>
      ) : (
        <p
          data-testid="accounts-unavailable"
          className="max-w-2xl rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4"
        >
          Accounts are not configured on this deployment, so there is nothing to sign in
          to. Everything the site does is still here: the timeline, the people, the
          comparisons, the discoveries and the games all work without an account, and your
          progress is kept in this browser.
        </p>
      )}

      <p className="max-w-2xl text-sm text-[var(--color-text-secondary)]">
        We store your email address, what you have marked as a favourite, and which rounds
        you have played. Signing out clears the copy this browser keeps.
      </p>
    </PageShell>
  );
}
