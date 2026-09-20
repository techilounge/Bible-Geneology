# Phase 12 Report — Game and Learning Engine

Date: 2026-09-20
Commit: `feat(phase-12): add the quiz engine and learning journeys`

---

## 1. What is here

`/games` asks eight kinds of question and marks them. `/journeys` walks six guided
routes through the genealogy. Neither holds an answer key: a question is generated
from the dataset, checked against the chronology engine, and only then shown.

| Piece                                 | What it does                                                     |
| ------------------------------------- | ---------------------------------------------------------------- |
| `lib/quiz/types.ts`                   | `Question`, and the `EngineCheck` that says how to mark it       |
| `lib/quiz/random.ts`                  | A seeded stream, so a shared link is the same question           |
| `lib/quiz/generators.ts`              | One generator per mode in requirement §37                        |
| `lib/quiz/validate.ts`                | Marks a question from the engine, independently of its generator |
| `lib/quiz/generate.ts`                | Generates, validates, and drops anything that fails              |
| `lib/learning/journeys.ts`            | The six journeys in §39, written without a single figure         |
| `lib/learning/build.ts`               | Fills a journey in from the chronology at render time            |
| `lib/progress/xp.ts`                  | XP, levels and streaks, derived from the attempt log             |
| `lib/progress/achievements.ts`        | The badges in §38, as rules over the same log                    |
| `components/games/*`                  | The question as a form, the marked answer, the score panel       |
| `components/learning/JourneyStep.tsx` | One step: explanation, people with their dates, and a question   |
| `app/games`, `app/journeys`           | The routes, all of them playable with scripting switched off     |

`lib/chronology/references.ts` is new and small: reading-order reference sorting,
lifted out of the discovery generators so the quiz cites verses the same way rather
than growing a second copy of the rule.

## 2. The exit gate: every answer comes from the engine

The gate is that a generated answer is validated against the chronology engine at
generation time. A validator that re-ran the generator's own calculation would satisfy
that wording and prove nothing, so each mode is marked through a different function
than the one that built it.

| Mode                          | Built from                          | Marked by                                                                     |
| ----------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| Who lived longer              | the lifespan figures on the records | `compareLifespans`                                                            |
| Could their lifetimes overlap | `getLifetimeOverlap`                | `getPeopleAliveAtBirth` — was the earlier-born alive at the later one's birth |
| Who was alive                 | `getPeopleAliveAtYear`              | `getAgeAtYear`, per option                                                    |
| Put them in order             | the birth years                     | `getAgeAtPersonBirth`, pairwise                                               |
| Guess the age                 | `getAgeAtPersonBirth`               | the age carried by `getPeopleAliveAtBirth`                                    |
| Family connection             | `ancestorsOf`                       | `getAncestorPath`, per option                                                 |
| Timeline placement            | the birth year                      | `getAgeAtYear` — the birth year is the year the age is nought                 |
| Who am I                      | a lifespan and a recorded parent    | `getPersonTimeline` and `parentsOf` over the whole dataset                    |

Two things the gate does not require, and this does anyway:

- **Distractors are ruled out, not merely unchosen.** For every mode but the ordering
  one, the engine must confirm each wrong option wrong. A distractor that happens to
  also be correct is the failure a single-answer check cannot see, and the validator
  drops the question rather than shipping it.
- **A clue that fits two people is not a question.** "Who am I" searches the whole
  dataset for records matching its clues and refuses unless exactly one does.

`tests/golden/quiz.test.ts` is the gate itself: eight modes by a hundred seeds, 800
questions over the real dataset, every one of them re-marked there through
`markFromEngine` so the assertion does not rest on the generator having called the
validator. All 800 seeds produce a question; none is dropped for want of data.

## 3. What the questions look like

> Who lived longer, Mahalalel or Reu? — Mahalalel lived 895 years and Reu lived 239, a
> difference of 656 years.

> Which of these people was alive in 2067 AM? — Arphaxad lived from 1658 AM to 2096 AM,
> so 2067 AM falls inside that. The others had either not been born or had already died.

> Who am I? This chronology gives me a lifespan of 950 years, and the records name
> Lamech as my parent.

Every one carries the population it drew from — "the 24 of 49 people this chronology
gives both a birth and a death" — its working, and the verses behind it. The ancestry
questions cite the parent rows on the line of descent rather than the chronology,
because that is what they actually rest on; a question that could cite nothing is not
asked.

