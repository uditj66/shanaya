// Shown instantly while a dashboard page loads its live data (the sidebar stays in place).
// Next wraps every dashboard page in <Suspense> with this fallback, so moving between pages never blocks.
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="h-4 w-40 animate-pulse rounded-full bg-linen" />
      <div className="mt-3 h-10 w-72 animate-pulse rounded-xl bg-linen" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-linen/70" />
        ))}
      </div>
      <div className="mt-6 h-72 animate-pulse rounded-2xl bg-linen/60" />
    </div>
  );
}
