import { Card } from '@/components/ui/Card';

/**
 * Requirement sections 7 and 43. Most of the women named in these
 * genealogies, and several of the men, have no stated ages at all.
 *
 * They are not omitted, and their pages are not blank. A genealogy product
 * that quietly renders only the people with numbers has made the dataset's
 * gaps invisible, which is a claim about the text that the text does not
 * make.
 */
export function UndatedNotice({ name }: { name: string }) {
  return (
    <Card className="flex flex-col gap-2 border-dashed">
      <p className="font-medium">Scripture gives no ages for {name}</p>
      <p className="text-sm text-[var(--color-text-secondary)]">
        No birth year, no death year and no lifespan are recorded, so none is shown. This
        is a gap in what the text states, not a gap in this dataset, and estimating it
        would turn an absence into a claim.
      </p>
      <p className="text-sm text-[var(--color-text-muted)]">
        {name} still appears in the family tree and in relationship paths.
      </p>
    </Card>
  );
}
