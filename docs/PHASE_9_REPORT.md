# Phase 9 Report — Comparison and Overlap Explorer

Date: 2026-09-20
Commit: `feat(phase-9): add comparison and overlap explorer`

---

## 1. What is here

`/compare` takes two people and answers the product's other central question. It gives
the overlap or the gap, the two lifetimes drawn on one axis, each one's age when the
other was born, the lifespans side by side, how the two are related, the shortest chain
of overlapping lifetimes when they never share a year, and the verses the numbers rest
on.

| Piece                                     | What it does                                     |
| ----------------------------------------- | ------------------------------------------------ |
| `components/compare/ComparePicker.tsx`    | Two selectors as a plain GET form                |
| `components/compare/ComparisonResult.tsx` | The verdict and everything under it              |
| `lib/config/copy.ts`                      | The two sentences the product must not get wrong |
| `Overlap.gapYears`                        | How far apart two lifetimes are, from the engine |

## 2. Overlap is not contact, and the tests say so

Requirement section 21 is the rule this page exists to obey, so it is not left to
care. The sentence lives in `lib/config/copy.ts` as `NOT_CONTACT`, is rendered on
every comparison whatever the answer, and the browser suite imports the constant and
asserts its presence on all nine golden pairs. A test that retyped the sentence would
drift from the page; one that imports it cannot.

`tests/architecture/copy.test.ts` scans everything under `app/`, `components/`, `lib/`
and `data/canonical/` for claims of contact: _must have met_, _would have known_,
_knew each other_, _handed down to_, and five more. The bare phrase "they met" is
deliberately absent from the list, and the test says why: the disclaimer contains it,
inside a negation, and banning the substring would ban the sentence doing the work.

The lifetime connection chain gets the same treatment. Noah to Abraham comes out as
Noah → Shem → Abraham, and directly under it: the chain is not a route anything
travelled, and it is not evidence that anyone in it met anyone else.

## 3. All fourteen golden assertions, through the page

The browser suite visits `/compare?a=…&b=…` for every golden pair and reads the
verdict: Adam and Methuselah at 243 years, Adam and Lamech at 56, Methuselah and Noah
at 600, Shem and Abraham at 150, Shem and Isaac at 50, Terah and Abraham at exactly 75,
and the three pairs that never share a year.

Terah and Abraham at 75 is the derivation's own consistency check, so it has its own
named test. The 130-year offset was derived as Terah's 205 minus Abraham's 75 at the
departure from Haran; if the overlap came out at anything else the chain would be
assembled wrong rather than the number being surprising.

Noah and Abraham now says _2 years apart_, which is Kelv's decision visible in the
product rather than buried in a data file.

## 4. The same-year boundary

No pair in the real dataset produces it. Making one would mean inventing a person, so
the case is tested against the component instead, with the reason written next to the
test.

Its message is deliberately not a bare no: _One life ends in the very year the other
begins. This chronology counts a lifetime up to but not including the year of death, so
that is no overlap at all — and the text is not precise enough to say more._ The
distinction matters, because "they missed each other by four centuries" and "the
convention decides it" are different statements and only one of them is about
Scripture.

## 5. The copy the build prompt got wrong

`docs/COPY_CORRECTIONS.md` is new. It records the three wordings from the original
prompt that the verified chronology contradicts, each beside a replacement that is true
under the default and does the same work:

- §30's worked example becomes Shem and Abraham, 150 years, Shem 450 when Abraham was
  born. Same shape, same surprise, true.
- §35's "Shem was alive when Jacob was born" becomes Shem and Isaac, 50 years.
- §35's "Noah's lifetime extended into Abraham's" becomes Methuselah into Noah, 600
  years, and Adam into Methuselah, 243.

The copy test bans the originals by name. The narrowness of those patterns is
deliberate and documented: two canonical assumptions have to say that Noah and Abraham
overlap _under the alternate reading_, because that is the disagreement the alternate
chronology exists to record, and a pattern broad enough to catch the false claim would
catch the true one.

The corrections matter beyond the wording. The prompt's examples were not wrong because
someone mistyped a number; they were wrong because they stated a chronological result
from memory instead of deriving it. That is the exact failure requirement section 3
exists to prevent, and it had reached the specification itself.

## 6. No scripting required

The picker is a plain GET form. A browser with JavaScript disabled can select two
people, press Compare, and read the answer — asserted in the suite with a
`javaScriptEnabled: false` context. Every comparison therefore has an address that can
be linked, bookmarked and tested, which is also how the golden pairs are checked.

## 7. What the page refuses to do

- **Enoch.** No overlap involving him is computable, because Genesis gives his lifespan
  and no death. The page says it cannot say, rather than substituting a death year to
  produce a tidier answer.
- **Unrelated people.** When no stored relationship connects two people, the page says
  the dataset records no line between them — a statement about what has been entered,
  not about the family.
- **The same person twice.** Refused, with a sentence rather than an empty result.
- **A name that is not in the dataset.** Said plainly.

## 8. Exit criteria

| Criterion                                                        | Status                                            |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| Could They Have Met?, selectors, lifespan visualisation          | Pass                                              |
| Overlap explanation, age comparisons, relationship path, sources | Pass                                              |
| All golden comparison pairs tested through the UI                | Pass — nine pairs, plus the Terah self-check      |
| No string converts overlap into a claim of contact               | Pass — copy test over app, components, lib, data  |
| The same-year boundary renders its distinct message              | Pass — component test, with the reason recorded   |
| `npm run verify` green                                           | Pass — 443 engine and service tests, 62 component |
| `npm run test:e2e` green                                         | Pass — 378 tests                                  |

## 9. Still open, carried forward

- **Joseph's two figures** (Genesis 41:53 and Genesis 45:6). Asked for three times now.
- **Migration 0013** for `verified_by_label`.

## 10. What Phase 10 inherits

The relationship path, the overlap graph, and a page that shows both. Phase 10 is the
family tree, whose gate is that every edge traces to a `relationships` row and that no
relationship literal exists in any visualisation component — the same discipline the
architecture suite now applies to year arithmetic, pointed at a different kind of claim.
