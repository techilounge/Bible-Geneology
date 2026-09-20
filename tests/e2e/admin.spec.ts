import { expect, test } from '@playwright/test';

/**
 * The permission half of the Phase 14 exit gate, from outside.
 *
 * The database half is in tests/db/governance.test.ts, and it is the
 * one that matters: a canonical table refuses every client write in
 * every role. This checks the other claim — that a non-admin cannot
 * reach the admin routes — the way an attacker would, by asking for
 * them.
 *
 * A 404 rather than a redirect is deliberate. Somebody who cannot use
 * the CMS has no business learning it is there.
 */
const ADMIN_ROUTES = [
  '/admin',
  '/admin/people',
  '/admin/people/adam',
  '/admin/person_chronology/adam',
  '/admin/audit',
  '/admin/profiles',
  '/admin/../admin/audit',
];

test.describe('the admin is not reachable without an admin session', () => {
  for (const route of ADMIN_ROUTES) {
    test(`${route} is not found`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(404);
    });
  }

  test('and serialises none of its own content into the 404', async ({ page }) => {
    // A layout and its page render in parallel, so a guard in the
    // layout alone leaves the page's rendered output inside the 404
    // response, where anybody can read it. This caught exactly that.
    for (const route of ['/admin', '/admin/audit', '/admin/people']) {
      await page.goto(route);
      const html = await page.content();
      for (const tell of [
        'Review queue',
        'review status',
        'no-write-access',
        'Nothing recorded yet',
        'Signed in as',
      ]) {
        expect(html, `${route} leaked "${tell}"`).not.toContain(tell);
      }
    }
  });
});

test.describe('the admin is not advertised', () => {
  test('no page in the public site links to it', async ({ page }) => {
    for (const route of ['/', '/people', '/chronology', '/about', '/account']) {
      await page.goto(route);
      expect(await page.locator('a[href^="/admin"]').count(), route).toBe(0);
    }
  });
});
