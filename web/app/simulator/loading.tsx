import GlassCard from "@/components/GlassCard";
import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5 pb-8">
      <header className="space-y-2.5">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-9 w-52 rounded-tile" />
        <Skeleton className="h-3 w-64" />
      </header>

      {/* Meeting chips */}
      <div className="flex gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-pill" />
        ))}
      </div>

      {/* Race chips */}
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-tile" />
        ))}
      </div>

      {/* Race header */}
      <GlassCard className="space-y-2.5 p-4">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </GlassCard>

      {/* Controls */}
      <div className="flex gap-2">
        <Skeleton className="h-11 w-32 rounded-tile" />
        <Skeleton className="h-11 flex-1 rounded-tile" />
      </div>

      {/* Ranked runners */}
      <div className="space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <GlassCard key={i} level={1} className="p-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-6 w-6 rounded-chip" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-12" />
            </div>
            <Skeleton className="mt-2.5 h-1.5 w-full rounded-pill" />
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
