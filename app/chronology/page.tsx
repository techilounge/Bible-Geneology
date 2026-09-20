import type { Metadata } from 'next';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { ConfidenceBadge } from '@/components/chronology/ConfidenceBadge';
import { Card, CardTitle } from '@/components/ui/Card';
import { CHRONOLOGY_DISCLAIMER, EPOCH_LABEL } from '@/lib/config/chronology-defaults';

export const metadata: Metadata = {
  title: 'How the dates work',
  description:
    'Where every number in this app comes from: what Scripture states, what is ' +
    'calculated from it, and what stays unknown.',
};

/**
 * Requirement sections 10, 15 and 17. This page is not an appendix. The
 * product's whole claim is that it distinguishes what the text says from what
 * the app worked out, and a reader who wants to check that claim needs one
 * place that explains the distinction before they meet it on a chart.
 */
export default function ChronologyPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Method"
        title="How the dates work"
        lede="No birth year in this app is quoted from Scripture, because Scripture does not give birth years. It gives intervals, and every year here is arithmetic over them. This page says exactly which is which."
      />

      <Card className="flex flex-col gap-3">
        <CardTitle>The three things a number can be</CardTitle>
        <ul className="flex flex-col gap-3">
          <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <ConfidenceBadge level="EXPLICIT" />
            <span className="text-[var(--color-text-secondary)]">
              The text states it. &ldquo;All the days of Adam were nine hundred and thirty
              years&rdquo; is a lifespan you can read off the page.
            </span>
          </li>
          <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <ConfidenceBadge level="DERIVED" />
            <span className="text-[var(--color-text-secondary)]">
              We calculated it from numbers the text states. Every birth year in this app
              is derived, and each one shows its working.
            </span>
          </li>
          <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <ConfidenceBadge level="DISPUTED" />
            <span className="text-[var(--color-text-secondary)]">
              Readings disagree, and we show the disagreement rather than picking quietly.
            </span>
          </li>
          <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <ConfidenceBadge level="UNKNOWN" />
            <span className="text-[var(--color-text-secondary)]">
              The text does not say. It stays unknown. We do not estimate it to make a
              chart tidier.
            </span>
          </li>
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>What {EPOCH_LABEL} means here</CardTitle>
        <p className="text-[var(--color-text-secondary)]">
          Years are counted from the creation of Adam, written {EPOCH_LABEL}. Year 0 is a
          convention this chronology adopts so the arithmetic has somewhere to start. It
          is not a date the text gives, and it is not a claim about calendars.
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>A worked example of why this matters</CardTitle>
        <p className="text-[var(--color-text-secondary)]">
          Genesis 11:26 says Terah was seventy when he fathered Abram, Nahor and Haran.
          That is one age for three sons, and it does not say Abram was the eldest, so
          reading seventy as Abraham&rsquo;s birth offset is an interpretation rather than
          a statement.
        </p>
        <p className="text-[var(--color-text-secondary)]">
          This app instead derives it: Terah died at 205 (Genesis 11:32), Abraham was 75
          when he left Haran (Genesis 12:4), and Acts 7:4 places that departure after
          Terah&rsquo;s death. 205 less 75 is 130.
        </p>
        <p className="text-[var(--color-text-secondary)]">
          The two readings give different answers to the app&rsquo;s central question.
          Under 130, Noah and Abraham were never alive at the same time. Under 70, their
          lifetimes overlap by about 58 years. Both are kept, the derived one is the
          default, and the other is labelled rather than hidden.
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <CardTitle>What overlapping lifetimes does not mean</CardTitle>
        <p className="text-[var(--color-text-secondary)]">
          That two people were alive at the same time is not evidence that they met, knew
          of each other, or passed anything between them. The app says &ldquo;their
          lifetimes overlapped&rdquo; and never more than that.
        </p>
      </Card>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}
