# Phase 3 Report — Chronology Engine

Date: 2026-09-20
Commit: `feat(phase-3): complete the chronology engine and its test suite`

---

## 1. What the engine is

A set of pure functions over a `Dataset` that is passed in as a parameter, never
imported. The same code runs against JSON fixtures in a test and against Postgres rows
at runtime, and nothing in `lib/chronology` or `lib/graph` knows which.

| Module             | Answers                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `derive.ts`        | What year was this person born, and what is the working?          |
| `overlap.ts`       | Were these two alive at the same time, and for how long?          |
| `ages.ts`          | How old was A when B was born or died? What bar do I draw?        |
| `alive.ts`         | Who was alive in year N? How many generations at once?            |
| `events.ts`        | What happened during this lifetime, and how old were they?        |
| `explanation.ts`   | Why this date?                                                    |
| `relationships.ts` | How are these two related? Who descends from whom?                |
| `overlap-graph.ts` | What is the shortest chain of overlapping lifetimes between them? |

## 2. Two decisions worth recording

**No engine function returns a bare number.** Every one returns
`ChronologyResult<T>`, a union of `known`, `unknown` and `disputed`. A component
cannot render one without handling the absent cases, which makes requirement section
57 — never show NaN, undefined, null or a negative age — structural rather than a
review habit.

**Three kinds of absence, kept apart.** `not-applicable` means the person has no
record in this chronology at all; `no-data` means the record exists and the value is
unknown; `unknown-in-chronology` means a dependency of the calculation is unknown.
They read as pedantry until the Septuagint chronology arrives with a generation the
Masoretic text does not have, at which point "not in this chronology" and "present but
undated" need different words in the UI. Collapsing them now would be expensive to
undo later.

## 3. Boundary decisions the tests pin down

- **Half-open lifetimes.** `[birth, death)`. Someone who dies in the year another is
  born gives zero years and `overlaps: false`, flagged `sameYearBoundary` so the UI
  can say the chronology cannot resolve it rather than a flat no. The inclusive
  alternative would add a phantom year to every overlap and put `getLifetimeOverlap`
  one year out of step with `getAgeAtPersonBirth`.
- **Enoch is not excluded from the year explorer.** He has a birth year and a lifespan
  and no recorded death. An earlier version dropped anyone with no death year, which
  discarded something the text does say. `getPeopleAliveAtYear` now uses the death
  year when there is one and `birth + lifespan` otherwise, flagged `openEnded`. This
  is deliberately more permissive than `getLifetimeOverlap`, which still returns
  unknown for such a record, because an overlap needs both endpoints and a timeline
  bar does not.
- **A birth year and nothing else is not a window.** A record with no death year _and_
  no lifespan is left out entirely. A bar with a start and no length is not a bar.

## 4. What the test suite covers

311 tests. `lib/chronology` and `lib/graph` are at **100% branch coverage**, enforced
by per-directory thresholds in `vitest.config.ts` that `npm run verify` now runs.

The handful of guards that TypeScript's `noUncheckedIndexedAccess` forces but that no
input can reach — `if (current === undefined) break` after a `queue.length > 0` check,
and similar — carry a `v8 ignore` comment naming the reason. Marking them is the
honest option: deleting them would break the build, and writing a test that cannot
fail would make the 100% meaningless.

Two suites are not about any single function:

- `tests/golden/` asserts the 14 immutable chronology assertions and the
  dataset-wide provenance rules against the real derived data.
- `tests/architecture/layering.test.ts` greps the engine's own source and fails if
  anything in `lib/chronology`, `lib/graph` or `lib/domain` imports React, Next,
  Supabase, a route, a component, a service, or `node:fs`, or references `window`,
  `document`, `fetch` or `process.env`. ESLint enforces the same rule, but a lint zone
  is one config edit from being switched off and this is the property the whole
  layering rests on.

## 5. A bug the tests found

`chainPrefix` assembles the derivation steps that already run from the epoch to an
anchor's birth year, and every caller then appends its own step as
`anchor.birthYear + something`. It silently assumed the prefix summed to exactly the
anchor's birth year. For the real dataset it does, because the epoch is year zero — so
nothing was wrong in the data, and nothing would have been until the first chronology
whose epoch is not zero, or the first anchor whose birth is stated outright rather than
derived. At that point every derivation downstream of it would have claimed a chain
that does not add up to the number it explains.

A fixture with a non-zero epoch made `DerivationSchema` reject the result immediately.
`chainPrefix` now checks the invariant it depends on and falls back to a single step
from the epoch when the prefix does not hold, so the property is enforced where it is
relied on rather than assumed at every call site.

## 6. Exit criteria

| Criterion                                                      | Status                                   |
| -------------------------------------------------------------- | ---------------------------------------- |
| Engine is pure: no UI, no I/O, no framework imports            | Pass — asserted by test and by lint      |
| Every chronological function returns a typed result            | Pass — no function returns a bare number |
| UNKNOWN propagates rather than defaulting to a number          | Pass                                     |
| Overlap, ages, alive-at-year, generations, paths implemented   | Pass                                     |
| Derivations carry their working and check their own arithmetic | Pass                                     |
| 100% branch coverage on the engine                             | Pass — enforced in `vitest.config.ts`    |
| Golden tests pass against the real dataset                     | Pass                                     |
| `npm run verify` green                                         | Pass                                     |

## 7. What Phase 4 inherits

The validation layer already exists in `lib/validation` and runs in `npm run build`.
Phase 4 extends it into the full data-integrity system: cross-chronology consistency,
the age-plausibility rules, orphan and cycle detection across the whole graph rather
than the chronology input alone, and a reviewable integrity report.
