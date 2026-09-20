# PHASE 0 REPORT

**Project:** Bible Timeline Explorer
**Date:** 2026-09-20

---

## PHASE 0 PLAN

**Goal.** Establish the foundation before any feature exists: discover what is already
here, decide and document the architecture, write the build plan, and prove the
repository builds. No application features, no dataset, no timeline.

**Files.** Six planning documents in `docs/`; a minimal Next.js skeleton
(`package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`,
`vitest.config.ts`, `postcss.config.mjs`, one layout, one placeholder page, design
tokens, `lib/config/`); `.github/workflows/ci.yml`; `README.md`; `.env.example`.

**Database.** None. Schema is designed in `DATA_MODEL.md` and implemented in Phase 1.

**Dependencies.** next, react, react-dom, zod; and as dev dependencies typescript,
eslint with typescript-eslint and the Next plugin, prettier, vitest with v8 coverage,
tailwindcss with its postcss plugin. Zod is added now rather than in Phase 1 because it
is the single schema source the architecture depends on and its presence shapes the
domain types.

**Risks.** Documenting an architecture before any data exists risks specifying
something the Phase 2 dataset will not fit. Mitigated by keeping the engine's dataset
an argument rather than an import, so the shape can change without rewriting the
engine.

---

## Discovery result

There was no existing codebase. Kelv confirmed on 2026-09-20 that this is a greenfield
build, so the inspection checklist in §61 has no subject and every "existing" column in
`ARCHITECTURE.md` §0 reads "none". Choices were made rather than discovered, and each
one is recorded with its rationale in `ARCHITECTURE.md` §5.

---

## PHASE 0 REPORT

### Completed

**Six planning documents**, each addressing the requirements it is named for:

