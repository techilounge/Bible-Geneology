import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Attempt } from '@/lib/progress';
import { SyncProgress } from './SyncProgress';

/**
 * Carrying a week of signed-out play into an account. What matters here
 * is that the log actually reaches the form, and that a browser holding
 * nothing says so rather than offering a button that would do nothing.
 */
const attempt = (questionId: string): Attempt => ({
  questionId,
  mode: 'who-lived-longer',
  correct: true,
  day: '2026-09-01',
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('bringing a browser’s rounds into an account', () => {
  it('says there is nothing to bring when the browser is empty', async () => {
    render(<SyncProgress action={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByTestId('sync-none')).toBeDefined();
    });
  });

  it('offers the rounds it holds, and sends them in the form', async () => {
    const attempts = [attempt('q1'), attempt('q2')];
    window.localStorage.setItem(
      'bible-timeline-explorer.attempts.v1',
      JSON.stringify(attempts),
    );

    render(<SyncProgress action={() => undefined} />);

    const button = await screen.findByTestId('sync-progress');
    expect(button.textContent).toBe('Add 2 rounds from this browser');
    const field = document.querySelector('input[name="attempts"]');
    expect(JSON.parse(field?.getAttribute('value') ?? '[]')).toEqual(attempts);
  });

  it('counts one round in the singular', async () => {
    window.localStorage.setItem(
      'bible-timeline-explorer.attempts.v1',
      JSON.stringify([attempt('q1')]),
    );
    render(<SyncProgress action={() => undefined} />);
    expect((await screen.findByTestId('sync-progress')).textContent).toBe(
      'Add 1 round from this browser',
    );
  });
});
