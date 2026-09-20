# The verification source

Which text this project checks its numbers against, and why that one.

---

## 1. The choice

| Role          | Text                                 | Why                                                                    |
| ------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| Primary       | **World English Bible** (eBible.org) | Public domain worldwide; a modern translation of the Masoretic Hebrew  |
| Corroborating | **King James Version**, 1769 Blayney | An independent translation of the same Hebrew, public domain in the US |

A figure is **VERIFIED** only when the number it states appears in the cited verse in
**both** texts. One text agreeing is a reading; two independent translations of the same
Masoretic Hebrew agreeing on a number is evidence.

The King James Version corroborates rather than leads because its status in the United
Kingdom is Crown letters patent rather than plain public domain. Nothing from it is
published by this project, and a number is a fact rather than an expression, but the
text that leads should be the one with no question over it anywhere.

The American Standard Version of 1901 remains listed in `data/canonical/sources.json`
as an available third public-domain cross-check. This pass does not use it.

## 2. What is actually read

Neither translation is committed to this repository. Both are devDependencies, pinned
to an exact version with its integrity hash in `package-lock.json`:

| Package               | Version | Integrity                                                                                         |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `world-english-bible` | 1.0.1   | `sha512-OH/5yt9BYrhy1oBXXwhSuL9ES97t5Ij8rLWeQZUOIFAkoGzZaq8aLcKMBdzwHqPbJBkyMYPhgFj6rzvtT/oT4A==` |
| `bible-kjv`           | 1.1.3   | `sha512-pl6dXVYFxd7vlkGE6kiNmd0GUFe5UPyJzu8KwkY3vEbjO4v470Lh5+lAH61UiZMru5oevN7aZzDCSudb2frzaA==` |

`world-english-bible` is a JSON rendering of the eBible.org World English Bible; its
`package.json` carries no licence field, which concerns the packaging rather than the
text, and the text is public domain. `bible-kjv` is MIT-licensed packaging of the 1769
text.

Requirement section 16 says not to seed Bible translation text into the dataset, and
this pass does not. What reaches `data/generated/source-verification.json` is the set of
numbers each verse states and a short quoted fragment as evidence for the figures that
needed one. No verse text enters `data/canonical/`.

## 3. How a figure is checked

`scripts/verify-source.ts`, over `lib/verification/`:

1. Collect every figure in the canonical dataset that carries a number and a reference —
   person chronology, the alternate chronology's overrides, and the dated events.
2. Split them by what the dataset itself claims. A figure marked `EXPLICIT`, or an event
   whose rule is `person-age`, is a claim that Scripture states this number, and is
   checked against the text. A `DERIVED`, `DISPUTED` or `epoch` figure is not, and is
   never promoted because a number happens to appear in its verse.
3. Read the cited verse from both texts and extract every number it states, in digits or
   in words. `lib/verification/numbers.ts` reads the archaic forms too: "an hundred
   threescore and fifteen" is 175, and a multiplier takes only the number before it.
4. Re-run every derivation chain: add the steps again, confirm the running totals and the
   stated result, and confirm every reference the chain rests on belongs to a figure the
   text check verified.
5. Promote a record to VERIFIED only when every figure it states passed and, where its
   birth year comes from a chain, that chain was sound over verified inputs.

## 4. What the check does not establish

It establishes that the number the dataset states appears in the verse the dataset
cites. It does not establish that the number means there what the dataset takes it to
mean. Six of the checked verses state more than one number, and for those the match
alone is not conclusive; section 5 of `docs/PHASE_2_VERIFICATION_REPORT.md` lists them
and records the reading of each.

It also says nothing about a figure the dataset does not claim is stated. Those are
derivations and interpretations, and what makes them sound is the recorded calculation
and the named assumption, not a verse.

## 5. Running it

```
npm run verify:source              # report, write the audit file, change nothing
npm run verify:source -- --promote # also write the review statuses
```

The check runs again on every `npm test` as `tests/golden/source.test.ts`, one test per
figure. Change a figure the dataset says Scripture states and the suite fails unless the
verse states the new number too.
