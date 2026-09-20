# Phase 13 Plan — Authentication and Personalisation

Requirement sections 46 and 55, and the build order's Phase 13. Exit gate: RLS tests
prove one user cannot read or write another's rows; anonymous exploration still works
with no account; signing out leaves no personal data in caches or local storage.

---

## Goal

Add accounts without making the product need one. Everything the site does today keeps
working signed out; signing in adds favourites, saved comparisons, preferences, and a
progress record that follows a person between browsers.

The security property is not "the server checks first". It is that the database
refuses. Every personal table is owner-scoped by RLS, the client holds only the
anonymous key, and the tests prove the refusal against a real Postgres rather than
against a mock.

## Files

| File                             | What it is                                                  |
| -------------------------------- | ----------------------------------------------------------- |
| `supabase/migrations/0013_*.sql` | The carried-forward `verified_by_label` fix                 |
| `supabase/migrations/0014_*.sql` | Learning progress, the attempt's mode, and profile creation |
| `lib/supabase/env.ts`            | Whether accounts are configured at all, without throwing    |
| `lib/account/merge.ts`           | Merging a browser's attempt log into an account's           |
| `lib/account/redirect.ts`        | Which addresses a sign-in may return to                     |
| `lib/services/account.ts`        | The signed-in user's own rows, read and written as them     |
| `app/account/*`                  | Sign in, the account page, and the signed-out page          |
| `app/auth/callback/route.ts`     | The magic-link and OAuth exchange                           |
| `middleware.ts`                  | Session refresh on navigation                               |
| `components/account/*`           | The sign-in form, the account menu, the favourite button    |
| `tests/db/rls.test.ts`           | Isolation, extended to every personal table                 |
| `tests/e2e/account.spec.ts`      | Anonymous exploration, and a sign-out that leaves nothing   |

## Database

Two migrations. `0013` finally lands the fix carried since Phase 2: the verifier column
is a uuid and the canonical dataset records `source-check:web-bible+kjv-1769`, which is
a label and not a person, so the table gains `verified_by_label`, `supplied_by`,
`supplied_at` and `verification`, and the "VERIFIED needs a reviewer" constraint accepts
either a person or a label. `0014` adds `learning_progress`, gives `quiz_attempts` the
mode the progress rules tally by, and creates a profile row when an account is created
so nothing has to remember to.

## Dependencies

None new. `@supabase/ssr` and `@supabase/supabase-js` are already here from Phase 1.

## Risks

- **A deploy with no Supabase configured.** This environment has no keys, and the build
  and browser suite run in it. Reading the environment must not throw: pages have to
  work signed out and say plainly that accounts are unavailable here.
- **Personal data surviving a sign-out.** The gate names caches and local storage
  specifically. The attempt log, the service worker's caches and the session cookies all
  have to go, and the test has to prove it rather than assume it.
- **An open redirect through the sign-in.** `?next=` is the obvious hole. Only
  same-origin paths are allowed, and a test says so.
- **Losing anonymous progress at sign-in.** Someone who has played for a week and then
  signs in must not lose it. The merge is a pure function with its own tests, and it
  keeps both sides rather than picking one.
- **RLS that looks right and is not.** The policies exist from Phase 1; what has not
  been proved is every table. The isolation suite covers each personal table, for read,
  write, update and delete, as another user and as an anonymous visitor.
