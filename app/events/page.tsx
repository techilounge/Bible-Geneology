import type { Metadata } from 'next';
import { ComingInPhase } from '@/components/layout/ComingInPhase';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Dated events, and who the dataset can place alive when each happened.',
};

export default function EventsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Events"
        lede="Dated events, and who the dataset can place alive when each happened."
      />
      <ComingInPhase
        phase={9}
        what="Dated events, and who the dataset can place alive when each happened."
        dependsOn="Waits on the comparison and event views."
      />
    </PageShell>
  );
}
