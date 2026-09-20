import type { Metadata } from 'next';
import { ComingInPhase } from '@/components/layout/ComingInPhase';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export const metadata: Metadata = {
  title: 'Discover',
  description:
    'Findings the dataset actually supports, each shown with the numbers behind it.',
};

export default function DiscoverPage() {
  return (
    <PageShell>
      <PageHeader
        title="Discover"
        lede="Findings the dataset actually supports, each shown with the numbers behind it."
      />
      <ComingInPhase
        phase={11}
        what="Findings the dataset actually supports, each shown with the numbers behind it."
        dependsOn="Waits on the discovery engine, which reads the verified dataset rather than generating claims."
      />
    </PageShell>
  );
}
