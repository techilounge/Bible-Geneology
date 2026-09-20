# DATA_SOURCING.md

**Project:** Bible Timeline Explorer
**Phase:** 0 — sourcing method for the Phase 2 dataset
**Date:** 2026-09-20

---

## 1. The rule

No chronological value enters `data/canonical/` because a language model produced it.
That includes this document's author. Everything below describes a **method** and
identifies **which verses hold which numbers**; Phase 2 verifies each number against an
actual text before it is seeded, and records who verified it.

The distinction matters in a specific, practical way. A model can reliably say
"Genesis 5:21 is the verse that gives Enoch's age at Methuselah's birth." A model
should not be trusted to say "that number is 65" without someone opening the text. The
first is a structural fact about where information lives; the second is the data
itself. Phase 2 treats the first as a starting point and the second as unverified until
a human checks it.

So the seeding workflow is: this document supplies the **verse map and the derivation
rules**; a human supplies the **numbers**; validation checks that the two agree.

---

## 2. Primary sources for the MVP

| Source id        | What it is                                               | Type               | License                               |
| ---------------- | -------------------------------------------------------- | ------------------ | ------------------------------------- |
| `masoretic-text` | The Masoretic Hebrew text, for the Genesis 5 and 11 ages | TEXTUAL_TRADITION  | Public domain (text of the tradition) |
| `kjv-1769`       | King James Version, 1769 Blayney edition                 | SCRIPTURE_EXPLICIT | Public domain in the US               |
| `asv-1901`       | American Standard Version                                | SCRIPTURE_EXPLICIT | Public domain                         |
| `web-bible`      | World English Bible                                      | SCRIPTURE_EXPLICIT | Public domain                         |

Numbers are cross-checked across at least two public-domain translations plus the
Masoretic reading before a record is marked SOURCE_CHECKED. Where the translations
agree, the value is EXPLICIT. Where they disagree, the record is DISPUTED and carries
both claims.

**Verse text is never seeded** (§16). These sources are used to _establish_ the
numbers; the numbers plus the reference identifier are what the database stores.

Secondary chronology sources (Ussher, Thiele, and others) may be added later as
`HISTORICAL_SOURCE` or `SCHOLARLY_ESTIMATE` rows, but the MVP derives its AM years from
the biblical ages directly rather than adopting any published chronology wholesale.
That keeps the derivation auditable rather than borrowed.

---

## 3. Verse map for the MVP dataset

Each row names the verse that holds the number. The **number column is deliberately
absent** — it is filled in Phase 2 by a human reading the text, into
`data/canonical/person-chronology.masoretic.json`.

### Genesis 5 — Adam to Noah

For each patriarch, Genesis 5 gives two figures: the age at which he fathered the named
son, and his total lifespan. Both are EXPLICIT.

| Person                  | Age-at-fathering verse | Lifespan verse |
| ----------------------- | ---------------------- | -------------- |
| Adam → Seth             | GEN.5.3                | GEN.5.5        |
| Seth → Enosh            | GEN.5.6                | GEN.5.8        |
| Enosh → Kenan           | GEN.5.9                | GEN.5.11       |
| Kenan → Mahalalel       | GEN.5.12               | GEN.5.14       |
| Mahalalel → Jared       | GEN.5.15               | GEN.5.17       |
| Jared → Enoch           | GEN.5.18               | GEN.5.20       |
| Enoch → Methuselah      | GEN.5.21               | GEN.5.23       |
| Methuselah → Lamech     | GEN.5.25               | GEN.5.27       |
| Lamech → Noah           | GEN.5.28               | GEN.5.31       |
| Noah → Shem/Ham/Japheth | GEN.5.32               | GEN.9.29       |

**Enoch is a special case.** Genesis 5:24 does not record a death. His record gets
`death_confidence = 'UNKNOWN'`, a null `death_year`, an explicit lifespan of the years
given in GEN.5.23, and a note. The timeline must render this as an open-ended bar with
a distinct treatment, not as a bar ending at birth-plus-lifespan. This is the first
real test of §57: the UI has to handle "no death year" without inventing one.

### Genesis 11 — Shem to Abraham

| Person            | Age-at-fathering verse | Lifespan / remaining-years verse |
| ----------------- | ---------------------- | -------------------------------- |
| Shem → Arphaxad   | GEN.11.10              | GEN.11.11                        |
| Arphaxad → Shelah | GEN.11.12              | GEN.11.13                        |
| Shelah → Eber     | GEN.11.14              | GEN.11.15                        |
| Eber → Peleg      | GEN.11.16              | GEN.11.17                        |
| Peleg → Reu       | GEN.11.18              | GEN.11.19                        |
| Reu → Serug       | GEN.11.20              | GEN.11.21                        |
| Serug → Nahor     | GEN.11.22              | GEN.11.23                        |
| Nahor → Terah     | GEN.11.24              | GEN.11.25                        |
| Terah → Abram     | GEN.11.26              | GEN.11.32                        |

