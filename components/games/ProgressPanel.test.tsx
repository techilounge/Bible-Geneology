import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attempt } from '@/lib/progress';
import { ProgressPanel } from './ProgressPanel';
import { readAttempts, recordAttempt, clearAttempts, today } from './progress-store';

/**
 * Progress is per-browser, so these tests are about what happens when the
 * browser cannot help: a private window where storage throws, a first
 * visit where there is nothing stored, and a log somebody has edited by
 * hand. In every case the page renders and the game still plays.
 */
function attempt(correct: boolean): Attempt {
  return {
    questionId: `q-${Math.random()}`,
    mode: 'who-lived-longer',
    correct,
    day: today(),
  };
}

describe('the attempt log', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts empty and keeps what it is given', () => {
    expect(readAttempts()).toEqual([]);
    const first = attempt(true);
    recordAttempt(first);
    expect(readAttempts()).toEqual([first]);
  });

  it('does not count a refresh as a second attempt', () => {
    const one = attempt(true);
    recordAttempt(one);
    recordAttempt(one);
    expect(readAttempts()).toHaveLength(1);
  });

  it('counts a genuine second answer', () => {
    recordAttempt(attempt(true));
    recordAttempt(attempt(false));
    expect(readAttempts()).toHaveLength(2);
  });

  it('ignores anything in storage that is not an attempt log', () => {
    window.localStorage.setItem('bible-timeline-explorer.attempts.v1', 'not json');
    expect(readAttempts()).toEqual([]);
    window.localStorage.setItem('bible-timeline-explorer.attempts.v1', '{"a":1}');
    expect(readAttempts()).toEqual([]);
    window.localStorage.setItem(
      'bible-timeline-explorer.attempts.v1',
      JSON.stringify([{ nonsense: true }]),
    );
    expect(readAttempts()).toEqual([]);
  });

  it('survives storage that refuses to be written to', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => recordAttempt(attempt(true))).not.toThrow();
  });

  it('survives storage that refuses to be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readAttempts()).toEqual([]);
  });

  it('can be cleared, even when clearing throws', () => {
    recordAttempt(attempt(true));
    clearAttempts();
    expect(readAttempts()).toEqual([]);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => clearAttempts()).not.toThrow();
  });
});

describe('ProgressPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('says where the score is kept before anything is played', () => {
    render(<ProgressPanel />);
    expect(screen.getByTestId('progress-empty').textContent).toContain('this browser');
  });

  it('shows the level, the score and the streak once something is', () => {
    recordAttempt(attempt(true));
    recordAttempt(attempt(false));
    render(<ProgressPanel />);
    expect(screen.getByTestId('progress')).toBeDefined();
    expect(screen.getByText('1 of 2')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
  });

  it('lists every badge, earned or not', () => {
    recordAttempt(attempt(true));
    render(<ProgressPanel />);
    const badges = screen.getAllByTestId('achievement');
    expect(badges).toHaveLength(7);
    expect(badges.every((badge) => badge.dataset.earned === 'false')).toBe(true);
  });
});
