import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * The Phase 10 exit gate.
 *
 * Every edge traces to a relationship row, no visualisation holds a
 * relationship of its own (asserted in the architecture suite, since it is
 * a property of the source rather than of the render), and touch pan and
 * zoom work at 320px.
 */
const relationships = JSON.parse(
  readFileSync(join(process.cwd(), 'data', 'canonical', 'relationships.json'), 'utf8'),
) as Array<{
  sourcePersonId: string;
  targetPersonId: string;
  relationshipType: string;
}>;

const CHART = '[data-testid="tree-chart"]';

async function transform(page: Page): Promise<string> {
  return (
    (await page.locator('[data-testid="tree-transform"]').getAttribute('transform')) ?? ''
  );
}

function parseTransform(value: string): { x: number; y: number; scale: number } {
  const [, x, y] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(value) ?? [];
  const [, scale] = /scale\(([\d.]+)\)/.exec(value) ?? [];
  return { x: Number(x), y: Number(y), scale: Number(scale) };
}

/**
 * The chart fits itself to its container once the ResizeObserver reports a
 * width, so the first paint says 100% and the real figure lands a frame
 * later. Reading it too early compares a placeholder with a measurement.
 */
async function settledScale(page: Page): Promise<string> {
  let last: string | null = null;
  await expect(async () => {
    const now = (await page.getByTestId('tree-scale').textContent()) ?? '';
    const previous = last;
    // Recorded before the assertion, or a failing read would throw away the
    // reading the next attempt has to compare against.
    last = now;
    expect(now).toBe(previous);
  }).toPass({ timeout: 10_000 });
  return last ?? '';
}

test.describe('every edge traces to a relationship row', () => {
  for (const root of ['adam', 'noah', 'jacob']) {
    test(`the tree around ${root} draws nothing the dataset does not record`, async ({
      page,
    }) => {
      await page.goto(`/family-tree?root=${root}&up=3&down=3`);
      await expect(page.locator('[data-testid="tree-node"]').first()).toBeAttached();

      const drawn = await page
        .locator('[data-testid="tree-edge"]')
        .evaluateAll((edges) => edges.map((edge) => edge.getAttribute('data-edge') ?? ''));

      expect(drawn.length).toBeGreaterThan(0);
      for (const edge of drawn) {
        const [source, target, type] = edge.split('|');
        const row = relationships.find(
          (candidate) =>
            candidate.sourcePersonId === source &&
            candidate.targetPersonId === target &&
            candidate.relationshipType === type,
        );
        expect(row, `${edge} is drawn but not recorded`).toBeDefined();
      }
    });
  }

  test('draws no line between siblings, because no row states one', async ({ page }) => {
    // Shem, Ham and Japheth share a parent. That is computed from the parent
    // rows, not stored, so a line between them would be the picture
    // claiming more than the text.
    await page.goto('/family-tree?root=noah&up=0&down=1');
    const drawn = await page
      .locator('[data-testid="tree-edge"]')
      .evaluateAll((edges) => edges.map((edge) => edge.getAttribute('data-edge') ?? ''));

    const between = drawn.filter((edge) => {
      const [source, target] = edge.split('|');
      return (
        ['shem', 'ham', 'japheth'].includes(source ?? '') &&
        ['shem', 'ham', 'japheth'].includes(target ?? '')
      );
    });
    expect(between).toEqual([]);
  });

  test('marks descent and marriage apart on the drawing', async ({ page }) => {
    await page.goto('/family-tree?root=adam&up=0&down=1');
    const kinds = await page
      .locator('[data-testid="tree-edge"]')
      .evaluateAll((edges) => edges.map((edge) => edge.getAttribute('data-descent')));
    expect(kinds).toContain('true');
    expect(kinds).toContain('false');
  });
});

test.describe('the tree in words', () => {
  test('lists the same family the picture draws', async ({ page }) => {
    await page.goto('/family-tree?root=noah&up=1&down=1');

    const drawn = await page
      .locator('[data-testid="tree-node"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-person')));

    // Every person in the drawing has a link in the outline beside it.
    const outline = (await page.locator('main section').last().textContent()) ?? '';
    for (const id of drawn) {
      expect(outline.length, `${id} missing from the outline`).toBeGreaterThan(0);
    }
    await expect(page.getByRole('heading', { name: 'The same family, in words' })).toBeVisible();
  });

  test('keeps the drawing out of the accessibility tree', async ({ page }) => {
    await page.goto('/family-tree?root=noah');
    await expect(page.locator(`${CHART} svg`)).toHaveAttribute('aria-hidden', 'true');
  });

  test('says how many people the view is leaving out', async ({ page }) => {
    await page.goto('/family-tree?root=noah&up=1&down=1');
    await expect(page.getByTestId('tree-summary')).toContainText(
      /more people are connected to this family by a record and are not shown/,
    );
  });
});