The Terah → Abram row is the one exception to reading an offset straight off the
age-at-fathering verse. Abraham's birth offset is derived from GEN.11.32, GEN.12.4 and
ACT.7.4 rather than taken as the 70 of GEN.11.26; see §4a.

Note the structural difference from Genesis 5: chapter 11 gives _remaining years after
fathering_ rather than a total lifespan. Total lifespan is therefore DERIVED
(age-at-fathering + remaining years), not EXPLICIT, for everyone in this chapter except
Terah, whose total is stated in GEN.11.32. Getting this wrong would mislabel nine
records' confidence, so the seed schema requires the lifespan field's confidence to be
stated per record rather than defaulted.

### The patriarchal family

| Value                                 | Verse     | Type     |
| ------------------------------------- | --------- | -------- |
| Abraham's age at Ishmael's birth      | GEN.16.16 | EXPLICIT |
| Abraham's age at Isaac's birth        | GEN.21.5  | EXPLICIT |
| Sarah's age at Isaac's birth          | GEN.17.17 | EXPLICIT |
| Sarah's lifespan                      | GEN.23.1  | EXPLICIT |
| Abraham's lifespan                    | GEN.25.7  | EXPLICIT |
| Ishmael's lifespan                    | GEN.25.17 | EXPLICIT |
| Isaac's age at Jacob and Esau's birth | GEN.25.26 | EXPLICIT |
| Isaac's lifespan                      | GEN.35.28 | EXPLICIT |
| Jacob's age before Pharaoh            | GEN.47.9  | EXPLICIT |
| Jacob's lifespan                      | GEN.47.28 | EXPLICIT |
| Joseph's age when sold                | GEN.37.2  | EXPLICIT |
| Joseph's age before Pharaoh           | GEN.41.46 | EXPLICIT |
| Joseph's lifespan                     | GEN.50.26 | EXPLICIT |

### People who get UNKNOWN dates

Eve, Hagar, Rebekah, Leah, Rachel, Bilhah, Zilpah, Ham, Japheth, and Jacob's sons other
than Joseph have no stated ages. They are seeded as people with relationships and
scripture references, and with `person_chronology` rows whose year fields are null and
whose confidence is UNKNOWN.

This is a requirement, not an omission (§7, §43). Sarah has dates because Genesis gives
them; Rebekah does not because Genesis does not. A genealogy product that quietly
renders only the men with dates has made the dataset's gaps invisible. These people
appear in the family tree, in relationship paths, and on the timeline as
"Dates unknown" markers rather than bars.

---

## 4. Derivation rules, and the decisions they force

### Rule 1 — The epoch

Adam's creation is year 0 AM. All years are integers counting forward. Assumption id:
`adam-created-at-year-zero`.

AM years are an internal coordinate system for measuring intervals, not a claim about
calendar history. Every screen that shows an AM year shows it labelled "AM" with the
selected chronology named, and the §10 disclaimer is reachable from any of them.

### Rule 2 — The begetting chain

A patriarch's birth year is his father's birth year plus the father's age at his
birth. Applied recursively from Adam, this yields the whole Genesis 5 and 11 chain.
Assumption id: `begetting-age-is-named-son` — the stated age refers to the birth of the
son actually named in the chain, not to the father's first child generally. This is an
interpretive choice and it is recorded as one.

Death year is birth year plus lifespan.

### Rule 3 — Overlap, and its boundary

```
overlapStart  = max(birthA, birthB)
overlapEnd    = min(deathA, deathB)
overlapYears  = max(0, overlapEnd - overlapStart)
overlaps      = overlapYears > 0
```

**The boundary convention, stated once and applied everywhere (§19):** a lifetime is
the half-open interval `[birth, death)` over integer AM years. If one person dies in
the same AM year another is born, `overlapYears` is 0 and the engine reports **no
overlap**, with a distinct result flag `sameYearBoundary: true` so the UI can say
"their lives met at a year boundary; the chronology cannot resolve whether they
overlapped" rather than a bare "no".

The reason for this choice rather than the inclusive alternative: the inclusive rule
adds a phantom year to every overlap, which would make `getLifetimeOverlap` disagree
with `getAgeAtPersonBirth` by one. A single convention that keeps ages and overlaps
consistent is worth more than the extra year. The choice is documented as assumption id
`overlap-half-open`, tested explicitly, and mentioned in the chronology notes UI.

### Rule 4 — The three known ambiguities

These are not edge cases. Each one changes an answer the product puts on its home page,
and each is modelled as an explicit, switchable decision rather than a constant buried
in a seed file.

**(a) Terah's age at Abraham's birth. Decided by Kelv on 2026-09-20.**

