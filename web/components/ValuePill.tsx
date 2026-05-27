export default function ValuePill({ edge }: { edge: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent-gold/40 bg-accent-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-gold">
      <span>★</span>
      <span className="num">+{edge.toFixed(1)}%</span>
    </span>
  );
}
