# Phase 15 Plan — Production Hardening

The build order's final phase: a full review across security, accessibility,
performance, SEO, PWA, browser compatibility, mobile, error handling, indexes, rate
limiting, analytics, metadata, sharing, caching, dependencies, CI/CD and the production
environment, producing `docs/PRODUCTION_READINESS.md`.

Final gate: the production build passes; no critical security issues; no critical
accessibility issues; zero canonical dataset errors; all golden tests pass; the critical
end-to-end journeys pass.

---

## Goal

Find what is missing before a reader does. This phase is a review first and a change
second: every area gets looked at, what is already sound is recorded as sound with the
evidence, and only the gaps get code.

The review is written down because "we checked" decays into "we think we checked"
within a month. `PRODUCTION_READINESS.md` says what was checked, how, what was found
and what is deliberately not done.

## What is already in place, and will be re-checked rather than rebuilt

- Accessibility: axe on every route, at five widths, keyboard reach and 44px targets,
  in the browser suite since Phase 5.
- Data integrity: `validate:data`, `validate:derived` and `validate:prove-gate`, which
  corrupts the dataset five ways and asserts the gate fails.
- Database: RLS on every table, no client write path to canonical data, isolation and
  governance suites against a real Postgres, migrations proved idempotent in CI.
- Secrets: CI greps the client bundle for the service-role key.

## Expected gaps, to confirm or close

| Area             | What to check                                               |
| ---------------- | ----------------------------------------------------------- |
| Security headers | There is no Content-Security-Policy. That is the big one.   |
| SEO              | No `robots.txt` and no sitemap.                             |
| Error handling   | `error.tsx` exists; there is no `global-error.tsx`.         |
| Rate limiting    | The magic-link form can be posted as fast as anyone likes.  |
| Indexes          | Whether the queries the pages actually make are covered.    |
| Dependencies     | `npm audit`, and whether CI would notice a new advisory.    |
| Analytics        | None. Decide and record the decision rather than drift.     |
| Caching          | What is static, what is dynamic, and whether that is right. |
| Production env   | What has to be set, and what happens when it is not.        |

## Risks

- **A CSP that breaks the site quietly.** A policy that blocks a script shows up as a
  page that renders and does nothing. The browser suite is the check: hydration,
  the games, and axe all fail if scripts are blocked.
- **Rate limiting that punishes a real reader.** The limit belongs on the actions that
  send email, not on reading pages, and it has to fail open if its own store is down.
- **A review that reads as a clean bill of health.** Anything not checked is recorded
  as not checked.
