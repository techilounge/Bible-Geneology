import { summariseChange } from '@/lib/admin';
import type { AuditEntry } from '@/lib/services/admin';

/**
 * The history, as a table a reviewer can scan.
 *
 * The reason comes first after the date, because it is the column
 * somebody is reading the history to find.
 */
export function AuditTable({ entries }: { entries: readonly AuditEntry[] }) {
  if (entries.length === 0) {
    return <p data-testid="no-history">Nothing recorded yet.</p>;
  }

  return (
    <table className="w-full text-left text-sm" data-testid="history">
      <caption className="sr-only">Changes to this dataset, newest first</caption>
      <thead>
        <tr>
          <th scope="col" className="py-2">
            When
          </th>
          <th scope="col">Record</th>
          <th scope="col">Reason</th>
          <th scope="col">What changed</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id} className="border-t border-[var(--color-border-subtle)]">
            <td className="py-2 align-top">
              <time dateTime={entry.createdAt}>{entry.createdAt.slice(0, 16)}</time>
            </td>
            <td className="align-top">
              {entry.entityType} {entry.entityId}
            </td>
            <td className="align-top">
              {entry.reason ?? <span className="text-[var(--color-text-muted)]">—</span>}
            </td>
            <td className="align-top">
              {summariseChange(entry.action, entry.changes)}
              {entry.changes.length > 0 ? (
                <ul className="text-[var(--color-text-secondary)]">
                  {entry.changes.slice(0, 5).map((change) => (
                    <li key={change.field}>
                      {change.field}: {change.before ?? '—'} → {change.after ?? '—'}
                    </li>
                  ))}
                </ul>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
