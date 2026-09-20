# Bible Timeline Explorer

An interactive Bible chronology and genealogy learning platform built around one
question: **who was alive at the same time?**

## Current state

**Phase 1 complete — database and domain foundation.** Schema, migrations, domain
types and validation schemas exist; there is no dataset and no feature UI yet, by
design. The build order is fixed and documented, and it puts verified data before
calculations and calculations before interface.

```
verified source data → chronology engine → validation → services → UI → learning → AI
```

## Documents

| Document                                                   | What it covers                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)               | Layering, folder structure, technical decisions, visualization evaluation, risks |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md)                   | Schema, enums, provenance and derivation records, indexes                        |
| [docs/DATA_SOURCING.md](docs/DATA_SOURCING.md)             | Where every number comes from, derivation rules, the known ambiguities           |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | The 16 phases and the command that closes each gate                              |
| [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md)       | Golden tests, boundary cases, parity tests, CI order                             |
| [docs/SECURITY.md](docs/SECURITY.md)                       | RLS, credential handling, data governance, AI constraints                        |
| [docs/PHASE_0_REPORT.md](docs/PHASE_0_REPORT.md)           | What Phase 0 produced and how its gate was verified                              |

## The data rule

No chronological value in `data/canonical/` may come from a language model. Every
value traces to a verse, to a deterministic calculation from verses, or to an
identified secondary source, and carries its confidence and review status. Values that
cannot be established stay `UNKNOWN`; they are never filled in to make a chart tidier.

## Commands

```bash
npm run dev           # development server
npm run typecheck     # tsc --noEmit, strict
npm run lint          # eslint, including the layering rules
npm run test          # vitest, unit only, no database needed
npm run build         # production build
npm run verify        # all of the above, in order

npm run db:reset      # drop and recreate the local database, apply the Supabase shim
npm run db:migrate    # apply every migration in order
npm run db:check-rls  # fail if any table has RLS off or a canonical write policy
npm run db:verify     # reset, migrate and check in one command
npm run test:db       # constraint and RLS isolation tests against a real Postgres
```

Further gate commands (`validate:data`, `test:golden`, `test:e2e`, `audit:dataset`)
are added in the phases that implement them, rather than defined now as scripts that
would pass without checking anything. See
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Setup

```bash
npm install
cp .env.example .env.local

# Local database. Needs a Postgres reachable at DATABASE_URL
# (default postgres://postgres@127.0.0.1:5432/bible_timeline_explorer).
npm run db:verify
npm run test:db

npm run dev
```

`scripts/bootstrap-local-db.sql` creates the `auth` schema, `auth.uid()` and the
`anon` / `authenticated` / `service_role` roles that Supabase provides and a bare
Postgres does not. It is local-only and deliberately lives outside
`supabase/migrations/` so it cannot be applied to the hosted project. The migrations
themselves are identical in both places, which is what makes a local run meaningful.
