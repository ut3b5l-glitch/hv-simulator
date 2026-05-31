import GlassCard from "@/components/GlassCard";
import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5 pb-8">
      <header className="space-y-2.5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-9 w-48 rounded-tile" />
        <Skeleton className="h-3 w-40" />
      </header>

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} className="space-y-2.5 p-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-16" />
          </GlassCard>
        ))}
      </div>

      <section className="space-y-2">
        <Skeleton className="h-2.5 w-28" />
        {Array.from({ length: 3 }).map((_, i) => (
          <GlassCard key={i} className="p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-6 w-10" />
            </div>
            <Skeleton className="mt-2.5 h-1 w-full rounded-pill" />
          </GlassCard>
        ))}
      </section>
    </div>
  );
}
