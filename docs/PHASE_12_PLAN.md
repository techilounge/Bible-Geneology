# Phase 12 Plan — Game and Learning Engine

Requirement sections 37, 38 and 39. Exit gate: every generated question's answer is
validated against the chronology engine at generation time, and a test generates a
large sample across all eight modes and asserts each answer matches an engine call.

---

## Goal

Turn the engine into questions. The same discipline as Phase 11: a question is
generated or it does not exist, and its answer is the engine's answer rather than a
stored key. A question whose answer cannot be confirmed is never shown.

The gate is worded carefully — "validated against the chronology engine" — and a
validator that re-runs the generator's own calculation would satisfy it vacuously.
So every mode is marked by a different engine entry point than the one that built it.
"Who lived longer" is built from the lifespan figures and marked with
`compareLifespans`; "could their lifetimes overlap" is built with `getLifetimeOverlap`
and marked by asking whether the earlier-born was alive at the later one's birth.
Where the distractors can be checked too, they are: a wrong answer that is also
correct is the failure mode a single-answer check cannot see.

## Files

| File                           | What it is                                                       |
| ------------------------------ | ---------------------------------------------------------------- |
| `lib/quiz/types.ts`            | `Question`, and the `EngineCheck` that says how to mark it       |
| `lib/quiz/random.ts`           | A seeded PRNG, so a shared quiz link is the same quiz            |
| `lib/quiz/generators.ts`       | One generator per mode in requirement §37                        |
| `lib/quiz/validate.ts`         | Marks a question from the engine, independently of its generator |
| `lib/quiz/generate.ts`         | Generates, validates, and drops anything that fails              |
| `lib/learning/journeys.ts`     | The six journeys in requirement §39, as steps over real records  |
| `lib/progress/xp.ts`           | XP, levels and streaks as pure functions over an attempt log     |
| `lib/progress/achievements.ts` | The badges in requirement §38, unlocked from the same log        |
| `components/games/*`           | The question, the marked answer, and the progress summary        |
| `components/learning/*`        | A journey step                                                   |
| `app/games/page.tsx`           | The eight modes, and today's quiz                                |
| `app/games/[mode]/page.tsx`    | Play one mode: a question, an answer, and the working            |
| `app/journeys/page.tsx`        | The six journeys                                                 |
| `app/journeys/[slug]/page.tsx` | One journey, step by step                                        |
| `tests/golden/quiz.test.ts`    | The gate, over a large sample against the real dataset           |
| `tests/e2e/games.spec.ts`      | Playing, marking and progressing in a browser                    |

## Database

None. Requirement §11 lists `quizQuestions`, `quizAttempts`, `learningPaths`,
`achievements` and `userAchievements`, and the schema already describes them; nothing
is written there in this phase because a stored question is a hand-written answer key
and progress needs an account, which is Phase 13. Progress lives in the browser until
then, behind a module boundary Phase 13 can put a table behind.

## Dependencies

None new.

## Risks

- **A vacuous gate.** Validating with the generator's own call proves nothing. Each
  mode's check has to come through a different function, and the test has to assert
  which one.
- **An answer that is also correct.** Distractors are generated, so a distractor can
  accidentally be true — two people with the same lifespan, an ancestor among the
  "not an ancestor" options. Every mode that can check its distractors does.
- **Questions over UNKNOWN data.** Twenty-five of the 49 people have no death year. A
  mode that asks about lifespan has to draw from the dated population only, and say so.
- **Answers that read as claims about contact.** "Could their lifetimes overlap" is a
  question about years, not about meeting. The banned phrasings apply to generated
  question and explanation text exactly as they do to discoveries.
- **Journey prose drifting from the data.** A hand-written sentence with a number in it
  is a claim that can rot. Journey copy carries no figures; the page renders them from
  the engine, and a test bans digits in journey prose.
- **Progress that cannot be trusted or moved.** `localStorage` is per-browser and can
  throw. Every read and write is guarded, the pages render without it, and the
  progress rules themselves are pure functions so Phase 13 can replay a server log
  through them unchanged.
