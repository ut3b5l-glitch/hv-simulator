"use client";

import { useMemo, useState } from "react";
import type { Profiles, EntityRecord } from "@/lib/types";
import GlassCard from "./GlassCard";

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

  return (
    <div className="space-y-3">
      <div className="glass flex gap-1 rounded-2xl p-1">
        {(["jockeys", "trainers", "horses"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium capitalize transition-all ${
              tab === t ? "bg-white/12 text-white shadow-sm" : "text-white/55"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder={`Search ${tab}…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="glass w-full rounded-2xl px-4 py-3 text-sm placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
      />

      <div className="space-y-2">
        {filtered.map((rec) => (
          <EntityRow key={rec.id} rec={rec} mode={tab} />
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-white/50">No matches.</div>
        )}
      </div>
    </div>
  );
}

function EntityRow({ rec, mode }: { rec: EntityRecord; mode: Tab }) {
  const runs = rec.runs ?? rec.rides ?? 0;
  return (
    <GlassCard className="flex items-center gap-3 p-3.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{rec.name}</div>
        <div className="mt-0.5 text-[11px] text-white/55">
          {runs} {mode === "jockeys" ? "rides" : "runs"} · {rec.wins} wins ·{" "}
          {rec.places} places
        </div>
        {rec.trail60 && rec.trail60.rides > 0 && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/6 px-2 py-0.5 text-[10px] text-white/70">
            60d · {rec.trail60.rides}r · {rec.trail60.win_pct.toFixed(0)}% W
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="num text-base font-semibold">
          {rec.win_pct.toFixed(1)}
          <span className="ml-0.5 text-[11px] font-medium text-white/55">%</span>
        </div>
        <div className="num text-[11px] text-white/55">
          P {rec.place_pct.toFixed(0)}%
        </div>
      </div>
    </GlassCard>
  );
}
