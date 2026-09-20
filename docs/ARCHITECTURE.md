# ARCHITECTURE.md

**Project:** Bible Timeline Explorer
**Phase:** 0 — Repository Discovery
**Date:** 2026-09-20
**Status:** Proposed architecture, approved starting point

---

## 0. Discovery findings

There is no pre-existing codebase. The owner confirmed on 2026-09-20 that this is a
greenfield build, so the "inspect existing repository" half of Phase 0 has no subject.

| Discovery item            | Finding                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| Repository structure      | None. New repository created at the project root.                    |
| Package manager           | None existing. **Chosen: npm** (ships with Node, no extra CI setup). |
| Framework                 | None existing. **Chosen: Next.js (App Router).**                     |
| Dependencies              | None existing.                                                       |
| Database                  | None existing. **Chosen: Supabase Postgres.**                        |
| Existing schema           | None.                                                                |
| Authentication            | None. **Chosen: Supabase Auth.**                                     |
| Environment configuration | None. Defined in §9 below.                                           |
| Design system             | None. Defined as design tokens in §8.                                |
| Tests                     | None. Strategy in `TESTING_STRATEGY.md`.                             |
| Deployment configuration  | None. **Chosen: Vercel** for the web app, Supabase for data.         |
| CI/CD                     | None. **Chosen: GitHub Actions.**                                    |
| Existing code quality     | N/A. Standards set in §11.                                           |

Because nothing exists, every "existing failure" list in the Phase 0 exit gate is empty
by construction. The gate is instead satisfied against the skeleton described in §12.

---

## 1. The one rule this architecture exists to enforce

```
verified source data  →  chronology engine  →  validation  →  services  →  UI  →  learning  →  AI
```

Everything below is a mechanism for making that arrow one-directional. The single most
important structural decision is that **the chronology engine is a plain TypeScript
library with no framework imports and no database imports.** It receives a dataset as an
argument and returns values. That is what makes the numbers testable without a browser
or a database, and it is what stops chronology math from leaking into components.

A lint rule enforces it (§11), not just a convention.

---

## 2. Layer diagram

```
┌──────────────────────────────────────────────────────────────┐
│  app/            Next.js App Router. Pages, layouts, routes.  │  presentation
│  components/     React. Presentational + interactive.         │
└───────────────────────────┬──────────────────────────────────┘
                            │ may import ↓ only
┌───────────────────────────┴──────────────────────────────────┐
│  lib/services/   Query + composition. Talks to Supabase.      │  application
│                  Assembles view models from engine output.    │
└───────────────────────────┬──────────────────────────────────┘
                            │ may import ↓ only
┌───────────────────────────┴──────────────────────────────────┐
│  lib/chronology/ Pure deterministic calculations.             │  domain
│  lib/graph/      BFS / path finding over lifetime overlaps.   │  (no I/O,
│  lib/discovery/  Deterministic observation generation.        │   no React,
│  lib/domain/     Types, enums, Zod schemas, invariants.       │   no fetch)
└───────────────────────────┬──────────────────────────────────┘
                            │ may import ↓ only
┌───────────────────────────┴──────────────────────────────────┐
│  data/canonical/ Source-backed JSON. The system of record.    │  data
│  supabase/       Migrations, RLS policies, seed scripts.      │
└──────────────────────────────────────────────────────────────┘
```

Import direction is downward only. `lib/chronology` importing from `components/` or
`app/` is a build failure, not a code review comment.

---

## 3. The canonical dataset lives in git, not only in the database

This is the least obvious decision in the document, so it gets its own section.

Requirement §21 wants dataset validation to run in CI and fail the build. Requirement
§47 wants an admin CMS that edits people and chronology values. Those two pull in
opposite directions: CI cannot fail a build over a row someone edited in production.

**Resolution — two tiers with a clear system of record per phase:**

- **Phases 2 through 13:** `data/canonical/*.json` in git is the system of record.
  Changes arrive as pull requests, which means every chronological edit gets a diff, a
  reviewer, and a CI validation run. Provenance review is exactly what code review is
  good at. The database is a _projection_: `npm run db:seed` loads the JSON into
  Postgres, and the seed is idempotent and destructive-on-canonical-tables only.
