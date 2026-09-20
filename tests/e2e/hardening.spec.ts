import { expect, test } from '@playwright/test';

/**
 * The Phase 15 hardening, asserted rather than described.
 *
 * A header that is documented and not sent is worse than one that was
 * never claimed, so each of these asks the running server.
 */
test.describe('every response carries its security headers', () => {
  test('the headers are there, on a page and on an asset route', async ({ request }) => {
    for (const route of ['/', '/people/adam', '/discover']) {
      const response = await request.get(route);
      const headers = response.headers();
      expect(headers['x-content-type-options'], route).toBe('nosniff');
      expect(headers['referrer-policy'], route).toBe('strict-origin-when-cross-origin');
      expect(headers['x-frame-options'], route).toBe('DENY');
      expect(headers['strict-transport-security'], route).toContain('max-age=');
      expect(headers['cross-origin-opener-policy'], route).toBe('same-origin');
      expect(headers['permissions-policy'], route).toContain('geolocation=()');
      expect(headers['content-security-policy'], route).toBeTruthy();
    }
  });

  test('the policy closes the paths a policy can close', async ({ request }) => {
    const csp = (await request.get('/')).headers()['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  test('the framework does not announce its version', async ({ request }) => {
    expect((await request.get('/')).headers()['x-powered-by']).toBeUndefined();
  });

  test('and the site still works under the policy', async ({ page }) => {
    // The point of running this in a browser: a policy that blocks a
    // script shows up as a page that renders and then does nothing.
    const blocked: string[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy/i.test(message.text())) blocked.push(message.text());
    });

    await page.goto('/games/who-lived-longer?seed=csp');
    await page.locator('input[type="radio"][name="answer"]').first().check();
    await page.getByRole('button', { name: 'Check my answer' }).click();
    await expect(page.getByTestId('result')).toBeVisible();
    expect(blocked).toEqual([]);
  });
});

test.describe('what a crawler is told', () => {
  test('robots.txt keeps it out of the personal and staff routes', async ({
    request,
  }) => {
    const body = await (await request.get('/robots.txt')).text();
    expect(body).toContain('Allow: /');
    for (const path of ['/admin', '/account', '/auth/']) {
      expect(body, path).toContain(`Disallow: ${path}`);
    }
    expect(body).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
  });

  test('the sitemap lists the pages built from the dataset', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('xml');

    const body = await response.text();
    expect(body).toContain('/people/adam');
    expect(body).toContain('/journeys/adam-to-noah');
    expect(body).toContain('/discover/');
    // And nothing a crawler has no business indexing.
    expect(body).not.toContain('/admin');
    expect(body).not.toContain('/account');
  });
});
