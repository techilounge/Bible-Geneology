# Phase 6 Report — Character Experience

Date: 2026-09-20
Commit: `feat(phase-6): add character directory and profile pages`

---

## 1. What is here

49 statically generated profile pages and a directory, rendering the real canonical
figures and the derived chronology. No placeholder data anywhere.

| Piece                     | What it does                                                               |
| ------------------------- | -------------------------------------------------------------------------- |
| `/people`                 | Everyone, grouped by era, searchable including by former names             |
| `/people/[slug]`          | Dates, family, contemporaries, events, sources, and the working            |
| `lib/services/dataset.ts` | Loads canonical plus derived data; the seam Phase 13 will move to Supabase |
| `WhyThisDate`             | The recorded derivation, step by step, with the assumptions named          |
| `PersonDates`             | Birth, death and lifespan, each with its own confidence                    |
| `UndatedNotice`           | The page for someone Scripture gives no ages for                           |

## 2. Three confidences, not one

Birth, death and lifespan each carry their own badge. They genuinely differ: a
Genesis 5 lifespan is stated outright while the birth year beside it is arithmetic
over nine intervals, and one badge for the row would overstate one of them. Adam's
page says his lifespan is Stated and his birth year is Derived, which is exactly the
distinction the product exists to make.

No birth year on any page reads "Stated", because Scripture states none.

## 3. The pages with no numbers on them

24 of the 49 people have no ages in Scripture — most of the women named in these
genealogies, and several of the men. Their pages are not blank and they are not
omitted from the directory. Each says, in plain words, that Scripture gives no ages
for this person, that this is a gap in the text rather than in the dataset, and that
estimating it would turn an absence into a claim.

Requirement sections 7 and 43. A genealogy product that quietly renders only the
people with numbers has made the text's silences invisible, which is itself a claim
about the text.

## 4. "Why this date?"

Every derived birth year carries the chain that produced it, from year 0 to the
person, one row per interval with the verse beside it and the running total on the
right. Abraham's runs to 22 steps, from Adam through the flood and the Genesis 11
line to the subtraction that Acts 7:4 forces.

The page renders the derivation the engine recorded when the value was computed. It
never recomputes. A page that re-derived the chain for display could disagree with the
number printed above it, and that disagreement is the one failure this feature exists
to prevent.

Below the steps, the named assumptions the calculation rests on, in full. Abraham's
page explains the Terah decision where the reader meets it, not in a footnote
somewhere else.

## 5. What the contemporaries list says, and does not

Each dated profile lists whose lifetimes overlapped, longest first, with a standing
line above it: that is all it means, and an overlap is not evidence they met or knew
of each other. Requirement section 14, kept in the copy rather than in a policy
document.

## 6. The gate

`npm run test:e2e` — 202 tests, 77 of them Phase 6:

| Gate criterion                                           | How it is checked                                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| No profile renders a value without confidence and source | All 49 pages, asserting a confidence word and a source line                                              |
| Every rendered year traces to a derivation               | Every person with a derivation: open the working and assert the last running total equals the year shown |
| UNKNOWN-dated people render correctly                    | All 49 pages: the undated ones must show the notice, not a blank                                         |
| No NaN, undefined or null on any page                    | The rendered text of all 49 pages                                                                        |

Plus the directory: it lists everyone including the undated, finds Abraham by
searching "Abram", filters to dated people, and says so plainly when nothing matches.

## 7. One thing corrected along the way

The service layer's memoisation was originally React's `cache`, described in a comment
as loading the data once per request. `cache` only memoises within a single render,
which is the right scope for request data and the wrong one for files that cannot
change while the process runs — so the comment claimed more than the code did. It is
now a module-level memo in production and no memo at all in development, where
re-reading is what you want after editing a canonical file. The comment now describes
what happens.

## 8. Exit criteria

| Criterion                                               | Status                                                  |
| ------------------------------------------------------- | ------------------------------------------------------- |
| Directory, search, profiles against real canonical data | Pass — 49 static pages                                  |
| No chronology value without its confidence and source   | Pass — asserted on every page                           |
| Every rendered year traces to a derivation record       | Pass — asserted on every page that has one              |
| UNKNOWN-dated people render correctly                   | Pass — 24 of them                                       |
| `npm run verify` green                                  | Pass — 350 engine and service tests, 24 component tests |
| `npm run test:e2e` green                                | Pass — 202 tests                                        |

## 9. What Phase 7 inherits

The service layer, the confidence primitives, and profile pages to link to. Phase 7
is the interactive master timeline: the axis, the lifespan bars with their confidence
encoded in the bar itself, the viewport, and the open-ended bar that Enoch needs.
