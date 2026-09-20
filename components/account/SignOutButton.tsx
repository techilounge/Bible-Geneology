/**
 * Signing out, as a form.
 *
 * A POST so that no other site can trigger it with an image tag, and a
 * plain form so that it works with scripting off.
 */
export function SignOutButton() {
  return (
    <form action="/auth/sign-out" method="post">
      <button
        type="submit"
        data-testid="sign-out"
        className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-surface-overlay)] px-4 font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        Sign out
      </button>
    </form>
  );
}
