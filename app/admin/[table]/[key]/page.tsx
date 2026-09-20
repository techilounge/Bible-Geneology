import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { saveRecord } from '@/app/admin/actions';
import { AuditTable } from '@/components/admin/AuditTable';
import { RecordForm } from '@/components/admin/RecordForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { allowedTransitions, tableByName } from '@/lib/admin';
import { getRecord, getViewerRole, listAudit } from '@/lib/services/admin';
import { requireStaff } from '@/lib/services/admin-guard';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

/**
 * One record: what it says, what may be done to it, and what has been
 * done to it. The history sits under the form on purpose — the last
 * question a reviewer asks before changing something is who changed it
 * last and why.
 */
export default async function AdminRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ table: string; key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();

  const { table: name, key } = await params;
  const table = tableByName(name);
  if (!table) notFound();

  const [record, role] = await Promise.all([getRecord(table, key), getViewerRole()]);
  if (!record) notFound();

  const query = await searchParams;
  const problem = Array.isArray(query.problem) ? query.problem[0] : query.problem;
  const saved = (Array.isArray(query.saved) ? query.saved[0] : query.saved) === '1';

  const history = await listAudit(table.name, record.key, 20);

  return (
    <>
      <PageHeader
        eyebrow={table.label}
        title={record.display}
        lede={`This record is ${record.reviewStatus}.`}
      />

      {problem ? (
        <p
          role="alert"
          data-testid="problem"
          className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4"
        >
          {problem}
        </p>
      ) : null}
      {saved ? (
        <p role="status" data-testid="saved">
          Saved, and recorded in the history below.
        </p>
      ) : null}

      <RecordForm
        action={saveRecord}
        table={table}
        record={record}
        statuses={allowedTransitions(role, record.reviewStatus)}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">History</h2>
        <AuditTable entries={history} />
      </section>
    </>
  );
}
