# TESTING_STRATEGY.md

**Project:** Bible Timeline Explorer
**Date:** 2026-09-20

---

## 1. What is actually at risk

Most web applications risk a broken page. This one risks stating something false about
the Bible with a confident number attached. The test suite is weighted accordingly:
the chronology engine and the dataset get disproportionate coverage, and the UI is
tested mainly for _not disagreeing with the engine_.

Three failure modes drive the design:

1. **A wrong number that looks right.** Caught by golden tests and dataset validation.
2. **The UI computing its own answer.** Caught by parity tests and a lint rule.
3. **An unknown value rendered as a number.** Caught by the `ChronologyResult` type,
   plus explicit unknown-path tests on every engine function and every display
   component.

---

## 2. Tooling

| Layer                            | Tool                                           | Runs                    |
| -------------------------------- | ---------------------------------------------- | ----------------------- |
| Unit, engine, validation         | Vitest                                         | every commit            |
| Component                        | Vitest + Testing Library                       | every commit            |
| Integration (services, database) | Vitest against a local Supabase                | every commit            |
| End-to-end                       | Playwright, Chromium + WebKit                  | pull request and main   |
| Accessibility                    | `@axe-core/playwright`                         | pull request            |
| Visual regression                | Playwright screenshots, timeline and tree only | pull request            |
| Dataset validation               | `scripts/validate-data.ts`                     | pre-build, every commit |

Coverage thresholds, enforced: `lib/chronology` and `lib/graph` at 100% of branches;
`lib/validation` and `lib/discovery` at 95%; everything else at 70%. The high numbers
are only demanded where they are achievable — pure functions with no I/O.

---

## 3. Golden tests

`tests/golden/` holds assertions that are **immutable**. Changing one requires a
written justification in the pull request explaining what about the chronology was
wrong before, and review by the project owner. They exist to detect drift in the data
and the engine, so a suite that gets edited whenever it fails is worthless.

The build prompt's §22 list was written against the 70-year reading of Terah's age at
Abraham's birth. Kelv's decision of 2026-09-20 makes 130 the default
(`DATA_SOURCING.md` §4a), and that inverts two of those assertions. The table below is
the corrected set. Where an assertion changed, the original is shown so the change is
visible rather than quietly absorbed.

| #   | Assertion                                                         | Depends on                  |
| --- | ----------------------------------------------------------------- | --------------------------- |
| 1   | Adam's lifespan is as GEN.5.5 states                              | dataset only                |
| 2   | Methuselah's lifespan is as GEN.5.27 states                       | dataset only                |
| 3   | Adam and Methuselah's lifetimes overlap, approximately 243 years  | chain + `overlap-half-open` |
| 4   | Adam and Noah's lifetimes do not overlap                          | chain                       |
| 5   | Adam and Lamech's lifetimes overlap                               | chain                       |
| 6   | Methuselah and Noah's lifetimes overlap                           | chain                       |
| 7   | **Noah and Abraham's lifetimes do NOT overlap** under `masoretic` | chain + Terah decision (a)  |
| 8   | Shem and Abraham's lifetimes overlap                              | chain + Shem decision (b)   |
| 9   | Shem and Isaac's lifetimes overlap                                | as 8                        |
| 10  | **Shem and Jacob's lifetimes do NOT overlap** under `masoretic`   | as 8 + Terah decision (a)   |
| 11  | Methuselah's age at Noah's birth is a specific derived value      | chain                       |
| 12  | Terah and Abraham's lifetimes overlap by exactly 75 years         | chain + Terah decision (a)  |
| 13  | Noah and Abraham DO overlap under `masoretic-gen11-26`            | the alternate variant       |
| 14  | Shem and Jacob DO overlap under `masoretic-gen11-26`              | the alternate variant       |

Assertions 7 and 10 previously read "overlap" and now read "do not overlap".
Assertions 13 and 14 are their counterparts under the alternate chronology, so the
inversion is asserted from both sides and neither reading can drift unnoticed.

Assertion 12 is the derivation's own consistency check. The Terah–Abraham overlap must
come out at exactly 75 years, Abraham's age at the departure from Haran, because that
is the figure the 130 offset was derived from. If it comes out at anything else, the
chain is assembled wrong.

