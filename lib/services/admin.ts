import 'server-only';
import { cache } from 'react';
import {
  changedFields,
  judgeChange,
  readFields,
  type AppRole,
  type EditableTable,
  type FieldChange,
  type ReviewStatus,
} from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * The admin CMS's data access.
 *
 * Two clients, on purpose. The caller's own client answers "who is
 * this", because a role read as the caller is a role the database
 * agrees they have. The service-role client does the writing, because
 * canonical tables have no client write path at all and are not going
 * to get one — see docs/SECURITY.md section 4.
 *
 * Nothing here is a permission check standing in for the database's.
 * Every rule this module applies is also a trigger, and
 * tests/db/governance.test.ts proves the trigger, not this.
 */
export interface AdminRecord {
  key: string;
  display: string;
  reviewStatus: ReviewStatus;
  revisionNotes: string | null;
  fields: Record<string, unknown>;
}

export interface AuditEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  createdAt: string;
  actorId: string | null;
  changes: FieldChange[];
}

export interface ReviewCount {
  reviewStatus: ReviewStatus;
  count: number;
}

/**
 * The caller's role, as the database sees it.
 *
 * Defaults to 'user', which is the safe answer for every unknown: no
 * session, no Supabase, a profile row that has not arrived yet.
 */
export const getViewerRole = cache(async (): Promise<AppRole> => {
  if (!isSupabaseConfigured()) return 'user';
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 'user';

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  const role = data?.role;
  return role === 'admin' || role === 'editor' ? role : 'user';
});

/** The signed-in administrator's id, for the audit trail. */
export const getViewerId = cache(async (): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
});

/**
 * Whether the CMS can write at all.
 *
 * The service-role key is a separate piece of configuration from the
 * public one, and a deployment can legitimately have the second without
 * the first: a reader-facing deploy with no CMS. Asking here means the
 * pages can say so rather than throwing.
 */
export const canWrite = (): boolean =>
  isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function countsByStatus(table: EditableTable): Promise<ReviewCount[]> {
  if (!canWrite()) return [];
  const admin = createAdminClient();
  const { data } = await admin.from(table.name).select('review_status');
  const counts = new Map<ReviewStatus, number>();
  for (const row of data ?? []) {
    const status = row.review_status as ReviewStatus;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reviewStatus, count]) => ({ reviewStatus, count }))
    .sort((a, b) => a.reviewStatus.localeCompare(b.reviewStatus));
}

/** The records waiting for somebody, oldest first. */
export async function listForReview(
  table: EditableTable,
  status: ReviewStatus | null,
  limit = 50,
): Promise<AdminRecord[]> {
  if (!canWrite()) return [];
  const admin = createAdminClient();
  let query = admin.from(table.name).select('*').limit(limit);
  if (status) query = query.eq('review_status', status);
  const { data } = await query;
  return (data ?? []).map((row) => toRecord(table, row));
}

export async function getRecord(
  table: EditableTable,
  key: string,
): Promise<AdminRecord | null> {
  if (!canWrite()) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from(table.name)
    .select('*')
    .eq(table.key, key)
    .limit(1)
    .maybeSingle();
  return data ? toRecord(table, data) : null;
}

function toRecord(table: EditableTable, row: Record<string, unknown>): AdminRecord {
  return {
    key: String(row[table.key]),
    display: String(row[table.display] ?? row[table.key]),
    reviewStatus: row.review_status as ReviewStatus,
    revisionNotes: (row.revision_notes as string | null) ?? null,
    fields: row,
  };
}

export interface ChangeRequest {
  table: EditableTable;
  key: string;
  posted: Record<string, string>;
  status: ReviewStatus;
  reason: string;
  sources: readonly string[];
}

export type ChangeOutcome =
  { ok: true; changed: FieldChange[] } | { ok: false; problem: string };

/**
 * Applies an edit, if the rules and then the database both allow it.
 *
 * The audit row is not written here. A trigger writes it, from the same
 * statement, so a write that skipped this function still leaves a
 * trail — which is the whole point of putting it in the database.
 */
export async function applyChange(request: ChangeRequest): Promise<ChangeOutcome> {
  const role = await getViewerRole();
  if (!canWrite()) {
    return { ok: false, problem: 'This deployment has no write access configured.' };
  }

  const current = await getRecord(request.table, request.key);
  if (!current) return { ok: false, problem: 'That record no longer exists.' };

  const { values, rejected } = readFields(request.table, request.posted);
  if (rejected.length > 0) {
    return {
      ok: false,
      problem: `These could not be read, so nothing was saved: ${rejected.join(', ')}.`,
    };
  }

  const after = { ...current.fields, ...values };
  const changes = changedFields(current.fields, after).filter(
    (change) => change.field !== 'review_status',
  );

  const judged = judgeChange({
    role,
    from: current.reviewStatus,
    to: request.status,
    changesFields: changes.length > 0,
    reason: request.reason,
    sources: request.sources,
  });
  if (!judged.ok) return judged;

  const admin = createAdminClient();
  const { error } = await admin
    .from(request.table.name)
    .update({
      ...values,
      review_status: request.status,
      revision_notes: request.reason,
      verification: { method: 'admin-review', sources: request.sources },
      updated_by: await getViewerId(),
    })
    .eq(request.table.key, request.key);

  // The database's own refusal, which is the one that counts.
  if (error) return { ok: false, problem: error.message };
  return { ok: true, changed: changes };
}

/** The history, newest first. */
export async function listAudit(
  entityType?: string,
  entityId?: string,
  limit = 50,
): Promise<AuditEntry[]> {
  if (!canWrite()) return [];
  const admin = createAdminClient();
  let query = admin
    .from('audit_logs')
    .select('*')
    .order('id', { ascending: false })
    .limit(limit);
  if (entityType) query = query.eq('entity_type', entityType);
  if (entityId) query = query.eq('entity_id', entityId);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id as number,
    action: row.action as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
    reason: (row.reason as string | null) ?? null,
    createdAt: row.created_at as string,
    actorId: (row.actor_id as string | null) ?? null,
    changes: changedFields(
      row.before as Record<string, unknown> | null,
      row.after as Record<string, unknown> | null,
    ),
  }));
}
