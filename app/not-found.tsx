import Link from 'next/link';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export default function NotFound() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="404"
        title="There is nothing at this address"
        lede="The page may have moved, or the link may be wrong."
      />
      <p>
        <Link
          href="/"
          className="rounded underline underline-offset-4 hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Go to the home page
        </Link>
      </p>
    </PageShell>
  );
}
