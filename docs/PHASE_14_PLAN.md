# Phase 14 Plan — Admin and Data Governance

Requirement sections 47 and 48, and the build order's Phase 14. Exit gate: permission
and RLS tests prove a non-admin cannot reach admin routes or mutate canonical tables;
marking a record VERIFIED requires a reason and writes an audit row; editing a VERIFIED
record requires a reason and source information.

---

## Goal

Give the dataset a way to change that leaves a trail. Today the canonical files are
edited by a script and reviewed in a pull request; that works for one person building
the thing, and not at all for a contributor. This phase adds the editing interface, the
review workflow, the audit history, and the export that carries VERIFIED rows back out
to `data/canonical` so git stays the system of record.

The governing rule is the one from section 3, unchanged: nothing here lets anybody
invent a number. An edit records who changed what, why, and what it was based on, or it
does not happen.

## Files

| File                             | What it is                                                       |
| -------------------------------- | ---------------------------------------------------------------- |
| `supabase/migrations/0016_*.sql` | A reason on every verification, and source information with it   |
| `lib/admin/rules.ts`             | What an edit, a verification and a status move are allowed to be |
| `lib/admin/diff.ts`              | The before-and-after of a change, as an audit row                |
| `lib/services/admin.ts`          | The writes, after the caller's role is checked in the database   |
| `app/admin/*`                    | The queue, the record editor, and the history                    |
| `components/admin/*`             | The edit form, the review controls, the audit table              |
| `scripts/export-canonical.ts`    | VERIFIED rows back out to `data/canonical`                       |
| `tests/db/governance.test.ts`    | Canonical tables refuse a client write, from every role          |
| `tests/e2e/admin.spec.ts`        | Admin routes are not reachable without an admin session          |

## The shape of a write

There is no client write path to a canonical table and this phase does not add one.
`apply_canonical_rls` creates no INSERT, UPDATE or DELETE policy and revokes the verbs
outright, and `scripts/check-rls.ts` fails the build if that ever changes. An admin
write goes: server action → check the caller's role in the database → service-role
client → audit row, in one transaction where the database allows it.

That means the permission half of the gate is proved twice over: the route refuses a
non-admin, and the database would refuse the write even if the route did not.

## Database

One migration. `guard_verified_transition` already requires `revision_notes` when a
VERIFIED record is edited; it does not yet require anything when a record is _promoted_
to VERIFIED, which is the moment the gate cares most about. `0016` requires a reason on
that transition, requires the record to carry source information when it is verified or
edited afterwards, and writes the audit row from a trigger rather than from the
application, so a write that skipped the application still leaves a trail.

## Risks

- **An audit trail the application writes.** If the audit row is the application's job,
  a bug or a script that bypasses it leaves no record. The trigger is the answer.
- **A reason that is not a reason.** `revision_notes` set to a space satisfies a NOT
  NULL check and nothing else. Blankness is checked, as it is for `verified_by_label`.
- **An export that invents a diff.** The export must write exactly what is VERIFIED and
  nothing else, and must be readable as a diff by whoever reviews it. It writes the same
  canonical shapes the validator already checks, and the validator runs on the result.
- **An admin surface that appears where there is no admin.** This deployment has no
  accounts, so every admin route must be unreachable rather than broken.
- **Opening a pull request.** The build order describes the export as a pull request.
  Kelv has not asked for one, so the script writes the files and stops, and says what to
  run to open the request.
