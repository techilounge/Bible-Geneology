import { QUIZ_MODES } from '@/lib/quiz';
import type { Progress } from './types';

/**
 * The badges in requirement section 38, each a rule over the attempt log.
 *
 * A badge is earned or it is not; there is no state to keep and nothing to
 * award twice. Every rule is stated once, here, so the page that lists
 * what is still to earn uses the same sentence as the one that grants it.
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  earned: (progress: Omit<Progress, 'achievements'>) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'genesis-explorer',
    name: 'Genesis Explorer',
    description: 'Answer ten questions.',
    earned: (progress) => progress.answered >= 10,
  },
  {
    id: 'timeline-detective',
    name: 'Timeline Detective',
    description: 'Place ten births on the right year.',
    earned: (progress) => progress.modes['timeline-placement'].correct >= 10,
  },
  {
    id: 'genealogy-scholar',
    name: 'Genealogy Scholar',
    description: 'Get ten family connections right.',
    earned: (progress) => progress.modes['family-connection'].correct >= 10,
  },
  {
    id: 'patriarch-expert',
    name: 'Patriarch Expert',
    description: 'Answer twenty-five questions correctly.',
    earned: (progress) => progress.correct >= 25,
  },
  {
    id: 'chronology-master',
    name: 'Chronology Master',
    description: 'Get at least one right in every mode.',
    earned: (progress) => QUIZ_MODES.every((mode) => progress.modes[mode].correct >= 1),
  },
  {
    id: 'perfect-round',
    name: 'Perfect Round',
    description: 'Answer eight in a row correctly.',
    earned: (progress) => progress.longestCorrectRun >= 8,
  },
  {
    id: 'seven-day-streak',
    name: 'Seven-Day Streak',
    description: 'Play on seven consecutive days.',
    earned: (progress) => progress.bestStreakDays >= 7,
  },
];

export function earnedAchievements(progress: Omit<Progress, 'achievements'>): string[] {
  return ACHIEVEMENTS.filter((achievement) => achievement.earned(progress)).map(
    (achievement) => achievement.id,
  );
}
