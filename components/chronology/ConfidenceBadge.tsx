import type { ConfidenceLevel } from '@/lib/domain';
import { cn } from '../ui/cn';

/**
 * How confident the app is in a value, shown three ways at once.
 *
 * Requirement section 51 forbids colour as the only carrier of meaning, so
 * every level has a colour, a distinct shape treatment, and a word. That
 * encoding survives greyscale, colour blindness, a small screen and a
 * screenshot, and the word is the part that survives all four.
 */
const LEVELS: Record<
  ConfidenceLevel,
  { label: string; description: string; swatch: string; colour: string }
> = {
  EXPLICIT: {
    label: 'Stated',
    description: 'Scripture states this number directly.',
    swatch: 'bg-[var(--color-confidence-explicit)]',
    colour: 'text-[var(--color-confidence-explicit)]',
  },
  DERIVED: {
    label: 'Derived',
    description: 'Calculated from numbers Scripture states.',
    swatch:
      'bg-[var(--color-confidence-derived)] [background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.35)_2px,rgba(0,0,0,0.35)_4px)]',
    colour: 'text-[var(--color-confidence-derived)]',
  },
  APPROXIMATE: {
    label: 'Approximate',
    description: 'An estimate, not a stated or calculated figure.',
    swatch: 'bg-[var(--color-confidence-approximate)] opacity-70 blur-[0.5px]',
    colour: 'text-[var(--color-confidence-approximate)]',
  },
  DISPUTED: {
    label: 'Disputed',
    description: 'Sources or readings disagree about this.',
    swatch:
      'border-2 border-dashed border-[var(--color-confidence-disputed)] bg-transparent',
    colour: 'text-[var(--color-confidence-disputed)]',
  },
  UNKNOWN: {
    label: 'Unknown',
    description: 'Scripture does not say.',
    swatch: 'border-2 border-[var(--color-confidence-unknown)] bg-transparent',
    colour: 'text-[var(--color-confidence-unknown)]',
  },
};

export function ConfidenceBadge({
  level,
  className,
}: {
  level: ConfidenceLevel;
  className?: string;
}) {
  const { label, description, swatch, colour } = LEVELS[level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-overlay)] px-2.5 py-1 text-xs font-medium',
        colour,
        className,
      )}
      title={description}
    >
      <span aria-hidden="true" className={cn('size-2.5 rounded-sm', swatch)} />
      {label}
      <span className="sr-only">. {description}</span>
    </span>
  );
}

export const CONFIDENCE_LABELS = LEVELS;
