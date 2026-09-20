import type { Metadata } from 'next';
import { ComingInPhase } from '@/components/layout/ComingInPhase';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export const metadata: Metadata = {
  title: 'Compare',
  description: 'Two lifetimes side by side, whether they overlapped, and for how long.',
};

export default function ComparePage() {
  return (
    <PageShell>
      <PageHeader
        title="Compare"
        lede="Two lifetimes side by side, whether they overlapped, and for how long."
      />
      <ComingInPhase
        phase={9}
        what="Two lifetimes side by side, whether they overlapped, and for how long."
        dependsOn="Waits on the comparison views."
      />
    </PageShell>
  );
}
