import Link from 'next/link';
import { requireStaff } from '@/lib/services/admin-guard';

/**
 * One guard for every admin route.
 *
 * `notFound()` rather than a redirect to a sign-in: a reader who is not
 * staff has no business knowing the surface is there, and a 404 is the
 * honest answer to "is there an admin here" from somebody who cannot
 * use it.
 *
 * Each page repeats the guard, and that is not belt and braces. A
 * layout and its page render in parallel, so this alone would still let
 * the page's own output reach a 404 response.
 *
 * This is not the security boundary. The database is: canonical tables
 * have no client write path in any role, and the write functions run
 * the caller's role past the same rules again. This is the door.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await requireStaff();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <nav aria-label="Admin" className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin" className="underline">
          Review queue
        </Link>
        <Link href="/admin/audit" className="underline">
          History
        </Link>
        <span className="text-[var(--color-text-muted)]">Signed in as {role}</span>
      </nav>
      {children}
    </div>
  );
}
