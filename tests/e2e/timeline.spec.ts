import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The Phase 7 exit gate.
 *
 * The gate names desktop, tablet, mobile, touch and keyboard, a reduced
 * motion check, and axe reporting no violations on this route. Each of
 * those is a separate assertion below, because "it looked fine" is the
 * failure mode this phase was called the highest-risk one for.
 */
const CHART = '[data-testid="timeline-chart"]';

async function viewport(page: Page): Promise<string> {
  return (await page.getByTestId('viewport').textContent()) ?? '';
}

/**
 * Focus the chart, retrying until it takes.
 *
 * Workers running in parallel share a display, so a focus call can land in
 * a window that is not the active one. Retrying is the honest fix: the
 * assertion under test is what the keyboard does once focus is there, not
 * whether the first focus call wins the race.
 */
async function focusChart(page: Page): Promise<void> {
  await expect(async () => {
    await page.locator(CHART).focus();
    await expect(page.locator(CHART)).toBeFocused();
  }).toPass({ timeout: 10_000 });
}

test.describe('accessibility', () => {
  test('axe reports no violations', async ({ page }) => {
    await page.goto('/timeline');
    await expect(page.getByRole('list', { name: /Lifetimes/ })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(
      results.violations.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.map((node) => node.target.join(' ')),
      })),
    ).toEqual([]);
  });

  test('axe still reports none once a lifetime is selected', async ({ page }) => {
    await page.goto('/timeline');
    await page.getByRole('button', { name: /^Adam/ }).click();
    await expect(page.getByRole('status')).toContainText('alive in the same years');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test('the chart is hidden from assistive technology and the list is not', async ({
    page,
  }) => {
    await page.goto('/timeline');
    await expect(page.getByRole('list', { name: /Lifetimes/ })).toBeVisible();
    await expect(page.locator(`${CHART} svg`)).toHaveAttribute('aria-hidden', 'true');
    // Everyone drawn as a bar is also a row in the list, so nothing is
    // available only to people who can see the chart.
    const rows = await page
      .getByRole('list', { name: /Lifetimes/ })
      .getByRole('listitem')
      .count();
    expect(rows).toBeGreaterThan(0);
    await expect(page.locator('[data-testid="bar"]')).toHaveCount(rows);
  });
});

test.describe('the timeline renders the dataset', () => {
  test('draws a bar for every dated lifetime and none for the undated', async ({
    page,
  }) => {
    await page.goto('/timeline');
    // 26 of the 49 people have a birth year, and 25 of those also have an
    // end to draw to. Esau has a birth year and neither a death nor a
    // lifespan, so he is named in the prose instead of guessed at.
    await expect(page.locator('[data-testid="bar"]')).toHaveCount(25);
    await expect(page.getByRole('status')).toContainText('25 of 25 dated lifetimes');
    await expect(page.getByText(/23 more people/)).toBeVisible();
    await expect(
      page.getByText(/Esau has a birth year but no recorded death/),
    ).toBeVisible();
  });

  test('marks the dated events and leaves the undated ones off', async ({ page }) => {
    await page.goto('/timeline');
    const events = page.getByRole('list', { name: /Dated events/ });
    await expect(events.getByText('The Flood')).toBeVisible();
    // Genesis 10:25 gives an era, not a year, so Babel has no place on an axis.
    await expect(events.getByText('The Tower of Babel')).toHaveCount(0);
  });

  test('never prints a missing number as a number', async ({ page }) => {
    await page.goto('/timeline');
    const body = (await page.locator('main').textContent()) ?? '';
    expect(body).not.toMatch(/\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b/);
  });
});

