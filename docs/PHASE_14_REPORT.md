# Phase 14 Report — Admin and Data Governance

Date: 2026-09-20
Commit: `feat(phase-14): add admin CMS and data review workflow`

---

## 1. What is here

A way for the dataset to change that leaves a trail. An editor can edit a record, an
administrator can sign one off, and neither can do it without saying why and against
what. Every change is recorded by the database itself, and an export carries verified
records back out to `data/canonical`, where git stays the system of record.

| Piece                            | What it does                                                       |
| -------------------------------- | ------------------------------------------------------------------ |
| `supabase/migrations/0016_*.sql` | A reason and a source on every verification, and the audit trigger |
| `lib/admin/rules.ts`             | Who may do what, and what a change has to carry                    |
| `lib/admin/tables.ts`            | The writable surface, named field by field                         |
| `lib/admin/diff.ts`              | An audit row read back as a list of changed fields                 |
| `lib/admin/export.ts`            | Verified rows as canonical records, and how they fold in           |
| `lib/services/admin.ts`          | The reads and the writes, with the caller's role checked first     |
| `lib/services/admin-guard.ts`    | The refusal every admin page opens with                            |
| `app/admin/*`                    | The queue, a record, and the history                               |
| `components/admin/*`             | The edit form and the history table                                |
| `scripts/export-canonical.ts`    | `npm run export:canonical`, reporting by default                   |
| `tests/db/governance.test.ts`    | The gate, in the database                                          |
| `tests/e2e/admin.spec.ts`        | The gate, from outside                                             |

## 2. The exit gate

> Permission and RLS tests prove a non-admin cannot reach admin routes or mutate
> canonical tables; marking a record VERIFIED requires a reason and writes an audit
> row; editing a VERIFIED record requires a reason and source information.

**A non-admin cannot mutate a canonical table.** Proved for five canonical tables, for
insert, update and delete, from three roles — anonymous, a signed-in reader, and an
administrator. The administrator is in that list on purpose: the claim this
architecture makes is stronger than "admins only". There is no client write path to a
canonical table in any role. `apply_canonical_rls` creates no write policy and revokes
the verbs, the CMS writes through the service role after checking the caller, and
`scripts/check-rls.ts` fails the build if a write policy ever appears.

**A non-admin cannot reach the admin routes.** Seven addresses, each answered with a
404 rather than a redirect: somebody who cannot use the CMS has no business learning it
is there.

**Marking a record VERIFIED requires a reason and writes an audit row.** Refused with
no reason, refused with a reason that is only whitespace, refused with no source,
refused with a `verification` record that names no source, refused for a non-admin —
and, when accepted, the audit row is there with the reason, the previous status and the
new one.

**Editing a VERIFIED record requires a reason and source information.** Refused without
either, accepted with both.

## 3. A leak the browser test found

The first version guarded the admin routes in `app/admin/layout.tsx`. Every route
returned 404, and the test that asked for the status passed.

The test that read the response body did not. A layout and the page under it render in
parallel, so a `notFound()` in the layout stops the layout — and leaves the page's own
rendered output serialised into the 404 response, where anybody who asks for `/admin`
can read it. On a deployment with a real database that would have been the review queue
and its record names, handed to an anonymous visitor in the body of a page that says
"there is nothing at this address".

Every admin page now refuses for itself, before it reads anything, so there is nothing
to serialise. The page titles are the neutral word "Admin" for the same reason, since
metadata renders even when the page refuses. The test asserts the absence of the
content rather than the status code, because the status code was never the thing at
risk.

## 4. What can be edited, and by whom

The writable surface is a list, not "whatever was posted". A form is a POST, and
anybody who can reach the route can put any field name in one, so `lib/admin/tables.ts`
names the editable fields per table and everything else is rejected — `id`, `slug`,
`created_by`, and in particular `review_status`, `revision_notes` and `verification`,
which belong to the review rules rather than to the form.

An integer field that is not an integer is rejected rather than coerced. Writing 0 for
"about nine hundred" would be inventing a number, which is the one thing this product
exists not to do.

| Role   | Read the admin | Edit a record | Mark it VERIFIED |
| ------ | -------------- | ------------- | ---------------- |
| user   | no             | no            | no               |
| editor | yes            | yes           | no               |
| admin  | yes            | yes           | yes              |

