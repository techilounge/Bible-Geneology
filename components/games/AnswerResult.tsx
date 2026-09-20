import Link from 'next/link';
import { SourceList } from '@/components/chronology/SourceList';
import { NOT_CONTACT } from '@/lib/config/copy';
import type { ScriptureReference } from '@/lib/domain';
import type { Question } from '@/lib/quiz';

/**
 * A marked answer: right or wrong, then the working.
 *
 * The working is the point. A player who guesses and then reads why is
 * doing the thing the product is for, so the explanation, the figures
 * behind it and the verses they came from are shown either way.
 */
export function AnswerResult({
  question,
  given,
  correct,
  nextHref,
  references,
}: {
  question: Question;
  given: readonly string[];
  correct: boolean;
  nextHref: string;
  references: readonly ScriptureReference[];
}) {
  const label = (id: string) =>
    question.options.find((option) => option.id === id)?.label ?? id;

  return (
    <div
      className="flex flex-col gap-6"
      data-testid="result"
      data-correct={String(correct)}
    >
      <section className="flex flex-col gap-2">
        <p className="text-xl font-medium text-balance">{question.prompt}</p>
        <p
          className={
            correct
              ? 'text-lg font-semibold text-[var(--color-confidence-explicit)]'
              : 'text-lg font-semibold text-[var(--color-confidence-disputed)]'
          }
        >
          {correct ? 'Right' : 'Not this time'}
        </p>
        <p className="text-[var(--color-text-secondary)]">
          You answered {given.length > 0 ? given.map(label).join(', then ') : 'nothing'}.
          The answer is {question.answerIds.map(label).join(', then ')}.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Why</h2>
        <p className="text-[var(--color-text-secondary)]">{question.explanation}</p>
        <dl className="flex flex-col gap-2" data-testid="working">
          {question.working.map((step) => (
            <div
              key={`${step.label}-${step.value}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--color-border-subtle)] pb-2"
            >
              <dt className="text-[var(--color-text-secondary)]">{step.label}</dt>
              <dd className="font-mono tabular-nums">{step.value}</dd>
            </div>
          ))}
        </dl>
        {question.aboutOverlap ? (
          <p
            data-testid="not-contact"
            className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] p-3 text-sm"
          >
            {NOT_CONTACT}
          </p>
        ) : null}
        <SourceList references={references} label="This answer rests on" />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          href={nextHref}
          data-testid="next-question"
          className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Next question
        </Link>
        <Link
          href="/games"
          className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-surface-overlay)] px-4 font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          All the games
        </Link>
      </div>
    </div>
  );
}
