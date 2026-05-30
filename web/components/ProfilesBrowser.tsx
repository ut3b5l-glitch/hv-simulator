"use client";

import { useMemo, useState } from "react";
import type { Profiles, EntityRecord } from "@/lib/types";
import ProbBar from "./ProbBar";
import { SearchIcon } from "./Icons";

type Tab = "horses" | "jockeys" | "trainers";

export default function ProfilesBrowser({ profiles }: { profiles: Profiles }) {
  const [tab, setTab] = useState<Tab>("jockeys");
  const [query, setQuery] = useState("");

  const list = profiles[tab];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? list.filter((r) => r.name.toLowerCase().includes(q)) : list;
    return base.slice(0, 200);
  }, [list, query]);

  const maxWin = useMemo(
    () => Math.max(...filtered.map((r) => r.win_pct), 1),
    [filtered],
  );

  return (
    <div className="space-y-3">
      {/* Segmented control */}
      <div className="glass flex gap-1 rounded-pill p-1">
        {(["jockeys", "trainers", "horses"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tap flex-1 rounded-pill px-3 py-2 text-callout font-semibold capitalize transition-all duration-300 ease-out-expo ${
              tab === t ? "bg-white/12 text-white shadow-glass-1" : "text-ink-70"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="glass relative flex items-center rounded-pill">
        <SearchIcon className="pointer-events-none absolute left-3.5 h-4 w-4 text-ink-80" />
        <input
          type="search"
          placeholder={`Search ${tab}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-pill bg-transparent py-3 pl-10 pr-4 text-body placeholder:text-ink-80 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((rec, i) => (
          <EntityRow key={rec.id} rec={rec} mode={tab} maxWin={maxWin} index={Math.min(i, 12)} />
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-callout text-ink-70">No matches.</div>
        )}
      </div>
    </div>
  );
}

function EntityRow({
  rec,
  mode,
  maxWin,
  index,
}: {
  rec: EntityRecord;
  mode: Tab;
  maxWin: number;
  index: number;
}) {
  const runs = rec.runs ?? rec.rides ?? 0;
  const trail = rec.trail60;
  return (
    <div
      className="stagger glass shadow-glass-2 rounded-card p-3.5"
      style={{ ["--i" as string]: index }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-semibold">{rec.name}</div>
          <div className="num mt-0.5 text-micro text-ink-70">
            {runs} {mode === "jockeys" ? "rides" : "runs"} · {rec.wins}W · {rec.places}P
          </div>
          {trail && trail.rides > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-pill border border-accent-indigo/25 bg-accent-indigo/10 px-2 py-0.5 text-micro2 font-medium text-accent-indigo">
              <span className="h-1 w-1 rounded-full bg-accent-indigo" />
              60d · {trail.rides}r · {trail.win_pct.toFixed(0)}% win
            </div>
          )}
        </div>
        <div className="w-20 shrink-0 text-right">
          <div className="num text-headline font-semibold">
            {rec.win_pct.toFixed(1)}
            <span className="ml-0.5 text-micro font-medium text-ink-70">%</span>
          </div>
          <div className="num text-micro text-ink-70">P {rec.place_pct.toFixed(0)}%</div>
          <ProbBar value={rec.win_pct} max={maxWin} tone="win" height={3} className="mt-1.5" />
        </div>
      </div>
    </div>
  );
}