- **Phase 14 onward:** the admin CMS writes to Postgres with the DRAFT →
  SOURCE_CHECKED → VERIFIED workflow, and a scheduled export job writes the VERIFIED
  rows back to `data/canonical/*.json` and opens a pull request. CI validation still
  guards the dataset; the CMS becomes a friendlier editor in front of the same gate.

User-generated data (accounts, favorites, quiz attempts, progress) is **always**
database-only and never touches `data/canonical`. The two never share a table.

Practical consequence: the chronology engine takes its dataset as an argument. In tests
that argument is the JSON loaded from disk. At runtime it is rows read from Postgres.
The engine cannot tell the difference, which is the point.

---

## 4. Proposed folder structure

```
bible-timeline-explorer/
├── app/
│   ├── (marketing)/                 # home, about, chronology explainer
│   ├── timeline/
│   ├── people/[slug]/
│   ├── who-was-alive/
│   ├── compare/[pair]/
│   ├── family-tree/
│   ├── events/
│   ├── discover/
│   ├── games/
│   ├── journeys/
│   ├── admin/                       # Phase 14, server-guarded
│   ├── api/
│   └── layout.tsx
├── components/
│   ├── ui/                          # buttons, cards, sheets, primitives
│   ├── timeline/                    # lifespan bars, axis, viewport
│   ├── tree/
│   ├── chronology/                  # ConfidenceBadge, WhyThisDate, SourceList
│   └── share/
├── lib/
│   ├── domain/                      # types.ts, enums.ts, schemas.ts
│   ├── chronology/                  # THE ENGINE — no React, no I/O
│   │   ├── index.ts
│   │   ├── timeline.ts
│   │   ├── overlap.ts
│   │   ├── ages.ts
│   │   ├── alive.ts
│   │   ├── explanation.ts
│   │   └── __tests__/
│   ├── graph/                       # overlap graph, BFS, relationship paths
│   ├── discovery/
│   ├── validation/                  # dataset validators + report renderer
│   ├── services/                    # Supabase queries, view-model assembly
│   ├── supabase/                    # typed clients: browser / server / admin
│   └── config/                      # branding, feature flags, site config
├── data/
│   ├── canonical/                   # source-backed input data
│   │   ├── people.json
│   │   ├── relationships.json
│   │   ├── chronologies.json
│   │   ├── person-chronology.masoretic.json
│   │   ├── events.json
│   │   ├── scripture-references.json
│   │   └── sources.json
│   └── generated/                   # derived, git-ignored, rebuilt by scripts
├── supabase/
│   ├── migrations/
│   └── policies/
├── scripts/                         # validate-data, seed, derive, audit-report
├── tests/
│   ├── golden/                      # immutable chronology assertions
│   └── e2e/                         # Playwright
├── docs/                            # this file and its siblings
└── .github/workflows/
```

Note that `data/canonical/` holds **only sourced input**. Anything the engine can
compute — AM birth years, overlaps, discoveries — is derived at build or request time
and written to `data/generated/`, which is git-ignored. Hand-entering a derived number
would create a second source of truth that can silently drift from the engine.

---

## 5. Technical decisions

| #   | Decision                                    | Why                                                                                                                                                              | Rejected alternative                                                                      |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Next.js App Router                          | Server components render person profiles and timelines as HTML, which SEO (§53) requires; route handlers cover the small API surface without a separate service. | SPA + separate API — loses crawlable profile pages, the main organic acquisition channel. |
| 2   | TypeScript, `strict: true`, no `any`        | §64 forbids suppressing type errors; chronology values are exactly the kind of thing a type system should keep straight.                                         | Looser config — the prohibition is explicit.                                              |
| 3   | Supabase Postgres                           | Genealogy is relational; recursive CTEs handle ancestor paths; RLS gives per-user isolation without a bespoke authorization layer.                               | Document store — ancestor queries become application-side joins.                          |
| 4   | Tailwind CSS with a token layer             | Tokens defined once as CSS custom properties keep the §24 visual direction consistent and make rebranding (§1) a token swap.                                     | Ad-hoc CSS — the palette drifts across screens.                                           |
| 5   | Zod as the single schema source             | One schema validates canonical JSON at build time, API input at runtime, and derives TypeScript types. One definition, three uses.                               | Hand-written types plus separate validators — they diverge.                               |
| 6   | Vitest + Testing Library + Playwright + axe | Fast unit runs for the engine, real-browser checks for the timeline's touch and keyboard behaviour.                                                              | Jest — slower with ESM and TS here; no advantage.                                         |
| 7   | Engine takes dataset as a parameter         | Makes the engine testable with fixtures and reusable across chronologies.                                                                                        | Engine imports the database — untestable, couples domain to I/O.                          |
| 8   | AM integer years as the time unit           | Genesis gives whole years; a day-precision model would imply precision the text does not supply.                                                                 | Date objects — invents precision, breaks on pre-epoch years.                              |

