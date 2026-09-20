# Phase 10 Report — Interactive Family Tree

Date: 2026-09-20
Commit: `feat(phase-10): add the interactive family tree`

---

## 1. What is here

`/family-tree` draws the recorded lines of descent around one person, with the same
family written out beside it as a nested list. The drawing is pannable and zoomable
by finger, wheel or keyboard; the list is what a screen reader hears.

| Piece                              | What it does                                              |
| ---------------------------------- | --------------------------------------------------------- |
| `lib/graph/tree-layout.ts`         | Relationships in, coordinates out. Depths, order, edges.   |
| `lib/graph/tree-viewport.ts`       | Pan, zoom, pinch and fit as pure functions over a viewport |
| `components/tree/FamilyTreeChart.tsx` | The drawing, and the gestures that move it              |
| `components/tree/TreeOutline.tsx`  | The same family as a nested list, always in the DOM        |
| `app/family-tree/page.tsx`         | A plain GET form for who to centre on and how far to reach |

## 2. Every edge traces to a relationship row

The gate is a property of the source, not of the picture, so it is enforced where it
can be enforced. `buildFamilyTree` filters the stored `relationships` rows down to
those whose two ends are both in view and carries each row whole into a `TreeEdge`.
The component receives edges and names; it has never seen a relationship record, so
it cannot draw a line the dataset does not hold.

The browser suite reads every `data-edge` attribute the page renders, splits it back
into source, target and type, and looks the triple up in `data/canonical/relationships.json`.
An edge without a row fails the test. It runs for three roots — Adam, Noah and Jacob.

Siblings get their own test, from the other direction: Shem, Ham and Japheth share a
parent, that fact is computed rather than stored, and no line is drawn between them.
A drawn sibling line would be the picture claiming more than the text.

## 3. No relationship literal in any visualisation component

`tests/architecture/layering.test.ts` gained two checks over everything under
`components/`:

- no relationship type appears as a string literal (`'parent'`, `'spouse'`, and the
  rest), so no component can branch on what kind of relationship it is holding;
- no canonical person id appears as a string literal, so no component can single
  anyone out.

Descent is still drawn differently from marriage — solid against dashed — but the
distinction arrives on the edge as `isDescent`, classified in the engine. The chart
styles a boolean it was handed rather than comparing against a name it knows.

## 4. Spouses are seated, not scored

The first cut scored spouses with everyone else, using the partner's position. That
could never work: within a generation nobody has a position until the sort has
finished, so the branch never fired and the test that claimed to check it was passing
on an alphabetical coincidence. Ordering now runs in two passes — barycentre for the
generation, then each spouse spliced into the seat beside their partner — and the
tests place a spouse between two siblings, where luck cannot put them.

## 5. Touch pan and zoom at 320px

`lib/graph/tree-viewport.ts` holds the maths: `panViewport`, `zoomViewport` (about a
point, with no drift when the scale clamps), `pinchDistance`, `pinchMidpoint` and
`fitViewport`, which never magnifies past 1. The component contributes pointer
bookkeeping and nothing else, which is why the arithmetic has unit tests rather than
browser tests.

At 320px the suite dispatches the pointer events a one-finger drag and a two-finger
pinch produce and asserts the transform moved and the scale grew, then drives the same
chart from the keyboard and from the buttons. `touch-action: none` on the container
stops the page scrolling under a gesture meant for the tree, and the wheel listener is
registered non-passively for the same reason.

## 6. A page that arrives whole, without scripting

Writing the no-JavaScript test for the form turned up a real defect, app-wide. A
route-level `loading.tsx` puts the page behind a Suspense boundary; React then streams
the real content into a `[hidden]` container that only an inline script reveals. With
scripting off, that content never appears — the reader is left looking at a skeleton
for ever, on `/timeline`, `/people`, `/who-was-alive` and `/family-tree`.

None of these pages waits on anything slow. They read JSON that is already in memory
and answer in two to twelve milliseconds, so the skeleton bought nothing and cost the
whole page. The eight `loading.tsx` files are removed, along with the now-unused
`Skeleton` primitive, and `tests/e2e/shell.spec.ts` gained a check that every route
renders its `h1` and its `main` with JavaScript disabled. This is reversible: a route
that one day does wait on something slow can have its boundary back, with a test that
says what the no-JS reader sees instead.

## 7. Exit gate

| Requirement                                                     | Status                                        |
| --------------------------------------------------------------- | --------------------------------------------- |
| Tree renders ancestors and descendants around a chosen person   | Pass                                          |
| Every edge traces to a `relationships` row                      | Pass — asserted against the canonical file    |
| A test asserts no relationship literal in any visualisation     | Pass — architecture suite, plus person ids    |
| Touch pan and zoom work on a 320px viewport                     | Pass — drag, pinch, buttons and keyboard      |
| The drawing has a text equivalent                               | Pass — nested outline, chart `aria-hidden`    |
| `npm run verify` green                                          | Pass — 488 engine and service tests, 62 component |
| `npm run test:e2e` green                                        | Pass — 440 tests, desktop and mobile          |

## 8. Still open, carried forward

- **Migration 0013** for `verified_by_label`: the constraint wants a uuid and the
  canonical JSON carries a text label.
- **The Phase 2 verification pass** Kelv asked for on 2026-09-20: records stay
  `SOURCE_CHECKED` until each figure has been independently checked against a named
  public-domain source. That is the next piece of work, before Phase 11.

## 9. What Phase 11 inherits

A tree layout and a viewport, both pure and both tested, and the rule the discovery
engine will be held to next: a discovery is generated from the engine or it is not a
discovery. No hand-written overlap claim may be seeded into Phase 11.
