"use client";

import { useState } from "react";
import type { Meeting } from "@/lib/types";
import RaceTabs from "./RaceTabs";
import RunnerCard from "./RunnerCard";
import { StarIcon } from "./Icons";

export default function RaceView({ meeting }: { meeting: Meeting }) {
  const [idx, setIdx] = useState(0);
  const race = meeting.races[idx];
  if (!race) return null;

  const valueCount = race.runners.filter((r) => r.is_value).length;
  const maxWin = Math.max(...race.runners.map((r) => r.win_pct), 1);

  return (
    <div className="space-y-4">
      <RaceTabs races={meeting.races} activeIdx={idx} onChange={setIdx} />

      <div className="glass shadow-glass-2 rounded-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">Race {race.race_number}</div>
            <div className="num mt-1 text-headline font-semibold leading-tight">
              {race.distance_m}m · {race.course_config} · {race.race_class ?? "Class ?"}
            </div>
            <div className="mt-1 text-caption text-ink-70">
              Going {race.going ?? "?"} · {race.runners.length} runners
            </div>
          </div>
          {race.has_results && (
            <div className="shrink-0 text-right">
              <div className="eyebrow">Top-3</div>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <span className="num text-headline font-bold text-accent-green">
                  {race.top3_hits}
                  <span className="text-ink-80">/3</span>
                </span>
              </div>
              <div className="mt-1 flex justify-end gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${
                      i < race.top3_hits ? "bg-accent-green" : "bg-white/15"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {valueCount > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-pill border border-accent-gold/30 bg-accent-gold/12 px-2.5 py-1 text-micro font-semibold text-accent-gold">
            <StarIcon className="h-3 w-3" />
            {valueCount} value bet{valueCount > 1 ? "s" : ""}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {race.runners.map((r, i) => (
          <RunnerCard
            key={`${race.race_id}-${r.horse_name}`}
            runner={r}
            hasResults={race.has_results}
            maxWin={maxWin}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
