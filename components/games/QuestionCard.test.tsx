import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { quizFixture } from '@/lib/quiz/__tests__/fixtures';
import { generateQuestion, type Question } from '@/lib/quiz';
import { AnswerResult } from './AnswerResult';
import { QuestionCard } from './QuestionCard';

/**
 * The question, as the page renders it.
 *
 * The property that matters here is that it is a form: a GET form with
 * real inputs, so the game works with scripting switched off and every
 * state of it is a link. A test that only checked the text would pass
 * with a div full of buttons that do nothing.
 */
const dataset = quizFixture();

function ask(mode: Parameters<typeof generateQuestion>[1]): Question {
  const question = generateQuestion(dataset, mode, 'component');
  if (!question) throw new Error(`the fixture supports no ${mode} question`);
  return question;
}

describe('QuestionCard', () => {
  it('submits to its own mode, by GET, carrying the seed', () => {
    const question = ask('who-lived-longer');
    const { container } = render(
      <QuestionCard question={question} seed="component" references={[]} />,
    );
    const form = container.querySelector('form');
    expect(form?.getAttribute('method')).toBe('get');
    expect(form?.getAttribute('action')).toBe('/games/who-lived-longer');
    expect(container.querySelector('input[name="seed"]')?.getAttribute('value')).toBe(
      'component',
    );
  });

  it('offers every option as a radio a keyboard can reach', () => {
    const question = ask('who-lived-longer');
    const { container } = render(
      <QuestionCard question={question} seed="s" references={[]} />,
    );
    const radios = container.querySelectorAll('input[type="radio"][name="answer"]');
    expect(radios).toHaveLength(question.options.length);
  });

  it('asks an ordering with one select per position, and no dragging', () => {
    const question = ask('put-them-in-order');
    const { container } = render(
      <QuestionCard question={question} seed="s" references={[]} />,
    );
    const selects = container.querySelectorAll('select[name="answer"]');
    expect(selects).toHaveLength(question.options.length);
    expect(container.querySelectorAll('[draggable]')).toHaveLength(0);
  });

  it('says that shared years are not a meeting, where that is the question', () => {
    const question = ask('could-lifetimes-overlap');
    render(<QuestionCard question={question} seed="s" references={[]} />);
    expect(screen.getByTestId('not-contact')).toBeDefined();
  });

  it('names the population it drew from', () => {
    const question = ask('who-lived-longer');
    render(<QuestionCard question={question} seed="s" references={[]} />);
    expect(screen.getByText(/of \d+ people/)).toBeDefined();
  });
});

describe('AnswerResult', () => {
  const question = ask('who-lived-longer');
  const right = question.answerIds;
  const wrong = question.options
    .filter((option) => !right.includes(option.id))
    .map((option) => option.id);

  it('says so plainly when the answer is right', () => {
    render(
      <AnswerResult
        question={question}
        given={right}
        correct
        nextHref="/games/who-lived-longer?seed=next"
        references={[]}
      />,
    );
    expect(screen.getByTestId('result').dataset.correct).toBe('true');
    expect(screen.getByText('Right')).toBeDefined();
  });

  it('shows the working either way, because that is the point', () => {
    render(
      <AnswerResult
        question={question}
        given={wrong}
        correct={false}
        nextHref="/games/who-lived-longer?seed=next"
        references={[]}
      />,
    );
    expect(screen.getByTestId('result').dataset.correct).toBe('false');
    expect(screen.getByText('Not this time')).toBeDefined();
    expect(screen.getByTestId('working').children.length).toBe(question.working.length);
    expect(screen.getByText(question.explanation)).toBeDefined();
  });

  it('says what was answered, even when nothing was', () => {
    render(
      <AnswerResult
        question={question}
        given={[]}
        correct={false}
        nextHref="/next"
        references={[]}
      />,
    );
    expect(screen.getByText(/You answered nothing/)).toBeDefined();
  });

  it('offers the next question as a link, not a button that needs scripting', () => {
    render(
      <AnswerResult
        question={question}
        given={right}
        correct
        nextHref="/games/who-lived-longer?seed=next"
        references={[]}
      />,
    );
    expect(screen.getByTestId('next-question').getAttribute('href')).toBe(
      '/games/who-lived-longer?seed=next',
    );
  });
});
