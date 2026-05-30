"use client";

import { useMemo, useState } from "react";
import type { Runner } from "@/lib/types";

/**
 * Finishing-position distribution from the Monte-Carlo run.
 * `posDist[runnerIndex][place]` is the probability (%) that runner finishes in
 * a given place (0 = 1st). We render it two ways:
 *   1. a heatmap matrix — every runner × every position, intensity = likelihood
 *   2. a histogram for the tapped runner, with its expected (mean) finish
 */
export default function FinishDistribution({
  runners,
  posDist,
}: {
  runners: Runner[];
  posDist: number[][];
}) {
  const n = runners.length;

  // Rows sorted by win probability (P of 1st) — favourites on top.
  const rows = useMemo(
    () =>
      runners
        .map((r, i) => ({ r, i }))
        .sort((a, b) => (posDist[b.i]?.[0] ?? 0) - (posDist[a.i]?.[0] ?? 0)),
    [runners, posDist],
  );

  const [sel, setSel] = useState(rows[0]?.i ?? 0);
  const maxCell = useMemo(() => Math.max(...posDist.flat(), 1), [posDist]);

  const expected = (i: number) =>
    (posDist[i] ?? []).reduce((acc, p, place) => acc + (p / 100) * (place + 1), 0);

  const selDist = posDist[sel] ?? [];
  const selMax = Math.max(...selDist, 1);
  const selRunner = runners[sel];

  return (
    <div className="glass shadow-glass-2 rounded-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="eyebrow">Finishing-position distribution</div>
        <Legend />
      </div>

      {/* Heatmap matrix */}
      <div className="space-y-[3px]">
        <div
          className="grid items-center gap-[3px] pl-[34px] text-micro2 text-ink-80"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}
        >
          {Array.from({ length: n }, (_, p) => (
            <div key={p} className={`text-center ${p === 0 ? "text-accent-gold" : ""}`}>
              {p + 1}
            </div>
          ))}
        </div>

        {rows.map(({ r, i }) => {
          const active = i === sel;
          return (
            <button
              key={r.horse_id ?? i}
              onClick={() => setSel(i)}
              className={`grid w-full items-center gap-[3px] rounded-[6px] transition-colors ${
                active ? "bg-white/[0.06] ring-1 ring-accent-indigo/40" : ""
              }`}
              style={{ gridTemplateColumns: `30px repeat(${n}, minmax(0,1fr))` }}
            >
              <span
                className={`num text-right text-micro2 font-semibold ${
                  active ? "text-accent-indigo" : "text-ink-70"
                }`}
              >
                {r.horse_no ?? r.rank}
              </span>
              {Array.from({ length: n }, (_, p) => {
                const prob = posDist[i]?.[p] ?? 0;
                const t = prob / maxCell;
                const inMoney = p < 3;
                return (
                  <span
                    key={p}
                    title={`${r.horse_name} · P${p + 1}: ${prob.toFixed(1)}%`}
                    className="h-3.5 rounded-[3px]"
                    style={{
                      background:
                        t < 0.015
                          ? "rgba(255,255,255,0.035)"
                          : `rgba(${inMoney ? "129,140,248" : "129,140,248"}, ${(
                              0.12 +
                              0.88 * t
                            ).toFixed(3)})`,
                      boxShadow:
                        inMoney && t < 0.015
                          ? "inset 0 0 0 1px rgba(245,201,113,0.10)"
                          : undefined,
                    }}
                  />
                );
              })}
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between pl-[34px] text-micro2 text-ink-80">
        <span>← wins</span>
        <span>tap a row for detail</span>
        <span>last →</span>
      </div>

      {/* Selected-runner histogram */}
      {selRunner && (
        <div className="mt-4 border-t hairline pt-3">
          <div className="flex items-baseline justify-between">
            <div className="truncate text-body font-semibold">{selRunner.horse_name}</div>
            <div className="num shrink-0 text-micro text-ink-70">
              avg finish {expected(sel).toFixed(1)}
            </div>
          </div>
          <div
            className="mt-3 grid items-end gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`, height: 72 }}
          >
            {Array.from({ length: n }, (_, p) => {
              const prob = selDist[p] ?? 0;
              const h = Math.max(2, (prob / selMax) * 100);
              const inMoney = p < 3;
              return (
                <div key={p} className="flex h-full flex-col justify-end">
                  <div
                    className={`bar-fill origin-bottom rounded-[3px] ${
                      inMoney
                        ? "bg-gradient-to-t from-emerald-500/70 to-teal-300"
                        : "bg-gradient-to-t from-indigo-500/50 to-indigo-400/80"
                    }`}
                    style={{ height: `${h}%`, animationDelay: `${p * 25}ms` }}
                  />
                </div>
              );
            })}
          </div>
          <div
            className="mt-1 grid gap-[3px] text-center text-micro2 text-ink-80"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}
          >
            {Array.from({ length: n }, (_, p) => (
              <span key={p} className={p < 3 ? "text-accent-green/80" : ""}>
                {p + 1}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-1.5 text-micro2 text-ink-80">
      <span>low</span>
      <span
        className="h-2 w-12 rounded-pill"
        style={{
          background:
            "linear-gradient(90deg, rgba(129,140,248,0.12), rgba(129,140,248,1))",
        }}
      />
      <span>high</span>
    </div>
  );
}
