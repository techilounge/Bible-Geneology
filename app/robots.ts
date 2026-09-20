import type { MetadataRoute } from 'next';
import { branding } from '@/lib/config/branding';

/**
 * What a crawler may index.
 *
 * Everything a reader can explore, and nothing that belongs to one
 * person or to staff. `/admin` is already a 404 to anybody who is not
 * staff, and `/account` holds somebody's own rows; neither is a page a
 * search result should ever land on.
 *
 * The sitemap is named absolutely because a crawler reads this file
 * from the root and follows the URL it is given.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/account', '/account/', '/auth/'],
      },
    ],
    sitemap: `${branding.siteUrl}/sitemap.xml`,
  };
}
