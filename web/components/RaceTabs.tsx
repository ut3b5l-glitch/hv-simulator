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
          return (
            <button
              key={race.race_id}
              onClick={() => onChange(i)}
              className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                active
                  ? "glass-strong text-accent-gold shadow-glass ring-1 ring-accent-gold/40"
                  : "glass text-white/70"
              }`}
            >
              R{race.race_number}
            </button>
          );
        })}
      </div>
    </div>
  );
}
