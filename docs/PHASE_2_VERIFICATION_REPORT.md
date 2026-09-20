# Phase 2 Verification Report

Date: 2026-09-20
Sources: World English Bible (primary), King James Version 1769 (corroborating)
Method: `scripts/verify-source.ts`, recorded in `data/generated/source-verification.json`

---

## 1. What was asked, and what was done

Every figure the dataset says Scripture states was read back out of two public-domain
translations and compared with what the dataset says. Every derived value had its
underlying inputs checked and its arithmetic run again. Records were promoted to
VERIFIED only where all of that passed.

| Step                                                         | Result                                         |
| ------------------------------------------------------------ | ---------------------------------------------- |
| 1. Choose and document an authoritative public-domain source | `docs/VERIFICATION_SOURCE.md`                  |
| 2. Independently check every SOURCE_CHECKED figure           | 64 checked, 64 matched both texts              |
| 3. Confirm value, reference and claim type                   | One reclassification, section 4                |
| 4. Re-run every derivation over verified inputs              | 25 chains, arithmetic sound, 1 input uncovered |
| 5. Promote only what passed                                  | 25 records promoted, 24 not                    |
| 6. Leave discrepancies where they were, with a reason        | Sections 4 and 6                               |
| 7. Record the real source and method in provenance           | Section 7                                      |
| 8. Re-run validation and the golden tests                    | Section 8                                      |

## 2. The source

The World English Bible, public domain worldwide, corroborated by the King James Version
of 1769. A number counts as verified only when both state it. Neither text is committed
to this repository; both are pinned devDependencies read at verification time.
`docs/VERIFICATION_SOURCE.md` gives the versions, the integrity hashes, and the reason
the KJV corroborates rather than leads.

## 3. What was checked

64 figures across three files: the person chronology, the alternate chronology's
overrides, and the dated events. Every one matched in both translations. There were no
figures where the two translations disagreed, and none where a cited verse could not be
read.

The parser that reads numbers out of a verse handles the forms both texts use, including
the archaic ones. One case is worth recording because it caught a bug in the parser
rather than in the data: Genesis 25:7 in the King James Version reads "an hundred
threescore and fifteen years". The first version of the parser made that 2,075, because
it let the score multiply everything accumulated so far rather than the three in front
of it. Abraham's 175 was reported as a disagreement until the parser was fixed. The test
for it is `lib/verification/__tests__/numbers.test.ts`.

## 4. The one reclassification

**`sarah.ageAtIsaacBirth`, 90, Genesis 17:17 — was EXPLICIT, now DERIVED.**

The verse is Abraham's question at the announcement: "Will Sarah, who is ninety years
old, give birth?" It states Sarah's age as ninety, and Genesis 17:21 places the birth a
year later, so the verse does not say Sarah was ninety when Isaac was born. Genesis 21:5
gives Abraham's age at the birth as the hundred he names in the same question, which is
why ninety is the reading Sarah's age at the birth follows from — but it is a reading.

This is the same shape as `joseph.ageWhenSold`, which the dataset already classifies
DERIVED because Genesis 37:2 gives Joseph's age at the start of the narrative rather
than at the sale. The two are now consistent.

The consequence is recorded rather than worked around: Sarah's birth year rests on that
figure, so her derivation chain now cites an input the text check does not cover, and
her record stays at SOURCE_CHECKED. The figure keeps both references, Genesis 17:17 and
Genesis 21:5, and carries the reasoning as a note.

## 5. The six verses that state more than one number

A match means the number appears in the cited verse. Where the verse states only one
number that is conclusive. Six verses state two, and each was read by hand:

| Figure                                    | Verse     | Also states | Reading                                                                  |
| ----------------------------------------- | --------- | ----------- | ------------------------------------------------------------------------ |
| `shem.ageAtFathering` = 100               | Gen 11:10 | 2           | "Shem was one hundred years old when he became the father of Arpachshad" |
| `shem.yearsAfterFloodAtArphaxadBirth` = 2 | Gen 11:10 | 100         | "two years after the flood"                                              |
| `arphaxad.birthOffsetFromFather` = 100    | Gen 11:10 | 2           | The same statement, read for the son rather than the father              |
| `jacob.lifespan` = 147                    | Gen 47:28 | 17          | 17 is his years in Egypt; 147 is "the years of his life"                 |
| `sarah.ageAtIsaacBirth` = 90              | Gen 17:17 | 100         | 100 is Abraham's age; see section 4                                      |
| `joseph.yearsOfFamineAtJacobsArrival` = 2 | Gen 45:6  | 5           | "these two years the famine has been"; the 5 are the years still to come |

The other 58 figures cite a verse that states exactly one number.

## 6. What was not promoted, and why

**24 records stay at SOURCE_CHECKED.**

