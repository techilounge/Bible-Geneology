import 'server-only';
import { notFound } from 'next/navigation';
import { canReachAdmin, type AppRole } from '@/lib/admin';
import { getViewerRole } from './admin';

/**
 * The first line of every admin page, before it reads anything.
 *
 * A guard in the layout is not enough, and finding that out is what
 * `tests/e2e/admin.spec.ts` is for: a layout and the page under it
 * render in parallel, so a `notFound()` in the layout still leaves the
 * page's own output serialised into the 404 response, where anybody can
 * read it. The page has to refuse for itself, before it fetches
 * anything, so that there is nothing to serialise.
 */
export async function requireStaff(): Promise<AppRole> {
  const role = await getViewerRole();
  if (!canReachAdmin(role)) notFound();
  return role;
}
