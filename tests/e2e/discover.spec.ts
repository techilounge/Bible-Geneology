import { expect, test } from '@playwright/test';
import { NOT_CONTACT } from '../../lib/config/copy';

/**
 * The Phase 11 exit gate, in a browser: every discovery is reproducible and
 * links to the records it came from.
 *
 * Reproducibility is checked the way a reader would notice it failing —
 * the same address showing something different the second time, or a
 * shared link opening on another finding.
 */
test.describe('the discovery index', () => {
  test('lists findings, each linking to its own page', async ({ page }) => {
    await page.goto('/discover');
    const cards = page.getByTestId('discovery');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(8);

    await cards.first().getByRole('link').click();
    await expect(page).toHaveURL(/\/discover\/.+/);
    await expect(page.getByTestId('calculation')).toBeVisible();
  });

  test('says what each finding was drawn from', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.getByTestId('discovery').first()).toContainText(
      /Drawn from the \d+ of \d+ people/,
    );
  });

  test('shows the same page twice for the same address', async ({ page }) => {
    await page.goto('/discover?seed=alpha');
    const first = await page.getByTestId('surprise-link').textContent();
    await page.reload();
    expect(await page.getByTestId('surprise-link').textContent()).toBe(first);

    await page.goto('/discover?seed=alpha');
    expect(await page.getByTestId('surprise-link').textContent()).toBe(first);
  });

  test('surprise me again moves to a different finding, and back again', async ({
    page,
  }) => {
    await page.goto('/discover?seed=alpha');
    const first = await page.getByTestId('surprise-link').textContent();

    await page.getByRole('link', { name: 'Surprise me again' }).click();
    // The click is a soft navigation, so the address changes before the
    // content does; reading the heading too early reads the old one.
    await expect(page).toHaveURL(/seed=alpha\./);
    await expect(page.getByTestId('surprise-link')).not.toHaveText(first ?? '');

    await page.goBack();
    await expect(page).toHaveURL(/seed=alpha$/);
    await expect(page.getByTestId('surprise-link')).toHaveText(first ?? '');
  });

  test('works with no scripting, because it is a page of links', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/discover?seed=alpha');
    await expect(page.getByTestId('surprise-link')).toBeVisible();
    await page.getByRole('link', { name: 'Surprise me again' }).click();
    await expect(page).toHaveURL(/seed=/);
    await context.close();
  });
});

test.describe('a discovery page', () => {
  test('shows the working, the people and the verses', async ({ page }) => {
    await page.goto('/discover');
    await page.getByTestId('discovery').first().getByRole('link').click();
    await expect(page).toHaveURL(/\/discover\/.+/);

    await expect(
      page.getByRole('heading', { name: 'How this was worked out' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The people' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Where the numbers come from' }),
    ).toBeVisible();
  });

  test('says an overlap is not a meeting, wherever it reports one', async ({ page }) => {
    await page.goto('/discover');
    const overlapping = page.locator(
      '[data-testid="discovery"][data-kind="largest-overlap"]',
    );
    await overlapping.first().getByRole('link').click();
    await expect(page.getByTestId('not-contact')).toHaveText(NOT_CONTACT);
  });

  test('an address that is not a finding gets the not-found page', async ({ page }) => {
    const response = await page.goto('/discover/no-such-finding');
    expect(response?.status()).toBe(404);
  });

  test('serves a shareable card for the finding', async ({ page, request }) => {
    await page.goto('/discover');
    await page.getByTestId('discovery').first().getByRole('link').click();
    await expect(page).toHaveURL(/\/discover\/.+/);
    const url = new URL(page.url());

    const card = await request.get(`${url.pathname}/opengraph-image`);
    expect(card.status()).toBe(200);
    expect(card.headers()['content-type']).toContain('image/png');
  });

  test('never prints a missing value as a value', async ({ page }) => {
    await page.goto('/discover');
    const body = (await page.locator('main').textContent()) ?? '';
    expect(body).not.toMatch(/\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b/);
  });
});

test.describe('the home page carries a finding', () => {
  test('shows today’s discovery and a way to see another', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('todays-discovery')).toBeVisible();
    await page.getByTestId('surprise-me').click();
    await expect(page).toHaveURL(/\/discover\?seed=/);
  });
});

test.describe('accessibility', () => {
  test('axe reports no violations on the index or a finding', async ({ page }) => {
    const AxeBuilder = (await import('@axe-core/playwright')).default;

    for (const route of ['/discover', '/discover?seed=beta']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();
      expect(
        results.violations.map((v) => v.id),
        route,
      ).toEqual([]);
    }

    await page.goto('/discover');
    await page.getByTestId('discovery').first().getByRole('link').click();
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
