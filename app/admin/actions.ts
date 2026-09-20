'use server';

import { redirect } from 'next/navigation';
import { readSources, tableByName, type ReviewStatus } from '@/lib/admin';
import { applyChange } from '@/lib/services/admin';

/**
 * Saving an edit.
 *
 * The form posts here, the rules are applied, the database applies them
 * again, and the reviewer is sent back to the record with either a
 * confirmation or the one sentence explaining the refusal. No state is
 * held in a component, so the page works with scripting off like the
 * rest of the site.
 */
export async function saveRecord(formData: FormData): Promise<void> {
  const tableName = String(formData.get('table') ?? '');
  const key = String(formData.get('key') ?? '');
  const table = tableByName(tableName);
  if (!table || key.length === 0) redirect('/admin');

  const posted: Record<string, string> = {};
  for (const field of table.fields) {
    const value = formData.get(field.name);
    if (value !== null) posted[field.name] = String(value);
  }

  const outcome = await applyChange({
    table,
    key,
    posted,
    status: String(formData.get('review_status') ?? '') as ReviewStatus,
    reason: String(formData.get('reason') ?? ''),
    sources: readSources(String(formData.get('sources') ?? '')),
  });

  const back = `/admin/${table.name}/${encodeURIComponent(key)}`;
  redirect(
    outcome.ok
      ? `${back}?saved=1`
      : `${back}?problem=${encodeURIComponent(outcome.problem)}`,
  );
}
