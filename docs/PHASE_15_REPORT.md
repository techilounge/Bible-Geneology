# Phase 15 Report — Production Hardening

Date: 2026-09-20
Commit: `chore(phase-15): production hardening and readiness review`

---

## 1. What is here

A review of every area the build order names, written down in
`docs/PRODUCTION_READINESS.md`, and the code for the gaps it found. The review is the
deliverable; this report says what changed because of it.

| Change                                  | Why                                                                |
| --------------------------------------- | ------------------------------------------------------------------ |
| `lib/config/site-url.ts`                | A present-but-empty env var was failing every production build     |
| `lib/security/csp.ts`, `next.config.ts` | There was no Content-Security-Policy, and no HSTS or COOP          |
| `app/robots.ts`, `app/sitemap.ts`       | A crawler had no guidance at all                                   |
| `app/global-error.tsx`                  | An error in the root layout had nothing to render                  |
| `lib/security/rate-limit.ts`            | The sign-in link could be posted as fast as anyone liked           |
| `supabase/migrations/0017_*.sql`        | Somewhere shared to count those limits                             |
| `supabase/migrations/0018_*.sql`        | The index the progress read actually uses                          |
| `proxy.ts`                              | Next 16 renamed the convention; the old name warned on every build |
| `npm run security:audit` in CI          | A new advisory against an existing dependency goes unnoticed       |
| `tests/e2e/hardening.spec.ts`           | Every header and both crawler files, asserted against the server   |

## 2. The failure that was already happening

Six production deploys had failed in a row, every one at the same line, while every
local build passed:

```
metadataBase: new URL(branding.siteUrl)
TypeError: Invalid URL { input: '' }
```

`NEXT_PUBLIC_SITE_URL` was set in the hosting dashboard and empty.
`process.env.X ?? fallback` catches a variable that is absent, not one that is present
and empty, so the empty string went past the fallback into `new URL` and threw while
Next was collecting page data.

It passed locally because a local machine has the variable unset, which takes the
fallback. That is the shape of the bug worth remembering: the two states an optional
variable can be in are not "set" and "unset" but "usable" and "not usable", and only
one of those is worth branching on.

`resolveSiteUrl` now accepts a value only if it parses as an absolute http or https
URL, then falls back to the platform's own reported host, then to localhost. It takes
its environment as an argument, so the eight cases are tests rather than deployments.
Reproduced with `NEXT_PUBLIC_SITE_URL=""` before the change; the same command builds
clean after it. Shipped on its own, ahead of this commit, because a broken deploy is
not something to hold behind a phase.

## 3. The content security policy, and the version that was wrong

The first version carried a per-request nonce with `'strict-dynamic'`. That is the
policy worth having and it would have broken the site: Next only puts a nonce on its
script tags for a dynamically rendered response, and this site prerenders the person
pages, the discoveries and most of the shell. The policy would have blocked every
script on exactly the pages that matter most, and the only way to keep it would have
been to stop prerendering the catalogue.

The shipped policy allows `'self'` and inline scripts, and that limitation is written
into `docs/PRODUCTION_READINESS.md` §1 rather than left for somebody to discover. What
the policy still does: `form-action` stops a posted form leaving the origin, `base-uri`
stops a rewritten base tag hijacking every relative URL, `frame-ancestors` stops
clickjacking, `connect-src` restricts where data can go, `object-src` closes the plugin
path. The compensating control for the rest is that this site renders no user-supplied
HTML anywhere — `dangerouslySetInnerHTML` appears nowhere in the codebase.

There is a browser test for the thing a policy usually breaks silently: it plays a
round with the console watched for policy violations, because a blocked script shows up
as a page that renders and then does nothing.

## 4. Rate limiting, honestly

A token bucket on the sign-in link: five in a burst, one every two minutes after,
counted against the address and against the caller separately, because either alone is
a hole. The arithmetic is pure and has its own tests, including the clock going
backwards and a bucket left alone for a day.

Two things stated rather than hidden: the counters live in Postgres when there is a
service-role key and in process memory when there is not, and in memory across more
than one instance it is a speed bump rather than a control; and the limiter fails open
if its own store is unreachable, because it must not be the reason nobody can sign in.

