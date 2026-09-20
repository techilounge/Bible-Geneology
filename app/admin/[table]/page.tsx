import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { REVIEW_STATUSES, tableByName, type ReviewStatus } from '@/lib/admin';
import { listForReview } from '@/lib/services/admin';
import { requireStaff } from '@/lib/services/admin-guard';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

export default async function AdminTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ table: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();

  const { table: name } = await params;
  const table = tableByName(name);
  if (!table) notFound();

  const query = await searchParams;
  const raw = Array.isArray(query.status) ? query.status[0] : query.status;
  const status = REVIEW_STATUSES.includes(raw as ReviewStatus)
    ? (raw as ReviewStatus)
    : null;

  const records = await listForReview(table, status);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title={table.label}
        lede={status ? `Records at ${status}.` : 'Every record in this table.'}
      />

      {records.length === 0 ? (
        <p data-testid="no-records">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="records">
          {records.map((record) => (
            <li key={record.key}>
              <Link href={`/admin/${table.name}/${record.key}`} className="underline">
                {record.display}
              </Link>
              <span className="text-[var(--color-text-secondary)]">
                {' '}
                — {record.reviewStatus}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
