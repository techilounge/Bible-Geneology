import { expect, test } from '@playwright/test';

/**
 * The journeys, walked.
 *
 * What matters here is that a journey is made of links rather than of
 * component state: the step is in the address, the back button works,
 * and the whole thing can be read with scripting switched off. The
 * figures beside each name come from the engine, so the test checks
 * they are there rather than checking what they say — what they say is
 * asserted in tests/golden.
 */
const JOURNEYS = [
  'adam-to-noah',
  'the-flood-generation',
  'noah-to-abraham',
  'abrahams-family',
  'isaac-and-jacob',
  'the-twelve-tribes',
];

test.describe('the journeys index', () => {
  test('lists all six', async ({ page }) => {
    await page.goto('/journeys');
    await expect(page.getByTestId('journey-link')).toHaveCount(6);
  });
});

test.describe('walking a journey', () => {
  for (const slug of JOURNEYS) {
    test(`${slug} can be walked from its first step to its last`, async ({ page }) => {
      await page.goto(`/journeys/${slug}`);
      await expect(page.getByTestId('journey-step')).toBeVisible();
      await expect(page.getByTestId('step-counter')).toContainText('Step 1 of');

      const total = Number(
        /of (\d+)/.exec(
          (await page.getByTestId('step-counter').textContent()) ?? '',
        )?.[1],
      );
      expect(total).toBeGreaterThanOrEqual(3);

      for (let step = 1; step < total; step += 1) {
        await page.getByTestId('next-step').click();
        await expect(page.getByTestId('step-counter')).toContainText(
          `Step ${step + 1} of ${total}`,
        );
      }
      await expect(page.getByTestId('journey-end')).toBeVisible();
    });
  }
});

test.describe('what a step shows', () => {
  test('gives every named person their dates, or says there are none', async ({
    page,
  }) => {
    await page.goto('/journeys/adam-to-noah');
    const people = page.getByTestId('step-people').locator('li');
    expect(await people.count()).toBeGreaterThan(0);
    for (const row of await people.all()) {
      await expect(row).toContainText(/AM|No dates in this chronology/);
    }
  });

  test('says when a woman in the account has no dates, rather than leaving her out', async ({
    page,
  }) => {
    await page.goto('/journeys/isaac-and-jacob?step=3');
    await expect(
      page.getByTestId('step-people').locator('[data-undated="true"]').first(),
    ).toContainText('No dates in this chronology');
  });

  test('links a step question through to the game that asks it', async ({ page }) => {
    await page.goto('/journeys/adam-to-noah?step=2');
    await page.getByTestId('step-question-link').click();
    await expect(page).toHaveURL(/\/games\/.+\?seed=/);
    await expect(page.getByTestId('question')).toBeVisible();
  });

  test('a step out of range lands on a real step rather than an error', async ({
    page,
  }) => {
    const response = await page.goto('/journeys/adam-to-noah?step=99');
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('step-counter')).toContainText('Step 4 of 4');

    await page.goto('/journeys/adam-to-noah?step=not-a-number');
    await expect(page.getByTestId('step-counter')).toContainText('Step 1 of 4');
  });
});

test.describe('it reads without scripting', () => {
  test('a journey can be walked with JavaScript switched off', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/journeys/adam-to-noah');
    await expect(page.getByTestId('journey-step')).toBeVisible();
    await page.getByTestId('next-step').click();
    await expect(page.getByTestId('step-counter')).toContainText('Step 2 of 4');
    await context.close();
  });
});

test.describe('accessibility', () => {
  test('axe reports no violations', async ({ page }) => {
    const AxeBuilder = (await import('@axe-core/playwright')).default;
    await page.goto('/journeys/noah-to-abraham?step=2');
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  test('never prints a missing value as a value', async ({ page }) => {
    for (const slug of JOURNEYS) {
      await page.goto(`/journeys/${slug}`);
      const body = (await page.locator('main').textContent()) ?? '';
      expect(body, slug).not.toMatch(/\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b/);
    }
  });
});
