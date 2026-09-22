import type { Metadata } from 'next';
import { BookOpen, Calculator, Calendar, HelpCircle, Shield, Split } from 'lucide-react';
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

export default function ChronologyPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Methodology"
        title="How the dates work"
        icon={<BookOpen className="size-4" />}
        lede="No birth year in this app is quoted from Scripture, because Scripture does not give birth years. It gives intervals, and every year here is arithmetic over them. This page explains our rigorous scholarly approach."
      />

      {/* The 4 confidence levels */}
      <section className="glass-panel flex flex-col gap-5 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl">The four things a number can be</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Every figure in this explorer carries an explicit epistemic status. We
            distinguish stated figures from calculated arithmetic.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="flex flex-col gap-2 rounded-xl bg-[var(--color-surface-sunken)] p-4 border border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between">
              <ConfidenceBadge level="EXPLICIT" />
              <Shield className="size-4 text-[var(--color-confidence-explicit)]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              The text states it directly. &ldquo;All the days of Adam were nine hundred
              and thirty years&rdquo; is a lifespan you can read off the page.
            </p>
          </li>

          <li className="flex flex-col gap-2 rounded-xl bg-[var(--color-surface-sunken)] p-4 border border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between">
              <ConfidenceBadge level="DERIVED" />
              <Calculator className="size-4 text-[var(--color-confidence-derived)]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Calculated from intervals the text states. Every birth year in this app is
              derived, and each one shows its working.
            </p>
          </li>

          <li className="flex flex-col gap-2 rounded-xl bg-[var(--color-surface-sunken)] p-4 border border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between">
              <ConfidenceBadge level="DISPUTED" />
              <Split className="size-4 text-[var(--color-confidence-disputed)]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Readings disagree, and we show the disagreement rather than picking quietly.
            </p>
          </li>

          <li className="flex flex-col gap-2 rounded-xl bg-[var(--color-surface-sunken)] p-4 border border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between">
              <ConfidenceBadge level="UNKNOWN" />
              <HelpCircle className="size-4 text-[var(--color-confidence-unknown)]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              The text does not say. It stays unknown. We do not estimate it to make a
              chart tidier.
            </p>
          </li>
        </ul>
      </section>

      {/* Epoch convention */}
      <Card className="glass-panel flex flex-col gap-3 rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-[var(--color-accent)]" />
          <CardTitle>What {EPOCH_LABEL} means here</CardTitle>
        </div>
        <p className="text-[var(--color-text-secondary)] leading-relaxed">
          Years are counted from the creation of Adam, written {EPOCH_LABEL}. Year 0 is a
          convention this chronology adopts so the arithmetic has somewhere to start. It
          is not a date the text gives, and it is not a claim about modern solar
          calendars.
        </p>
      </Card>

      {/* Worked Example */}
      <Card className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
        <CardTitle className="text-xl">A worked example of why this matters</CardTitle>
        <p className="text-[var(--color-text-secondary)] leading-relaxed">
          Genesis 11:26 says Terah was seventy when he fathered Abram, Nahor and Haran.
          That is one age for three sons, and it does not say Abram was the eldest, so
          reading seventy as Abraham&rsquo;s birth offset is an interpretation rather than
          a statement.
        </p>
        <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-surface-sunken)] p-4 text-sm leading-relaxed text-[var(--color-text-primary)]">
          <span className="font-semibold text-[var(--color-accent)]">
            The Derived Arithmetic:
          </span>{' '}
          Terah died at 205 (Genesis 11:32), Abraham was 75 when he left Haran (Genesis
          12:4), and Acts 7:4 places that departure after Terah&rsquo;s death. 205 less 75
          is 130.
        </div>
        <p className="text-[var(--color-text-secondary)] leading-relaxed">
          The two readings give different answers to the app&rsquo;s central question.
          Under 130, Noah and Abraham were never alive at the same time. Under 70, their
          lifetimes overlap by about 58 years. Both are kept, the derived one is the
          default, and the other is labelled rather than hidden.
        </p>
      </Card>

      {/* Limits of overlap */}
      <Card className="glass-panel flex flex-col gap-3 rounded-2xl p-6 border-l-4 border-l-[var(--color-accent)]">
        <CardTitle>What overlapping lifetimes does not mean</CardTitle>
        <p className="text-[var(--color-text-secondary)] leading-relaxed">
          That two people were alive at the same time is not evidence that they met, knew
          of each other, or passed anything between them. The app says &ldquo;their
          lifetimes overlapped&rdquo; and never more than that.
        </p>
      </Card>

      <p className="text-sm text-[var(--color-text-muted)]">{CHRONOLOGY_DISCLAIMER}</p>
    </PageShell>
  );
}
