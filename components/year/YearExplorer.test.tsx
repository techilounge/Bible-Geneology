import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { buildRows } from '@/lib/chronology/scale';
import type { Person, PersonChronology } from '@/lib/domain';
import { YearExplorer } from './YearExplorer';

/**
 * The year explorer, checked on its rendered output.
 *
 * The engine already has its own suite; what these assert is the join
 * between the two — that the controls move the year, that the year moves
 * the list, and that the wordings this product cares about survive contact
 * with the DOM.
 */
function person(id: string, name: string): Person {
  return {
    id,
    canonicalName: name,
    slug: id,
    gender: 'male',
    description: null,
    eraId: null,
    sortOrder: null,
    primaryScriptureReferences: ['GEN.5.1'],
    reviewStatus: 'DRAFT',
  };
}

function record(
  personId: string,
  birthYear: number | null,
  deathYear: number | null,
  lifespan: number | null,
): PersonChronology {
  return {
    personId,
    chronologyId: 'fixture',
    birthYear,
    deathYear,
    lifespan,
    birthConfidence: birthYear === null ? 'UNKNOWN' : 'DERIVED',
    deathConfidence: deathYear === null ? 'UNKNOWN' : 'DERIVED',
    lifespanConfidence: lifespan === null ? 'UNKNOWN' : 'EXPLICIT',
    birthSourceType: birthYear === null ? 'UNKNOWN' : 'SCRIPTURE_DERIVED',
    deathSourceType: deathYear === null ? 'UNKNOWN' : 'SCRIPTURE_DERIVED',
    lifespanSourceType: lifespan === null ? 'UNKNOWN' : 'SCRIPTURE_EXPLICIT',
    sourceReferences: ['GEN.5.1'],
    calculationMethod: null,
    derivation: null,
    notes: null,
    reviewStatus: 'DRAFT',
  };
}

const PEOPLE = [
  person('adam', 'Adam'),
  person('seth', 'Seth'),
  person('enoch', 'Enoch'),
  person('noname', 'Noname'),
];

const CHRONOLOGY = [
  record('adam', 0, 930, 930),
  record('seth', 130, 1042, 912),
  record('enoch', 622, null, 365),
  record('noname', null, null, null),
];

const ROWS = buildRows(
  PEOPLE.map((p) => ({
    personId: p.id,
    name: p.canonicalName,
    slug: p.slug,
    record: CHRONOLOGY.find((c) => c.personId === p.id) as PersonChronology,
  })).filter((entry) => entry.record.birthYear !== null),
);

function renderExplorer(initialYear = 700) {
  return render(
    <YearExplorer
      chronologyId="fixture"
      people={PEOPLE}
      chronology={CHRONOLOGY}
      rows={ROWS}
      events={[
        {
          id: 'flood',
          name: 'The Flood',
          slug: 'flood',
          year: 1000,
          confidence: 'DERIVED',
        },
      ]}
      bounds={[0, 1042]}
      initialYear={initialYear}
      unplaceableCount={1}
    />,
  );
}

describe('YearExplorer', () => {
  it('lists everyone the chronology can place alive, with their ages', () => {
    renderExplorer(700);
    const list = screen.getByTestId('living-list');
    expect(within(list).getByText('Adam')).toBeDefined();
    expect(within(list).getByText('Seth')).toBeDefined();
    expect(within(list).getByText('Enoch')).toBeDefined();
    expect(screen.getByTestId('living-heading').textContent).toContain(
      '3 people alive in 700 AM',
    );
  });

  it('leaves out anyone born later', () => {
    renderExplorer(100);
    expect(within(screen.getByTestId('living-list')).queryByText('Seth')).toBeNull();
  });

  it('applies the half-open rule: the year of death is not a year alive', () => {
    renderExplorer(930);
    expect(within(screen.getByTestId('living-list')).queryByText('Adam')).toBeNull();

    renderExplorer(929);
    expect(
      within(screen.getAllByTestId('living-list')[1]!).getByText('Adam'),
    ).toBeDefined();
  });

  it('says plainly when the chronology places nobody, without claiming history', () => {
    renderExplorer(1042);
    expect(screen.getByTestId('living-heading').textContent).toContain(
      'Nobody the chronology can place is alive in 1042 AM',
    );
    expect(
      screen.getByText(/statement about this chronology, not about history/),
    ).toBeDefined();
  });

  it('marks an open-ended life rather than inventing a death for it', () => {
    renderExplorer(700);
    // Enoch: a stated lifespan, no recorded death.
    const enoch = screen
      .getByTestId('living-list')
      .querySelector('[data-person="enoch"]');
    expect(enoch?.textContent).toContain('987?');
    expect(enoch?.textContent).toContain(
      'records a lifespan for this person and no death',
    );
  });

  it('counts the people it cannot place in any year', () => {
    renderExplorer();
    expect(
      screen.getByText(/1 more people are named in this dataset and cannot appear here/),
    ).toBeDefined();
  });

  it('keeps the slider and the number box on the same year', async () => {
    const user = userEvent.setup();
    renderExplorer(700);

    await user.clear(screen.getByLabelText('Year (AM)'));
    await user.type(screen.getByLabelText('Year (AM)'), '800');
    expect((screen.getByLabelText('Year, as a slider') as HTMLInputElement).value).toBe(
      '800',
    );
  });

  it('will not accept a year outside the range', async () => {
    const user = userEvent.setup();
    renderExplorer(700);

    await user.clear(screen.getByLabelText('Year (AM)'));
    await user.type(screen.getByLabelText('Year (AM)'), '99999');
    expect(screen.getByTestId('living-heading').textContent).toContain('1042 AM');
  });

  it('jumps to the next year in which anything changes, not the next year', async () => {
    const user = userEvent.setup();
    renderExplorer(700);

    // Nothing happens between 622 and 930, so the jump is to 930.
    await user.click(screen.getByRole('button', { name: /Next change/ }));
    expect(screen.getByTestId('living-heading').textContent).toContain('930 AM');
  });

  it('names what happens at the year it would jump to', () => {
    renderExplorer(700);
    expect(screen.getByText(/930 AM: Adam died/)).toBeDefined();
    expect(screen.getByText(/622 AM: Enoch born/)).toBeDefined();
  });

  it('does not call the end of an open-ended window a death', () => {
    renderExplorer(988);
    // Enoch's window closes at 987; the label must not say he died.
    expect(screen.getByText(/987 AM: Enoch last placed/)).toBeDefined();
  });

  it('stops at the ends of the range instead of wrapping round', () => {
    renderExplorer(0);
    expect(screen.getByRole('button', { name: /Previous change/ })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('jumps to a dated event', async () => {
    const user = userEvent.setup();
    renderExplorer(0);
    await user.click(screen.getByRole('button', { name: /The Flood/ }));
    expect(screen.getByTestId('living-heading').textContent).toContain('1000 AM');
  });

  it('draws the marker on the strip at the chosen year', () => {
    const { container } = renderExplorer(700);
    expect(container.querySelector('[data-testid="marker-rule"]')).not.toBeNull();
  });
});
