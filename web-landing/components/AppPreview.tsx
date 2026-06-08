import Wordmark from "./Wordmark";
import type { Dict } from "@/lib/i18n";

// A single runner row inside the mock race card.
function RunnerLine({
  n,
  name,
  pct,
  tone,
  width,
}: {
  n: number;
  name: string;
  pct: number;
  tone: "win" | "place" | "market";
  width: number;
}) {
  const fill =
    tone === "win"
      ? "bg-gradient-to-r from-accent-green to-accent-cyan"
      : tone === "place"
        ? "bg-gradient-to-r from-accent-blue to-accent-cyan"
        : "bg-[rgba(22,49,68,0.22)]";
  const chip =
    tone === "win"
      ? "bg-accent-green/15 text-accent-green"
      : tone === "place"
        ? "bg-accent-red/12 text-accent-red"
        : "bg-[rgba(22,49,68,0.08)] text-ink-60";
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-caption font-bold ${chip}`}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-callout font-semibold text-ink-50">{name}</span>
          <span className="num shrink-0 text-callout font-bold text-ink-50">
            {pct}
            <span className="text-micro font-semibold text-ink-70">%</span>
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-pill bg-[rgba(22,49,68,0.06)]">
          <div className={`h-full rounded-pill ${fill}`} style={{ width: `${width}%` }} />
        </div>
      </div>
    </div>
  );
}

/**
 * In-DOM recreation of a real Zokki race read (the 3 Jun Happy Valley R1),
 * framed as a phone. Built from the same tokens as the app so it stays crisp
 * and on-palette at any size — no raster screenshot to go stale.
 */
export default function AppPreview({ t }: { t: Dict["preview"] }) {
  return (
    <div className="mx-auto w-[270px] sm:w-[286px]">
      <div className="rounded-[2.5rem] border border-[rgba(22,49,68,0.16)] bg-[#0c1f2e] p-2.5 shadow-[0_44px_100px_-34px_rgba(22,49,68,0.6)]">
        <div className="overflow-hidden rounded-[2rem] bg-[#eaf2ef]">
          {/* App hero */}
          <div className="hero-grad px-4 pb-4 pt-4">
            <Wordmark tone="light" className="origin-left scale-90" />
            <div className="mt-3.5 text-micro font-semibold uppercase tracking-eyebrow text-mint/70">
              {t.venue}
            </div>
            <div className="text-[1.35rem] font-bold leading-none text-mint">{t.date}</div>
            <div className="mt-1 text-caption text-mint/60">{t.meta}</div>
          </div>

          {/* Race card */}
          <div className="p-3">
            <div className="glass rounded-card p-3.5">
              <div className="flex items-center justify-between">
                <span className="rounded-pill bg-accent-gold/15 px-2 py-0.5 text-micro2 font-bold uppercase tracking-wide text-accent-gold">
                  {t.verdict}
                </span>
                <span className="num text-micro text-ink-70">{t.raceMeta}</span>
              </div>
              <p className="mt-2.5 text-caption leading-relaxed text-ink-50">{t.narrative}</p>
              <div className="mt-3.5 space-y-2.5">
                <RunnerLine n={1} name="Family Fortune" pct={31} tone="win" width={100} />
                <RunnerLine n={2} name="Wah May Wai Wai" pct={24} tone="place" width={77} />
                <RunnerLine n={3} name="Setanta" pct={14} tone="market" width={45} />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5 pb-1">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent-green" />
              <span className="h-1.5 w-1.5 rounded-full bg-[rgba(22,49,68,0.2)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[rgba(22,49,68,0.2)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
