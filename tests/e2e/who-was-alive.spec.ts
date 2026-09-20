import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { buildDataset, getPeopleAliveAtYear } from '@/lib/chronology';
import type { Person, PersonChronology } from '@/lib/domain';

/**
 * The Phase 8 exit gate.
 *
 * "Every displayed value comes from the engine" is not a claim a screenshot
 * can settle, so this compares the rendered list against the engine's own
 * answer, year by year. The engine is the one under test everywhere else;
 * here it is the oracle, and the page is what has to agree with it.
 */
const read = <T>(dir: string, name: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), 'data', dir, name), 'utf8')) as T;

const dataset = buildDataset({
  chronologyId: 'masoretic',
  people: read<Person[]>('canonical', 'people.json'),
  chronology: read<PersonChronology[]>('generated', 'person-chronology.masoretic.json'),
  relationships: [],
});

/**
 * A spread across the whole range, plus the boundaries that the half-open
 * interval makes interesting: the year Noah dies (2006) and the year
 * Abraham is born (2008), the flood (1656), and both ends of the span.
 */
const SAMPLE_YEARS = [
  0, 1, 130, 687, 1055, 1056, 1656, 2006, 2007, 2008, 2083, 2259, 2315, 2369,
];

async function renderedIds(page: Page): Promise<string[]> {
  return (
    await page
      .locator('[data-testid="living-list"] li')
      .evaluateAll((items) => items.map((item) => item.getAttribute('data-person') ?? ''))
  ).sort();
}

function engineIds(year: number): string[] {
  return getPeopleAliveAtYear(dataset, year)
    .map((person) => person.personId)
    .sort();
}

test.describe('parity with the chronology engine', () => {
  for (const year of SAMPLE_YEARS) {
    test(`the page and the engine agree about ${year} AM`, async ({ page }) => {
      await page.goto(`/who-was-alive?year=${year}`);
      await expect(page.getByTestId('living-heading')).toContainText(`${year} AM`);
      expect(await renderedIds(page)).toEqual(engineIds(year));
    });
  }

  test('the count in the heading is the length of the list', async ({ page }) => {
    await page.goto('/who-was-alive?year=1656');
    const expected = engineIds(1656);
    await expect(page.getByTestId('living-heading')).toContainText(
      `${expected.length} people alive in 1656 AM`,
    );
    expect(await renderedIds(page)).toHaveLength(expected.length);
  });

  test('still agrees after the year is changed in the browser', async ({ page }) => {
    // The server rendered one year; the slider is now driving. Both paths
    // call the same engine, and this is what proves it.
    await page.goto('/who-was-alive?year=0');
    for (const year of [1056, 1656, 2008]) {
      await page.getByLabel(`Year (AM)`).fill(String(year));
      await expect(page.getByTestId('living-heading')).toContainText(`${year} AM`);
      expect(await renderedIds(page)).toEqual(engineIds(year));
    }
  });
});

test.describe('the half-open rule, on the page', () => {
  test('someone born in the chosen year is alive at nought', async ({ page }) => {
    await page.goto('/who-was-alive?year=1056');
    const noah = page.locator('[data-testid="living-list"] [data-person="noah"]');
    await expect(noah).toBeVisible();
    await expect(noah).toContainText('aged 0');
  });

  test('someone who dies in the chosen year is not listed', async ({ page }) => {
    // Noah dies in 2006 AM, so 2006 is not a year he was alive.
    await page.goto('/who-was-alive?year=2006');
    await expect(
      page.locator('[data-testid="living-list"] [data-person="noah"]'),
    ).toHaveCount(0);

    await page.goto('/who-was-alive?year=2005');
    await expect(
      page.locator('[data-testid="living-list"] [data-person="noah"]'),
    ).toBeVisible();
  });

  test('says who it cannot place at all, rather than leaving them out quietly', async ({
    page,
  }) => {
    await page.goto('/who-was-alive');
    await expect(page.getByText(/more people are named in this dataset/)).toBeVisible();
  });
});

