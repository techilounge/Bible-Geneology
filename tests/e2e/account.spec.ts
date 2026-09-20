import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The Phase 13 exit gate, in a browser.
 *
 * The isolation half is proved in tests/db/personal-data.test.ts, against
 * a real Postgres, because RLS is a database property and a browser
 * cannot see it. What only a browser can show is the other two halves:
 * that exploration works with no account at all, and that signing out
 * leaves nothing of the reader behind in this browser.
 *
 * This deployment has no Supabase configured, which is not a gap in the
 * test: it is the state requirement section 46 cares most about, because
 * it is the one where an account-shaped assumption would break the whole
 * site rather than one page.
 */
const ATTEMPTS_KEY = 'bible-timeline-explorer.attempts.v1';

const EXPLORATION = [
  '/',
  '/timeline',
  '/who-was-alive',
  '/people',
  '/people/adam',
  '/family-tree',
  '/compare',
  '/events',
  '/discover',
  '/games',
  '/journeys',
  '/chronology',
];

test.describe('exploration needs no account', () => {
  test('every exploration page renders for a visitor with no session', async ({
    page,
  }) => {
    for (const route of EXPLORATION) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('h1'), route).toHaveCount(1);
      // Nothing may redirect a signed-out reader to a sign-in.
      expect(new URL(page.url()).pathname, route).toBe(route);
    }
  });

  test('a round can be played and scored with no account', async ({ page }) => {
    await page.goto('/games/who-lived-longer?seed=anon');
    await page.locator('input[type="radio"][name="answer"]').first().check();
    await page.getByRole('button', { name: 'Check my answer' }).click();
    await expect(page.getByTestId('result')).toBeVisible();

    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), ATTEMPTS_KEY))
      .not.toBeNull();
  });

  test('the account page says plainly that accounts are not configured here', async ({
    page,
  }) => {
    await page.goto('/account');
    await expect(page.getByTestId('accounts-unavailable')).toContainText(
      'without an account',
    );

    await page.goto('/account/sign-in');
    await expect(page.getByTestId('accounts-unavailable')).toBeVisible();
    // And it offers no form it cannot honour.
    await expect(page.getByTestId('send-link')).toHaveCount(0);
  });
});

test.describe('signing out leaves nothing behind', () => {
  test('the sign-out route is a POST, and redirects to the page that clears up', async ({
    request,
  }) => {
    const posted = await request.post('/auth/sign-out', { maxRedirects: 0 });
    expect(posted.status()).toBe(303);
    expect(posted.headers()['location']).toContain('/account/signed-out');

    // A GET would let any page on the internet sign a reader out.
    const got = await request.get('/auth/sign-out', { maxRedirects: 0 });
    expect(got.status()).toBe(405);
  });

  test('local storage and the caches are empty afterwards', async ({ page }) => {
    await page.goto('/games/who-lived-longer?seed=signout');
    await page.locator('input[type="radio"][name="answer"]').first().check();
    await page.getByRole('button', { name: 'Check my answer' }).click();
    await expect(page.getByTestId('result')).toBeVisible();
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), ATTEMPTS_KEY))
      .not.toBeNull();

    // A cached page, as the service worker would leave one.
    await page.evaluate(async () => {
      const cache = await caches.open('shell-test');
      await cache.put('/cached-page', new Response('a page this reader saw'));
    });
    expect(await page.evaluate(() => caches.keys())).toContain('shell-test');

    await page.goto('/account/signed-out');
    await expect(page.getByTestId('cleanup')).toHaveAttribute('data-cleared', 'yes');

    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), ATTEMPTS_KEY),
    ).toBeNull();
    expect(
      await page.evaluate(() =>
        Object.keys(window.localStorage).filter((key) =>
          key.startsWith('bible-timeline-explorer.'),
        ),
      ),
    ).toEqual([]);

    // Every cache is deleted, but the service worker is still running and
    // starts re-caching static assets for the very next request. So the
    // assertion is the property the gate actually names: nothing cached
    // belongs to this reader. A content-hashed script belongs to nobody.
    const cached = await page.evaluate(async () => {
      const paths: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          paths.push(new URL(request.url).pathname);
        }
      }
      return paths;
    });
    expect(cached).not.toContain('/cached-page');
    expect(
      cached.filter(
        (path) => !path.startsWith('/_next/static/') && !/\.(png|svg|woff2?)$/.test(path),
      ),
    ).toEqual([]);
  });

  test('the signed-out page still offers the rest of the site', async ({ page }) => {
    await page.goto('/account/signed-out');
    await page.getByTestId('keep-exploring').click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('the sign-in cannot be turned into a redirect to somewhere else', () => {
  test('the callback never sends a reader off this origin', async ({ request }) => {
    for (const next of [
      'https://evil.test/steal',
      '//evil.test',
      '/\\evil.test',
      'javascript:alert(1)',
    ]) {
      const response = await request.get(
        `/auth/callback?code=whatever&next=${encodeURIComponent(next)}`,
        { maxRedirects: 0 },
      );
      const location = response.headers()['location'] ?? '';
      expect(location, next).not.toContain('evil.test');
      expect(location, next).not.toContain('javascript:');
    }
  });
});

test.describe('accessibility', () => {
  test('axe reports no violations on the account pages', async ({ page }) => {
    for (const route of ['/account', '/account/sign-in', '/account/signed-out']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();
      expect(
        results.violations.map((violation) => violation.id),
        route,
      ).toEqual([]);
    }
  });
});
