import { describe, expect, it } from 'vitest';
import { LOCAL_SITE_URL, resolveSiteUrl } from '../site-url';

/**
 * Every case here is a deployment that has happened or could. The
 * empty-string one is not hypothetical: it failed six production
 * builds in a row before anybody looked at the log.
 */
describe('working out where the site lives', () => {
  it('uses the configured URL when there is one', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://example.test' })).toBe(
      'https://example.test',
    );
  });

  it('treats a present but empty value as not set, rather than throwing', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: '' })).toBe(LOCAL_SITE_URL);
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: '   ' })).toBe(LOCAL_SITE_URL);
    expect(resolveSiteUrl({})).toBe(LOCAL_SITE_URL);
  });

  it('treats a value that is not a URL as not set', () => {
    for (const bad of ['example.test', 'https://', 'not a url', 'ftp://example.test']) {
      expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: bad }), bad).toBe(LOCAL_SITE_URL);
    }
  });

  it('drops a path and a trailing slash, keeping the origin', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://example.test/' })).toBe(
      'https://example.test',
    );
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://example.test/app' })).toBe(
      'https://example.test',
    );
  });

  it('falls back to the platform’s production host, which has no scheme', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: 'bible-geneology.vercel.app',
      }),
    ).toBe('https://bible-geneology.vercel.app');
  });

  it('then to this deployment’s own host', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: '',
        NEXT_PUBLIC_VERCEL_URL: 'bible-geneology-abc123.vercel.app',
      }),
    ).toBe('https://bible-geneology-abc123.vercel.app');
  });

  it('accepts a platform host that already carries a scheme', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_VERCEL_URL: 'https://already.vercel.app' })).toBe(
      'https://already.vercel.app',
    );
  });

  it('prefers what was configured over what the platform reports', () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://bibletimeline.test',
        NEXT_PUBLIC_VERCEL_URL: 'bible-geneology-abc123.vercel.app',
      }),
    ).toBe('https://bibletimeline.test');
  });
});
