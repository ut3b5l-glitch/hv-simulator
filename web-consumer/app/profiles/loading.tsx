import GlassCard from "@/components/GlassCard";
import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5 pb-8">
      <header className="space-y-2.5">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="h-9 w-40 rounded-tile" />
      </header>

      {/* Segmented control */}
      <Skeleton className="h-12 w-full rounded-pill" />
      {/* Search */}
      <Skeleton className="h-12 w-full rounded-pill" />

      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <GlassCard key={i} className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="w-20 space-y-2">
                <Skeleton className="h-5 w-12 self-end" />
                <Skeleton className="h-1 w-full rounded-pill" />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
