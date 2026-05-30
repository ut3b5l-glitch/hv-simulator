export default function EmptyState({
  title = "No meetings yet",
  hint,
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
      <div className="glass-strong mb-4 grid h-14 w-14 place-items-center rounded-card text-ink-60">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M3 9h18M8 14h8" />
        </svg>
      </div>
      <div className="text-title font-semibold">{title}</div>
      <div className="mt-2 max-w-xs text-callout text-ink-70">
        {hint ?? (
          <>
            Run{" "}
            <code className="num rounded bg-white/10 px-1.5 py-0.5 text-caption">
              python export_data.py
            </code>{" "}
            to publish a snapshot.
          </>
        )}
      </div>
    </div>
  );
}
