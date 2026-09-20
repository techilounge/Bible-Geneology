# IMPLEMENTATION_PLAN.md

**Project:** Bible Timeline Explorer
**Date:** 2026-09-20

The phase sequence and exit gates are fixed by the build prompt §61. This document
turns each gate into a command that either passes or fails, so "phase complete" is a
test result rather than a judgement call.

---

## Gate commands

Every phase gate is some subset of these. None of them may be weakened to make a phase
pass.

| Command                 | Checks                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `npm run typecheck`     | `tsc --noEmit`, strict, zero errors                           |
| `npm run lint`          | ESLint including the layering and chronology-math rules       |
| `npm run test`          | Vitest unit and component tests                               |
| `npm run test:golden`   | The immutable chronology assertions                           |
| `npm run validate:data` | Canonical dataset validation; exits non-zero on severe errors |
| `npm run build`         | Next.js production build, preceded by `validate:data`         |
| `npm run test:e2e`      | Playwright                                                    |
| `npm run test:a11y`     | axe against the key routes                                    |
| `npm run db:migrate`    | Supabase migrations against a clean database                  |
| `npm run audit:dataset` | Regenerates `docs/DATASET_AUDIT.md`                           |

`npm run verify` runs typecheck, lint, test, validate:data, and build. That is the
command CI runs on every pull request, and the one to run before declaring any phase
done.

---

## Phase 0 — Repository discovery

**Status: in progress.** See `PHASE_0_REPORT.md`.

Goal: establish that there is a buildable repository, a documented architecture, and a
plan, before any feature code exists.

Deliverables: the six planning documents; a skeleton that builds; CI wired up.

Gate: `npm run verify` green on the skeleton; the six documents exist.

---

## Phase 1 — Database and domain foundation

**Goal.** Every entity in `DATA_MODEL.md` exists as a migration, a Zod schema, and a
TypeScript type. No data, no UI.

**Files.** `supabase/migrations/0001_*.sql` through `0006_*.sql`;
`lib/domain/{enums,types,schemas}.ts`; `lib/supabase/{browser,server,admin}.ts`;
`scripts/db-reset.ts`.

**Database.** All core and application tables, enums, constraints, indexes. RLS
enabled on every table in the same migration that creates it — never a follow-up
migration, because a table that ships without RLS for one deploy is a table that leaked.

**Dependencies.** `@supabase/supabase-js`, `@supabase/ssr`, `zod`.

**Risks.** Getting the `unknown_means_null` constraint wrong would either block
legitimate UNKNOWN records or permit incoherent ones. Write the constraint tests before
the seed data exists.

**Gate.** `npm run db:migrate` succeeds on a clean database; migrations are
idempotent on re-run; `npm run typecheck` and `npm run test` green; RLS verified
enabled on every table by an automated check, not by inspection.

**Commit.** `feat(phase-1): add domain schema, migrations and types`

---

## Phase 2 — Verified Genesis dataset

**This is the phase that determines whether the product is trustworthy.** It runs
slower than the others and that is correct.

**Goal.** Populate `data/canonical/` with human-verified, source-backed input values
per `DATA_SOURCING.md`, derive the chronology, and produce the audit report.

**Files.** All of `data/canonical/*.json`; `scripts/derive-chronology.ts`;
`scripts/audit-dataset.ts`; `docs/DATASET_AUDIT.md`.

**Sequence.**

1. Seed identity and structure first: `people.json`, `person-names.json`,
   `relationships.json`, `scripture-references.json`, `sources.json`,
   `assumptions.json`. These need no numbers and can be reviewed independently.
2. Fill `person-chronology.masoretic.json` input values by the §7 procedure in
   `DATA_SOURCING.md`, in chain order: Genesis 5, then Genesis 11, then the
   patriarchal family.
3. Seed the UNKNOWN-dated people explicitly. Do not leave them out.
4. Run the derivation script. Inspect the generated birth and death years.
5. Run golden tests. Investigate every mismatch before touching a number.
6. Generate the audit report.

**Risks.** The temptation, on a mismatch between derived output and a golden
assertion, is to adjust the input number until the test passes. That inverts the whole
method. A mismatch means either the verse map is wrong, a derivation rule is wrong, or
the golden assertion is wrong — and each is investigated as a question about the text
and the rules, in writing, before anything changes.

