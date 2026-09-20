import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * The Phase 6 exit gate.
 *
 * "No profile renders a chronology value without its confidence and source"
 * is a claim about all 49 pages, so it is checked on all 49 pages rather
 * than on a representative sample. The undated people are the important
 * half: a page that renders blank for them would pass a test that only
 * looked at Adam.
 */
const people = JSON.parse(
  readFileSync(join(process.cwd(), 'data', 'canonical', 'people.json'), 'utf8'),
) as Array<{ id: string; slug: string; canonicalName: string }>;

const derived = JSON.parse(
  readFileSync(
    join(process.cwd(), 'data', 'generated', 'person-chronology.masoretic.json'),
    'utf8',
  ),
) as Array<{
  personId: string;
  birthYear: number | null;
  deathYear: number | null;
  lifespan: number | null;
  derivation: { result: number } | null;
}>;

const byId = new Map(derived.map((record) => [record.personId, record]));

test.describe('every profile page', () => {
  for (const person of people) {
    test(`${person.slug} states its confidence and its sources`, async ({ page }) => {
      const response = await page.goto(`/people/${person.slug}`);
      expect(response?.status()).toBe(200);

      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        person.canonicalName,
      );

      const record = byId.get(person.id);
      const hasAnyValue =
        record !== undefined &&
        (record.birthYear !== null ||
          record.deathYear !== null ||
          record.lifespan !== null);

      const body = (await page.locator('main').textContent()) ?? '';

      // Requirement section 57, asserted on the rendered page rather than
      // on the engine that feeds it.
      expect(body).not.toMatch(/\bNaN\b|\bundefined\b|\bnull\b/);

      if (hasAnyValue) {
        // A dated profile must carry a confidence word beside the dates.
        await expect(page.getByText('Dates', { exact: true })).toBeVisible();
        expect(body).toMatch(/Stated|Derived|Approximate|Disputed|Unknown/);
        // And it must say where the numbers came from.
        expect(body).toMatch(/Sources:/);
      } else {
        // The undated people get a plain statement, not an empty page.
        await expect(
          page.getByText(`Scripture gives no ages for ${person.canonicalName}`),
        ).toBeVisible();
      }
    });
  }
});

test.describe('every derived year shows its working', () => {
  const withDerivations = people.filter((p) => byId.get(p.id)?.derivation);

  for (const person of withDerivations) {
    test(`${person.slug} can explain its birth year`, async ({ page }) => {
      await page.goto(`/people/${person.slug}`);

      const why = page.getByText('Why this date?');
      await expect(why).toBeVisible();
      await why.click();

      const record = byId.get(person.id);
      // The working has to end on the number printed above it. A derivation
      // that explains a different year is the failure this feature exists
      // to make impossible.
      await expect(page.locator('details[open] ol li').last()).toContainText(
        String(record?.derivation?.result),
      );
      await expect(page.locator('details[open]')).toContainText(
        'What this calculation assumes',
      );
    });
  }
});

test.describe('the directory', () => {
  test('lists everyone, including the people with no ages', async ({ page }) => {
    await page.goto('/people');
    await expect(page.getByRole('status')).toContainText(`of ${people.length} people`);
    await expect(page.getByText('Scripture gives no ages').first()).toBeVisible();
  });

  test('finds a person by a name they no longer go by', async ({ page }) => {
    await page.goto('/people');
    await page.getByRole('searchbox').fill('Abram');
    await expect(page.getByRole('link', { name: /Abraham/ })).toBeVisible();
  });

  test('can hide the people Scripture gives no ages for', async ({ page }) => {
    await page.goto('/people');
    const before = await page.getByRole('status').textContent();
    await page.getByLabel('Only people with dates').check();
    await expect(page.getByRole('status')).not.toHaveText(before ?? '');
    await expect(page.getByText('Scripture gives no ages')).toHaveCount(0);
  });

  test('says so plainly when nothing matches', async ({ page }) => {
    await page.goto('/people');
    await page.getByRole('searchbox').fill('Melchizedek of Nowhere');
    await expect(page.getByText(/No one in this dataset matches/)).toBeVisible();
  });
});
