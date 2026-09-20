import { type ChronologyResult, type Derivation, known, unknown } from '@/lib/domain';
import { type Dataset, isPresent, lookup } from './dataset';

export interface ChronologyExplanation {
  personId: string;
  chronologyId: string;
  field: 'birthYear';
  result: number;
  unit: string;
  steps: Derivation['steps'];
  assumptions: string[];
  sourceReferences: string[];
  calculationMethod: string | null;
}

/**
 * The material behind "Why this date?" (requirement section 17).
 *
 * The engine does not re-derive anything here. The derivation was recorded
 * when the value was computed, so the explanation and the number cannot
 * disagree — which they could if the UI recomputed the chain to display it.
 */
export function getChronologyExplanation(
  dataset: Dataset,
  personId: string,
): ChronologyResult<ChronologyExplanation> {
  if (!isPresent(dataset, personId)) return unknown('not-applicable');

  const record = lookup(dataset, personId);
  if (record?.birthYear == null) return unknown('no-data');
  if (!record.derivation) {
    // A value with no derivation is either the epoch itself or a figure stated
    // outright. Neither has a chain to show, and inventing one would be worse
    // than saying so.
    return unknown('no-data');
  }

  return known(
    {
      personId,
      chronologyId: dataset.chronologyId,
      field: 'birthYear',
      result: record.derivation.result,
      unit: record.derivation.unit,
      steps: record.derivation.steps,
      assumptions: record.derivation.assumptions,
      sourceReferences: record.sourceReferences,
      calculationMethod: record.calculationMethod,
    },
    record.birthConfidence,
    record.derivation,
  );
}