## 4. It plays without scripting

The question is a GET form, the answer comes back in the address, and the marking
happens on the server. So the whole game works with JavaScript switched off, every
state of it is a link somebody can share, and the back button does what it should.
Ordering is three selects rather than a drag-and-drop list, which is the same decision:
requirement §50 rules out anything that needs a pointer.

The browser suite asserts it directly, answering a question in a context with
`javaScriptEnabled: false`, for the games and for the journeys.

## 5. Progression, without an account

Requirement §46 says core exploration needs no account, and playing is core. The
attempt log lives in this browser and nowhere else; every read and write is wrapped,
so a private window or blocked site data costs the score and not the game.

The rules over that log are pure functions in `lib/progress`, so XP, levels, streaks
and all seven badges are derived rather than stored — there is no counter to fall out
of step with what a player did. Phase 13 can replay a server-side log through the same
functions and get the same answers, which is why they were written this way.

## 6. Journeys carry no figures

A journey is the only place in the product where a person is named by hand, so the
prose carries no numbers at all. Every figure beside a name is read from the engine
when the page renders. `lib/learning/__tests__` bans digits in journey text — chapter
citations aside, which name a passage and cannot be falsified by a chronology change —
and the golden suite asserts that every id a journey names exists and that the same
journey shows different years under the alternate chronology.

The steps say what the dataset cannot do as readily as what it can: Rebekah has no
ages, the four mothers of Jacob's children have none, the Tower of Babel has an era
and no year, and Enoch has a span with no end. Those are the steps, not the omissions.

## 7. Coverage

`lib/quiz`, `lib/progress` and `lib/learning` join the chronology engine, the graph and
the discovery generators at 100% of branches, functions and lines in
`vitest.config.ts`. The quiz engine decides whether an answer is right; an untested
branch in it is a wrong answer nobody has read.

## 8. Verification run

| Check                   | Result                                     |
| ----------------------- | ------------------------------------------ |
| `npm run typecheck`     | clean                                      |
| `npm run lint`          | clean                                      |
| `npm run format`        | clean (and now part of `verify`, see §9)   |
| `npm run test:coverage` | 799 tests in 33 files, every threshold met |
| `npm run test:ui`       | 81 tests in 7 files                        |
| `npm run build`         | clean                                      |
| `npx playwright test`   | 540 tests, desktop and mobile              |
| `npm run validate`      | 0 severe, 0 warning, both chronologies     |

Of those, 77 unit tests, 40 golden tests, 19 component tests and 64 browser tests
(36 for the games, 28 for the journeys) are new in this phase.

## 9. Two things fixed on the way through

- **Formatting had drifted.** Eleven files were out of Prettier's hands because
  `npm run verify` ran typecheck, lint, tests and build but never `format`. A gate that
  is not run is not a gate; it is in the chain now, and the drift was cleaned up in its
  own commit (`style: bring the tree back to Prettier`).
- **An accessibility test raced a navigation.** The discovery suite ran axe after a
  soft navigation, waiting only for a heading that exists on both pages, so it
  occasionally analysed a document that was about to be replaced. It now waits for the
  address to change first.

## 10. Still open, carried forward

- Migration 0013 for `verified_by_label`, unchanged by this phase.
- Review status still does not gate what reaches the application: derived output is
  written `reviewStatus: 'DRAFT'`, so §8's "only VERIFIED reaches production
  calculations" is not yet enforced at the boundary. Questions inherit this, being
  generated from the derived dataset.
- Progress is per-browser, and an attempt is recorded after the page is already
  readable, so navigating away within the same instant loses that one attempt. Phase 13
  moves the log to an account and the question disappears with it.
- `quizQuestions`, `quizAttempts`, `learningPaths` and `achievements` exist in the
  schema and hold nothing. A stored question would be a hand-written answer key, which
  is the thing this phase exists to avoid; the tables wait for Phase 13 and 14.

## 11. What Phase 13 inherits

An attempt log with a shape (`questionId`, `mode`, `correct`, `day`) and a set of pure
rules over it. Authentication turns that into rows behind RLS without touching the
rules, and anonymous play keeps working because nothing above `lib/progress` knows
where the log came from.
