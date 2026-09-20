# Phase 7 Report — The Interactive Timeline

Date: 2026-09-20
Commit: `feat(phase-7): add the interactive master timeline`

---

## 1. What is here

`/timeline` now draws the real derived chronology: 24 lifespan bars on a shared year
axis, the four dated events as markers, zoom, pan, selection with overlap
highlighting, a name filter, and the same content written out as a list.

| Piece                              | What it does                                                  |
| ---------------------------------- | ------------------------------------------------------------- |
| `lib/chronology/scale.ts`          | Year-to-pixel maths, lane packing, virtualization, clamping   |
| `components/timeline/Timeline.tsx` | Filters, selection, and the two views kept in agreement       |
| `TimelineChart.tsx`                | The SVG layer, `aria-hidden`, driven by real buttons and keys |
| `TimelineList.tsx`                 | The accessible representation: who, when, how long, how sure  |

## 2. The list is not a fallback

The semantic list was built first and the chart added over it, which is the order
ARCHITECTURE.md section 6 asks for. The SVG carries `aria-hidden="true"`, because a
chart retrofitted with ARIA announces its shape rather than its content, and because
announcing both would read every lifetime twice.

So a screen reader, a search engine, and a browser that has not run the JavaScript yet
all get the same sentences. The browser test asserts the two agree by counting: every
bar drawn has a row in the list, and the count is checked rather than assumed.

The controls — zoom, pan, reset, the filter, the selection buttons — sit outside the
hidden subtree and are ordinary buttons and inputs, so a sighted keyboard user drives
the chart without ever meeting the SVG.

## 3. Twenty-four bars, not twenty-five, and not forty-nine

Three groups, kept apart on the page rather than folded into one number:

- **24 placed.** A birth year and something to end the bar at.
- **1 with a start and no end.** Esau has a birth year, because Genesis dates him
  through Jacob, and neither a death year nor a lifespan. There is no year to draw the
  bar to, so he is named in the prose instead of being given a plausible length.
- **24 with no ages at all.** Counted and stated, as on the directory.

Enoch is in the first group and is the reason `livingWindowEnd` is shared rather than
reimplemented: Scripture gives his lifespan and no death, so his bar runs to birth plus
lifespan and is drawn dashed. The uncertainty is in the shape, not only in the caption.

## 4. Overlap on screen means overlap in the engine

Selecting a lifetime highlights the ones that share years with it. The rule is the
half-open interval `[birth, death)`, assumption `overlap-half-open`, the same rule the
"who was alive" engine applies — dying in the year another is born is not an overlap,
and the chart must not highlight it.

`overlappingIds` is a pure function in `lib/chronology/scale.ts` with its own tests,
including that exact boundary. A browser test then checks the case this project was
told to get right: with Noah dying in 2006 AM and Abraham born in 2008 under the
130-year default, selecting Noah does not light Abraham up.

The status line says `N other dated lifetimes overlap this one` and then, every time:
_Overlapping lifetimes mean the two were alive in the same years, not that they met._
Requirement section 21. It is not a tooltip and not a footnote.

## 5. Events that have a year, and one that does not

Four of the five events are drawn as markers. The Tower of Babel is not. Genesis 10:25
places it in an era, not a year, and putting it at a plausible point on an axis is
exactly the invention requirement section 3 forbids. The chart omits it and the events
page will carry it.

## 6. Performance

Lane packing, extent and virtualization are pure functions, so their cost is measured
directly rather than inferred from a frame rate. `visibleRows` filters by year rather
than by row index, because the rows are sorted by birth year and a viewport covers a
contiguous slice of time.

The component test mounts 2,000 synthetic lifetimes — eighty times the real dataset —
and asserts the mount completes inside a budget, then asserts that zooming in actually
reduces the number of drawn bars, so the virtualization is proved to bite rather than
merely to exist. The budget is generous because jsdom is not a browser; what it catches
is an accidental quadratic, which is the regression that would matter.

Lanes are repacked whenever the filter changes. Keeping the original lanes would leave
the gaps where the hidden people used to be, which reads as missing data rather than as
a filter.

## 7. Accessibility

`axe-core` runs against `/timeline` with the WCAG 2.0 A/AA, WCAG 2.1 A/AA and
best-practice rule sets, twice: once on load and once with a lifetime selected, since
selection changes the DOM and a clean first pass says nothing about the second.

Both report zero violations.

Beyond axe, which cannot check these:

- Keyboard: arrows pan, `+`/`-` zoom, `Home` restores the full span, `Escape` clears the
  selection. Panning at full extent is asserted to be a no-op, because it is.
- Touch: a tap selects, with no hover state anywhere in the path. Every control is at
  least 44px, the checkbox measured by the label that wraps it, since tapping the words
  is what toggles it.
- Widths 320, 390, 768 and 1280: no horizontal overflow, and the chart measured to
  confirm it resizes to the column rather than keeping the width it was rendered at.
- Reduced motion: the bars carry a 150ms transition, and the test asserts it is present
  without the preference and gone with it. The rule itself is the global one in
  `globals.css`; the test proves it reaches this component.

## 8. Two things fixed on the way

`chainPrefix` aside, this phase turned up one latent defect and one piece of noise.

`buildRows` assigned lanes inline, so a filtered view kept the original lane numbers.
The packing is now `packLanes`, exported and tested, and the filter re-runs it.

Every page load was requesting `/favicon.ico` and getting a 404, because the root
metadata named a manifest but no icons. The icons already existed for the manifest, so
the fix was to point at them.

## 9. Exit criteria

| Criterion                                       | Status                                                       |
| ----------------------------------------------- | ------------------------------------------------------------ |
| Verified on desktop, tablet, mobile             | Pass — 320, 390, 768, 1280, no overflow, chart resizes       |
| Verified on touch                               | Pass — tap selects; every control ≥44px                      |
| Verified on keyboard                            | Pass — pan, zoom, reset, clear, focus visible                |
| Large synthetic dataset renders within budget   | Pass — 2,000 lifetimes mount in budget; virtualization bites |
| `prefers-reduced-motion` disables transitions   | Pass — asserted both ways                                    |
| axe reports no violations on the timeline route | Pass — on load and with a selection                          |
| `npm run verify` green                          | Pass — 395 engine tests, 38 component tests                  |
| `npm run test:e2e` green                        | Pass — 246 tests                                             |

## 10. Still open, carried forward

- **Joseph.** His birth year stays UNKNOWN pending two figures from the text
  (Genesis 41:53 and Genesis 45:6) that Kelv has been asked for twice. Nothing may
  supply them from model knowledge. He is one of the 24 with no ages, so the timeline
  is correct as it stands and will gain a bar when the figures arrive.
- **Migration 0013.** The `verified_requires_reviewer` constraint wants a `uuid` and the
  canonical JSON carries a text label; the migration adds `verified_by_label`.
- **Sections 30 and 35 of the build prompt.** The example copy assumes Noah and Abraham
  overlap, which the 130-year default makes false. Must be rewritten before Phases 9
  and 11, tracked in `docs/TESTING_STRATEGY.md` section 3.

## 11. What Phase 8 inherits

A shared scale module, so the family tree and the timeline place a year in the same
place, and a working pattern for a visual surface: semantic structure first, the
picture over it, and the two checked against each other in the test suite.
