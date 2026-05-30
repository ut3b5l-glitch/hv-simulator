import { StarIcon } from "./Icons";

export default function ValuePill({ edge }: { edge: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-accent-gold/40 bg-accent-gold/15 px-1.5 py-0.5 text-micro2 font-bold uppercase tracking-wide text-accent-gold">
      <StarIcon className="h-2.5 w-2.5" />
      <span className="num">+{edge.toFixed(1)}%</span>
    </span>
  );
}
