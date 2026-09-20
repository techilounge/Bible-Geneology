import type { Metadata } from 'next';
import { ComingInPhase } from '@/components/layout/ComingInPhase';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';

export const metadata: Metadata = {
  title: 'Family tree',
  description:
    'Descent and relationships as a graph you can walk, with unknown dates kept visible rather than hidden.',
};

export default function FamilyTreePage() {
  return (
    <PageShell>
      <PageHeader
        title="Family tree"
        lede="Descent and relationships as a graph you can walk, with unknown dates kept visible rather than hidden."
      />
      <ComingInPhase
        phase={10}
        what="Descent and relationships as a graph you can walk, with unknown dates kept visible rather than hidden."
        dependsOn="Waits on the tree renderer."
      />
    </PageShell>
  );
}