### Branding configurability (§1)

Everything nameable lives in `lib/config/branding.ts`:

```ts
export const branding = {
  productName: 'Bible Timeline Explorer',
  shortName: 'Timeline Explorer',
  tagline: 'Explore the Bible Through Time',
  domain: process.env.NEXT_PUBLIC_SITE_URL,
  ogImageTemplate: '/api/og',
} as const;
```

No component hard-codes the product name. Colors are CSS custom properties in one
file. Changing the name and palette should touch two files and no JSX.

---

## 6. Visualization approach

Requirement §45 asks for an evaluation rather than a default pick. Here it is.

| Library                      | Performance                             | Accessibility                                                   | Touch                         | Maintenance                          | Bundle                  | Verdict                                                                               |
| ---------------------------- | --------------------------------------- | --------------------------------------------------------------- | ----------------------------- | ------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------- |
| **vis-timeline**             | Adequate to a few thousand items        | Weak; DOM structure is not navigable and labels are not exposed | Built-in but hard to override | Maintained but architecturally dated | Large                   | **Reject.** Fighting its DOM to meet WCAG AA (§51) costs more than building the bars. |
| **Full D3 as renderer**      | Excellent                               | Whatever you build                                              | Manual                        | Excellent                            | Large if imported whole | **Reject as a renderer** — D3's DOM mutation fights React's reconciliation.           |
| **d3-scale / d3-array only** | N/A, math only                          | N/A                                                             | N/A                           | Excellent                            | ~6 KB                   | **Accept.** Use D3 for scales and ticks; let React own the DOM.                       |
| **React Flow**               | Good to ~1000 nodes with virtualization | Reasonable; keyboard support needs work but is reachable        | Good pinch/pan                | Active                               | Moderate                | **Accept for the family tree only.**                                                  |
| **Recharts / Visx**          | Fine                                    | Fine                                                            | Fine                          | Active                               | Moderate                | **Reject** — built for statistical charts, not lifespan bars with overlap semantics.  |

**Decision.** Two surfaces, two approaches, one shared scale module:

1. **Master timeline (§27):** custom SVG rendered by React, positioned by `d3-scale`.
   Lifespan bars are `<rect>` elements in a `<g role="list">` with each bar a focusable
   `role="listitem"`, so keyboard navigation and screen readers come from semantics
   rather than an ARIA retrofit. Virtualize to the visible year window plus a margin.
   If profiling later shows SVG struggling past roughly 500 simultaneous bars, swap the
   renderer for Canvas behind the same component interface, keeping an off-screen DOM
   list as the accessible representation.
