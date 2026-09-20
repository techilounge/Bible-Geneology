import { toggleFavouriteAction } from '@/app/account/actions';
import { accountsEnabled } from '@/lib/services/account';

/**
 * Saving something to an account, from a page that stays static.
 *
 * Reading whether this reader has already saved this person would make
 * every person page render per request, which is a real cost for a
 * detail this small. So the control states what it does rather than what
 * the state is, the account page lists what is saved, and the pages stay
 * prerendered.
 *
 * A form, so it works with scripting off. Signed out, the action sends
 * the reader to sign in and back again rather than failing.
 */
export function FavouriteButton({
  entityType,
  entityId,
  next,
  label,
}: {
  entityType: 'person' | 'event' | 'discovery' | 'comparison';
  entityId: string;
  next: string;
  label: string;
}) {
  if (!accountsEnabled()) return null;

  return (
    <form action={toggleFavouriteAction}>
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        data-testid="favourite"
        className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-surface-overlay)] px-4 text-sm font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        {label}
      </button>
    </form>
  );
}
