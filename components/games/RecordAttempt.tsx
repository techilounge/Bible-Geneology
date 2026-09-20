'use client';

import { useEffect } from 'react';
import type { QuizMode } from '@/lib/quiz';
import { recordAttempt, today } from './progress-store';

/**
 * Writes one marked answer to the browser's log, and renders nothing.
 *
 * It runs after the answer has already been shown, so a browser that
 * cannot store anything loses the score and nothing else.
 */
export function RecordAttempt({
  questionId,
  mode,
  correct,
}: {
  questionId: string;
  mode: QuizMode;
  correct: boolean;
}) {
  useEffect(() => {
    recordAttempt({ questionId, mode, correct, day: today() });
  }, [questionId, mode, correct]);

  return null;
}
