/**
 * Single source of truth for product naming and identity.
 *
 * Requirement section 1: the name and branding must be changeable without
 * significant refactoring. No component may hard-code the product name;
 * import from here instead.
 */
export const branding = {
  productName: 'Bible Timeline Explorer',
  shortName: 'Timeline Explorer',
  tagline: 'Explore the Bible Through Time',
  description:
    'Discover who lived together, how biblical characters were related, ' +
    'and what happened during their lifetimes.',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const;

export type Branding = typeof branding;
