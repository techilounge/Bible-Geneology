import { PageShell } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <PageShell>
      <p role="status" className="sr-only">
        Loading
      </p>
      <Skeleton className="h-12 w-3/4 max-w-lg" />
      <Skeleton className="h-5 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </PageShell>
  );
}
