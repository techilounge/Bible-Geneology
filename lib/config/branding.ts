import { resolveSiteUrl } from './site-url';

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
  // Not `process.env.X ?? fallback`: a variable that is present and
  // empty passes that test and then fails the build. See site-url.ts.
  siteUrl: resolveSiteUrl({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
  }),
} as const;

export type Branding = typeof branding;
