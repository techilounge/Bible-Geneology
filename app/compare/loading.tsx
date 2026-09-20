import { PageShell } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <PageShell>
      <p role="status" className="sr-only">
        Loading compare
      </p>
      <Skeleton className="h-10 w-2/3 max-w-sm" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-40 w-full" />
    </PageShell>
  );
}