## 5. What the review found to be already sound

Recorded with its evidence in `PRODUCTION_READINESS.md` rather than re-done here: RLS
on every table with no canonical write path, personal-data isolation, the audit trail,
the service-role grep in CI, axe with zero violations on every route at two viewports,
no horizontal overflow at five widths, 44px touch targets, every page working with
scripting off, the dataset validators and the test that proves the dataset gate fails
on a corrupted file, and `npm audit` reporting nothing.

## 6. What is deliberately not done

- **No analytics, no third-party scripts.** That is why `connect-src` can be tight and
  why there is no consent banner.
- **No error reporting service.** An exception in production is visible only in the
  host's logs. First thing to revisit.
- **No Lighthouse run and no Safari.** Chromium at two viewports is what this
  environment has. Both are named as gaps.
- **No screen-reader pass by a person.** axe finds a category of problems, not all of
  them, and this is the honest hole in the accessibility section.
- **No deployment workflow**, because there is no deployment target in the repository.

## 7. Verification run

| Check                    | Result                                                |
| ------------------------ | ----------------------------------------------------- |
| `npm run typecheck`      | clean                                                 |
| `npm run lint`           | clean                                                 |
| `npm run format`         | clean                                                 |
| `npm run security:audit` | 0 vulnerabilities                                     |
| `npm run test:coverage`  | 881 tests in 42 files, every threshold met            |
| `npm run test:ui`        | 88 tests in 9 files                                   |
| `npm run build`          | clean, and clean again with `NEXT_PUBLIC_SITE_URL=""` |
| `npm run db:migrate`     | 18 migrations                                         |
| `npm run db:check-rls`   | 27 tables, 60 policies, passed                        |
| `npm run test:db`        | 124 tests in 4 files                                  |
| `npx playwright test`    | 604 tests, desktop and mobile                         |
| `npm run validate`       | 0 severe, 0 warning, both chronologies                |

New in this phase: 22 unit tests and 12 browser tests.

## 8. A red run that was not the code

One full browser run in this phase reported 54 failures, all of them on pages that
need JavaScript, and none of them reproduced one at a time. The cause was a stale
incremental build: the prerendered HTML in `.next/server` still referenced a chunk
name from an earlier build, so the browser asked for a script that was no longer
there, got a 404 served as `text/plain`, and never hydrated. Everything that renders
on the server passed; everything that needed a click did not.

`rm -rf .next` and a fresh build fixed it, and the same suite passed. It is recorded
because the symptom is misleading — it looks exactly like a Content-Security-Policy
blocking scripts, which is what had just been added — and because the diagnosis is
worth repeating: a page that renders and then does nothing is a script that did not
load, and the browser console says which one.

Nothing in the deployed pipeline is affected: CI and the hosting platform both build
from a clean checkout.

## 9. The final gate

| Gate condition                    | Result                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| Production build passes           | Yes                                                                    |
| No critical security issues       | None; the `script-src` limit is recorded in §1 of the readiness review |
| No critical accessibility issues  | Zero axe violations, every route, desktop and mobile                   |
| Zero canonical dataset errors     | 0 severe, 0 warning, both chronologies                                 |
| All golden tests pass             | Yes                                                                    |
| Critical end-to-end journeys pass | Yes, desktop and mobile                                                |

## 10. What is left, and who owns it

Everything in `docs/PRODUCTION_READINESS.md` §10 is Kelv's: the environment variables,
the Supabase email sender and Google client, applying migrations 0001 to 0018, the
first administrator, and a daily `sweep_rate_limits()`. Nothing in the build is blocked
on any of it.

The oldest open item in the project is now half closed. The derivation used to discard
the review status of the figures it built on and stamp every derived record DRAFT; it now
propagates the true status through the chain, so the derived data honestly distinguishes
the 25-record verified spine from the source-checked collateral, and the alternate
chronology surfaces its disputed reading as DISPUTED down the whole line after Abraham.
What is left is the decision of whether to switch the application boundary to VERIFIED-only
by default, which narrows the default experience and touches figures the journeys were
built around — see section 7 of `PRODUCTION_READINESS.md`.
