# Phase 5 Report — Application Shell

Date: 2026-09-20
Commit: `feat(phase-5): add application shell, design tokens and PWA foundation`

---

## 1. What is here

Shell only, as the plan requires. No timeline, no tree, no data on screen except on
the two pages whose whole content is the method.

| Area       | Built                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------- |
| Routes     | 11 pages, each with its own metadata, loading state and single `h1`                          |
| Layout     | Sticky header with responsive navigation, footer carrying the standing disclaimer, skip link |
| Primitives | `Button`, `Card`, `Skeleton`, `SkipLink`, `PageHeader`, `PageShell`, `ComingInPhase`         |
| Chronology | `ConfidenceBadge`, `ChronologyValue`                                                         |
| States     | Root and per-route `loading.tsx`, an error boundary, a not-found page, an offline page       |
| PWA        | Generated manifest, three icons including a maskable one, a service worker                   |

Routes whose phase has not arrived render `ComingInPhase`: what will be there, and
what it is waiting on. A visitor who arrives early is told so, rather than meeting a
404 or a spinner that never resolves.

## 2. The two components that carry the product's actual claim

**`ConfidenceBadge`.** Requirement section 51 forbids colour as the only carrier of
meaning, so each level gets three signals at once: a colour, a shape treatment (solid,
hatched, soft-edged, dashed, outlined) and a word. The word is the one that survives
greyscale, colour blindness, a small screen and a screenshot, so there is a test
asserting every level has a distinct one and a sentence of explanation for a screen
reader.

**`ChronologyValue`.** Requirement section 57 says never show NaN, undefined, null or
a negative age. The engine makes that possible by returning a discriminated union
rather than a bare number; this component is the only place that union is unwrapped
for display, so it is the single point where the requirement is kept or broken. It is
also where each of the three kinds of absence gets its own wording:

| Reason                  | What the reader sees                           |
| ----------------------- | ---------------------------------------------- |
| `no-data`               | Scripture does not give this                   |
| `unknown-in-chronology` | Cannot be worked out from what Scripture gives |
| `not-applicable`        | Not part of this chronology                    |

A test renders all three and asserts the output contains none of the words "null",
"undefined" or "NaN".

## 3. The offline decision

A stale chronology is worse than no chronology. A reader looking at a cached date has
no way to tell it is cached, and this product's whole claim is that its numbers can be
checked. So the service worker:

- serves navigations from the network, falling back to a dedicated offline page that
  offers nothing rather than a saved copy;
- caches static assets only, which are content-hashed by the build, so a cache hit is
  the same bytes the network would return;
- never touches anything under `/api`, at all. There is a test asserting that line is
  still in the file.

## 4. The gate, as executable assertions

`npm run test:e2e` — 48 Playwright tests across a desktop and a 390px project:

| Gate criterion                         | How it is checked                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Layouts at 320, 375, 390, 430, desktop | Every route at every width, asserting `scrollWidth - clientWidth <= 1`                        |
| Keyboard reaches every control         | Tabs through the page and counts distinct focused elements                                    |
| Visible focus                          | Reads the computed outline on the focused element and fails if suppressed                     |
| Skip link                              | First tab stop, and Enter moves focus into `#main`                                            |
| Touch targets                          | Every standalone control at least 44px tall                                                   |
| Installability                         | Manifest is linked, is `standalone`, has a maskable icon, and every icon it names returns 200 |

One finding worth recording. The touch-target test first failed on a 41px control,
which turned out to be a link inside a sentence. WCAG 2.5.8 exempts those explicitly,
because enlarging one breaks the line it sits in and the rest of the sentence is not a
target. The test now excludes links whose parent is a paragraph and asserts everything
else, plus a separate check that inline links are still at least 24px. Applying the
exemption is not the same as lowering the bar, and writing it down is how the
difference stays visible.

## 5. Test configuration

Three suites, three environments, deliberately separate:

| Suite                  | Environment | Why separate                                                                                                |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `vitest.config.ts`     | node        | The engine must keep running without a DOM. A chronology test that needs one has grown a dependency on one. |
| `vitest.ui.config.ts`  | jsdom       | Components need a DOM and the React plugin                                                                  |
| `playwright.config.ts` | Chromium    | Layout and keyboard behaviour need a real browser                                                           |

`npm run verify` runs typecheck, lint, both validators, the engine suite with its
coverage thresholds, the component suite and the production build. `npm run test:e2e`
runs separately and in CI, because it needs a built server.

## 6. Exit criteria

| Criterion                                             | Status                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Layouts verified at 320, 375, 390, 430 px and desktop | Pass — asserted per route, not eyeballed                     |
| Keyboard reaches every interactive element            | Pass                                                         |
| Visible focus on every control                        | Pass                                                         |
| `npm run verify` green                                | Pass — 335 engine tests, 24 component tests                  |
| PWA installability                                    | Pass — manifest, maskable icon, service worker, offline page |

## 7. What Phase 6 inherits

The shell, the confidence primitives, and a `/people` route holding a placeholder.
Phase 6 is the character experience: the person page, the dates with their working,
the source list, and "Why this date?" reading the derivation the engine already
records.