- **23 records state no figure at all.** Ham, Japheth, Haran, Nahor son of Terah, Eve,
  Hagar, Rebekah, Leah, Rachel, Bilhah, Zilpah, Dinah and the sons of Jacob other than
  Joseph. Scripture gives no age for any of them, so their records are honestly empty
  and there is nothing for a figure check to verify. Verifying those records would mean
  verifying an absence — establishing that no verse anywhere gives an age for Dinah —
  and that is a different kind of check from the one this pass performs. They are not
  wrong; they are unverifiable by this method, and saying so is more useful than
  promoting them on a technicality.
- **Sarah**, for the reason in section 4.

**Nothing was changed to DISPUTED.** The one record already at DISPUTED, the alternate
chronology's reading of Genesis 11:26 as Abraham's birth offset, stays there. The
number 70 is in the verse and both translations state it; what is disputed is that the
verse gives one age for three sons and does not say Abram was the eldest. A text check
cannot settle that and was never going to.

**Four figures were not text-checked at all**, because the dataset does not claim
Scripture states them:

| Figure                               | Why                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `adam.birthOffsetFromFather` = 0     | The epoch. A choice this project made, recorded as the assumption `adam-created-at-year-zero` |
| `creation-of-adam` = 0 AM            | The same choice, as an event                                                                  |
| `joseph.ageWhenSold` = 17            | Genesis 37:2 does state seventeen; applying it to the sale is a reading                       |
| `abraham.birthOffsetFromFather` = 70 | The alternate chronology's interpretation, DISPUTED                                           |

`data/generated/source-verification.json` records what each of their verses says
anyway, as part of the audit trail, but none of them was promoted on that basis.

One more reference deserves a note: **Acts 7:4 states no number.** It is cited on
Abraham's record because it places his departure from Haran after Terah's death, which
is what makes the default chronology's 130 follow from 205 − 75. It is reasoning, not a
figure, so it is not something a figure check can verify; the reasoning is recorded as
the assumption `abraham-birth-from-acts-7-4`.

## 7. What the provenance now says

`verifiedBy` used to read "Kelv (techilounge)" on all 49 records. Kelv supplied those
readings; he did not inspect the source this pass checked them against, and recording
him as the verifier of a source he did not inspect would be a false audit trail. So:

- `suppliedBy` and `suppliedAt` now record who supplied the reading.
- `verifiedBy` records what performed the check: `source-check:web-bible+kjv-1769`.
- `verification` records the method, the tool, both sources, how many figures were
  checked, and whether the record's derivation chain was re-run.

Two validator rules keep it that way. A VERIFIED record without a verification method
and a primary source is a severe finding, and so is a `verifiedBy` that names anything
other than a check. `tests/golden/source.test.ts` asserts both from the other side.

**DERIVED and VERIFIED remain different dimensions.** `confidence` says what kind of
claim a figure is; `reviewStatus` says whether it has been checked. Joseph's record is
VERIFIED and his birth offset is still DERIVED: his four explicit inputs — 30 before
Pharaoh, 7 years of plenty, 2 years of famine elapsed, 110 at death — were each matched
in both translations, and the age of 39 that follows from them stays a calculation.

## 8. Validation and the golden tests, after the pass

| Check                           | Result                                   |
| ------------------------------- | ---------------------------------------- |
| `npm run validate:data`         | 0 severe, 0 warnings, 49 records         |
| `npm run validate:derived`      | 0 severe, 0 warnings, both chronologies  |
| Golden chronology assertions    | All 14 pass, unchanged                   |
| `npm test`                      | 583 tests pass                           |
| Source check as a standing test | 64 figures, one test each, in `npm test` |

No golden assertion moved. The verification pass changed one classification and a set of
review statuses; it changed no number, so no date moved and no overlap changed.

## 9. Still open

- **Review status is not yet wired into what the application shows.** Requirement
  section 8 says only VERIFIED records reach production calculations. The derived output
  is written with `reviewStatus: 'DRAFT'` for every record by design, because a derived
  record is never reviewed directly, so the canonical status does not currently reach
  the pages. Nothing is being shown that should not be — every record in the dataset has
  been through this pass — but the gate itself is unimplemented, and the derived record
  should carry the canonical status it came from before it can be.
- **`people.json`, `relationships.json` and `events.json` are still DRAFT.** This pass
  covered chronological figures, which is what the request named. Relationships cite
  verses and could be checked the same way, but the check would be a different one:
  whether a verse states a relationship is not a number match.
- **Migration 0013** for `verified_by_label`. The database constraint wants a uuid for
  the verifier and the canonical JSON now carries `source-check:web-bible+kjv-1769`,
  which is a label rather than a person. The label is the right thing to store, so the
  column needs to accept one.
