# Phase 8 Report — Who Was Alive?

Date: 2026-09-20
Commit: `feat(phase-8): add year explorer`

---

## 1. What is here

`/who-was-alive` answers the question the product was built around. Pick a year and
the page lists everyone this chronology can place alive in it, with their ages, over a
timeline strip with a rule drawn at that year.

| Piece                              | What it does                                               |
| ---------------------------------- | ---------------------------------------------------------- |
| `changeYears` / `nextChange`       | The years in which the living set changes, and how to step |
| `busiestYear`                      | The fullest year, so the page opens somewhere worth seeing |
| `components/year/YearExplorer.tsx` | Slider, year entry, jumps, living list, timeline strip     |
| `lib/services/dataset.ts`          | `getTimelineRows/Events/Bounds`, shared with `/timeline`   |

## 2. The page does no arithmetic

The gate asks that every displayed value come from the engine and that no arithmetic on
year values exist in the route's components. Both are now asserted, not asserted-about.

The engine is framework-independent by construction, so the client imports it rather
than carrying a smaller copy of it. `getPeopleAliveAtYear` and `getAgeAtYear` run in the
browser as the slider moves, and they are the same functions the profile pages call on
the server. The alternative — a component that subtracts a birth year from the selected
year — is a second, untested chronology engine, and the day the two disagree is the day
the product stops being worth trusting.

`tests/architecture/layering.test.ts` now scans every file under `app/timeline`,
`app/who-was-alive`, `components/timeline` and `components/year` for arithmetic on
anything named like a year or an age, with comments stripped first. It found two real
cases on the way in, both since moved into `lib/chronology/scale.ts` and tested there:
the bar length the timeline list prints, and the pan and zoom maths that used to live in
an event handler.

## 3. Parity, checked year by year

`tests/e2e/who-was-alive.spec.ts` loads the route for twelve years spread across the
range and compares the rendered list of people against `getPeopleAliveAtYear` computed
directly from the generated chronology. It then changes the year in the browser three
more times and compares again, because the server path and the client path are different
code paths to the same answer and only one of them was covered by the first check.

The sample deliberately includes 2006, 2007 and 2008: Noah dies in 2006 and Abraham is
born in 2008, which is the boundary Kelv's 130-year decision produces and the one the
half-open interval governs.

## 4. Jumping to somewhere worth looking

Stepping a year at a time through a chronology that spans 2,315 years is not exploration.
`changeYears` returns only the years in which someone is born or a living window closes,
and the two jump buttons move to the next and previous one, labelled with what happens
there: _1658 AM: Arphaxad born_, _930 AM: Adam died_.

An open-ended window gets a different word. Enoch's record gives a lifespan and no death,
so his window closes at 987 AM and the button says _last placed_, not _died_. Saying Enoch
died in 987 AM is a claim Genesis 5:24 does not make, and a label is not the place to start
making it.

The dated events are jump buttons too. The undated ones are not, for the same reason they
have no marker on the timeline.

## 5. Where the page opens

On `busiestYear`, the year the chronology can place the most people alive, which is a new
engine function with its own tests. Opening on the epoch would have shown Adam alone.

The page says so in its lede, and says it is a fact about this chronology rather than
about history. The same care applies to the empty case: when no one can be placed in the
chosen year, the page says that is a statement about the chronology and not a claim that
the world was empty.

## 6. Three ways to choose a year

A range slider, a number box, and the jump buttons, all driving one piece of state, with
the chosen year kept in the address bar so a year can be linked to. The URL is updated
with `history.replaceState` rather than a router navigation, because asking the server for
a new page on every drag of a slider is not a design.

A year typed into the box or pasted into the URL is clamped to the range on both sides —
`?year=99999` lands on 2315 AM and `?year=not-a-year` lands on the default, rather than on
an empty page.

## 7. Two contrast defects found and fixed

The app-wide axe sweep added in this phase found that `--color-text-muted` at 63%
lightness came out at 4.04:1 on `--color-surface-overlay`, and the Unknown confidence
colour at 60% came out at 3.55:1 on the same surface. Both are under the 4.5:1 that
WCAG 1.4.3 asks for at that size.

Both tokens were lightened rather than the handful of components that happened to trip
over them. A colour token that is only contrast-safe on some of the app's surfaces is a
trap for whoever writes the next component, and "Unknown" is not the label to leave hard
to read.

The sweep itself is the more valuable part: axe now runs against all ten routes with the
WCAG 2.0 A/AA, 2.1 A/AA and best-practice rule sets, so a contrast regression fails the
suite on whichever page it lands.

## 8. Exit criteria

| Criterion                                                   | Status                                             |
| ----------------------------------------------------------- | -------------------------------------------------- |
| Year slider, manual entry, living list with ages            | Pass                                               |
| Timeline synchronisation                                    | Pass — a rule on the shared chart, at the year     |
| Jumps to events and to births and deaths                    | Pass — labelled with what happens there            |
| Every displayed value comes from the engine                 | Pass — the client imports it, and parity is tested |
| Parity test against `getPeopleAliveAtYear` for sample years | Pass — 12 years, server and client paths           |
| No arithmetic on year values in the route's components      | Pass — asserted by the architecture suite          |
| `npm run verify` green                                      | Pass — 426 engine and service tests, 52 component  |
| `npm run test:e2e` green                                    | Pass — 320 tests                                   |

## 9. Still open, carried forward

Unchanged from Phase 7, and none of it blocks Phase 9:

- **Joseph's two figures** (Genesis 41:53 and Genesis 45:6), asked for twice. Until they
  arrive he is one of the people this page counts but cannot place.
- **Migration 0013** for `verified_by_label`.
- **Sections 30 and 35 of the build prompt**, whose example copy assumes Noah and Abraham
  overlap. Phase 9 is the comparison engine UI, so this is the phase where that copy has
  to be rewritten rather than shipped.

## 10. What Phase 9 inherits

The overlap engine, a proven pattern for putting it on a page without duplicating it, and
the architecture test that stops the duplication happening by accident. Phase 9 is "Could
They Have Met?", which is the same arithmetic asked as a question about two people, and
the phase where the wording rule — overlap is not contact — matters most.
