# Copy corrections

Wording from the original build prompt that the verified chronology contradicts,
with the corrected version beside it. Recorded here rather than fixed silently,
because the difference between the two is the whole point of the Terah decision.

The original prompt's examples were written against the 70-year reading of Genesis
11:26. Kelv's decision of 2026-09-20 makes 130 the default (`DATA_SOURCING.md` §4a),
derived from Genesis 11:32, Genesis 12:4 and Acts 7:4. Under that default, Noah dies
in 2006 AM and Abraham is born in 2008 AM, and Shem dies in 2158 AM while Jacob is
born in 2168 AM.

`tests/architecture/copy.test.ts` fails the build if any of the original wordings
reappears in shipped copy or in the canonical data.

---

## 1. The §30 worked example

> **Original.** "Noah and Abraham … their lifetimes overlapped by approximately 58
> years."

**Corrected.** Noah and Abraham never share a year. Noah dies in 2006 AM, two years
before Abraham is born in 2008 AM. The 58-year figure is the answer under the
alternate `masoretic-gen11-26` reading, where Abraham is born in 1948 AM, and the app
reports it only when that chronology is selected.

**Replacement worked example, same shape, true under the default:** Shem and Abraham.
Shem is born in 1558 AM and dies in 2158 AM; Abraham is born in 2008 AM and dies in
2183 AM. Their lifetimes overlap by 150 years. Shem was 450 when Abraham was born.

That example does everything the original was for — a long-lived ancestor overlapping
a patriarch, a surprising number, a chain of derived birth years behind it — and it is
true under the chronology the product ships with.

## 2. The §35 "Surprise Me" examples

> **Original.** "Shem was alive when Jacob was born."

**Corrected.** He was not, under the default. Shem dies in 2158 AM; Jacob is born in
2168 AM, ten years later. Shem _was_ alive when Isaac was born, and their lifetimes
overlap by 50 years, which is the same kind of surprise and is true.

> **Original.** "Noah's lifetime extended into Abraham's lifetime."

**Corrected.** It did not, by two years. What is true and no less surprising:
Methuselah's lifetime extended into Noah's by 600 years, and Adam's extended into
Methuselah's by 243.

## 3. What this means for Phase 11

No seeded discovery may reproduce the original wordings. Any discovery that asserts an
overlap must be generated from the engine at build time rather than written by hand, so
that a change of chronology changes the discovery rather than falsifying it. The Phase
11 gate should treat a hand-written overlap claim as a defect.

## 4. The rule underneath all of this

The copy was not wrong because someone mistyped a number. It was wrong because it
stated a chronological result from memory instead of deriving it. That is the failure
mode requirement section 3 exists to prevent, and it reached the build prompt itself.