## 5. The audit trail is the database's, not the application's

An audit row written by a server action is a row that a script, a migration or a bug
can skip. `write_audit_row` is an `AFTER` trigger on every reviewable table, so a
change made by any route into the database appears in the history. One of the tests
writes straight to the table, the way a script would, and then finds the row.

It is `SECURITY DEFINER` because no client role has `INSERT` on `audit_logs` and none is
going to get one. There is no `UPDATE` and no `DELETE` grant for any role including
admin, and a test asserts all three verbs are refused. A write that changes only
`updated_at` records nothing, so the history is changes rather than saves.

## 6. Two copies of the rules, on purpose

`lib/admin/rules.ts` says what a change must carry, and so does the trigger. That is
not the duplicated business logic section 64 forbids: the database's copy is the one
that decides, and the application's exists so a reviewer reads "Marking a record
VERIFIED needs a reason saying what was checked" instead of a Postgres exception. Where
they could drift, `tests/db/governance.test.ts` tests the database, never the helper —
so a divergence shows up as a failing test rather than as a rule that quietly stopped
applying.

## 7. The export, and the pull request it does not open

`npm run export:canonical` reads the VERIFIED rows and reports what would change.
`--write` applies it. It does not commit, branch, push or open a pull request; it
prints the commands and stops, because Kelv has not asked for a pull request and
opening one is not a step to take on somebody's behalf.

Two rules live in `lib/admin/export.ts`, where they are tested without a database:
only VERIFIED rows are exported, and nothing already in a file is ever removed by an
export. Existing order is preserved so the diff is readable; new records are appended
in key order.

## 8. Coverage

`lib/admin` joins the engine zone — no React, no Next, no Supabase, no I/O — at 100% of
branches, functions and lines. `lib/services/admin.ts` is not unit tested, for the same
reason as `lib/services/account.ts`: the properties worth asserting about it are the
ones the database enforces, and they are asserted against a real Postgres rather than
against a mock that would agree with anything.

## 9. Verification run

| Check                      | Result                                     |
| -------------------------- | ------------------------------------------ |
| `npm run typecheck`        | clean                                      |
| `npm run lint`             | clean                                      |
| `npm run format`           | clean                                      |
| `npm run test:coverage`    | 859 tests in 40 files, every threshold met |
| `npm run test:ui`          | 88 tests in 9 files                        |
| `npm run build`            | clean                                      |
| `npm run db:migrate`       | 16 migrations, 0016 applied                |
| `npm run db:check-rls`     | 26 tables, 60 policies, passed             |
| `npm run test:db`          | 124 tests in 4 files                       |
| `npx playwright test`      | 592 tests, desktop and mobile              |
| `npm run validate`         | 0 severe, 0 warning, both chronologies     |
| `npm run export:canonical` | ran, reported, wrote nothing               |

New in this phase: 42 unit tests, 58 database tests and 18 browser tests.

## 10. One thing the fixtures had to change

`tests/db/helpers.ts` seeded VERIFIED rows with no reason and no source, which the new
rule refuses. They now carry both. That is the rule working: the fixtures are a writer
like any other, and a fixture exempted from a rule is a rule with a hole in it.

## 11. Still open, carried forward

- Review status still does not gate what reaches the application. The export is now the
  mechanism that would close it — only VERIFIED rows leave the database — but the
  canonical files themselves are still DRAFT, so `data/canonical` has nothing verified
  in it to export yet. Phase 15 should decide whether the derived output carries the
  review status through to the pages.
- The CMS edits `people` and `person_chronology`. Events, relationships and the
  reference data are governed by the same triggers and the same audit trail but have no
  form yet.
- The export covers people and relationships. A record with no canonical file shape —
  a chronology row, which is derived rather than canonical — is deliberately not
  exportable.
- Nobody is an administrator yet. The first one has to be set directly in the database,
  because the CMS will not promote anyone: `forbid_self_role_change` refuses a role
  change from anybody who is not already an admin.

## 12. What Phase 15 inherits

A dataset that can change with a record of why, and an export that puts a reviewed
change back where it can be read as a diff. The production hardening review should
treat the admin surface as the highest-value target in the product, and the leak in
section 3 as the shape of what to look for: not whether a route refuses, but whether a
refusal returns anything it should not.
