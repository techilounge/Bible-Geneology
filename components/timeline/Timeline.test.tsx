import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { TimelineEvent, TimelineRow } from '@/lib/chronology/scale';
import { packLanes } from '@/lib/chronology/scale';
import { Timeline } from './Timeline';

/**
 * The timeline's claims about Scripture, asserted on the rendered output.
 *
 * The engine tests already prove the arithmetic. What these check is the
 * part a user actually meets: that the list says the same thing the chart
 * shows, that "overlaps" on screen means what the overlap engine means, and
 * that a large dataset does not bring the render to a stop.
 */
function row(
  personId: string,
  startYear: number,
  endYear: number,
  extra: Partial<TimelineRow> = {},
): Omit<TimelineRow, 'lane'> {
  return {
    personId,
    name: personId[0]?.toUpperCase() + personId.slice(1),
    slug: personId,
    startYear,
    endYear,
    openEnded: false,
    birthConfidence: 'DERIVED',
    deathConfidence: 'DERIVED',
    ...extra,
  };
}

const ROWS = packLanes([
  row('adam', 0, 930),
  row('seth', 130, 1042),
  row('noah', 1056, 2006),
  row('abraham', 2008, 2183),
]);

const EVENTS: TimelineEvent[] = [
  {
    id: 'the-flood',
    name: 'The Flood',
    slug: 'the-flood',
    year: 1656,
    confidence: 'DERIVED',
  },
];

function renderTimeline(rows: readonly TimelineRow[] = ROWS) {
  return render(
    <Timeline
      rows={rows}
      events={EVENTS}
      undatedCount={24}
      startedButUnended={['Esau']}
    />,
  );
}

describe('Timeline', () => {
  it('lists every lifetime in words, not only as bars', () => {
    renderTimeline();
    const list = screen.getByRole('list', { name: 'Lifetimes, earliest first' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(ROWS.length);
    expect(within(list).getByRole('button', { name: /Adam/ })).toBeDefined();
  });

  it('keeps the chart out of the accessibility tree, since the list carries it', () => {
    const { container } = renderTimeline();
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says who it had to leave off, rather than leaving them off quietly', () => {
    renderTimeline();
    expect(screen.getByText(/24 more people/)).toBeDefined();
    // A birth year with no end is its own case and gets its own sentence.
    expect(screen.getByText(/Esau has a birth year but no recorded death/)).toBeDefined();
  });

  it('reports the overlap count and refuses to call it a meeting', async () => {
    const user = userEvent.setup();
    renderTimeline();

    await user.click(screen.getByRole('button', { name: /Adam/ }));

    const status = screen.getByRole('status');
    // Adam (0-930) overlaps Seth (130-1042) and nobody else.
    expect(status.textContent).toContain('1 other dated lifetime overlaps');
    expect(status.textContent).toContain('not that they met');
  });

  it('applies the half-open rule on screen, not only in the engine', async () => {
    const user = userEvent.setup();
    // Two lifetimes that touch at a single year: 0-100 and 100-200.
    renderTimeline(packLanes([row('early', 0, 100), row('late', 100, 200)]));

    await user.click(screen.getByRole('button', { name: /Early/ }));
    expect(screen.getByRole('status').textContent).toContain('No other dated lifetime');
  });

  it('marks the selected row as pressed, so the list shows what the chart shows', async () => {
    const user = userEvent.setup();
    renderTimeline();

    const noah = screen.getByRole('button', { name: /Noah/ });
    await user.click(noah);
    expect(noah.getAttribute('aria-pressed')).toBe('true');

    await user.click(noah);
    expect(noah.getAttribute('aria-pressed')).toBe('false');
  });

  it('filters by name and repacks the lanes so no gap is left behind', async () => {
    const user = userEvent.setup();
    const { container } = renderTimeline();

    await user.type(screen.getByLabelText('Find a name'), 'noah');

    const list = screen.getByRole('list', { name: 'Lifetimes, earliest first' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);

    // One bar left, and it is in the first lane rather than the third.
    const bars = container.querySelectorAll('[data-testid="bar"]');
    expect(bars).toHaveLength(1);
    expect(bars[0]?.getAttribute('y')).toBe('28');
  });

  it('says so plainly when a search matches nobody', async () => {
    const user = userEvent.setup();
    renderTimeline();
    await user.type(screen.getByLabelText('Find a name'), 'Melchizedek');
    expect(screen.getByText('No one on the timeline matches that name.')).toBeDefined();
  });

  it('can hide the dated events', async () => {
    const user = userEvent.setup();
    renderTimeline();
    expect(screen.getByRole('list', { name: /Dated events/ })).toBeDefined();

    await user.click(screen.getByLabelText('Show dated events'));
    expect(screen.queryByRole('list', { name: /Dated events/ })).toBeNull();
  });

  it('keeps the axis fixed to the whole dataset while a filter is applied', async () => {
    const user = userEvent.setup();
    renderTimeline();
    const before = screen.getByTestId('viewport').textContent;

    await user.type(screen.getByLabelText('Find a name'), 'noah');
    expect(screen.getByTestId('viewport').textContent).toBe(before);
  });
});

describe('Timeline keyboard control', () => {
  it('pans with the arrow keys and returns with Home', async () => {
    const user = userEvent.setup();
    renderTimeline();

    const chart = screen.getByRole('group', { name: 'Timeline chart' });
    chart.focus();
    const full = screen.getByTestId('viewport').textContent;

    await user.keyboard('{-}');
    const zoomedOut = screen.getByTestId('viewport').textContent;
    await user.keyboard('+');
    const zoomedIn = screen.getByTestId('viewport').textContent;
    expect(zoomedIn).not.toBe(zoomedOut);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('viewport').textContent).not.toBe(full);

    await user.keyboard('{Home}');
    expect(screen.getByTestId('viewport').textContent).toBe(full);
  });

  it('clears the selection with Escape', async () => {
    const user = userEvent.setup();
    renderTimeline();

    await user.click(screen.getByRole('button', { name: /Adam/ }));
    expect(
      screen.getByRole('button', { name: /Adam/ }).getAttribute('aria-pressed'),
    ).toBe('true');

    screen.getByRole('group', { name: 'Timeline chart' }).focus();
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('button', { name: /Adam/ }).getAttribute('aria-pressed'),
    ).toBe('false');
  });
});

describe('Timeline at scale', () => {
  /**
   * The Phase 7 gate asks for a large synthetic dataset within budget. The
   * real dataset is 25 lifetimes; this is 2,000, which is far more than
   * Scripture will ever supply and is the size at which a naive chart stops
   * being usable.
   *
   * The budget is generous because jsdom is not a browser and the number
   * would be meaningless as a browser figure. What it catches is the class
   * of regression that matters: an accidental quadratic in lane packing or
   * in the overlap highlight.
   */
  const MANY = packLanes(
    Array.from({ length: 2000 }, (_unused, index) =>
      row(`p${index}`, index, index + 400),
    ),
  );

  it('mounts 2,000 lifetimes inside the budget', () => {
    const started = performance.now();
    renderTimeline(MANY);
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(6000);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2000);
  });

  it('draws only the bars the viewport can show once it is zoomed in', async () => {
    const user = userEvent.setup();
    const { container } = renderTimeline(MANY);
    const all = container.querySelectorAll('[data-testid="bar"]').length;

    const chart = screen.getByRole('group', { name: 'Timeline chart' });
    chart.focus();
    for (let i = 0; i < 6; i += 1) await user.keyboard('+');

    expect(container.querySelectorAll('[data-testid="bar"]').length).toBeLessThan(all);
  });
});
