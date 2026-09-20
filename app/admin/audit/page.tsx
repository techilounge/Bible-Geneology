import type { Metadata } from 'next';
import { AuditTable } from '@/components/admin/AuditTable';
import { PageHeader } from '@/components/layout/PageHeader';
import { listAudit } from '@/lib/services/admin';
import { requireStaff } from '@/lib/services/admin-guard';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

/**
 * Every change to the dataset, newest first.
 *
 * Written by a database trigger rather than by the application, so a
 * change made by a script or by hand appears here too. Nothing in the
 * application can edit or remove a row: there is no grant for it.
 */
export default async function AdminAuditPage() {
  await requireStaff();

  const entries = await listAudit(undefined, undefined, 100);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="History"
        lede="Every change to a reviewable record, as the database recorded it. Nothing here can be edited or removed."
      />
      <AuditTable entries={entries} />
    </>
  );
}