**Consequence for product copy, tracked here because the tests are what caught it.**
The build prompt's §30 worked example ("Noah and Abraham ... approximately 58 years")
and two of its §35 Surprise Me examples ("Shem was alive when Jacob was born", "Noah's
lifetime extended into Abraham's lifetime") assert overlaps that the chosen default
does not produce. They are placeholder copy, not data, but they must be rewritten
before Phase 9 and Phase 11 ship, and no seeded discovery may reproduce them. A copy
review against the verified dataset is an exit condition for both phases.

**Provenance assertions**, run over the whole dataset rather than per pair:

- Every `person_chronology` record with a non-null year has at least one scripture
  reference or an identified secondary source.
- Every DERIVED value has a derivation record whose steps arithmetically produce it.
- Every derivation step cites a scripture reference that resolves.
- No record is VERIFIED without `verifiedBy` and `verifiedAt`.
- No value in `data/canonical/` is a derived field.

The exact numeric expectations in assertions 1, 2, 3 and 11 are filled in during Phase
2 from the verified dataset, and the fixtures are frozen at that point. They are
deliberately _not_ pre-filled from memory in Phase 0, for the reason given in
`DATA_SOURCING.md` §1.

---

## 4. Boundary cases

Each of these gets a named test in `lib/chronology/__tests__/boundaries.test.ts`:

| Case                                                      | Expected                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| A dies in the same AM year B is born                      | `overlapYears: 0`, `overlaps: false`, `sameYearBoundary: true`             |
| A and B born in the same year                             | overlap from that year                                                     |
| A and B are the same person                               | rejected as invalid input, not an overlap of a full lifespan               |
| A has an unknown death year (Enoch)                       | `{ status: 'unknown', reason: 'no-data' }`                                 |
| A has unknown birth and death (Rebekah)                   | `{ status: 'unknown', reason: 'no-data' }`                                 |
| A has no record in the selected chronology                | `{ status: 'unknown', reason: 'not-applicable' }`, distinct from the above |
| Year query before the epoch                               | empty result, no error                                                     |
| Year query after the last death                           | empty result, no error                                                     |
| `getAgeAtYear` for a year before birth                    | unknown, never a negative number                                           |
| `getAgeAtYear` for a year after death                     | the age at death, flagged as posthumous                                    |
| Relationship path between disconnected people             | `{ status: 'unknown', reason: 'no-data' }`, no infinite loop               |
| Ancestor path where a middle generation has unknown dates | path returns; overlap chain does not                                       |
| Overlap chain where no chain exists                       | explicit no-chain result                                                   |

The "no record in this chronology" versus "record with unknown dates" distinction is
listed because it is the one most likely to be collapsed by accident, and it becomes
load-bearing the moment the Septuagint chronology lands.

---

## 5. Parity tests

The rule from §8's exit gate — never duplicate calculations in components — is tested,
not just linted. For each of the timeline, year explorer, comparison, and profile
routes, a test renders the route with a fixture dataset, extracts every numeric value
from the output, and asserts each one equals the corresponding engine call.

This catches the realistic version of the mistake, which is not someone writing
`birthYear + lifespan` in JSX but someone rounding, off-by-one-ing, or formatting a
value in a way that changes it.

---

## 6. Component tests

Every component that displays a chronological value is tested against all three
`ChronologyResult` states. The assertion is that the unknown and disputed states render
their designed message and that the string `NaN`, `undefined`, `null`, and `-` followed
by a digit never appear in the output (§57).

A repository-wide test asserts that no rendered output in any component test contains
those tokens. It is crude, and it will catch a real bug eventually.

---

## 7. End-to-end journeys

The critical journeys, run on Chromium and WebKit, desktop and a 375 px mobile
viewport:

1. Land on home, select Explore Timeline, select a person, read their detail panel.
2. Open Who Was Alive?, set a year, confirm the living list and ages.
3. Open Could They Have Met?, choose Noah and Abraham, confirm the overlap result, the
   named chronology, and the "the Bible does not state that they met" qualifier.
4. Open a character profile, expand Why This Date?, confirm the derivation steps and
   their verse references.
5. Open the family tree, trace Abraham's lineage to Adam.
6. Press Surprise Me, confirm a discovery with its people, calculation and references.
7. Play one quiz round to completion.
8. Install the PWA and load the offline shell.
9. Keyboard-only traversal of the timeline: tab to it, arrow between people, select,
   read the panel, escape.

Journey 3 is the product's signature claim and journey 9 is the accessibility
commitment; neither may be skipped or marked flaky.

---

## 8. Accessibility testing

- axe on every top-level route, zero violations at WCAG AA.
- Manual screen reader passes (VoiceOver and NVDA) at the end of Phases 7, 8 and 10 —
  automated tools do not catch an unusable timeline, only an unlabelled one.
- Contrast checked on the token palette itself, so a compliant palette makes every
  component compliant by construction.
- A test asserting that confidence is never communicated by color alone: each
  confidence level's rendered output must contain a distinguishing text label or shape
  attribute (§51).
- `prefers-reduced-motion` honoured by every animated surface.

---

## 9. Performance testing

- Lighthouse CI on home, a profile, and the timeline, with budgets that fail the build.
- A synthetic dataset of several thousand people for the timeline, to catch the
  scaling cliff before the real dataset reaches it.
- A bundle size budget per route, failing on regression, with a specific check that
  the canonical dataset is not shipped whole to the client (§54).

---

## 10. CI

On every pull request, in order, stopping at the first failure:

```
typecheck → lint → validate:data → test → test:golden → build → test:e2e → test:a11y
```

`validate:data` runs before the unit tests so a dataset error is reported as a dataset
error rather than as fifty confusing test failures.

On main, additionally: Lighthouse CI, visual regression, and `npm audit`.

The pipeline includes a self-check: a job that corrupts a fixture dataset and asserts
that `validate:data` exits non-zero. A gate nobody has seen fail is a gate nobody knows
works.

No test is skipped, quarantined, or marked `.todo` to get a phase through its gate
(§64). A failing test is a stop condition (§63).
