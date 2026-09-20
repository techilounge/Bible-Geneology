# PHASE 1 REPORT

**Project:** Bible Timeline Explorer
**Date:** 2026-09-20

---

## PHASE 1 PLAN

**Goal.** Every entity in `DATA_MODEL.md` as a migration, a Zod schema and a
TypeScript type, with row level security on from the start. No dataset, no UI.

**Files.** Twelve migrations under `supabase/migrations/`; `lib/domain/`;
`lib/supabase/`; `scripts/` for the runner, the local shim and the RLS checker;
constraint and isolation tests under `tests/db/`.

**Database.** All core, application and audit tables; the enums; the constraints from
the data model; indexes; an RLS policy set per table group, enabled in the migration
that creates each table.

**Dependencies.** `@supabase/supabase-js`, `@supabase/ssr`, `server-only`; and as dev
dependencies `pg`, `@types/pg`, `tsx`, `dotenv`.

**Risks.** The `unknown_means_null` constraint enforces "unknown stays unknown", and
getting it backwards would either block legitimate UNKNOWN records or admit incoherent
ones. And Supabase supplies `auth.users`, `auth.uid()` and the `anon`/`authenticated`/
`service_role` roles, which a bare Postgres does not.

---

## PHASE 1 REPORT

### Completed

**Twelve migrations**, applied in filename order:

| Migration                 | Contents                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `0001_enums.sql`          | The seven enumerated types                                                                     |
| `0002_profiles.sql`       | `profiles`, the `current_app_role` / `is_staff` / `is_admin` helpers, the self-promotion guard |
| `0003_rls_helpers.sql`    | `apply_canonical_rls`, `add_audit_columns`, `touch_updated_at`                                 |
| `0004_reference_data.sql` | `eras`, `sources`, `scripture_references`                                                      |
| `0005_people.sql`         | `people`, `person_names`, full-text search indexes                                             |
| `0006_chronology.sql`     | `chronologies`, `person_chronology`, the alive-at-year index                                   |
| `0007_relationships.sql`  | `relationships`, the cycle guard, the redundant-child guard                                    |
| `0008_provenance.sql`     | `scripture_attachments`, `source_claims`                                                       |
| `0009_events.sql`         | `events`, `event_chronology`, `event_people`                                                   |
| `0010_user_data.sql`      | `favorites`, `saved_comparisons`, `quiz_attempts`, `user_achievements`, `apply_owner_rls`      |
| `0011_content.sql`        | `discoveries`, `quiz_questions`, `learning_paths`, `learning_path_steps`, `achievements`       |
| `0012_audit.sql`          | `audit_logs`, the VERIFIED transition guard                                                    |

25 tables, 56 policies.

**The policy shape is applied by a function, not written out per table.**
`apply_canonical_rls(tbl, review_gated)` enables RLS, forces it for the owner too,
grants `SELECT` to `anon` and `authenticated`, revokes every write verb from them, and
creates exactly two read policies: the public one (narrowed to `review_status =
'VERIFIED'` where the table is review-gated) and a staff one. It creates no write
policy at all. Writing that twelve times by hand would eventually produce twelve
subtly different policy sets; writing it once means a canonical table cannot acquire a
client write path by accident, and `db:check-rls` fails the build if one appears.

**Three guards live in the database rather than only in application code**, because an
application bug should not be sufficient to break them:

- A parent edge that would close an ancestry cycle is rejected by a recursive CTE in a
  trigger. A cycle makes ancestor-path queries non-terminating, and the database is the
  last place to stop one.
- A `child` edge that merely inverts an existing `parent` edge is rejected, so descent
  has one canonical direction and cannot be stored twice with the two copies drifting.
- Promotion to `VERIFIED` requires an administrator, and editing an already-VERIFIED
  record requires `revision_notes`. Requirement §48 as a trigger.

**Domain layer.** `lib/domain/` holds the enumerated vocabularies, the Zod schemas, the
types inferred from them, and `ChronologyResult<T>`. Two details carry weight:

- `PersonChronologySchema` requires `sourceReferences` to be non-empty and refuses a
  number under UNKNOWN confidence, which is requirement §5 and §7 enforced where a bad
  record is actually built rather than where it is stored.
- `DerivationSchema` recomputes the running totals from the steps and rejects a
  derivation that disagrees with its own arithmetic. A stored "Why this date?"
  explanation that does not add up is a parse failure.

**`ChronologyResult<T>`** is a discriminated union of `known`, `unknown` and
`disputed`. No engine function returns a bare number, so there is no code path that can
produce `NaN` and no component that can render one without handling the other two
cases. Its `UnknownReason` distinguishes `no-data` from `not-applicable`, which matters
the moment the Septuagint chronology lands: "not present in this chronology" and
"present but undated" are different facts and get different wording.