**Gate.** All records validate; all references and relationship targets resolve; no
parent cycles; every chronological claim has provenance; golden tests pass;
`docs/DATASET_AUDIT.md` exists and every seeded value in it names a verse and a
reviewer.

**Commit.** `feat(phase-2): add verified Genesis chronology dataset`

---

## Phase 3 — Chronology engine

**Goal.** Implement §18's functions as pure TypeScript. No React, no Supabase, no
`fetch`.

**Files.** `lib/chronology/{timeline,overlap,ages,alive,events,explanation,scale}.ts`;
`lib/graph/{overlap-graph,bfs,paths}.ts`; tests alongside.

**Function inventory** (§18), all taking a dataset argument and returning
`ChronologyResult<T>` where a value may be undeterminable:

```
getPersonTimeline            getAgeAtPersonDeath        getOverlapChain
getLifetimeOverlap           getEventsDuringLifetime    getGenerationDistance
getPeopleAliveAtYear         getAncestorPath            compareLifespans
getPeopleAliveAtBirth        getDescendantPath          getLivingAncestorsAtYear
getPeopleAliveAtDeath        getRelationshipPath        getLivingDescendantsAtYear
getAgeAtYear                 getMaximumConcurrentGenerations
getAgeAtPersonBirth          getChronologyExplanation
```

**Risks.** Unknown dates propagating as silent zeros. The `ChronologyResult` union
prevents it at the type level, but each function needs an explicit test for the
partially-unknown case: what does `getLifetimeOverlap(enoch, noah)` return when Enoch
has no death year? Answer: `{ status: 'unknown', reason: 'no-data' }`, not a computed
overlap using a substituted death year.

**Gate.** Every function has unit tests including the unknown and boundary cases;
golden tests pass; a lint check confirms no import from `react`, `next`, or
`@supabase` anywhere under `lib/chronology` or `lib/graph`.

**Commit.** `feat(phase-3): implement chronology engine`

---

## Phase 4 — Data integrity system

**Goal.** `npm run validate:data` checks everything in §21 and fails CI on severe
errors.

**Validators**, each with a severity:

| Check                                                   | Severity |
| ------------------------------------------------------- | -------- |
| `death_year >= birth_year`                              | severe   |
| lifespan consistent with derived years                  | severe   |
| parent birth year <= child birth year, where both known | severe   |
| all person ids referenced exist                         | severe   |
| all chronology ids exist                                | severe   |
| all scripture reference ids resolve                     | severe   |
| all relationship targets exist                          | severe   |
| no parent cycles                                        | severe   |
| confidence values in the enum                           | severe   |
| review statuses in the enum                             | severe   |
| chronology record has at least one source reference     | severe   |
| derivation `runningTotal` matches `result`              | severe   |
| event start <= end                                      | severe   |
| duplicate records                                       | severe   |
| UNKNOWN confidence paired with a non-null value         | severe   |
| a derived field appearing in `data/canonical/`          | severe   |
| orphan relationship (person with no edges)              | warning  |
| person with no scripture reference                      | warning  |
| VERIFIED record with no `verifiedBy`                    | warning  |

**Gate.** Zero severe errors; the report renders; CI fails on an intentionally
corrupted fixture, proving the gate actually bites.

**Commit.** `feat(phase-4): add canonical data validation and CI gate`

---

## Phase 5 — Application foundation

**Goal.** Shell only. Routing, layout, theme, navigation, design tokens, shared
components, loading and error states, accessibility foundations, PWA manifest and
service worker. No timeline.

**Gate.** Layouts verified at 320, 375, 390, 430 px and desktop; keyboard navigation
reaches every interactive element with visible focus; `npm run verify` green;
Lighthouse PWA installability check passes.

**Commit.** `feat(phase-5): add application shell, design tokens and PWA foundation`

---

## Phase 6 — Character experience

**Goal.** Directory, search, profile pages, relationships, scripture references,
chronology details, Why This Date?, people alive during lifetime, events during
lifetime — all against real canonical data.

**Gate.** No profile renders a chronology value without its confidence and source; a
test asserts that every rendered year on every profile traces to a derivation record;
the UNKNOWN-dated people render correctly rather than blank or broken.

**Commit.** `feat(phase-6): add character directory and profile pages`

---