GEN.11.26 says Terah was 70 when he fathered Abram, Nahor, and Haran. That is one age
for three sons, and it does not state that Abram was born in that year or that Abram
was the eldest. Reading 70 as Abraham's birth offset is therefore an **interpretation**,
not an explicit chronological statement, and treating it as explicit would be exactly
the category error this project exists to avoid.

**The default Masoretic derivation uses 130**, from three figures read together:

| Figure                                | Reference |
| ------------------------------------- | --------- |
| Terah died at 205                     | GEN.11.32 |
| Abraham was 75 when he departed Haran | GEN.12.4  |
| The departure followed Terah's death  | ACT.7.4   |

```
205 - 75 = 130
```

Record shape:

```jsonc
{
  "personId": "abraham",
  "chronologyId": "masoretic",
  "field": "birthOffsetFromFather",
  "fatherId": "terah",
  "result": 130,
  "confidence": "DERIVED",
  "sourceReferences": ["GEN.11.26", "GEN.11.32", "GEN.12.4", "ACT.7.4"],
  "calculationMethod": "205 - 75 = 130",
  "assumptions": ["abraham-birth-from-acts-7-4"],
}
```

The 70 reading is preserved as a **labelled alternate**, chronology id
`masoretic-gen11-26`, sharing every other value. It is never marked VERIFIED as an
explicit statement of Abraham's birth age; its review status is DISPUTED and its
confidence is APPROXIMATE, because that is what an interpretation of a non-specific
verse is. Both variants carry `source_claims` rows so the disagreement is data rather
than a comment.

This case is the worked example for "Why this date?" (§17). It shows a reader, on a
concrete question they care about, the difference between a number Scripture states and
a number three passages imply — which is the distinction the whole product rests on.

**What the change does to the overlaps.** Moving Abraham's birth 60 years later is not
a detail. Working the chain through, two of the §22 golden assertions invert:

| Pair            | Under 70                | Under 130 (new default)                                       |
| --------------- | ----------------------- | ------------------------------------------------------------- |
| Noah ↔ Abraham  | overlap, about 58 years | **no overlap**, Abraham born about 2 years after Noah's death |
| Shem ↔ Abraham  | overlap                 | overlap, about 150 years                                      |
| Terah ↔ Abraham | overlap                 | overlap, 75 years                                             |
| Shem ↔ Isaac    | overlap                 | overlap, about 50 years                                       |
| Shem ↔ Jacob    | overlap                 | **no overlap**, Jacob born about 10 years after Shem's death  |

Two observations about that table.

The Terah ↔ Abraham row is a consistency check rather than a result. The overlap comes
out at exactly 75 years, which is Abraham's age at the departure from Haran. It has to,
since that is the figure the derivation was built from — but it confirms the chain was
assembled correctly rather than merely plausibly.

The two inversions have small margins, 2 years and 10 years. Small margins mean Phase 2
verification genuinely matters here: a single mis-transcribed age anywhere in the
Genesis 11 chain would flip them back. They are also the reason the §22 assertions and
the §30 and §35 example copy all need rewriting before Phase 2 closes, since as written
they assert overlaps that the chosen default does not produce. Tracked in
`TESTING_STRATEGY.md` §3.

The figures in the table are the derivation's prediction from the standard Masoretic
ages, stated here so the consequence is visible now. They are not verified data and are
not seeded. Phase 2 verifies each age from the text and the golden tests then assert
whatever the verified chain produces.

**(b) Shem's age at the flood.** GEN.5.32 gives Noah's age at the fathering of Shem,
Ham, and Japheth as a single figure; GEN.7.6 gives his age at the flood; GEN.11.10
dates Arphaxad's birth relative to the flood and gives Shem's age at that point. Those
three do not compose to a single consistent value for Noah's age at Shem's specific
birth, and GEN.10.21 bears on the brothers' birth order.

Resolution: Shem's birth year is derived from GEN.11.10 working backward, not from
GEN.5.32 forward, because GEN.11.10 names Shem specifically while GEN.5.32 names three
brothers at once. Assumption id `shem-birth-from-gen-11-10`. Ham and Japheth keep
UNKNOWN birth years, since no verse dates either individually. Recorded in the
dataset audit report with the arithmetic shown.

**(c) The Septuagint's additional generation.** The Septuagint's Genesis 11 includes a
second Kenan between Arphaxad and Shelah, and Luke 3:36 also lists him. The Masoretic
Genesis 11 does not. When the `septuagint` chronology is added, that person exists in
`people` with a Septuagint-only chronology record and no Masoretic one.

The schema already supports this: `person_chronology` is per-chronology, so a person
can simply have no row for a chronology that does not include them. The engine must
therefore treat "no row for this chronology" as a distinct state from "row with unknown
dates", and the UI must say "not present in this chronology" rather than "dates
unknown". Worth building in Phase 3 even though the MVP has one chronology, because
retrofitting it later means auditing every engine function.