test.describe('the year controls', () => {
  test('opens on the fullest year the chronology knows', async ({ page }) => {
    await page.goto('/who-was-alive');
    const heading = await page.getByTestId('living-heading').textContent();
    const year = Number(/(\d+) AM/.exec(heading ?? '')?.[1]);
    expect(engineIds(year).length).toBeGreaterThan(0);

    // No other year of change holds more people than the one it opens on.
    const better = SAMPLE_YEARS.filter(
      (y) => engineIds(y).length > engineIds(year).length,
    );
    expect(better).toEqual([]);
  });

  test('the slider and the number box drive the same year', async ({ page }) => {
    await page.goto('/who-was-alive?year=1000');

    // Driven from the keyboard, which is how the slider has to work anyway.
    // Retried because workers running in parallel share a display, so the
    // first focus can land in a window that is not the active one.
    await expect(async () => {
      await page.getByLabel('Year, as a slider').press('ArrowRight');
      await expect(page.getByLabel('Year (AM)')).toHaveValue('1001', { timeout: 2000 });
    }).toPass({ timeout: 10_000 });
    await expect(page.getByTestId('living-heading')).toContainText('1001 AM');

    // And back the other way: the box moves the slider.
    await page.getByLabel('Year (AM)').fill('1656');
    await expect(page.getByLabel('Year, as a slider')).toHaveValue('1656');
    await expect(page.getByTestId('living-heading')).toContainText('1656 AM');
  });

  test('jumps to the next year in which anything changes', async ({ page }) => {
    await page.goto('/who-was-alive?year=1656');
    const before = await page.getByLabel('Year (AM)').inputValue();

    await page.getByRole('button', { name: /Next change/ }).click();
    const after = await page.getByLabel('Year (AM)').inputValue();
    expect(Number(after)).toBeGreaterThan(Number(before));

    // And the year it landed on is one where the living set really differs.
    expect(engineIds(Number(after))).not.toEqual(engineIds(Number(before)));
  });

  test('jumps to a dated event', async ({ page }) => {
    await page.goto('/who-was-alive?year=0');
    await page.getByRole('button', { name: /The Flood/ }).click();
    await expect(page.getByTestId('living-heading')).toContainText('1656 AM');
  });

  test('a year outside the range lands on a real year, not an empty page', async ({
    page,
  }) => {
    await page.goto('/who-was-alive?year=99999');
    await expect(page.getByTestId('living-heading')).toContainText('2369 AM');

    await page.goto('/who-was-alive?year=not-a-year');
    await expect(page.getByTestId('living-heading')).toBeVisible();
  });

  test('keeps the chosen year in the address bar, so it can be shared', async ({
    page,
  }) => {
    await page.goto('/who-was-alive?year=0');
    await page.getByLabel('Year (AM)').fill('1656');
    await expect(page.getByTestId('living-heading')).toContainText('1656 AM');
    expect(page.url()).toContain('year=1656');
  });
});

test.describe('the timeline strip follows the year', () => {
  test('draws a rule at the chosen year and moves it', async ({ page }) => {
    await page.goto('/who-was-alive?year=500');
    // A vertical rule has no width, so Playwright reports it as hidden;
    // its presence and its x position are what matter.
    const marker = page.locator('[data-testid="marker-rule"]');
    await expect(marker).toHaveCount(1);
    const at500 = await marker.getAttribute('x1');

    await page.getByLabel('Year (AM)').fill('2000');
    await expect(page.getByTestId('living-heading')).toContainText('2000 AM');
    expect(await marker.getAttribute('x1')).not.toBe(at500);
  });
});

test.describe('accessibility', () => {
  test('axe reports no violations', async ({ page }) => {
    const AxeBuilder = (await import('@axe-core/playwright')).default;
    await page.goto('/who-was-alive?year=1656');
    await expect(page.getByTestId('living-list')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test('never prints a missing number as a number', async ({ page }) => {
    await page.goto('/who-was-alive?year=1656');
    const body = (await page.locator('main').textContent()) ?? '';
    expect(body).not.toMatch(/\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b/);
  });

  test('every control is a real touch target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/who-was-alive?year=1656');

    const undersized = await page.evaluate(() =>
      [...document.querySelectorAll('main button, main input')]
        .filter((el) => el.parentElement?.tagName !== 'P')
        .map((el) => {
          const target = el.closest('label') ?? el;
          return {
            text:
              (target.textContent?.trim().slice(0, 40) || el.getAttribute('type')) ?? '',
            height: Math.round(target.getBoundingClientRect().height),
          };
        })
        .filter((control) => control.height > 0 && control.height < 44),
    );
    expect(undersized).toEqual([]);
  });
});
