# Production Readiness

Date: 2026-09-20
Reviewed at commit: the Phase 15 commit, `chore(phase-15): production hardening and readiness review`

This is the record of what was checked before launch, how, what was found, and what is
deliberately not done. Anything not checked is recorded as not checked, because a
review that reads as a clean bill of health is a review nobody can act on.

Status meanings: **Ready** — checked and sound, with the evidence named. **Fixed** —
a gap found in this review and closed in this phase. **Known limit** — a real
limitation, accepted with a reason. **Owner** — something only Kelv can do.

---

## 1. Security

| Area                    | Status      | Evidence                                                                     |
| ----------------------- | ----------- | ---------------------------------------------------------------------------- |
| Row level security      | Ready       | On every table; `npm run db:check-rls` checks 27 tables, 60 policies         |
| Canonical write path    | Ready       | None exists in any client role; 45 refusals in `tests/db/governance.test.ts` |
| Personal data isolation | Ready       | `tests/db/personal-data.test.ts`, five tables, every verb                    |
| Audit trail             | Ready       | Written by trigger; no UPDATE or DELETE grant for any role                   |
| Service-role key        | Ready       | `server-only`, no `NEXT_PUBLIC_` prefix, CI greps the client bundle          |
| Admin routes            | Ready       | 404 for a non-admin, and no content in the 404 body                          |
| Open redirect           | Ready       | `lib/account/redirect.ts`, 18 unit cases and a browser test                  |
| Security headers        | Fixed       | CSP, HSTS, COOP, DNS-prefetch off, no `X-Powered-By`                         |
| `script-src`            | Known limit | Allows inline; see below                                                     |
| Rate limiting           | Fixed       | Token bucket on the sign-in link, by address and by caller                   |
| Dependency advisories   | Ready       | `npm audit`: 0 vulnerabilities; now runs in CI and fails at high             |
| Raw HTML rendering      | Ready       | `dangerouslySetInnerHTML` appears nowhere in the codebase                    |

### The content security policy, and what it cannot do

The first version carried a per-request nonce with `'strict-dynamic'`, which is the
policy worth having. It would have broken the site. Next.js only puts a nonce on its
own script tags for a dynamically rendered response, and this site prerenders the
person pages, the discoveries and most of the shell; a prerendered document cannot
carry a nonce that changes per request, so the policy would have blocked every script
on exactly the pages that matter most. The alternative is rendering the whole
catalogue per request, which trades the site's performance for it.

So `script-src` is `'self' 'unsafe-inline'`. What the policy still does:
`form-action 'self'` stops a posted form leaving the origin, `base-uri 'self'` stops a
rewritten base tag redirecting every relative URL, `frame-ancestors 'none'` stops
clickjacking, `connect-src` restricts where data can be sent, and `object-src 'none'`
closes the plugin path. The compensating control for the rest is that this site renders
no user-supplied HTML at all: every string goes through React's escaping, and there is
no `dangerouslySetInnerHTML` anywhere.

**What would change it:** nonce support for prerendered responses, or a decision that
the person pages can be dynamic. Neither is worth doing before launch.

### Rate limiting, and what it is worth

The sign-in link is the only endpoint that does something expensive for somebody who
has not signed in — it emails an address they typed. It is limited to five in a burst
and one every two minutes after that, counted against the address and against the
caller separately, because either alone is a hole.

**Known limit:** the counters live in Postgres when `SUPABASE_SERVICE_ROLE_KEY` is set
and in process memory when it is not. In memory, on more than one instance, it is a
speed bump rather than a control. The limiter also fails open if its own store is
unreachable, which is deliberate: it must not become the reason nobody can sign in, and
Supabase applies its own email limits underneath.

**Not done:** `sweep_rate_limits()` exists and nothing calls it. It needs a scheduled
job on the host (Supabase cron, daily) or the table grows slowly and for ever.

## 2. Accessibility

