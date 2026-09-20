# Phase 2 Report — Verified Foundational Dataset

Date: 2026-09-20
Commit: `feat(phase-2): derive the verified chronology and lock the golden tests`

---

## 1. What Phase 2 produced

A dataset of 49 people whose chronological figures were read from the text by the
project owner, plus an engine-computed chronology derived from those figures and
nothing else.

| Artefact                         | Count | Where                                                         |
| -------------------------------- | ----: | ------------------------------------------------------------- |
| People                           |    49 | `data/canonical/people.json`                                  |
| Alternate names                  |    11 | `data/canonical/person-names.json`                            |
| Relationships (parent, spouse)   |    66 | `data/canonical/relationships.json`                           |
| Scripture references             |    92 | `data/canonical/scripture-references.json`                    |
| Named assumptions                |     8 | `data/canonical/assumptions.json`                             |
| Chronology figure records        |    49 | `data/canonical/person-chronology.masoretic.json`             |
| Event figure records             |     5 | `data/canonical/event-chronology.masoretic.json`              |
| Alternate-chronology differences |     1 | `data/canonical/chronology-overrides.masoretic-gen11-26.json` |

Derived output, recomputed by `npm run derive:chronology` and never committed:

| Artefact              | Default | Alternate |
| --------------------- | ------: | --------: |
| Person records        |      49 |        49 |
| ... with a birth year |      25 |        25 |
| Event records         |       5 |         5 |
| ... with a year       |       4 |         4 |

## 2. Confidence profile

Birth years: 25 DERIVED, 24 UNKNOWN. **No birth year in this dataset is EXPLICIT**,
because Scripture states no one's birth year — it states intervals, and every year is
arithmetic over them. Labelling any of them EXPLICIT would be the single most
misleading thing this dataset could do.

Lifespans: 17 EXPLICIT, 8 DERIVED, 24 UNKNOWN. The eight DERIVED lifespans are the
Genesis 11 patriarchs, where the text gives years remaining after fathering rather
than a total, so the total is a sum rather than a reading.

Review status on the canonical figures: 48 SOURCE_CHECKED, 1 DRAFT (Joseph, see §5).
Nothing is VERIFIED yet; VERIFIED requires a recorded reviewer identity, which is
migration `0013` work.

## 3. The Terah decision, and what it cost

Kelv's decision of 2026-09-20 makes 130 the default Terah-to-Abraham birth offset,
derived as Terah's 205 (GEN.11.32) less Abraham's 75 at the departure from Haran
(GEN.12.4), with Acts 7:4 placing that departure after Terah's death. The 70 of
GEN.11.26 is preserved as the alternate chronology `masoretic-gen11-26` at review
status DISPUTED.

Abraham is therefore born in **2008 AM** under the default and 1948 AM under the
alternate. Two of the build prompt's §22 golden assertions invert:

| Pair           | Prompt said | Default (130)                                      | Alternate (70) |
| -------------- | ----------- | -------------------------------------------------- | -------------- |
| Noah ↔ Abraham | overlap ~58 | **no overlap** (Noah dies 2006, Abraham born 2008) | overlap 58     |
| Shem ↔ Jacob   | overlap     | **no overlap** (Shem dies 2158, Jacob born 2168)   | overlap 50     |

Both readings are asserted, from both sides, in `tests/golden/chronology.test.ts`, so
neither can drift unnoticed.

**Outstanding consequence.** The build prompt's §30 worked example and two of its §35
"Surprise Me" examples assert the overlaps the default does not produce. They are
placeholder copy, not data, and they must be rewritten before Phase 9 and Phase 11
ship. Tracked in `docs/TESTING_STRATEGY.md` §3 as an exit condition for both phases.

## 4. The chain, and the checks it closes on

| Person     | Birth | Death | Lifespan |
| ---------- | ----: | ----: | -------: |
| Adam       |     0 |   930 |      930 |
| Methuselah |   687 |  1656 |      969 |
| Lamech     |   874 |  1651 |      777 |
| Noah       |  1056 |  2006 |      950 |
| Shem       |  1558 |  2158 |      600 |
| Terah      |  1878 |  2083 |      205 |
| Abraham    |  2008 |  2183 |      175 |
| Sarah      |  2018 |  2145 |      127 |
| Isaac      |  2108 |  2288 |      180 |
| Jacob      |  2168 |  2315 |      147 |

Enoch has a birth year (622) and a lifespan (365) and **no death year**, because
Genesis 5:24 records none. That is the dataset's first real test of §57 and it is
preserved rather than papered over.

Two figures the text states independently of the begetting chain land on years the
chain already produces. Neither is an interpretation; both are arithmetic that either
closes or does not:

- **The flood falls in 1656 AM**, which is Noah's 600th year (GEN.7.6) and also the
  year Methuselah dies. The chain produces both numbers by separate routes.
- **Abraham departs Haran in 2083 AM**, which is the year Terah dies. Acts 7:4 requires
  exactly that, and it is the constraint the 130 offset was derived from, so the chain
  closing here is the derivation checking itself.

A third: Terah and Abraham's lifetimes overlap by exactly 75 years, Abraham's age at
the departure. Anything else would mean the chain is assembled wrong.

**Babel has no year.** Genesis 10:25 says the earth was divided in Peleg's days, which
is a statement about an era and not a date. The event is dated UNKNOWN and the timeline
will show a gap.

## 5. The one gap, and why it is not filled

Joseph's birth year is UNKNOWN. Deriving it needs the years of plenty (GEN.41.53) and
the years of famine already elapsed when Jacob arrived (GEN.45.6), subtracted with his
age before Pharaoh (GEN.41.46) from Jacob's age before Pharaoh (GEN.47.9). Those two
figures were added to the model _after_ the Phase 2 worksheet was generated, so the
worksheet never asked for them and they were never supplied.

Both numbers are well known. Neither is going in from memory. §3 of the build prompt
says the production dataset is not populated from general model knowledge, and a figure
that is easy to recall is exactly the kind that gets recalled wrong and never checked.
The engine already implements the rule; it is waiting on two readings.

Joseph's record therefore stays at DRAFT with a null birth year, his lifespan of 110
(GEN.50.26) intact, and the validator reports it as a warning on every run rather than
letting it disappear.

## 6. Exit criteria

| Criterion                                                       | Status                                                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Every chronological value carries provenance                    | Pass — asserted over the whole dataset in `tests/golden/provenance.test.ts`                                          |
| Every DERIVED value carries a derivation whose steps produce it | Pass — `DerivationSchema` recomputes the running totals and rejects any chain that disagrees with its own arithmetic |
| Every derivation step cites a reference that resolves           | Pass                                                                                                                 |
| No value in `data/canonical/` is a derived field                | Pass — enforced by the validator, not by convention                                                                  |
| UNKNOWN stays UNKNOWN                                           | Pass — 24 people carry null years rather than estimates                                                              |
| Golden tests pass                                               | Pass — 14 assertions plus 3 independent closure checks                                                               |
| Golden tests pass under the alternate chronology                | Pass                                                                                                                 |
| Validator reports zero severe findings                          | Pass — 1 warning (Joseph)                                                                                            |
| `npm run verify` green                                          | Pass                                                                                                                 |

## 7. What Phase 3 inherits

The chronology engine was written against fixtures during Phase 2 and now has real
data behind it. Phase 3's remaining work is test coverage rather than new capability:
`lib/graph` needs its relationship suite, `overlap-graph`, `events`, `explanation` and
`derive` need direct tests, and the coverage thresholds for `lib/chronology` and
`lib/graph` rise to 100% branches.