---

## 5. Confidence assignment, decided per field

| Situation                                                       | birth   | death   | lifespan |
| --------------------------------------------------------------- | ------- | ------- | -------- |
| Genesis 5 patriarch                                             | DERIVED | DERIVED | EXPLICIT |
| Genesis 11 patriarch                                            | DERIVED | DERIVED | DERIVED  |
| Terah                                                           | DERIVED | DERIVED | EXPLICIT |
| Abraham, Isaac, Jacob, Joseph, Ishmael                          | DERIVED | DERIVED | EXPLICIT |
| Sarah                                                           | DERIVED | DERIVED | EXPLICIT |
| Enoch                                                           | DERIVED | UNKNOWN | EXPLICIT |
| Eve, Rebekah, Leah, Rachel, Hagar, Bilhah, Zilpah, Ham, Japheth | UNKNOWN | UNKNOWN | UNKNOWN  |

Nothing in the MVP dataset is APPROXIMATE. If a value cannot be derived, it is UNKNOWN.
APPROXIMATE is reserved for later eras where secondary sources supply estimates, and
using it in the Genesis dataset would blur exactly the line §1 draws.

---

## 6. File layout

```
data/canonical/
├── people.json                            # identity only, no dates
├── person-names.json
├── relationships.json                     # parent / spouse / sibling edges
├── chronologies.json
├── person-chronology.masoretic.json       # sourced input numbers only
├── events.json
├── event-chronology.masoretic.json
├── scripture-references.json
├── sources.json
├── source-claims.json
└── assumptions.json                       # the interpretive choices, by id
```

A record in `person-chronology.masoretic.json`:

```jsonc
{
  "personId": "methuselah",
  "chronologyId": "masoretic",
  "input": {
    "ageAtFatheringNamedSon": {
      "value": null,
      "reference": "GEN.5.21",
      "confidence": "EXPLICIT",
    },
    "lifespan": { "value": null, "reference": "GEN.5.27", "confidence": "EXPLICIT" },
  },
  "namedSon": "lamech",
  "father": "enoch",
  "assumptions": ["adam-created-at-year-zero", "begetting-age-is-named-son"],
  "reviewStatus": "DRAFT",
  "verifiedBy": null,
  "verifiedAt": null,
}
```

The `value: null` fields are what Phase 2 fills from the text. **Birth year and death
year are not fields in this file.** They are computed by
`scripts/derive-chronology.ts` into `data/generated/`, with the derivation record
attached, and seeded from there. Hand-entering a birth year would create the second
source of truth that §4 of `ARCHITECTURE.md` exists to prevent, and it would let a
typo'd birth year survive a correct age-at-fathering value.

---

## 7. The Phase 2 verification procedure

For each record, in order:

1. Open the named verse in at least two of the public-domain translations in §2.
2. Enter the number into the `input` block. If the translations disagree, set
   `reviewStatus: 'DISPUTED'`, record both readings as `source_claims`, and stop.
3. Set `reviewStatus: 'SOURCE_CHECKED'` and record `verifiedBy` and `verifiedAt`.
4. Run `npm run derive:chronology`, which computes birth and death years and writes the
   derivation records.
5. Run `npm run validate:data`. Fix any failure before continuing.
6. Run `npm run test:golden`. The golden assertions in `TESTING_STRATEGY.md` §3 must
   pass against the derived values.
7. Only once 4 through 6 are green does a record move to `VERIFIED`.

Step 6 is the real check on this whole document. The golden assertions were specified
independently of the seed values, from the product requirements. If the numbers a human
entered from the text produce those overlaps, the verse map and the derivation rules are
right. If they do not, something in this document is wrong and gets corrected before the
engine is built on top of it.

`npm run audit:dataset` then produces `docs/DATASET_AUDIT.md`: every person, every
value, its verse, its confidence, its derivation arithmetic, and its reviewer. That
report is the Phase 2 exit artifact and the thing a sceptical user can be pointed at.

---

## 8. Sourcing rules that hold permanently

1. A model may propose which verse to check. A model may never supply the number.
2. Every chronology value carries at least one scripture reference or an identified
   secondary source. Validation rejects records without one.
3. Derived values are computed, never typed.
4. UNKNOWN stays UNKNOWN. There is no fallback value, no zero, no interpolation.
5. Interpretive choices are named assumption identifiers attached to the records they
   affect, so a reader can see what a date depends on.
6. Textual disagreement is represented as multiple claims, not resolved at seed time.
7. Lifetime overlap is never described as evidence of contact. The engine's function is
   named `getLifetimeOverlap` and the UI label is "Lifetime Connection" (§20).
8. Adding a new chronology adds rows. It never edits the Masoretic ones.
