# Phase 4 Report — Data Integrity System

Date: 2026-09-20
Commit: `feat(phase-4): add derived-data validation and prove the gate bites`

---

## 1. Why there are two validators

The canonical files hold no years. They hold the figures a human read from the text —
"Adam was 130 when Seth was born", "Terah died at 205" — and the years are computed
from them into `data/generated/`. That split is deliberate (Phase 2, §1), and it means
the canonical validator structurally cannot catch a death before a birth: there are no
deaths in the files it reads.

So Phase 4 adds the second half.

| Validator                            | Reads             | Catches                                                                                                        |
| ------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `lib/validation/validate-dataset.ts` | `data/canonical/` | Shape, references that do not resolve, duplicates, parent cycles, enum typos, a derived value typed in by hand |
| `lib/validation/validate-derived.ts` | `data/generated/` | Years that contradict each other, descent that runs backwards, derivations that explain a different number     |

Both are pure functions over parsed records, so both are tested without a filesystem
and both are reusable by the Phase 14 admin tooling.

## 2. What the derived validator checks

Severe, and these fail the build:

- A death year before the birth year, or a negative lifespan.
- A lifespan that disagrees with its own years.
- A child born before their parent.
- A year present with confidence UNKNOWN, or absent without it — the runtime half of
  the database's `unknown_means_null` constraint.
- A stated year or lifespan with no scripture reference behind it.
- A reference, on a record or on a derivation step, that does not resolve.
- A derivation whose steps do not sum to its own result, or whose result is not the
  number it is attached to.
- Two records for one person, or one event, in a single chronology.
- A record belonging to a chronology other than the one it was loaded under.
- An event that ends before it starts.

Warning, reported and not fatal:

- A parent under 12 at a child's birth. The text is the authority; the number is only
  a smell, and a threshold is not Scripture.
- A child born after the parent's death. Possible for a father, and the text sometimes
  says so.
- A derived record claiming to be VERIFIED. Review happens on the figures a human can
  check, never on arithmetic.

## 3. The integrity report

`npm run validate:derived` writes `data/generated/INTEGRITY_REPORT.md`: per chronology,
how many people are dated, the confidence profile, the span of birth years, how many
events are dated, and every finding in a table. It is git-ignored, like everything else
under `data/generated/`, because it describes output that is recomputed on every build.

Current state: **0 severe, 0 warning** across both chronologies.

## 4. Proving the gate bites

A validator that reports a finding nobody wires to an exit code is decoration, and
that is exactly the failure §21 exists to prevent. The unit suites assert the
validators return findings; that is necessary and it is not the same claim.

`npm run validate:prove-gate` corrupts the real canonical files, one way at a time,
and asserts `npm run validate` exits non-zero each time:

| Corruption                                             | Caught by                    |
| ------------------------------------------------------ | ---------------------------- |
| A derived year typed into the canonical figures        | `derived-value-in-canonical` |
| A scripture reference that does not resolve            | `missing-reference`          |
| A relationship pointing at a person who does not exist | `missing-person`             |
| A parent cycle                                         | `parent-cycle`               |
| A fathering age that makes a son older than his father | `child-born-before-parent`   |

It works on a copy, restores the originals in a `finally` block, and restores them on
SIGINT and SIGTERM too, because leaving a contributor's canonical data corrupted
because they pressed Ctrl-C would be a worse bug than the one it guards against. CI
runs it on every push.

## 5. Exit criteria

| Criterion                                                    | Status                                        |
| ------------------------------------------------------------ | --------------------------------------------- |
| Every check in the Phase 4 table implemented with a severity | Pass                                          |
| Zero severe findings on the current dataset                  | Pass — 1 warning, Joseph's two unread figures |
| The integrity report renders                                 | Pass — `data/generated/INTEGRITY_REPORT.md`   |
| CI fails on an intentionally corrupted fixture               | Pass — five of them, end to end               |
| `npm run verify` green                                       | Pass — 335 tests                              |

## 6. What Phase 5 inherits

`npm run validate` now gates the build on both halves of the dataset, and
`npm run verify` runs typecheck, lint, both validators, the full suite with coverage
thresholds, and the production build. Phase 5 is the application shell — routing,
layout, design tokens, accessibility, PWA — with no timeline in it yet.
