import type { Metadata } from 'next';
import { ComingInPhase } from '@/components/layout/ComingInPhase';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export const metadata: Metadata = {
  title: 'People',
  description:
    'Every person in the dataset, with their dates, their sources, and the working behind each derived year.',
};

export default function PeoplePage() {
  return (
    <PageShell>
      <PageHeader
        title="People"
        lede="Every person in the dataset, with their dates, their sources, and the working behind each derived year."
      />
      <ComingInPhase
        phase={6}
        what="Every person in the dataset, with their dates, their sources, and the working behind each derived year."
        dependsOn="Waits on the character experience."
      />
    </PageShell>
  );
}