| Document                 | Covers                                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE.md`        | Discovery findings, layer diagram and enforced import direction, the git-vs-database system-of-record decision, folder structure, eight technical decisions with rejected alternatives, the §45 visualization evaluation, rendering and caching, design tokens, environment configuration, eight risks with mitigations, code quality enforcement |
| `DATA_MODEL.md`          | Full schema for every entity in §11, enums, the person/chronology separation, the `unknown_means_null` constraint, stored-versus-computed relationships, derivation records for "Why this date?", indexes, Zod-derived types, the `ChronologyResult` union                                                                                        |
| `DATA_SOURCING.md`       | The no-LLM-data rule and how it is operationalised, the verse map for the whole MVP dataset, derivation rules, the overlap boundary convention, three known chronological ambiguities, per-field confidence assignment, the Phase 2 verification procedure, eight permanent sourcing rules                                                        |
| `IMPLEMENTATION_PLAN.md` | Gate commands, all 16 phases with deliverables and exit criteria, per-phase commit messages, working rules, MVP scope                                                                                                                                                                                                                             |
| `TESTING_STRATEGY.md`    | Tooling and coverage thresholds, the golden assertions with their dependencies, 13 boundary cases, parity tests, component and E2E journeys, accessibility and performance testing, CI order                                                                                                                                                      |
| `SECURITY.md`            | Threat model, auth, three-layer service-role protection, RLS policy per table group, data governance authorization, input validation and abuse, supply chain, AI feature constraints, error handling and headers, privacy, pre-launch checklist                                                                                                   |

**A buildable skeleton.** Next.js 16 with the App Router, React 19, TypeScript in
strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, Tailwind
4, Vitest, ESLint 10 flat config, Prettier.

Three things in the skeleton are load-bearing rather than boilerplate:

1. **`lib/config/branding.ts`** — the product name in one place, so §1's
   renameability is structural rather than a promise.
2. **`lib/config/chronology-defaults.ts`** — the half-open lifetime interval, the
   default chronology id, and the §10 disclaimer, defined once. The boundary
   convention is now a constant the engine and the UI both read, which is what §19's
   "do not silently choose inconsistent behavior" requires.
3. **`eslint.config.mjs`** — the layering rule from `ARCHITECTURE.md` §2 as
   `no-restricted-imports` zones. `lib/chronology`, `lib/graph`, `lib/discovery` and
   `lib/domain` cannot import React, Next, Supabase, or anything from `app/` or
   `components/`, and cannot reference `fetch`, `window` or `document`. §18's
   "the engine must contain no UI code" fails the lint run rather than a review.

`app/page.tsx` is an explicit placeholder. §70 says not to begin by generating pages,
and the Phase 0 gate requires a build, so the page exists to satisfy the build and says
so in a comment.

### Validation

Commands executed in this session, all from a clean install:

```
npm install                 25 packages, then 182 dev packages, 0 vulnerabilities
npm run typecheck           pass, 0 errors
npm run lint                pass, 0 problems
npm run test                pass, 1 file, 5 tests
npm run build               pass, compiled in 4.6s, 2 static routes prerendered
npm run format              pass, all files match Prettier style
```

`npm run verify` runs typecheck, lint, test and build in sequence and completes green.

Two failures occurred and were fixed rather than worked around:

- `next.config.ts` used an `eslint` key that Next 16 removed from `NextConfig`.
  Removed; lint runs standalone and in CI.
- `prefer-as-const` on the `LIFETIME_INTERVAL` literal type annotation. Changed to an
  `as const` assertion.

The client-bundle credential scan from `SECURITY.md` §3 was also run against the build
output and reports clean. It is wired into CI as a required step.

### Tests

5 tests in `lib/config/branding.test.ts`, all passing. They assert that a product name
exists for components to read, that the site URL comes from the environment, that the
default chronology is named rather than assumed, that the lifetime interval convention
is fixed in one place, and that the chronology disclaimer is present.

These are foundation tests, not chronology tests. There is nothing to calculate yet.
The golden suite specified in `TESTING_STRATEGY.md` §3 has its assertions written but
its numeric expectations deliberately unfilled; they are populated in Phase 2 from the
verified dataset, for the reason in `DATA_SOURCING.md` §1.

### Data integrity

No canonical data exists yet, so there is nothing to validate. `data/canonical/` and
`data/generated/` exist as empty directories, with `data/generated/` git-ignored so a
derived value cannot be committed by accident.

`npm run validate:data`, `npm run test:golden`, `npm run db:migrate`,
`npm run test:e2e` and `npm run audit:dataset` are **not** defined as scripts yet. They
are added in the phases that implement them. Defining them now as commands that exit
zero without checking anything would make every intervening gate report a pass it had
not earned.

### Issues

1. **GitHub repository attached.** `techilounge/Bible-Geneology`, supplied by Kelv on
   2026-09-20. It was empty; Phase 0 is its initial commit on `main`. CI runs from the
   next push onward.
2. **Supabase project identified, credentials not held.** Project `xxbkryncsftubcdjpkns`
   in `us-west-2`, free plan. No keys or database password are in this session, and
   none should be pasted into chat. Phase 1 runs its migrations against a local
   Supabase instance, which is what its gate ("a clean database") actually calls for;
   the hosted project is configured with credentials set directly in Supabase and the
   deployment environment. See `SECURITY.md` §3.
3. **The Terah decision is settled.** Kelv decided on 2026-09-20 that the default
   Masoretic derivation uses 130, derived from GEN.11.32, GEN.12.4 and ACT.7.4, with
   the 70 reading kept as the labelled alternate `masoretic-gen11-26` and never marked
   VERIFIED as an explicit birth age. Documented in `DATA_SOURCING.md` §4a.

   The consequence is larger than the offset: **two of the build prompt's own §22
   golden assertions invert.** Noah and Abraham no longer overlap, and neither do Shem
   and Jacob. The §22 list, and the §30 and §35 example copy, were written against the
   70 reading and need rewriting. Corrected assertions are in `TESTING_STRATEGY.md` §3.

4. **Coverage thresholds are provisional** at 70%. They are raised to 100% for
   `lib/chronology` and `lib/graph` in Phase 3, when those directories have code.

None of these is a §63 stop condition, and none now blocks Phase 1.

### Files changed

```
docs/ARCHITECTURE.md           docs/TESTING_STRATEGY.md      eslint.config.mjs
docs/DATA_MODEL.md             docs/SECURITY.md              vitest.config.ts
docs/DATA_SOURCING.md          docs/PHASE_0_REPORT.md        postcss.config.mjs
docs/IMPLEMENTATION_PLAN.md    README.md                     .github/workflows/ci.yml
package.json                   app/layout.tsx                .env.example
tsconfig.json                  app/page.tsx                  .gitignore
next.config.ts                 app/globals.css               .prettierrc.json
lib/config/branding.ts         lib/config/chronology-defaults.ts
lib/config/branding.test.ts    .prettierignore
```

### Exit gate

| Criterion                                   | Result                                                            |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Project builds                              | **Pass.** `npm run build` compiled successfully, 2 static routes. |
| Existing tests pass, or failures documented | **Pass.** No prior tests existed. 5 new tests pass.               |
| Architecture documented                     | **Pass.** `ARCHITECTURE.md` plus five companion documents.        |
| Implementation plan exists                  | **Pass.** `IMPLEMENTATION_PLAN.md`, 16 phases with gate commands. |

**Phase 0 is complete.**

### Next phase

**PHASE 1 — DATABASE AND DOMAIN FOUNDATION.** Migrations for every entity in
`DATA_MODEL.md`, TypeScript domain types, Zod validation schemas, RLS enabled on every
table in the migration that creates it. No timeline UI.

Phase 1 needs a Supabase project (or a local Supabase instance) before its gate,
`npm run db:migrate` against a clean database, can be run.
