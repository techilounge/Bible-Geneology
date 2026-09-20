import { SourceList } from '@/components/chronology/SourceList';
import { NOT_CONTACT } from '@/lib/config/copy';
import type { ScriptureReference } from '@/lib/domain';
import type { Question } from '@/lib/quiz';

/**
 * A question, as a plain form.
 *
 * It submits with GET to its own address, which means the whole game
 * works with scripting switched off and a marked answer is a shareable
 * link. Nothing here decides whether an answer is right: the page does
 * that, from the question the engine has already agreed with.
 */
export function QuestionCard({
  question,
  seed,
  references,
}: {
  question: Question;
  seed: string;
  references: readonly ScriptureReference[];
}) {
  return (
    <form
      method="get"
      action={`/games/${question.mode}`}
      data-testid="question"
      data-mode={question.mode}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="seed" value={seed} />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-xl font-medium text-balance">{question.prompt}</legend>

        {question.ordered ? (
          <OrderedAnswer question={question} />
        ) : (
          <ChoiceAnswer question={question} />
        )}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-lg bg-[var(--color-accent)] px-4 font-medium text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          Check my answer
        </button>
      </div>

      <p className="text-sm text-[var(--color-text-muted)]">
        Drawn from {question.population}.
      </p>
      {question.aboutOverlap ? (
        <p
          data-testid="not-contact"
          className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-overlay)] p-3 text-sm"
        >
          {NOT_CONTACT}
        </p>
      ) : null}
      <SourceList references={references} label="This question rests on" />
    </form>
  );
}

function ChoiceAnswer({ question }: { question: Question }) {
  return (
    <ul className="flex flex-col gap-2">
      {question.options.map((option) => (
        <li key={option.id}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-4 py-2 hover:border-[var(--color-accent)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-accent)]">
            <input
              type="radio"
              name="answer"
              value={option.id}
              className="size-4 accent-[var(--color-accent)]"
            />
            <span>{option.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/**
 * Ordering, as one select per position.
 *
 * Drag and drop would need scripting and a pointer, and requirement
 * section 50 rules out anything that needs either. Three selects work on
 * a phone, with a keyboard, and with no JavaScript at all.
 */
function OrderedAnswer({ question }: { question: Question }) {
  return (
    <ol className="flex flex-col gap-3">
      <li className="text-sm text-[var(--color-text-muted)]">Choose each person once.</li>
      {question.options.map((_option, position) => (
        <li key={position} className="flex flex-col gap-1">
          <label
            className="text-sm text-[var(--color-text-secondary)]"
            htmlFor={`position-${position}`}
          >
            {position === 0 ? 'Earliest' : `Then`}
          </label>
          <select
            id={`position-${position}`}
            name="answer"
            defaultValue=""
            className="min-h-11 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-3"
          >
            <option value="">Choose a person</option>
            {question.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ol>
  );
}
