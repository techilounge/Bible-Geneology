import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../achievements';
import { QUIZ_MODES, type QuizMode } from '@/lib/quiz';
import {
  EMPTY_PROGRESS,
  XP_FOR_ATTEMPT,
  XP_FOR_CORRECT,
  bestStreakFrom,
  dayBefore,
  levelFor,
  streakFrom,
  summarise,
  xpFor,
} from '../xp';
import type { Attempt } from '../types';

/**
 * Progression is a function of the log, so every one of these tests is a
 * statement about what a player did rather than about what a counter
 * holds. Phase 13 will replay a server-side log through the same
 * functions, and these are the assertions that say it will get the same
 * answers.
 */
function attempt(
  correct: boolean,
  day = '2026-09-20',
  mode: QuizMode = 'who-lived-longer',
): Attempt {
  return { questionId: `${mode}-${day}-${correct}`, mode, correct, day };
}

describe('xp and levels', () => {
  it('gives more for a right answer than for a wrong one, and something for both', () => {
    expect(xpFor([attempt(true)])).toBe(XP_FOR_CORRECT);
    expect(xpFor([attempt(false)])).toBe(XP_FOR_ATTEMPT);
    expect(XP_FOR_ATTEMPT).toBeGreaterThan(0);
    expect(xpFor([])).toBe(0);
  });

  it('counts a level every hundred', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(250)).toBe(3);
  });

  it('says how much is left to the next level', () => {
    expect(summarise([]).toNextLevel).toBe(100);
    expect(summarise([attempt(true)]).toNextLevel).toBe(90);
  });
});

describe('streaks', () => {
  it('counts consecutive days up to the last one played', () => {
    expect(streakFrom(['2026-09-18', '2026-09-19', '2026-09-20'])).toBe(3);
  });

  it('counts a day played twice once', () => {
    expect(streakFrom(['2026-09-19', '2026-09-19', '2026-09-20'])).toBe(2);
  });

  it('stops at a gap', () => {
    expect(streakFrom(['2026-09-01', '2026-09-19', '2026-09-20'])).toBe(2);
  });

  it('is nothing when nothing has been played', () => {
    expect(streakFrom([])).toBe(0);
    expect(bestStreakFrom([])).toBe(0);
  });

  it('remembers the best run even after it is broken', () => {
    const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-20'];
    expect(streakFrom(days)).toBe(1);
    expect(bestStreakFrom(days)).toBe(3);
  });

  it('knows which day follows which, and says no to nonsense', () => {
    expect(dayBefore('2026-09-19', '2026-09-20')).toBe(true);
    expect(dayBefore('2026-09-30', '2026-10-01')).toBe(true);
    expect(dayBefore('2026-09-18', '2026-09-20')).toBe(false);
    expect(dayBefore('not-a-day', '2026-09-20')).toBe(false);
  });
});

describe('the summary', () => {
  it('is empty before anything is played', () => {
    expect(EMPTY_PROGRESS.answered).toBe(0);
    expect(EMPTY_PROGRESS.achievements).toEqual([]);
    expect(EMPTY_PROGRESS.lastDay).toBeNull();
    expect(EMPTY_PROGRESS.level).toBe(1);
  });

  it('tallies each mode separately', () => {
    const progress = summarise([
      attempt(true, '2026-09-20', 'who-was-alive'),
      attempt(false, '2026-09-20', 'who-was-alive'),
      attempt(true, '2026-09-20', 'guess-the-age'),
    ]);
    expect(progress.modes['who-was-alive']).toEqual({ answered: 2, correct: 1 });
    expect(progress.modes['guess-the-age']).toEqual({ answered: 1, correct: 1 });
    expect(progress.modes['who-am-i']).toEqual({ answered: 0, correct: 0 });
    expect(progress.answered).toBe(3);
    expect(progress.correct).toBe(2);
    expect(progress.lastDay).toBe('2026-09-20');
  });

  it('finds the longest unbroken run of right answers', () => {
    const progress = summarise([
      attempt(true),
      attempt(true),
      attempt(false),
      attempt(true),
    ]);
    expect(progress.longestCorrectRun).toBe(2);
  });
});

describe('achievements', () => {
  it('earns nothing for nothing', () => {
    expect(summarise([]).achievements).toEqual([]);
  });

  it('earns the explorer after ten questions, right or wrong', () => {
    const ten = Array.from({ length: 10 }, () => attempt(false));
    expect(summarise(ten).achievements).toContain('genesis-explorer');
  });

  it('earns the mode badges from that mode alone', () => {
    const detective = Array.from({ length: 10 }, () =>
      attempt(true, '2026-09-20', 'timeline-placement'),
    );
    expect(summarise(detective).achievements).toContain('timeline-detective');
    expect(summarise(detective).achievements).not.toContain('genealogy-scholar');

    const scholar = Array.from({ length: 10 }, () =>
      attempt(true, '2026-09-20', 'family-connection'),
    );
    expect(summarise(scholar).achievements).toContain('genealogy-scholar');
  });

  it('earns the expert after twenty-five right answers', () => {
    const many = Array.from({ length: 25 }, () => attempt(true));
    expect(summarise(many).achievements).toContain('patriarch-expert');
  });

  it('earns the master only after every mode has been answered right', () => {
    const allButOne = QUIZ_MODES.slice(0, -1).map((mode) =>
      attempt(true, '2026-09-20', mode),
    );
    expect(summarise(allButOne).achievements).not.toContain('chronology-master');
    const all = QUIZ_MODES.map((mode) => attempt(true, '2026-09-20', mode));
    expect(summarise(all).achievements).toContain('chronology-master');
  });

  it('earns the perfect round for eight in a row', () => {
    const seven = Array.from({ length: 7 }, () => attempt(true));
    expect(summarise(seven).achievements).not.toContain('perfect-round');
    expect(summarise([...seven, attempt(true)]).achievements).toContain('perfect-round');
  });

  it('earns the seven-day streak for seven days running', () => {
    const days = Array.from({ length: 7 }, (_, index) =>
      attempt(true, `2026-09-0${index + 1}`),
    );
    expect(summarise(days).achievements).toContain('seven-day-streak');
    expect(summarise(days.slice(0, 6)).achievements).not.toContain('seven-day-streak');
  });

  it('describes every badge it can award', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.name.length).toBeGreaterThan(0);
      expect(achievement.description.endsWith('.')).toBe(true);
    }
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
