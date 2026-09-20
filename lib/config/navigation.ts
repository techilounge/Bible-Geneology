/**
 * The site's navigation, in one place.
 *
 * Each route's `phase` is the build phase that fills it in. Until then the
 * route renders an honest placeholder rather than being hidden: a navigation
 * that grows one item at a time is easier to review than one that appears
 * fully formed at the end, and a visitor who lands on an unbuilt route
 * should be told so rather than get a 404.
 */
export interface NavItem {
  href: string;
  label: string;
  description: string;
  phase: number;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  {
    href: '/timeline',
    label: 'Timeline',
    description: 'Every dated lifetime on one scrollable axis.',
    phase: 7,
  },
  {
    href: '/who-was-alive',
    label: 'Who was alive',
    description: 'Pick a year and see who was living in it.',
    phase: 8,
  },
  {
    href: '/people',
    label: 'People',
    description: 'Every person in the dataset, with their dates and sources.',
    phase: 6,
  },
  {
    href: '/family-tree',
    label: 'Family tree',
    description: 'Descent and relationships as a navigable graph.',
    phase: 10,
  },
  {
    href: '/compare',
    label: 'Compare',
    description: 'Two lifetimes side by side, and whether they overlapped.',
    phase: 9,
  },
  {
    href: '/events',
    label: 'Events',
    description: 'Dated events, and who was alive when they happened.',
    phase: 9,
  },
  {
    href: '/discover',
    label: 'Discover',
    description: 'Findings the dataset supports, each with its working.',
    phase: 11,
  },
] as const;

export const SECONDARY_NAV: readonly NavItem[] = [
  {
    href: '/chronology',
    label: 'How the dates work',
    description:
      'Where every number comes from, what is stated, what is derived, and what is unknown.',
    phase: 5,
  },
  {
    href: '/about',
    label: 'About',
    description: 'What this is, and what it deliberately does not claim.',
    phase: 5,
  },
] as const;

export const ALL_NAV: readonly NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];
