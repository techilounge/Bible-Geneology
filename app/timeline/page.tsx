import type { Metadata } from 'next';
import { ComingInPhase } from '@/components/layout/ComingInPhase';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export const metadata: Metadata = {
  title: 'Timeline',
  description:
    'Every dated lifetime on one scrollable axis, with the confidence of each date shown on the bar itself.',
};

export default function TimelinePage() {
  return (
    <PageShell>
      <PageHeader
        title="Timeline"
        lede="Every dated lifetime on one scrollable axis, with the confidence of each date shown on the bar itself."
      />
      <ComingInPhase
        phase={7}
        what="Every dated lifetime on one scrollable axis, with the confidence of each date shown on the bar itself."
        dependsOn="Waits on the timeline engine and the visual encoding of confidence."
      />
    </PageShell>
  );
}
