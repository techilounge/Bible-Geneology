import { expect, test, type Page } from '@playwright/test';

/**
 * The Phase 12 exit gate, in a browser.
 *
 * The engine-level proof that every answer is the engine's answer lives
 * in tests/golden/quiz.test.ts, over eight hundred questions. What can
 * only be checked here is that the game is actually playable: that the
 * same link is the same question, that answering it marks it and shows
 * the working, and that all of it works with scripting switched off.
 */
const MODES = [
  'who-lived-longer',
  'could-lifetimes-overlap',
  'who-was-alive',
  'put-them-in-order',
  'guess-the-age',
  'family-connection',
  'timeline-placement',
  'who-am-i',
];

async function answerFirstOption(page: Page): Promise<void> {
  const radios = page.locator('input[type="radio"][name="answer"]');
  if ((await radios.count()) > 0) {
    await radios.first().check();
  } else {
    const selects = page.locator('select[name="answer"]');
    const count = await selects.count();
    for (let index = 0; index < count; index += 1) {
      const options = selects.nth(index).locator('option');
      await selects
        .nth(index)
        .selectOption((await options.nth(index + 1).getAttribute('value')) ?? '');
    }
  }
  await page.getByRole('button', { name: 'Check my answer' }).click();
}

test.describe('the games index', () => {
  test('offers all eight modes and today’s round', async ({ page }) => {
    await page.goto('/games');
    await expect(page.getByTestId('mode-link')).toHaveCount(8);
    await expect(page.getByTestId('daily-quiz')).toBeVisible();
  });

  test('says where the score is kept before anything is played', async ({ page }) => {
    await page.goto('/games');
    await expect(page.getByTestId('progress-empty')).toContainText('this browser');
  });
});

test.describe('every mode asks a question and marks it', () => {
  for (const mode of MODES) {
    test(`${mode} asks, marks, and shows the working`, async ({ page }) => {
      await page.goto(`/games/${mode}?seed=browser`);
      await expect(page.getByTestId('question')).toBeVisible();

      await answerFirstOption(page);

      const result = page.getByTestId('result');
      await expect(result).toBeVisible();
      await expect(page.getByTestId('working')).toBeVisible();
      await expect(result).toContainText(/Right|Not this time/);
      await expect(page.getByTestId('next-question')).toBeVisible();
    });
  }
});

test.describe('the same link is the same question', () => {
  test('a reload asks the same thing', async ({ page }) => {
    await page.goto('/games/who-lived-longer?seed=stable');
    const asked = await page.getByRole('group').textContent();
    await page.reload();
    expect(await page.getByRole('group').textContent()).toBe(asked);
  });

  test('the next question is a different one, and its own link', async ({ page }) => {
    await page.goto('/games/who-lived-longer?seed=stable');
    const asked = await page.getByRole('group').textContent();
    await answerFirstOption(page);

    await page.getByTestId('next-question').click();
    await expect(page).toHaveURL(/seed=/);
    expect(await page.getByRole('group').textContent()).not.toBe(asked);
  });
});

test.describe('it plays without scripting', () => {
  test('a question can be answered with JavaScript switched off', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto('/games/who-lived-longer?seed=plain');
    await expect(page.getByTestId('question')).toBeVisible();
    await answerFirstOption(page);

    await expect(page.getByTestId('result')).toBeVisible();
    await expect(page.getByTestId('working')).toBeVisible();
    await context.close();
  });
});

test.describe('progress is kept in the browser', () => {
  test('answering a question moves the score', async ({ page }) => {
    await page.goto('/games/who-lived-longer?seed=progress');
    await answerFirstOption(page);
    await expect(page.getByTestId('result')).toBeVisible();

    // The answer is marked on the server and recorded in the browser
    // afterwards, so the page is readable before the score is written.
    // Navigating away too early is a race the test would lose, and the
    // player would only lose one attempt.
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem('bible-timeline-explorer.attempts.v1'),
        ),
      )
      .not.toBeNull();

    await page.goto('/games');
    await expect(page.getByTestId('progress')).toBeVisible();
    await expect(page.getByTestId('progress')).toContainText('Level');
    await expect(page.getByTestId('achievement').first()).toBeVisible();
  });
});

test.describe('overlap is never turned into contact', () => {
  test('the overlap mode carries the note, in the question and in the answer', async ({
    page,
  }) => {
    await page.goto('/games/could-lifetimes-overlap?seed=browser');
    await expect(page.getByTestId('not-contact')).toBeVisible();
    await answerFirstOption(page);
    await expect(page.getByTestId('not-contact')).toBeVisible();
  });

  test('no page claims anyone met', async ({ page }) => {
    for (const mode of MODES) {
      await page.goto(`/games/${mode}?seed=browser`);
      const body = (await page.locator('main').textContent()) ?? '';
      expect(body).not.toMatch(/must have met|would have met|knew each other/i);
    }
  });
});

test.describe('accessibility', () => {
  test('axe reports no violations on a question or a marked answer', async ({ page }) => {
    const AxeBuilder = (await import('@axe-core/playwright')).default;

    await page.goto('/games/who-lived-longer?seed=axe');
    await expect(page.locator('h1')).toBeVisible();
    const asked = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(asked.violations.map((violation) => violation.id)).toEqual([]);

    await answerFirstOption(page);
    await expect(page.getByTestId('result')).toBeVisible();
    const marked = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    expect(marked.violations.map((violation) => violation.id)).toEqual([]);
  });

  test('never prints a missing value as a value', async ({ page }) => {
    for (const mode of MODES) {
      await page.goto(`/games/${mode}?seed=browser`);
      const body = (await page.locator('main').textContent()) ?? '';
      expect(body, mode).not.toMatch(/\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b/);
    }
  });
});
