import {
  STATUS_MEANING,
  type EditableField,
  type EditableTable,
  type ReviewStatus,
} from '@/lib/admin';
import type { AdminRecord } from '@/lib/services/admin';

/**
 * The editing form.
 *
 * A plain form posting to a server action: no client state, so it works
 * with scripting off, and every field in it is one the table actually
 * has. The reason and the sources sit beside the status rather than
 * behind a confirmation dialog, because they are required exactly when
 * the status makes them required and a reviewer should see that.
 */
export function RecordForm({
  action,
  table,
  record,
  statuses,
}: {
  action: (data: FormData) => void;
  table: EditableTable;
  record: AdminRecord;
  statuses: readonly ReviewStatus[];
}) {
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="table" value={table.name} />
      <input type="hidden" name="key" value={record.key} />

      {table.fields.map((field: EditableField) => (
        <div key={field.name} className="flex flex-col gap-1">
          <label htmlFor={field.name} className="font-medium">
            {field.label}
          </label>
          {field.kind === 'longtext' ? (
            <textarea
              id={field.name}
              name={field.name}
              rows={3}
              defaultValue={String(record.fields[field.name] ?? '')}
              className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-2"
            />
          ) : field.kind === 'enum' ? (
            <select
              id={field.name}
              name={field.name}
              defaultValue={String(record.fields[field.name] ?? '')}
              className="min-h-11 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-2"
            >
              <option value="">—</option>
              {(field.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={field.name}
              name={field.name}
              type="text"
              inputMode={field.kind === 'integer' ? 'numeric' : 'text'}
              defaultValue={String(record.fields[field.name] ?? '')}
              className="min-h-11 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-2"
            />
          )}
        </div>
      ))}

      <div className="flex flex-col gap-1">
        <label htmlFor="review_status" className="font-medium">
          Review status
        </label>
        <select
          id="review_status"
          name="review_status"
          defaultValue={record.reviewStatus}
          className="min-h-11 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-2"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {STATUS_MEANING[record.reviewStatus]}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="reason" className="font-medium">
          Reason
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={2}
          defaultValue=""
          className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-2"
        />
        <p className="text-sm text-[var(--color-text-secondary)]">
          Required to verify a record, and to change one that is already verified.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="sources" className="font-medium">
          Checked against
        </label>
        <textarea
          id="sources"
          name="sources"
          rows={2}
          defaultValue=""
          className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-2"
        />
        <p className="text-sm text-[var(--color-text-secondary)]">
          One source per line, such as a translation or a reference.
        </p>
      </div>

      <div>
        <button
          type="submit"
          data-testid="save"
          className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Save
        </button>
      </div>
    </form>
  );
}
