import type { MetadataRoute } from 'next';
import { branding } from '@/lib/config/branding';
import { JOURNEYS } from '@/lib/learning';
import { QUIZ_MODES } from '@/lib/quiz';
import { getCanonical, getDiscoveries } from '@/lib/services/dataset';

/**
 * Every page worth finding, built from the dataset rather than typed
 * out, so a person added to the canonical files is a person a crawler
 * can reach without anybody remembering to add them here.
 *
 * Personal and staff routes are absent for the same reason they are in
 * robots.ts. A generated question is absent too: a seed is not a page,
 * and a crawler walking an infinite space of seeds is a crawler
 * wasting its budget on this site.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = branding.siteUrl;
  const now = new Date();

  const fixed = [
    '',
    '/timeline',
    '/who-was-alive',
    '/people',
    '/family-tree',
    '/compare',
    '/events',
    '/discover',
    '/games',
    '/journeys',
    '/chronology',
    '/about',
  ];

  const entries: MetadataRoute.Sitemap = fixed.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));

  for (const person of getCanonical().people) {
    entries.push({
      url: `${base}/people/${person.slug}`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.6,
    });
  }

  for (const event of getCanonical().events) {
    entries.push({
      url: `${base}/events/${event.slug}`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.5,
    });
  }

  for (const discovery of getDiscoveries()) {
    entries.push({
      url: `${base}/discover/${discovery.id}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

  for (const journey of JOURNEYS) {
    entries.push({
      url: `${base}/journeys/${journey.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

  for (const mode of QUIZ_MODES) {
    entries.push({
      url: `${base}/games/${mode}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    });
  }

  return entries;
}