| Area                  | Status | Evidence                                                                                                |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| Automated checks      | Ready  | axe on every route, desktop and mobile, `wcag2a` through `wcag21aa` plus best-practice, zero violations |
| Keyboard reach        | Ready  | `tests/e2e/shell.spec.ts`, every control reachable with visible focus                                   |
| Touch targets         | Ready  | 44px minimum, asserted rather than styled and hoped for                                                 |
| Layout at width       | Ready  | No horizontal overflow at 320, 375, 390, 430 and 1280                                                   |
| Zoom                  | Ready  | `maximumScale: 5`; zooming is never disabled                                                            |
| Works without scripts | Ready  | Every route renders, and the games are playable, with JavaScript off                                    |

**Known limit:** axe finds a category of problems, not all of them. No screen-reader
pass by a person has been done, and no testing with a real assistive-technology user.
That is the honest gap in this section, and it is the one worth closing first after
launch.

## 3. Performance and caching

| Area                 | Status | Detail                                                                          |
| -------------------- | ------ | ------------------------------------------------------------------------------- |
| Client JavaScript    | Ready  | 1.05 MB across all chunks, before compression; no charting or animation library |
| Prerendering         | Ready  | 49 person pages and 14 discovery pages are static HTML                          |
| Dataset parsing      | Ready  | Memoised per process in production, re-read in development                      |
| Discovery generation | Ready  | Memoised per chronology; the generators are pure                                |
| Home and games       | Ready  | `revalidate = 3600`, so the daily seed changes on the hour                      |
| Account and admin    | Ready  | `force-dynamic`; neither may ever be cached across readers                      |
| Service worker       | Ready  | Caches the shell and content-hashed assets only                                 |

**Not done:** no Lighthouse run and no real-device measurement. The numbers above are
build output and code reading, not field data. Do a Lighthouse pass against the first
real deployment.

## 4. SEO, metadata and sharing

| Area          | Status | Detail                                                               |
| ------------- | ------ | -------------------------------------------------------------------- |
| `robots.txt`  | Fixed  | Allows the site, refuses `/admin`, `/account` and `/auth/`           |
| Sitemap       | Fixed  | Built from the dataset, so a new person is reachable without an edit |
| Titles        | Ready  | A template per route, product name from `lib/config/branding.ts`     |
| Descriptions  | Ready  | Per route, written rather than generated                             |
| Share cards   | Ready  | An OpenGraph image per discovery, generated from the finding         |
| Canonical URL | Owner  | `NEXT_PUBLIC_SITE_URL`; blank is now survivable, see section 10      |

## 5. PWA, offline and browser support

| Area            | Status      | Detail                                                                  |
| --------------- | ----------- | ----------------------------------------------------------------------- |
| Manifest        | Ready       | Installable; the icons it names all resolve, asserted in CI             |
| Offline page    | Ready       | `/offline`, served when a navigation fails                              |
| Asset caching   | Ready       | Content-hashed only, so a cache hit is the bytes the network would give |
| Browser support | Known limit | Tested in Chromium at two viewports. Not tested in Safari or Firefox    |

**Known limit:** the browser suite runs Chromium only, because that is what the build
environment has. Safari is the one that matters most for the gaps — date handling and
`dvh` units — and it has not been tried.

## 6. Error handling

| Area                | Status | Detail                                                                                                  |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| Page errors         | Ready  | `app/error.tsx`, with a way back                                                                        |
| Layout errors       | Fixed  | `app/global-error.tsx`, with no component, stylesheet or font it could depend on                        |
| Not found           | Ready  | A written 404, asserted in the browser suite                                                            |
| Missing data        | Ready  | UNKNOWN renders as unknown; a test asserts no page ever prints `NaN`, `undefined`, `null` or `Infinity` |
| Unconfigured deploy | Ready  | Accounts absent renders and says so, rather than throwing                                               |

**Not done:** no error reporting service. An exception in production is currently
visible only in the host's logs. That is a deliberate choice for launch — see analytics
below — and the first thing to revisit if anything goes wrong quietly.

## 7. Data integrity

