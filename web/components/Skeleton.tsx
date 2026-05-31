/**
 * Shimmering placeholder block. Compose these into route-level `loading.tsx`
 * skeletons that echo the real layout so route transitions don't flash empty.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-chip ${className}`} aria-hidden />;
}
