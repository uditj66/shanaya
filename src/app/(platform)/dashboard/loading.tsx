import { Skeleton } from "@/components/admin/ui/skeleton";

// Shown instantly while a dashboard page loads its live data (the sidebar stays in place).
// Next wraps every dashboard page in <Suspense> with this fallback, so moving between pages never blocks.
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72 rounded-xl" />
    </div>
  );
}
