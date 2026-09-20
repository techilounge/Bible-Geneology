import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { EDITABLE_TABLES, STATUS_MEANING, type ReviewStatus } from '@/lib/admin';
import { canWrite, countsByStatus } from '@/lib/services/admin';
import { requireStaff } from '@/lib/services/admin-guard';

// Deliberately says nothing. Page metadata is rendered even when the
// page itself refuses, so the descriptive title lives in the heading.
export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

/**
 * What is waiting for somebody.
 *
 * The queue is the review workflow's front door: a count per status per
 * table, and a way into each. DRAFT and SOURCE_CHECKED are the two that
 * mean work; DISPUTED means a decision somebody has already made.
 */
export default async function AdminPage() {
  await requireStaff();

  const tables = await Promise.all(
    EDITABLE_TABLES.map(async (table) => ({
      table,
      counts: await countsByStatus(table),
    })),
  );

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Review queue"
        lede="Every record carries a review status. Nothing reaches the site as verified without a reason and a source."
      />

      {!canWrite() ? (
        <p
          data-testid="no-write-access"
          className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4"
        >
          This deployment has no write access configured, so the queue is empty and
          nothing here can be changed.
        </p>
      ) : null}

      {tables.map(({ table, counts }) => (
        <section key={table.name} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{table.label}</h2>
          {counts.length === 0 ? (
            <p className="text-[var(--color-text-secondary)]">Nothing to show.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {counts.map(({ reviewStatus, count }) => (
                <li key={reviewStatus}>
                  <Link
                    href={`/admin/${table.name}?status=${reviewStatus}`}
                    className="underline"
                  >
                    {count} {reviewStatus}
                  </Link>
                  <span className="text-[var(--color-text-secondary)]">
                    {' '}
                    — {STATUS_MEANING[reviewStatus as ReviewStatus]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
