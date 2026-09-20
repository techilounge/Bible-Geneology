# Phase 11 Report — Discovery Engine

Date: 2026-09-20
Commit: `feat(phase-11): add the deterministic discovery engine`

---

## 1. What is here

`/discover` lists findings nobody wrote. Each one is produced by a generator that
reads the chronology engine, fills a template with what it found, and records the
people, events and Scripture references it drew on. Change the chronology and the
findings change with it.

| Piece                                      | What it does                                                   |
| ------------------------------------------ | -------------------------------------------------------------- |
| `lib/discovery/types.ts`                   | The `Discovery` shape: the claim, its calculation, its sources |
| `lib/discovery/generators.ts`              | Nine generators covering the ten kinds in requirement §34      |
| `lib/discovery/generate.ts`                | Runs them in a fixed order and looks one up by id              |
| `lib/discovery/pick.ts`                    | Surprise Me: a seed picks the finding, so a link reopens it    |
| `components/discovery/DiscoveryCard.tsx`   | One finding in a list, with its kind on it                     |
| `components/discovery/DiscoveryDetail.tsx` | One finding in full: calculation, timeline, sources            |
| `app/discover/page.tsx`                    | Surprise Me and the full list                                  |
| `app/discover/[id]/page.tsx`               | One discovery, prerendered, with its own metadata              |
| `app/discover/[id]/opengraph-image.tsx`    | The shareable card, 1200×630, generated from the same record   |

The plan named a `DiscoveryList.tsx`; the list is nine lines of layout over
`DiscoveryCard`, so it lives in the page rather than in a component of its own. The
detail view, which the plan did not name, turned out to be the piece worth extracting,
because the discovery page and the person page both show a calculation with its
sources.

## 2. What the dataset actually yields

Fourteen findings under the default chronology:

| Kind                        | Finding                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------- |
| largest-overlap             | Kenan and Mahalalel, 840 years                                                      |
| unexpected-contemporaries   | Ishmael and Shem (64 years, 10 generations apart), Isaac and Shem, Abraham and Shem |
| shortest-connection-chain   | Adam to Joseph: 22 generations, 3 lifetimes                                         |
| most-concurrent-generations | 1878 AM, 10 generations, 10 people                                                  |
| living-ancestors-at-birth   | Terah, born with 9 ancestors alive                                                  |
| living-descendants-at-death | Adam, died with 8 descendants alive                                                 |
| outlived-a-descendant       | Eber and Peleg, Shem and Nahor, Shelah and Reu                                      |
| events-during-a-lifetime    | Shem, 2 dated events inside his lifetime                                            |
| longest / shortest lifespan | Methuselah at 969, Joseph at 110                                                    |

## 3. The exit gate: reproducible from canonical data

Three suites, at three levels, all of them asserting the same property.

- `lib/discovery/__tests__/generate.test.ts` (23 tests) runs the generators twice over
  a fixture and compares the output whole, then repeats that over an empty dataset, a
  dataset where nobody is dated, and a dataset with a single dated person — the cases
  where a generator is most likely to invent a superlative out of nothing.
- `tests/golden/discoveries.test.ts` (75 tests) runs them over the real dataset. It
  asserts identical output on a second run, that every `personId` and `eventId` names a
  record that exists, that every `sourceReferences` entry is in
  `scripture-references.json`, and that no headline contains a banned contact phrasing.
- `tests/e2e/discover.spec.ts` (12 tests, run on desktop and mobile) asserts the same
  thing through the browser: the same seed opens the same finding, and every finding's
  page carries its calculation and its sources.

The stronger evidence is that the findings move with the data. Generating against the
alternate `masoretic-gen11-26` chronology, where Terah is 70 at Abraham's birth,
produces different findings from the same code: Jacob and Shem become contemporaries
(50 years, 11 generations apart), Abraham replaces Terah as the person born with the
most living ancestors, and the fullest year moves from 1878 AM with 10 generations to
1958 AM with 12. A hand-written discovery could not do that; it would simply have been
wrong under one of the two chronologies. That is the failure recorded in
`docs/COPY_CORRECTIONS.md`, and this is the structural answer to it.