test.describe('selection', () => {
  test('reports who was alive at the same time, and says it is not a meeting', async ({
    page,
  }) => {
    await page.goto('/timeline');
    await page.getByRole('button', { name: /^Adam/ }).click();

    const status = page.getByRole('status');
    await expect(status).toContainText(/\d+ other dated lifetimes overlap this one/);
    await expect(status).toContainText('not that they met');
    await expect(status.getByRole('link', { name: /Adam/ })).toHaveAttribute(
      'href',
      '/people/adam',
    );
  });

  test('agrees with the chronology page that Noah and Abraham never overlap', async ({
    page,
  }) => {
    await page.goto('/timeline');
    await page.getByRole('button', { name: /^Noah/ }).click();
    // Under the 130-year default, Noah dies in 2006 AM and Abraham is born
    // in 2008. The two views of one fact must not disagree.
    const abraham = page.getByRole('button', { name: /^Abraham/ });
    await expect(abraham).toHaveAttribute('aria-pressed', 'false');
    await expect(abraham).not.toHaveClass(/surface-overlay/);
  });

  test('clears with the button and with Escape', async ({ page }) => {
    await page.goto('/timeline');
    const adam = page.getByRole('button', { name: /^Adam/ });

    await adam.click();
    await page.getByRole('button', { name: 'Clear selection' }).click();
    await expect(adam).toHaveAttribute('aria-pressed', 'false');

    await adam.click();
    await focusChart(page);
    await page.keyboard.press('Escape');
    await expect(adam).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('keyboard control', () => {
  test('the chart is reachable by tabbing and pans and zooms from the keys', async ({
    page,
  }) => {
    await page.goto('/timeline');

    await focusChart(page);

    const full = await viewport(page);

    // Panning at full extent is a no-op, because there is nothing either
    // side of the data to pan into.
    await page.keyboard.press('ArrowRight');
    expect(await viewport(page)).toBe(full);

    await page.keyboard.press('+');
    const zoomed = await viewport(page);
    expect(zoomed).not.toBe(full);

    await page.keyboard.press('ArrowRight');
    const panned = await viewport(page);
    expect(panned).not.toBe(zoomed);

    await page.keyboard.press('-');
    expect(await viewport(page)).not.toBe(panned);

    await page.keyboard.press('Home');
    expect(await viewport(page)).toBe(full);
  });

  test('the zoom buttons say what they do, not just what they look like', async ({
    page,
  }) => {
    await page.goto('/timeline');
    for (const name of [
      'Zoom in',
      'Zoom out',
      'Pan earlier',
      'Pan later',
      'Show the whole span',
    ]) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
  });

  test('the view never leaves the data behind', async ({ page }) => {
    await page.goto('/timeline');
    await focusChart(page);
    for (let i = 0; i < 25; i += 1) await page.keyboard.press('ArrowLeft');

    // Panned hard against the start, the earliest year is still in view and
    // at least one bar is still drawn.
    expect(await viewport(page)).toContain('0');
    expect(await page.locator('[data-testid="bar"]').count()).toBeGreaterThan(0);
  });
});

test.describe('filters', () => {
  test('finds one person and repacks the chart around them', async ({ page }) => {
    await page.goto('/timeline');
    await page.getByLabel('Find a name').fill('Methuselah');

    await expect(page.locator('[data-testid="bar"]')).toHaveCount(1);
    await expect(page.getByRole('status')).toContainText('1 of 25');
    // The surviving bar sits in the first lane, not where it was before.
    await expect(page.locator('[data-testid="bar"]')).toHaveAttribute('y', '28');
  });

  test('says so plainly when nothing matches', async ({ page }) => {
    await page.goto('/timeline');
    await page.getByLabel('Find a name').fill('Melchizedek of Nowhere');
    await expect(
      page.getByText('No one on the timeline matches that name.'),
    ).toBeVisible();
  });

  test('hides the events on request', async ({ page }) => {
    await page.goto('/timeline');
    await page.getByLabel('Show dated events').uncheck();
    await expect(page.getByRole('list', { name: /Dated events/ })).toHaveCount(0);
  });
});

test.describe('responsive and touch', () => {
  for (const [label, width] of [
    ['mobile', 320],
    ['phone', 390],
    ['tablet', 768],
    ['desktop', 1280],
  ] as const) {
    test(`fits and stays usable at ${label} width`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/timeline');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflows at ${width}px`).toBeLessThanOrEqual(1);

      // The chart resizes to the column rather than keeping the width it
      // was server-rendered at. The poll is because the measurement is made
      // by a ResizeObserver, one frame after hydration.
      await expect
        .poll(async () => (await page.locator(`${CHART} svg`).boundingBox())?.width ?? 0)
        .toBeGreaterThan(0);

      const box = await page.locator(`${CHART} svg`).boundingBox();
      expect(box?.width ?? 0).toBeLessThanOrEqual(width);
    });
  }

  test('every control on this page is a real touch target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/timeline');

    /**
     * A checkbox is measured by the label wrapping it, because that whole
     * label is the target: tapping the words toggles the box. Measuring the
     * 20px box alone would report a failure a user cannot experience.
     */
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

test.describe('reduced motion', () => {
  test('the bars animate normally, and not at all when motion is reduced', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/timeline');
    const moving = await page
      .locator('[data-testid="bar"]')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(moving)).toBeGreaterThan(0.05);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/timeline');
    const still = await page
      .locator('[data-testid="bar"]')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(still)).toBeLessThan(0.01);
  });
});

test.describe('touch input', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('a tap selects a lifetime, without a hover state to depend on', async ({
    page,
  }) => {
    await page.goto('/timeline');
    await page.getByRole('button', { name: /^Adam/ }).tap();
    await expect(page.getByRole('status')).toContainText('Adam');
    await expect(page.getByRole('button', { name: /^Adam/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
