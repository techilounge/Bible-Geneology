import { expect, test, type Page } from '@playwright/test';
import { CONNECTION_IS_NOT_A_ROUTE, NOT_CONTACT } from '@/lib/config/copy';

/**
 * The Phase 9 exit gate.
 *
 * Two things are being checked, and the second matters more than the first.
 * One: every golden comparison pair gives the right answer through the page,
 * not only through the engine. Two: no wording on the page turns a
 * chronological overlap into a claim that two people met.
 */
const url = (a: string, b: string) => `/compare?a=${a}&b=${b}`;

/**
 * The route is dynamic, so Next streams it in behind a loading state.
 * Waiting for the verdict is waiting for the real page: without it a test
 * can read the placeholder and pass or fail for the wrong reason.
 */
async function open(page: Page, a: string, b: string): Promise<void> {
  await page.goto(url(a, b));
  await expect(page.getByTestId('verdict')).toBeVisible();
}

async function verdict(page: Page): Promise<string> {
  return (await page.getByTestId('verdict').textContent()) ?? '';
}

/**
 * The immutable assertions from docs/TESTING_STRATEGY.md section 3, run
 * through the UI. Numbers here are the golden ones; changing any of them
 * needs the written justification that document requires.
 */
const OVERLAPPING: Array<[string, string, number]> = [
  ['adam', 'methuselah', 243],
  ['adam', 'lamech', 56],
  ['methuselah', 'noah', 600],
  ['shem', 'abraham', 150],
  ['shem', 'isaac', 50],
  ['terah', 'abraham', 75],
];

const NOT_OVERLAPPING: Array<[string, string]> = [
  ['adam', 'noah'],
  ['noah', 'abraham'],
  ['shem', 'jacob'],
];

test.describe('golden comparison pairs, through the page', () => {
  for (const [a, b, years] of OVERLAPPING) {
    test(`${a} and ${b} overlap by ${years} years`, async ({ page }) => {
      await open(page, a, b);
      expect(await verdict(page)).toContain(`${years} years`);
      expect(await verdict(page)).toContain('both were alive at the same time');
    });
  }

  for (const [a, b] of NOT_OVERLAPPING) {
    test(`${a} and ${b} do not overlap`, async ({ page }) => {
      await open(page, a, b);
      const text = await verdict(page);
      expect(text).not.toContain('both were alive at the same time');
      expect(text).toMatch(/^No\.|One life ends in the very year/);
    });
  }

  test('Terah and Abraham come out at exactly 75, the derivation self-check', async ({
    page,
  }) => {
    // The 130-year offset was derived as Terah's 205 minus Abraham's 75 at
    // the departure from Haran, so this overlap must come back out at 75.
    await open(page, 'terah', 'abraham');
    expect(await verdict(page)).toContain('75 years');
  });

  test('Noah and Abraham miss each other by two years', async ({ page }) => {
    await open(page, 'noah', 'abraham');
    expect(await verdict(page)).toContain('2 years apart');
  });
});

test.describe('overlap is never turned into contact', () => {
  /**
   * Phrases that cannot appear in a correct sentence on this page. The bare
   * phrase "they met" is deliberately not on the list: the page's own
   * disclaimer contains it, inside a negation, and a test that banned the
   * substring would ban the sentence doing the work.
   */
  const FORBIDDEN = [
    /\bmust have (met|known)\b/i,
    /\bwould have (met|known|spoken)\b/i,
    /\bcertainly met\b/i,
    /\bdid meet\b/i,
    /\bknew each other\b/i,
    /\bwere acquainted\b/i,
    /\bhanded (it )?down to\b/i,
    /\bpassed (it )?(down|on) to\b/i,
    /\btaught (him|her|them)\b/i,
  ];

  const PAIRS = [...OVERLAPPING.map(([a, b]) => [a, b]), ...NOT_OVERLAPPING];

  for (const [a, b] of PAIRS) {
    test(`${a} and ${b}: no string claims contact`, async ({ page }) => {
      await open(page, a as string, b as string);
      const body = (await page.locator('main').textContent()) ?? '';

      const offenders = FORBIDDEN.filter((pattern) => pattern.test(body)).map(
        (pattern) => pattern.source,
      );
      expect(offenders).toEqual([]);

      // And the sentence that does the work is on the page, every time.
      expect(body).toContain(NOT_CONTACT);
    });
  }

  test('the lifetime connection chain is labelled as not a route', async ({ page }) => {
    await open(page, 'noah', 'abraham');
    await expect(page.getByTestId('connection-chain')).toContainText('Shem');
    await expect(page.getByText(CONNECTION_IS_NOT_A_ROUTE)).toBeVisible();
  });
});

/*
 * The same-year boundary case — one life ending in the very year another
 * begins — has its own message, asserted in
 * components/compare/ComparisonResult.test.tsx. No pair in the real dataset
 * produces it, so testing it here would mean inventing a person, and an
 * invented person in the canonical data is the one thing this project must
 * not do.
 */

test.describe('picking two people', () => {
  test('asks for two names before it answers anything', async ({ page }) => {
    await page.goto('/compare');
    await expect(page.getByText('Choose two people from the lists above.')).toBeVisible();
    await expect(page.getByTestId('verdict')).toHaveCount(0);
  });

  test('works as a plain form, with no scripting needed', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/compare');

    await page.getByLabel('First person').selectOption('noah');
    await page.getByLabel('Second person').selectOption('abraham');
    await page.getByRole('button', { name: 'Compare' }).click();

    await expect(page).toHaveURL(/a=noah&b=abraham/);
    await expect(page.getByTestId('verdict')).toContainText('2 years apart');
    await context.close();
  });

  test('says so plainly when a name is not in the dataset', async ({ page }) => {
    await page.goto('/compare?a=noah&b=melchizedek-of-nowhere');
    await expect(page.getByText(/not in this dataset/)).toBeVisible();
  });

  test('refuses to compare someone with themselves', async ({ page }) => {
    await page.goto('/compare?a=noah&b=noah');
    await expect(page.getByText('That is the same person twice.')).toBeVisible();
  });

  test('says it cannot tell when one of them has no recorded death', async ({ page }) => {
    // Enoch has a lifespan and no death year, so no overlap involving him
    // is computable. Substituting a death to tidy the chart is what
    // requirement section 7 forbids.
    await open(page, 'enoch', 'adam');
    expect(await verdict(page)).toContain('cannot say');
  });
});

test.describe('the rest of the comparison', () => {
  test('gives ages, lifespans, relationship and sources', async ({ page }) => {
    await open(page, 'methuselah', 'noah');
    const body = (await page.locator('main').textContent()) ?? '';

    expect(body).toContain('369');
    expect(body).toContain('Lifespans');
    expect(body).toContain('How they are related');
    expect(body).toContain('Genesis');
  });

  test('never prints a missing number as a number', async ({ page }) => {
    for (const [a, b] of [...OVERLAPPING.map(([x, y]) => [x, y]), ['enoch', 'adam']]) {
      await open(page, a as string, b as string);
      const body = (await page.locator('main').textContent()) ?? '';
      expect(body, `${a} and ${b}`).not.toMatch(
        /\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b/,
      );
    }
  });

  test('axe reports no violations', async ({ page }) => {
    const AxeBuilder = (await import('@axe-core/playwright')).default;
    await open(page, 'noah', 'abraham');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