## 4. Nothing here claims contact

Requirement §20 and §21: a shared lifetime is not evidence that two people met. Every
discovery carries `aboutOverlap`, and the detail view renders the standing
not-contact note for any discovery that sets it. The generated sentences say "were
alive at the same time", "were still alive in the same years", "sit between them" —
never met, knew, saw or taught. `tests/golden/discoveries.test.ts` bans the verbs over
every generated headline, so a future generator cannot introduce one, and the Phase 9
copy test independently bans them across `app`, `components`, `lib` and
`data/canonical`.

The connection-chain finding is the one most at risk of being read as a route, so it
says "lifetimes sit between them" and its page labels the chain as overlapping
lifetimes rather than as a line of contact, with `data-testid="not-contact"` asserted
in the browser suite.

## 5. Every superlative names its population

Twenty-five of the 49 people in the dataset have no death year, so "the longest
lifespan" is a fact about a subset. Every discovery carries a `population` string
generated from the dataset — "the 24 of 49 people this chronology gives both a birth
and a death" — and it is rendered under the headline rather than kept in the record.
A reader is never told the dataset is the Bible.

## 6. Surprise Me is a seed, not a die

`Math.random` on the server would mean the link a reader shares opens a different
finding than the one they saw. `pickDiscovery` hashes a seed string with FNV-1a and
indexes into the ordered list, so `?seed=abc` is a stable address for a finding. The
home page seeds today's discovery with the date, which is why it carries
`revalidate = 3600` rather than being fully static, and Surprise Me hands out the next
seed as a plain link that works without scripting.

## 7. Coverage

`lib/discovery/**` joins `lib/chronology/**` and `lib/graph/**` at 100% of branches,
functions and lines in `vitest.config.ts`. These generators write the sentences the
product presents as findings; an untested branch is a claim nobody has read.

Getting there removed real dead code rather than adding tests to cover it: a
`recorded ? 'Died' : ...` arm in the lifespan generator that `dated()` had already made
unreachable, a redundant null-death guard in the outlived-a-descendant generator, and
an optional-index fallback that a sort over `{discovery, gap}` pairs made unnecessary.
The guards that remain unreachable — a name lookup for an id that came out of the
dataset — carry a `v8 ignore` comment saying why.

## 8. Verification run

| Check                   | Result                                                   |
| ----------------------- | -------------------------------------------------------- |
| `npm run typecheck`     | clean                                                    |
| `npm run lint`          | clean                                                    |
| `npm run test:coverage` | 682 tests, thresholds met                                |
| `npm run test:ui`       | 62 tests                                                 |
| `npm run build`         | clean; 14 discovery pages and 14 card images prerendered |
| `npx playwright test`   | 464 tests across desktop and mobile                      |
| `npm run validate`      | 0 severe, 0 warning, both chronologies                   |

## 9. Still open, carried forward

- Migration 0013 for `verified_by_label`. The database constraint wants a uuid and the
  canonical JSON now carries a text label, `source-check:web-bible+kjv-1769`. Unchanged
  by this phase and still outstanding.
- Review status does not reach the application. Derived output is written
  `reviewStatus: 'DRAFT'` by design, so requirement §8's "only VERIFIED reaches
  production calculations" is not yet enforced at the boundary. Discoveries inherit
  this: they are generated from the derived dataset, so they are as reviewed as it is.
- `people.json`, `relationships.json` and `events.json` are still DRAFT.

## 10. What Phase 12 inherits

A generator that turns chronology into a statement with its calculation attached is
most of what a question generator needs. The learning engine can ask "who was alive
when Adam died?" and score the answer against `getPeopleAliveAtYear` rather than
against a stored answer key, which is the same discipline: the question and the mark
both come out of the engine, so neither can drift from the data.
