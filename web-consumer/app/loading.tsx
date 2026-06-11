import GlassCard from "@/components/GlassCard";
import { Skeleton } from "@/components/Skeleton";

// Shown while the Races page (and date-switch navigations) resolve server-side.
export default function Loading() {
  return (
    <div className="space-y-5 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2.5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-9 w-44 rounded-tile" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-9 w-28 rounded-pill" />
      </header>

      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[3.25rem] w-12 rounded-tile" />
        ))}
      </div>

      <GlassCard className="space-y-2.5 p-4">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </GlassCard>

      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <GlassCard key={i} className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-tile" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-7 w-12 rounded-tile" />
            </div>
            <Skeleton className="mt-3 h-1.5 w-full rounded-pill" />
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