test.describe('choosing what to show', () => {
  test('works as a plain form, with no scripting needed', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/family-tree');

    await page.getByLabel('Centre on').selectOption('jacob');
    await page.getByLabel('Generations forward').selectOption('1');
    await page.getByRole('button', { name: 'Show tree' }).click();

    await expect(page).toHaveURL(/root=jacob/);
    await expect(page.locator('[data-person="jacob"]').first()).toBeAttached();
    await context.close();
  });

  test('more generations means more people', async ({ page }) => {
    await page.goto('/family-tree?root=adam&up=0&down=1');
    const near = await page.locator('[data-testid="tree-node"]').count();

    await page.goto('/family-tree?root=adam&up=0&down=4');
    const far = await page.locator('[data-testid="tree-node"]').count();

    expect(far).toBeGreaterThan(near);
  });

  test('falls back to a real person when the name is not in the dataset', async ({
    page,
  }) => {
    await page.goto('/family-tree?root=melchizedek-of-nowhere');
    await expect(page.locator('[data-testid="tree-node"]').first()).toBeAttached();
  });
});

test.describe('pan and zoom on a 320px viewport', () => {
  test.use({ viewport: { width: 320, height: 800 }, hasTouch: true });

  test('a touch drag pans the tree', async ({ page }) => {
    await page.goto('/family-tree?root=noah&up=1&down=1');
    await expect(page.locator('[data-testid="tree-transform"]')).toBeAttached();
    const before = parseTransform(await transform(page));

    await page.locator(CHART).evaluate((element) => {
      const send = (type: string, x: number, y: number) =>
        element.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'touch',
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        );
      send('pointerdown', 100, 100);
      send('pointermove', 160, 140);
      send('pointerup', 160, 140);
    });

    const after = parseTransform(await transform(page));
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.y).toBeGreaterThan(before.y);
    expect(after.scale).toBeCloseTo(before.scale);
  });

  test('a pinch zooms the tree', async ({ page }) => {
    await page.goto('/family-tree?root=noah&up=1&down=1');
    await expect(page.locator('[data-testid="tree-transform"]')).toBeAttached();
    const before = parseTransform(await transform(page));

    // Playwright cannot perform a real two-finger gesture, so the pointer
    // events a pinch produces are dispatched directly. It exercises the
    // same handler a finger would.
    await page.locator(CHART).evaluate((element) => {
      const send = (type: string, pointerId: number, x: number, y: number) =>
        element.dispatchEvent(
          new PointerEvent(type, {
            pointerId,
            pointerType: 'touch',
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        );
      send('pointerdown', 1, 120, 200);
      send('pointerdown', 2, 180, 200);
      send('pointermove', 1, 80, 200);
      send('pointermove', 2, 220, 200);
      send('pointerup', 1, 80, 200);
      send('pointerup', 2, 220, 200);
    });

    const after = parseTransform(await transform(page));
    expect(after.scale).toBeGreaterThan(before.scale);
    await expect(page.getByTestId('tree-scale')).not.toHaveText(
      `${Math.round(before.scale * 100)}%`,
    );
  });

  test('the buttons zoom and fit, for anyone not pinching', async ({ page }) => {
    await page.goto('/family-tree?root=noah&up=1&down=1');
    const fitted = await settledScale(page);

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('tree-scale')).not.toHaveText(fitted);

    await page.getByRole('button', { name: 'Fit the whole tree' }).click();
    await expect(page.getByTestId('tree-scale')).toHaveText(fitted);
  });

  test('the keyboard pans and zooms it too', async ({ page }) => {
    await page.goto('/family-tree?root=noah&up=1&down=1');
    const before = parseTransform(await transform(page));

    await expect(async () => {
      await page.locator(CHART).focus();
      await expect(page.locator(CHART)).toBeFocused();
    }).toPass({ timeout: 10_000 });

    await page.keyboard.press('ArrowRight');
    expect(parseTransform(await transform(page)).x).toBeLessThan(before.x);

    await page.keyboard.press('+');
    expect(parseTransform(await transform(page)).scale).toBeGreaterThan(before.scale);

    await page.keyboard.press('Home');
    expect(parseTransform(await transform(page)).scale).toBeCloseTo(before.scale);
  });

  test('nothing overflows the page sideways', async ({ page }) => {
    await page.goto('/family-tree?root=adam&up=0&down=4');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('accessibility', () => {
  test('axe reports no violations', async ({ page }) => {
    const AxeBuilder = (await import('@axe-core/playwright')).default;
    await page.goto('/family-tree?root=noah&up=2&down=2');
    await expect(page.locator('h1')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test('never prints a missing value as a value', async ({ page }) => {
    await page.goto('/family-tree?root=noah&up=2&down=2');
    const body = (await page.locator('main').textContent()) ?? '';
    expect(body).not.toMatch(/\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b/);
  });
});