**Supabase clients.** Browser, server and admin. The admin client imports `server-only`,
throws if `window` is defined, and is blocked from `app/` and `components/` by the
ESLint zone added in Phase 0. CI greps the built client chunks for `service_role`.

### Validation

```
npm run db:reset       reset bible_timeline_explorer, shim applied
npm run db:migrate     12 migrations applied to a clean database
tsx scripts/db-migrate.ts --force
                       all 12 re-applied cleanly, proving idempotency
npm run db:check-rls   checked 25 tables and 56 policies, passed
npm run test:db        2 files, 25 tests passed
npm run typecheck      pass, 0 errors
npm run lint           pass, 0 problems
npm run test           2 files, 21 tests passed
npm run build          pass, compiled, 2 static routes
```

### Tests

**21 unit tests** covering the schemas: provenance required, UNKNOWN paired with null
in both directions, a wholly unknown record accepted, death-before-birth rejected,
derivation arithmetic checked, self-relationships rejected, non-Genesis references
accepted (which the Terah derivation needs), identifiers required to be slug-safe, and
gender defaulting to `unknown` rather than `male`.

**25 integration tests** against a real Postgres: every constraint above, plus RLS
isolation — an anonymous visitor reads VERIFIED rows and not DRAFT ones, an
authenticated user cannot write to a canonical table, a staff user can read drafts but
still cannot write, one user cannot read, insert for, or delete another user's rows, a
user cannot promote themselves but can rename themselves, and the audit log is readable
only by an admin and writable by nobody.

### Data integrity

No canonical data exists yet; Phase 2 seeds it. What Phase 1 establishes is that the
database will refuse the specific bad states the data model promised it would refuse,
verified before there is any data to be wrong about.

### Issues

**Three real bugs, all found by running the tests rather than by reading the code.**
Recording them because each was a silent failure of the kind that is very hard to spot
later:

1. **RLS policies without matching grants.** A policy decides which rows a verb may
   touch; a `GRANT` decides whether the role may use the verb at all. Six tests failed
   with `permission denied` because the migrations created policies but never granted
   the verbs, relying implicitly on Supabase's default grants. Fixed by granting
   explicitly in the migrations, which also makes them behave identically locally and
   on the hosted project.
2. **The audit log was unreadable by anyone.** `audit_logs` had an admin read policy
   and no `SELECT` grant, so the policy was dead code. Caught by adding the positive
   assertion — that an admin _can_ read it — rather than only asserting that a
   non-admin cannot. A suite that only tests denial cannot tell a secure table from a
   broken one.
3. **The role-change trigger blocked the service role.** It raised for any caller who
   was not an admin, and `auth.uid()` is null for the service role that runs seeds, so
   seeding a role would have been impossible. Given the same null-uid carve-out the
   VERIFIED guard uses.

**Open, not blocking:**

- Phase 1 was verified against a local Postgres 16 with a shim supplying the `auth`
  schema and the Supabase roles. The migrations are unchanged between there and the
  hosted project, but they have not yet been applied to `xxbkryncsftubcdjpkns`. That
  needs credentials, which are deliberately not in this session.
- `scripts/db-reset.ts` refuses any host that is not localhost, so the reset command
  cannot be pointed at the hosted database by a mistyped environment variable.

### Files changed

```
supabase/migrations/0001_enums.sql .. 0012_audit.sql   (12 files)
lib/domain/{enums,results,schemas,types,index}.ts
lib/domain/schemas.test.ts
lib/supabase/{env,browser,server,admin}.ts
scripts/{db,db-migrate,db-reset,check-rls}.ts
scripts/bootstrap-local-db.sql
tests/db/{helpers,constraints.test,rls.test}.ts
vitest.config.ts  vitest.db.config.ts  package.json
.github/workflows/ci.yml  README.md
```

### Exit gate

| Criterion                                         | Result                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| Successful migration                              | **Pass.** 12 migrations on a clean database, and again with `--force`. |
| Schema validation                                 | **Pass.** 25 constraint and isolation tests.                           |
| TypeScript passes                                 | **Pass.** Strict, 0 errors.                                            |
| Tests pass                                        | **Pass.** 21 unit, 25 integration.                                     |
| No unresolved critical schema issues              | **Pass.** Three bugs found and fixed; none outstanding.                |
| RLS enabled on every table, checked automatically | **Pass.** `db:check-rls` over 25 tables and 56 policies.               |

**Phase 1 is complete.**

### Next phase

**PHASE 2 — VERIFIED GENESIS DATASET.** The phase that decides whether the product is
trustworthy. Identity and structure first, then the chronology input values by the
verse-by-verse procedure in `DATA_SOURCING.md` §7, then derivation, then the audit
report.

Phase 2 needs a decision from Kelv before it can finish: the numbers must be entered
from an actual text by a person, not recalled by a model. See the note at the end of
`DATA_SOURCING.md` §1.