## Phase 7 — Interactive master timeline

**Goal.** The primary visualization: lifespan bars, year scale, zoom, pan, selection,
overlap highlighting, event markers, filters, responsive and keyboard interaction.

**Risks.** This is the highest-risk phase for both performance and accessibility.
Build the semantic list structure first, verify a screen reader can traverse it, then
add the visual layer.

**Gate.** Verified on desktop, tablet, mobile, touch, and keyboard; a large synthetic
dataset renders within budget; `prefers-reduced-motion` disables transitions; axe
reports no violations on the timeline route.

**Commit.** `feat(phase-7): add interactive biblical timeline`

---

## Phase 8 — Who Was Alive?

Year slider, manual entry, living-person list with ages, timeline synchronization,
jumps to events and to births and deaths.

**Gate.** Every displayed value comes from the engine; a parity test asserts the
route's output equals `getPeopleAliveAtYear` for a sample of years; no arithmetic on
year values exists in the route's components.

**Commit.** `feat(phase-8): add year explorer`

---

## Phase 9 — Comparison engine UI

Could They Have Met?, person selectors, lifespan visualization, overlap explanation,
age comparisons, relationship path, sources.

**Gate.** All golden comparison pairs tested through the UI; a copy review confirms no
string converts chronological overlap into a claim of contact; the same-year boundary
case renders its distinct message.

**Commit.** `feat(phase-9): add comparison and overlap explorer`

---

## Phase 10 — Family tree

**Gate.** Every edge traces to a `relationships` row; a test asserts no relationship
literal exists in any visualization component; touch pan and zoom work on a 320 px
viewport.

**Commit.** `feat(phase-10): add interactive family tree`

---

## Phase 11 — Discovery engine

Deterministic discoveries, Surprise Me, discovery pages, shareable cards.

**Gate.** Every discovery is reproducible: running the generator twice on the same
dataset produces identical output; each discovery links to the records it came from.

**Commit.** `feat(phase-11): add deterministic discovery engine`

---

## Phase 12 — Game and learning engine

Quiz infrastructure and the eight modes; learning journeys; XP, achievements, streaks.

**Gate.** Every generated question's answer is validated against the engine at
generation time; a test generates a large sample of questions across all modes and
asserts each answer matches an engine call.

**Commit.** `feat(phase-12): add quiz engine and learning journeys`

---

## Phase 13 — Authentication and personalization

Google and email magic link, Apple where practical; favorites, saved comparisons, quiz
progress, achievements, preferences.

**Gate.** RLS tests prove one user cannot read or write another's rows; anonymous
exploration still works with no account; signing out leaves no personal data in
caches or local storage.

**Commit.** `feat(phase-13): add authentication and personalization`

---

## Phase 14 — Admin and data governance

Editing interface, review workflow, audit history, verification, and the export job
that writes VERIFIED rows back to `data/canonical` as a pull request.

**Gate.** Permission and RLS tests prove a non-admin cannot reach admin routes or
mutate canonical tables; marking a record VERIFIED requires a reason and writes an
audit row; editing a VERIFIED record requires a reason and source information.

**Commit.** `feat(phase-14): add admin CMS and data review workflow`

---

## Phase 15 — Production hardening

Full review across security, accessibility, performance, SEO, PWA, browser
compatibility, mobile, error handling, indexes, rate limiting, analytics, metadata,
sharing, caching, dependencies, CI/CD, and production environment. Produces
`PRODUCTION_READINESS.md`.

**Final gate.** Production build passes; no critical security issues; no critical
accessibility issues; zero canonical dataset errors; all golden tests pass; critical
E2E journeys pass.

**Commit.** `chore(phase-15): production hardening and readiness review`

---

## Working rules

- One phase per branch, one commit per phase, no combining phases (§66).
- Each phase opens with a PHASE X PLAN and closes with a PHASE X REPORT (§62).
- A test is reported as passing only when it was actually executed, with its output.
- On hitting a §63 stop condition, work stops and the failure is reported rather than
  worked around.
- Nothing is pushed to GitHub and no repository is created until Kelv asks.

## MVP scope

Phases 0 through 11 plus a reduced Phase 12 deliver §68. Phases 13 and 14 are needed
for the full product but not for the MVP definition, since core exploration requires no
account (§46). Phase 15 runs before any public launch.