2. **Family tree (§32):** React Flow for pan, zoom, and node interaction, with layout
   computed by `d3-hierarchy` (or `elkjs` if spouse pairs and multiple parents make the
   graph non-tree-shaped, which for Jacob's family they will).

Both read from `lib/chronology/scale.ts` so the year-to-pixel mapping is identical.
This is one visualization framework plus a math library, which satisfies §45's warning
against stacking frameworks.

---

## 7. Rendering and caching

- Person profiles, compare pages, and event pages: **server components, statically
  generated** with `generateStaticParams`. The canonical dataset changes by pull
  request, so these are static until the next deploy. Perfect for SEO and Core Web
  Vitals.
- Timeline and Who Was Alive: **server shell, client island.** The server sends the
  dataset slice for the default viewport; the client handles pan, zoom, and slider
  interaction against that slice, requesting more only when the viewport moves outside
  it. This answers §54's "do not send the entire dataset to every client".
- Discovery pages: precomputed at build time into `data/generated/discoveries.json` by
  a script that runs the discovery engine. Deterministic in, deterministic out.
- User-specific data (favorites, progress): client-fetched after hydration so the
  static shell stays cacheable.

---

## 8. Design tokens

Defined once in `app/globals.css` as custom properties, consumed through Tailwind's
theme extension. The §24 direction — modern museum, not parchment — becomes:

- Deep neutral base with a slight blue cast, not brown, and not pure black.
- One warm gold accent used sparingly for emphasis and the selected state.
- Confidence is communicated by **both** a color and a shape or label (§51 forbids
  color alone): EXPLICIT gets a solid bar, DERIVED a subtle diagonal hatch, APPROXIMATE
  a soft-edged bar, DISPUTED a dashed outline, UNKNOWN an empty outline with a label.
  That encoding survives greyscale, color blindness, and small screens.

---

## 9. Environment configuration

| Variable                        | Where           | Purpose                                                             |
| ------------------------------- | --------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client + server | Project URL                                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Anon key, RLS-constrained                                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | **server only** | Seed and admin writes. Never in a client bundle. See `SECURITY.md`. |
| `NEXT_PUBLIC_SITE_URL`          | client + server | Canonical URLs, OG images                                           |
| `ANTHROPIC_API_KEY`             | server only     | Phase 15+ optional AI features                                      |

`lib/config/env.ts` parses these with Zod at startup and throws on a missing required
variable, so a misconfigured deploy fails immediately instead of rendering broken pages.

---

## 10. Risks

| Risk                                                                                                                         | Impact                                                              | Mitigation                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chronology ambiguity treated as settled** — Terah's age at Abraham's birth decides whether Noah and Abraham overlap at all | High. It changes headline claims the product is built around.       | Decided by Kelv on 2026-09-20: default 130, derived from GEN.11.32, GEN.12.4 and ACT.7.4. The 70 reading survives as the labelled alternate `masoretic-gen11-26`, never VERIFIED as explicit. Both readings are asserted in the golden suite, so neither can drift. `DATA_SOURCING.md` §4a. |
| **Derived values hand-entered into canonical data**                                                                          | High. Creates a second source of truth that drifts from the engine. | `data/canonical` holds only sourced input; validation fails if a derived field appears there.                                                                                                                                                                                               |
| **UI reimplementing chronology math**                                                                                        | High. Two answers to the same question.                             | Lint rule forbidding arithmetic on year fields outside `lib/chronology`; code review; engine-vs-UI parity tests.                                                                                                                                                                            |
| **Timeline performance as the dataset grows toward Kings and Prophets**                                                      | Medium.                                                             | Virtualize from the start; keep the renderer swappable behind one interface.                                                                                                                                                                                                                |
| **Copyright on Bible text**                                                                                                  | Medium, legal.                                                      | Store references only (§16). Verse text arrives at runtime from a licensed API or public-domain translation, never seeded.                                                                                                                                                                  |
| **Accessible timeline is genuinely hard**                                                                                    | Medium.                                                             | Build the semantic list structure first and the visual layer on top, rather than retrofitting ARIA.                                                                                                                                                                                         |
| **Scope** — 15 phases, 8 game modes, 6 journeys                                                                              | Medium.                                                             | MVP is §68 only. Phases 12 and 14 ship a subset behind flags.                                                                                                                                                                                                                               |
| **LLM drift into the dataset**                                                                                               | Critical if it happens.                                             | Every chronology row requires a `sourceReferences` entry and a review status; validation rejects rows without provenance; no code path writes canonical data from a model response.                                                                                                         |

---

## 11. Code quality enforcement

- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes`.
- ESLint with `no-restricted-imports` zones implementing §2's import direction.
- A custom ESLint rule (`no-chronology-math-in-ui`) flagging arithmetic on identifiers
  matching `/year|age|lifespan|birth|death/i` inside `app/` and `components/`.
- Prettier, run in CI as a check.
- `npm run validate:data` in the pre-build step; severe errors fail the build (§21).
- No `any`, no `@ts-expect-error` without an adjacent issue link, no skipped tests.

---

## 12. Phase 0 exit gate

| Criterion                                   | How it is met                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Project builds                              | `npm run build` on the skeleton.                                                              |
| Existing tests pass, or failures documented | No prior tests. A placeholder engine test and a dataset-shape test run green on the skeleton. |
| Architecture documented                     | This file.                                                                                    |
| Implementation plan exists                  | `IMPLEMENTATION_PLAN.md`.                                                                     |

Result recorded in `PHASE_0_REPORT.md`.
