export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/70 ${className}`} />;
}

export function SkeletonStatCard() {
  return (
    <div className="flex flex-col gap-2 border border-slate-200 bg-white px-4 py-3.5">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="h-6 w-12" />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="w-full max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
