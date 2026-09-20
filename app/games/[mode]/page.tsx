import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnswerResult } from '@/components/games/AnswerResult';
import { QuestionCard } from '@/components/games/QuestionCard';
import { RecordAttempt } from '@/components/games/RecordAttempt';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { CHRONOLOGY_DISCLAIMER } from '@/lib/config/chronology-defaults';
import {
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  QUIZ_MODES,
  isCorrectAnswer,
  nextQuizSeed,
  type QuizMode,
} from '@/lib/quiz';
import { getQuestion, resolveReferences } from '@/lib/services/dataset';

/**
 * One mode, played as a plain form.
 *
 * The seed is in the address and the answer comes back in the address,
 * so the whole game works without scripting and every state of it is a
 * link somebody can share. The only client-side code on the page records
 * the attempt in this browser, and the page is complete without it.
 */
export function generateStaticParams() {
  return QUIZ_MODES.map((mode) => ({ mode }));
}

function first(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value !== undefined && value.length > 0 ? value : null;
}

function all(raw: string | string[] | undefined): string[] {
  if (raw === undefined) return [];
  return (Array.isArray(raw) ? raw : [raw]).filter((value) => value.length > 0);
}

function isMode(value: string): value is QuizMode {
  return (QUIZ_MODES as readonly string[]).includes(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mode: string }>;
}): Promise<Metadata> {
  const { mode } = await params;
  if (!isMode(mode)) return { title: 'Play and learn' };
  return { title: MODE_LABELS[mode], description: MODE_DESCRIPTIONS[mode] };
}

export default async function GameModePage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { mode } = await params;
  if (!isMode(mode)) notFound();

  const query = await searchParams;
  const seed = first(query.seed)?.slice(0, 64) ?? 'start';
  const given = all(query.answer);

  const question = getQuestion(mode, seed);
  const nextHref = `/games/${mode}?seed=${encodeURIComponent(nextQuizSeed(seed))}`;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Play and learn"
        title={MODE_LABELS[mode]}
        lede={MODE_DESCRIPTIONS[mode]}
      />

      {question === null ? (
        <p className="text-[var(--color-text-secondary)]">
          This dataset cannot support a question of this kind yet. It needs more people
          with both a birth and a death recorded, and none will be invented to make one.
        </p>
      ) : given.length === 0 ? (
        <QuestionCard
          question={question}
          seed={seed}
          references={resolveReferences(question.sourceReferences)}
        />
      ) : (
        <>
          <AnswerResult
            question={question}
            given={given}
            correct={isCorrectAnswer(question, given)}
            nextHref={nextHref}
            references={resolveReferences(question.sourceReferences)}
          />
          <RecordAttempt
            questionId={question.id}
            mode={question.mode}
            correct={isCorrectAnswer(question, given)}
          />
        </>
      )}

      <nav className="flex flex-wrap gap-3 text-sm">
        {QUIZ_MODES.filter((other) => other !== mode).map((other) => (
          <Link
            key={other}
            href={`/games/${other}`}
            className="rounded text-[var(--color-text-secondary)] underline decoration-dotted underline-offset-4 hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            {MODE_LABELS[other]}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}
