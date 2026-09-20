import { expect, test, type Page } from '@playwright/test';

/**
 * The Phase 5 exit gate, as executable assertions.
 *
 * These check properties a screenshot cannot: that nothing overflows the
 * viewport at the narrowest width anyone actually uses, that a keyboard
 * reaches every control and can see where it is, and that the pages that are
 * not built yet say so rather than erroring.
 */
const WIDTHS = [320, 375, 390, 430, 1280];

const ROUTES = [
  '/',
  '/timeline',
  '/who-was-alive',
  '/people',
  '/family-tree',
  '/compare',
  '/events',
  '/discover',
  '/chronology',
  '/about',
];

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('layout holds at every width', () => {
  for (const width of WIDTHS) {
    test(`no horizontal scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ROUTES) {
        await page.goto(route);
        expect(
          await horizontalOverflow(page),
          `${route} overflows horizontally at ${width}px`,
        ).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe('every route renders its own page', () => {
  for (const route of ROUTES) {
    test(`${route} has exactly one h1 and a title`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page).toHaveTitle(/\w/);
    });
  }

  test('an unknown address gets the not-found page, not a crash', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'nothing at this address',
    );
  });
});

test.describe('keyboard access', () => {
  test('the skip link is the first stop and moves focus to the content', async ({
    page,
  }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('every interactive element can be reached by tabbing', async ({ page }) => {
    await page.goto('/');

    const interactive = await page
      .locator('a[href], button:not([disabled])')
      .filter({ has: page.locator(':visible') })
      .count();

    const reached = new Set<string>();
    for (let i = 0; i < interactive + 30; i += 1) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return `${el.tagName}:${el.textContent?.trim().slice(0, 40) ?? ''}`;
      });
      if (id) reached.add(id);
    }

    expect(reached.size).toBeGreaterThanOrEqual(interactive);
  });

  test('focus is visible, not suppressed', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const outline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });

    expect(outline?.outlineStyle).not.toBe('none');
    expect(parseFloat(outline?.outlineWidth ?? '0')).toBeGreaterThan(0);
  });
});

test.describe('the mobile menu', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens, reports its state, and navigates', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'People' })
      .click();
    await expect(page).toHaveURL(/\/people$/);
  });
});

test.describe('touch targets', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /**
   * Standalone controls only. WCAG 2.5.8 exempts a link sitting inside a
   * sentence, because enlarging it would break the line it belongs to, and
   * the rest of the sentence is not a target. Applying the exemption is not
   * the same as lowering the bar: an inline link is excluded here and a nav
   * link, a button or a card is not.
   */
  test('every standalone control is at least 44px tall', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();

    const undersized = await page.evaluate(() => {
      const selector = 'header a[href], header button, main a[href], main button';
      return [...document.querySelectorAll(selector)]
        .filter((el) => el.parentElement?.tagName !== 'P')
        .map((el) => ({
          text: el.textContent?.trim().slice(0, 40) ?? '',
          height: Math.round(el.getBoundingClientRect().height),
        }))
        .filter((control) => control.height > 0 && control.height < 44);
    });

    expect(undersized).toEqual([]);
  });

  test('inline links in prose are still large enough to read and hit', async ({
    page,
  }) => {
    await page.goto('/');
    const inline = page.locator('main p a[href]').first();
    const box = await inline.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
  });
});

test.describe('installability', () => {
  test('serves a manifest with the icons it names', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest',
    );

    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(
      manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable'),
    ).toBe(true);

    for (const icon of manifest.icons) {
      const response = await request.get(icon.src);
      expect(response.status(), `${icon.src} is missing`).toBe(200);
    }
  });

  test('the service worker never caches data requests', async ({ request }) => {
    const source = await (await request.get('/sw.js')).text();
    expect(source).toContain("url.pathname.startsWith('/api/')");
  });
});
