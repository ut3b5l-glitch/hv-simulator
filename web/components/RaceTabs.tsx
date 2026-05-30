"use client";

import type { Race } from "@/lib/types";

export default function RaceTabs({
  races,
  activeIdx,
  onChange,
}: {
  races: Race[];
  activeIdx: number;
  onChange: (idx: number) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
      <div className="flex gap-2 pb-1">
        {races.map((race, i) => {
          const active = i === activeIdx;
          const settled = race.has_results;
          return (
            <button
              key={race.race_id}
              onClick={() => onChange(i)}
              className={`tap relative flex shrink-0 flex-col items-center gap-1 rounded-tile px-3.5 py-2 transition-all duration-300 ease-out-expo ${
                active
                  ? "glass-strong text-white ring-1 ring-accent-gold/45 shadow-glow-gold"
                  : "glass text-ink-60"
              }`}
            >
              <span className="num text-callout font-bold leading-none">
                R{race.race_number}
              </span>
              {settled ? (
                <span
                  className={`h-1 w-1 rounded-full ${
                    race.top3_hits >= 2
                      ? "bg-accent-green"
                      : race.top3_hits === 1
                        ? "bg-accent-gold"
                        : "bg-accent-red/80"
                  }`}
                />
              ) : (
                <span className="h-1 w-1 rounded-full bg-white/20" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
