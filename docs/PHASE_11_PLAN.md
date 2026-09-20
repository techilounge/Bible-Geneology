# Phase 11 Plan — Discovery Engine

Requirement sections 34, 35 and 36. Exit gate: every discovery is reproducible from
canonical data — running the generator twice on the same dataset produces identical
output, and each discovery links to the records it came from.

---

## Goal

Turn the chronology engine's answers into findings a reader would not have thought to
ask for, without any of those findings being written by hand. A discovery is generated
or it does not exist. Change the chronology and every discovery changes with it; that
is the property that stops the failure recorded in `docs/COPY_CORRECTIONS.md`, where the
build prompt's own examples asserted overlaps the data does not support.

## Files

| File                                     | What it is                                                  |
| ---------------------------------------- | ----------------------------------------------------------- |
| `lib/discovery/types.ts`                 | The `Discovery` shape: what it claims and what it rests on  |
| `lib/discovery/generators.ts`            | One generator per kind in requirement section 34            |
| `lib/discovery/generate.ts`              | Runs them all, in a fixed order, with stable ids            |
| `lib/discovery/pick.ts`                  | Surprise Me: a seed picks a discovery, so a link reopens it |
| `lib/discovery/__tests__/`               | Determinism, provenance, and the claims themselves          |
| `components/discovery/DiscoveryCard.tsx` | One finding, with the calculation under it                  |
| `components/discovery/DiscoveryList.tsx` | The list, filterable by kind                                |
| `app/discover/page.tsx`                  | The discovery index, replacing the placeholder              |
| `app/discover/[id]/page.tsx`             | One discovery, with its visualisation and sources           |
| `app/discover/[id]/opengraph-image.tsx`  | The shareable card                                          |
| `tests/e2e/discover.spec.ts`             | The gate, in a browser                                      |

## Database

None. Discoveries are computed from the canonical dataset at request time, exactly as
the timeline is. Requirement section 11 lists a `discoveries` entity, and the data
model already describes it; nothing is stored there yet because a stored discovery
would be a hand-written claim in a different shape.

## Dependencies

None new. The shareable card uses `next/og`, which ships with Next.

## Risks

- **A discovery that reads as a claim about contact.** The copy test already bans the
  phrasings; every discovery sentence has to be generated from a template that cannot
  produce one, and `NOT_CONTACT` travels with any overlap discovery.
- **Non-determinism.** `Surprise Me` must not call `Math.random` on the server, or the
  link a reader shares opens on a different finding. A seed in the URL picks the index.
- **A discovery that is true but empty.** "Adam had the longest lifespan" is a fact
  about a dataset of 26 dated people, not about Scripture. Each generator has to say
  what population it ranged over.
- **Superlatives over UNKNOWN data.** Most of the dataset has no dates. A generator
  that says "the longest lifespan" while 23 people have none is misleading; the phrasing
  has to name the population it drew from.
