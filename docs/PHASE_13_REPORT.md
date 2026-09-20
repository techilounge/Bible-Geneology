# Phase 13 Report — Authentication and Personalisation

Date: 2026-09-20
Commit: `feat(phase-13): add authentication and personalization`

---

## 1. What is here

Accounts, for the readers who want one, and nothing that needs one. A reader can sign
in with a link mailed to them or with Google, and the account then keeps their
favourites and their play across browsers. Every other page works exactly as it did,
signed out, and on a deployment with no account service attached at all.

| Piece                            | What it does                                                        |
| -------------------------------- | ------------------------------------------------------------------- |
| `supabase/migrations/0013_*.sql` | The verifier label carried since Phase 2, plus supply provenance    |
| `supabase/migrations/0014_*.sql` | `learning_progress`, the attempt's mode and day, profile on sign-up |
| `supabase/migrations/0015_*.sql` | Drops the stored-question foreign key; an attempt keeps its seed    |
| `lib/supabase/env.ts`            | `isSupabaseConfigured`, which answers instead of throwing           |
| `lib/account/redirect.ts`        | Which addresses a sign-in may return to                             |
| `lib/account/merge.ts`           | A browser's attempt log and an account's, as a set union            |
| `lib/account/attempts.ts`        | Parsing that log back out of a form field                           |
| `lib/services/account.ts`        | The reader's own rows, read and written as them                     |
| `middleware.ts`                  | Session refresh on navigation, and nothing when unconfigured        |
| `app/auth/callback/route.ts`     | The magic-link and OAuth exchange, server side                      |
| `app/auth/sign-out/route.ts`     | Sign-out, as a POST                                                 |
| `app/account/*`                  | Sign in, the account, and the page that clears this browser         |
| `components/account/*`           | The sign-out form, the favourite control, the cleanup, the sync     |
| `tests/db/personal-data.test.ts` | Isolation, table by table, against a real Postgres                  |
| `tests/e2e/account.spec.ts`      | Anonymous exploration, and a sign-out that leaves nothing           |

## 2. The exit gate

> RLS tests prove one user cannot read or write another's rows; anonymous exploration
> still works with no account; signing out leaves no personal data in caches or local
> storage.

Three claims, proved in three different places, because no single suite can carry all
three honestly.

**One user cannot reach another's rows.** `tests/db/personal-data.test.ts` runs against
a real Postgres with the real policies applied, as the real roles. It is table-driven
over every personal table, so adding a sixth one without isolating it fails here rather
than in production.

| Table               | Read own | Anonymous sees nothing | Insert as another | Delete another's | Reassign another's | Hand over own | Delete own |
| ------------------- | -------- | ---------------------- | ----------------- | ---------------- | ------------------ | ------------- | ---------- |
| `favorites`         | ✓        | ✓                      | refused           | 0 rows           | 0 rows             | refused       | ✓          |
| `saved_comparisons` | ✓        | ✓                      | refused           | 0 rows           | 0 rows             | refused       | ✓          |
| `quiz_attempts`     | ✓        | ✓                      | refused           | 0 rows           | 0 rows             | refused       | ✓          |
| `user_achievements` | ✓        | ✓                      | refused           | 0 rows           | 0 rows             | refused       | ✓          |
| `learning_progress` | ✓        | ✓                      | refused           | 0 rows           | 0 rows             | refused       | ✓          |

Both halves of an update policy are checked, and they fail differently on purpose:
taking someone else's row matches nothing, because `USING` hides it; giving your own
row away raises, because `WITH CHECK` refuses the new value. A test that only asserted
"nothing happened" would pass on a table with no update policy at all.

**Anonymous exploration still works.** `tests/e2e/account.spec.ts` walks twelve routes
with no session and asserts each one returns 200, renders its heading, and does not
redirect to a sign-in. It then plays a round and reads the score back out of local
storage. This deployment has no Supabase configured, which makes the browser suite an
honest test of the unconfigured case rather than a simulation of it.

**Signing out leaves nothing.** The test plays a round, puts a page in a cache the way
the service worker would, signs out, and then reads both back. Local storage holds no
key of ours, and no cache holds anything belonging to a reader.

## 3. Two states that are not errors

A deployment with no account service is a supported state, not a misconfiguration.
`publicEnv()` still throws — that is right for a deploy that means to have accounts and
has been set up wrong — but nothing on a page calls it now without asking
`isSupabaseConfigured()` first. `/account` and `/account/sign-in` say plainly that
accounts are unavailable and that everything else still works; the middleware returns
immediately; the favourite control renders nothing rather than a button that would
fail.

Being signed out is the other. It is the default, it is most readers, and the only page
that changes is the account page itself.

## 4. What the browser sends, and what it is trusted with

Nothing in `lib/services/account.ts` checks ownership. It could not be trusted if it
did: a check in application code is an opinion, and the one that matters is the
database's. No insert names an owner the policy would not have forced anyway, and the
service-role key is not reachable from any of this — the layering test still proves no
route or component imports it.

The attempt log is the one thing a reader can post in bulk, so it is parsed rather than
trusted: `parseAttempts` drops anything that is not an attempt in a known mode, and
caps the batch at 500, the same limit the browser store keeps.

## 5. The open redirect that is not there

