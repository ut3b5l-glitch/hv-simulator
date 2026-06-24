import GlassCard from "@/components/GlassCard";
import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-2.5">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-8 w-44 rounded-tile" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-9 w-28 rounded-pill" />
      </header>

      {/* Night tally */}
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>

      {/* Race result cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} level={1} className="space-y-3 p-4">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-12" />
            </div>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-[8px]" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
