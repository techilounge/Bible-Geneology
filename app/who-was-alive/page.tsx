import type { Metadata } from 'next';
import { ComingInPhase } from '@/components/layout/ComingInPhase';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export const metadata: Metadata = {
  title: 'Who was alive',
  description:
    'Pick a year and see everyone the dataset can place alive in it, with their ages.',
};

export default function WhoWasAlivePage() {
  return (
    <PageShell>
      <PageHeader
        title="Who was alive"
        lede="Pick a year and see everyone the dataset can place alive in it, with their ages."
      />
      <ComingInPhase
        phase={8}
        what="Pick a year and see everyone the dataset can place alive in it, with their ages."
        dependsOn="Waits on the year explorer."
      />
    </PageShell>
  );
}