`?next=` is the hole every sign-in has. `safeNext` resolves the value against an origin
no deployment can be and compares the result: anything that is secretly absolute lands
somewhere else and is thrown away. That catches `//evil.test` and `/\evil.test` without
having to know that a URL parser reads a backslash as a slash, which is the detail that
usually defeats a hand-written check. The auth routes are excluded as destinations too,
so a link cannot sign somebody in and immediately out again.

There are eighteen unit cases and a browser test that posts four hostile values at the
real callback and asserts the `Location` header never leaves this origin.

## 6. Signing out is a POST

A sign-out on a GET can be triggered by any page on the internet with an image tag, and
by a link prefetcher with no page at all. It is a form, and it works with scripting
off. The route clears the session and redirects with a 303 to `/account/signed-out`,
which is where the browser's own copies are cleared, because only the browser can clear
them.

## 7. Progress crosses the sign-in without being counted twice

Somebody who has played for a week signed out, then signs in, should not lose the week
— and should not gain it again every time they sign in. `mergeAttempts` is a set union
over (day, question, outcome), so the second sign-in adds nothing. It is pure, which is
what lets `lib/progress` replay a merged log and produce the same badges either side of
the join.

The conservative edge is stated rather than hidden: a genuine second attempt at the same
question, on the same day, with the same outcome merges into the first. Undercounting a
repeat is a smaller wrong than inflating a score on every sign-in.

## 8. Three migrations, one of them overdue

`0013` finally lands the fix carried since Phase 2. `verified_by` is a uuid pointing at
a person, and the Phase 2 verification pass was not a person: it was
`scripts/verify-source.ts` reading two public-domain translations and recording itself
as `source-check:web-bible+kjv-1769`. Recording a tool as a user would have been a lie
in the audit trail, so the table now takes either, and `supplied_by` keeps the person
who supplied a reading separate from whatever verified it — which was Kelv's explicit
instruction on 2026-09-20.

`0014` adds `learning_progress`, gives `quiz_attempts` the mode and the day the
progress rules tally by, and creates a profile when an account is created so nothing
has to remember to.

`0015` removes the foreign key from `quiz_attempts` to `quiz_questions`. Phase 1
assumed questions would be stored rows; Phase 12 generates them from a mode and a seed
and deliberately keeps no answer key, so the attempt now records the seed instead. The
column comments say so, in the database, where the next person to look will be.

## 9. Coverage

`lib/account` joins the engine zone: no React, no Next, no Supabase, no I/O, enforced
by ESLint and by `tests/architecture/layering.test.ts`, at 100% of branches, functions
and lines. It holds the redirect rule and the merge, which are the two pieces of this
phase where a missed branch is a security bug or a lost week of play.

`lib/services/account.ts` is not unit tested. It is a thin translation between Supabase
rows and the shapes above it, and the properties worth asserting about it are the ones
the database enforces; they are proved against a real Postgres instead of against a
mocked client that would agree with whatever it was told.

## 10. Verification run

| Check                   | Result                                        |
| ----------------------- | --------------------------------------------- |
| `npm run typecheck`     | clean                                         |
| `npm run lint`          | clean                                         |
| `npm run format`        | clean                                         |
| `npm run test:coverage` | 817 tests in 36 files, every threshold met    |
| `npm run test:ui`       | 88 tests in 9 files                           |
| `npm run build`         | clean; the person pages are still prerendered |
| `npm run db:migrate`    | 15 migrations, 0013–0015 applied              |
| `npm run db:check-rls`  | 26 tables, 60 policies, passed                |
| `npm run test:db`       | 66 tests in 3 files                           |
| `npx playwright test`   | desktop and mobile                            |
| `npm run validate`      | 0 severe, 0 warning, both chronologies        |

New in this phase: 18 unit tests, 7 component tests, 31 database tests and 34 browser
tests — 16 for the account pages, and 18 from the three new routes joining the shell
suite's width, keyboard and no-scripting passes.

## 11. What Kelv has to do, and it is not nothing

None of this can reach a real reader until the hosted side is configured, and none of
it is something the build can do:

1. In Supabase, enable the email provider and set the sender, so the magic link can be
   sent from an address that is not a test one.
2. In Supabase, create the Google OAuth client and paste its id and secret in, then add
   `https://<the site>/auth/callback` as an authorised redirect.
3. Wherever the site deploys, set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Until they are set the site runs exactly as it does
   here, with accounts off and everything else working.
4. Apply `0013`, `0014` and `0015` to the hosted database.

No key is in this repository, and none should be pasted into chat.

## 12. Still open, carried forward

- Review status still does not gate what reaches the application: derived output is
  written `reviewStatus: 'DRAFT'`, so §8's "only VERIFIED reaches production
  calculations" is not enforced at the boundary. This is now the oldest open item.
- A favourite control cannot show whether something is already saved without making
  every person page render per request. It states the action instead, and the account
  page lists what is saved. A later phase can revisit this with partial prerendering.
- `saved_comparisons` and `learning_progress` are isolated, migrated and proved, but
  nothing writes to them yet; the compare page and the journeys still keep nothing.
- Progress still syncs on a press rather than automatically, because an automatic
  upload on every page load is a write the reader did not ask for.

## 13. What Phase 14 inherits

An account it can attach content to, with every personal table already owner-scoped and
proved, and a merge that lets anonymous work be adopted rather than lost. The rule that
matters, and that Phase 14 must not break: nothing the site does may start requiring an
account.
