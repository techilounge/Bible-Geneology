import Link from 'next/link';
import { EPOCH_LABEL } from '@/lib/config/chronology-defaults';
import type { BuiltStep } from '@/lib/learning';
import type { Question } from '@/lib/quiz';

/**
 * One step of a journey: the explanation, the people it is about with
 * their dates, and a question if the step has one.
 *
 * Every figure on this card came out of the engine a moment ago. The
 * step itself carries no numbers, which is why a chronology change
 * rewrites the page instead of falsifying it.
 */
export function JourneyStep({
  step,
  questionHref,
}: {
  step: BuiltStep;
  questionHref: (question: Question) => string;
}) {
  return (
    <article
      className="flex flex-col gap-5"
      data-testid="journey-step"
      data-step={step.id}
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-balance">{step.title}</h2>
        <p className="text-[var(--color-text-secondary)]">{step.body}</p>
      </div>

      <ul className="flex flex-col gap-2" data-testid="step-people">
        {step.people.map((person) => (
          <li
            key={person.personId}
            data-person={person.personId}
            data-undated={String(person.undated)}
            className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--color-border-subtle)] pb-2"
          >
            <Link
              href={`/people/${person.personId}`}
              className="rounded font-medium hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              {person.name}
            </Link>
            <span className="font-mono text-sm tabular-nums text-[var(--color-text-secondary)]">
              {person.undated
                ? 'No dates in this chronology'
                : `${person.birthYear} to ${
                    person.openEnded ? `${person.birthYear}+` : person.deathYear
                  } ${EPOCH_LABEL}`}
            </span>
          </li>
        ))}
      </ul>

      {step.events.length > 0 ? (
        <ul className="flex flex-col gap-2" data-testid="step-events">
          {step.events.map((event) => (
            <li
              key={event.eventId}
              className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm"
            >
              <span className="text-[var(--color-text-secondary)]">{event.name}</span>
              <span className="font-mono tabular-nums">
                {event.year === null
                  ? 'Not dated by this chronology'
                  : `${event.year} ${EPOCH_LABEL}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {step.generatedQuestion ? (
        <div
          className="flex flex-col gap-3 rounded-xl border border-[var(--color-accent)] bg-[var(--color-surface-raised)] p-4"
          data-testid="step-question"
        >
          <p className="text-xs tracking-widest text-[var(--color-accent)] uppercase">
            Try it
          </p>
          <p className="font-medium text-balance">{step.generatedQuestion.prompt}</p>
          <div>
            <Link
              href={questionHref(step.generatedQuestion)}
              data-testid="step-question-link"
              className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-surface-overlay)] px-4 font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              Answer this one
            </Link>
          </div>
        </div>
      ) : null}
    </article>
  );
}