| Area              | Status | Evidence                                                                         |
| ----------------- | ------ | -------------------------------------------------------------------------------- |
| Canonical dataset | Ready  | `npm run validate`: 0 severe, 0 warning, both chronologies                       |
| Derived output    | Ready  | Regenerated and revalidated on every test and build run                          |
| The gate itself   | Ready  | `validate:prove-gate` corrupts the dataset five ways and asserts the build fails |
| Golden tests      | Ready  | Including 800 generated questions re-marked by the engine                        |
| Provenance        | Ready  | Every chronological value carries a source type and a confidence                 |

**Carried forward, and still open:** review status does not gate what reaches the
application. Derived output is written `reviewStatus: 'DRAFT'`, so section 8's "only
VERIFIED reaches production calculations" is not enforced at the boundary. The Phase 14
export is the mechanism that would close it — only VERIFIED rows leave the database —
but nothing in `data/canonical` is VERIFIED yet, so there is nothing to export. This is
the oldest open item in the project and it should be closed before the dataset grows
beyond one person's review.

## 8. Analytics

**Status: none, deliberately.**

No analytics, no tag manager, no third-party script of any kind. That is why
`connect-src` can be as tight as it is, and why there is no cookie banner: there is
nothing to consent to. If measurement becomes necessary, the choice that preserves this
is a self-hosted, cookieless counter; anything else reopens the CSP and the consent
question together.

## 9. CI/CD

| Step                              | Runs on                                         |
| --------------------------------- | ----------------------------------------------- |
| `npm run security:audit`          | Every push and pull request; fails at high      |
| typecheck, lint, format           | Every push and pull request                     |
| `validate`, `validate:prove-gate` | Every push and pull request                     |
| coverage, component tests         | Every push and pull request                     |
| Migrations, twice, then RLS check | Every push and pull request, on a real Postgres |
| `test:db`                         | Every push and pull request                     |
| `build`, then the browser suite   | Every push and pull request                     |
| Service-role grep of the bundle   | Every push and pull request                     |

**Not done:** there is no deployment workflow, because there is no deployment target
yet. Nothing here pushes to an environment.

## 10. The production environment

Everything below is Kelv's, and none of it is in the repository.

A variable that is **present and empty** is not the same as one that is absent, and
this review found that out the hard way. `NEXT_PUBLIC_SITE_URL` was set to an empty
string in the hosting dashboard, `process.env.X ?? fallback` let it straight through,
and `new URL('')` failed six production builds in a row while every local build
passed. `lib/config/site-url.ts` now accepts a value only if it parses as an absolute
http or https URL, and falls back to the platform's own host and then to localhost.
Any other optional variable that grows a fallback should be read the same way.

| Setting                         | What happens without it                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | Falls back to the platform's host, then localhost; the sitemap and share cards point at whichever |
| `NEXT_PUBLIC_SUPABASE_URL`      | Accounts are off; everything else works                                                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accounts are off; everything else works                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | The admin CMS cannot write; rate limits fall back to memory                                       |
| Supabase email sender           | No sign-in link can be sent                                                                       |
| Supabase Google OAuth client    | The Google button fails                                                                           |
| Migrations 0001–0018 applied    | The app reads files and works; accounts and the CMS do not                                        |
| The first administrator         | Nobody can reach the CMS; it will not promote anyone                                              |
| A daily `sweep_rate_limits()`   | The rate-limit table grows slowly and for ever                                                    |

## 11. The final gate

| Gate condition                    | Result                                                 |
| --------------------------------- | ------------------------------------------------------ |
| Production build passes           | Yes                                                    |
| No critical security issues       | None found; the CSP limit in section 1 is recorded     |
| No critical accessibility issues  | Zero axe violations on every route, desktop and mobile |
| Zero canonical dataset errors     | 0 severe, 0 warning, both chronologies                 |
| All golden tests pass             | Yes                                                    |
| Critical end-to-end journeys pass | Yes, desktop and mobile                                |

## 12. What to do first, after launch

1. Set the environment and apply the migrations (section 10). Nothing else matters
   until that is done.
2. Run Lighthouse against the real deployment, and open Safari.
3. Close the review-status gap in section 7 before anybody but Kelv edits the dataset.
4. Decide on error reporting. Quiet failures are the ones that last longest.
5. Get somebody who uses a screen reader to try the timeline and the games.
