// Lightweight fallback UI shown instantly via loading.tsx while a page's
// server-side data fetch is in flight — makes the cold-start wait (1.7-2.4s
// per real production profiling) feel like the app responded immediately
// instead of a blank screen, rather than actually shortening it.
export default function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 bg-surface-warm rounded" />
        <div className="h-9 w-9 bg-surface-warm rounded-full" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 bg-surface-warm rounded-lg" />
        ))}
      </div>
    </div>
  );
}
