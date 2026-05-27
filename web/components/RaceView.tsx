"use client";

import { useState } from "react";
import type { Meeting } from "@/lib/types";
import RaceTabs from "./RaceTabs";
import RunnerCard from "./RunnerCard";
import GlassCard from "./GlassCard";

export default function RaceView({ meeting }: { meeting: Meeting }) {
  const [idx, setIdx] = useState(0);
  const race = meeting.races[idx];
  if (!race) return null;

  const valueCount = race.runners.filter((r) => r.is_value).length;

  return (
    <div className="space-y-4">
      <RaceTabs races={meeting.races} activeIdx={idx} onChange={setIdx} />

      <GlassCard className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">
              Race {race.race_number}
            </div>
            <div className="num mt-0.5 text-lg font-semibold">
              {race.distance_m}m · {race.course_config} · {race.race_class ?? "Class ?"}
            </div>
            <div className="mt-0.5 text-xs text-white/55">
              Going {race.going ?? "?"} · {race.runners.length} runners
            </div>
          </div>
          {race.has_results && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/50">
                Top-3 Hits
              </div>
              <div className="num text-lg font-semibold text-accent-green">
                {race.top3_hits}/3
              </div>
            </div>
          )}
        </div>
        {valueCount > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-gold/12 px-2.5 py-1 text-[11px] font-medium text-accent-gold ring-1 ring-accent-gold/30">
            ★ {valueCount} value bet{valueCount > 1 ? "s" : ""}
          </div>
        )}
      </GlassCard>

      <div className="space-y-2">
        {race.runners.map((r) => (
          <RunnerCard key={`${race.race_id}-${r.horse_name}`} runner={r} hasResults={race.has_results} />
        ))}
      </div>
    </div>
  );
}
