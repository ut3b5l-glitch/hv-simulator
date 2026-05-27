"use client";

import { useState } from "react";
import type { Runner } from "@/lib/types";
import ValuePill from "./ValuePill";
import FactorBars from "./FactorBars";

function rankBadgeClasses(rank: number, hit: boolean | null) {
  if (hit === true)
    return "bg-accent-green/20 text-accent-green ring-1 ring-accent-green/40";
  if (hit === false && rank <= 3)
    return "bg-accent-red/15 text-accent-red ring-1 ring-accent-red/30";
  if (rank === 1) return "bg-accent-gold/20 text-accent-gold ring-1 ring-accent-gold/40";
  if (rank <= 3) return "bg-white/12 text-white ring-1 ring-white/15";
  return "bg-white/5 text-white/60 ring-1 ring-white/10";
}

export default function RunnerCard({
  runner,
  hasResults,
}: {
  runner: Runner;
  hasResults: boolean;
}) {
  const [open, setOpen] = useState(false);
  const actualHit =
    hasResults && runner.actual_position !== null && runner.actual_position !== undefined
      ? runner.actual_position <= 3
      : null;

  return (
    <div className="glass rounded-squircle shadow-glass">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-3.5 text-left active:scale-[0.997] transition-transform"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-bold ${rankBadgeClasses(
            runner.rank,
            actualHit,
          )}`}
        >
          {runner.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold leading-tight">
              {runner.horse_name}
            </span>
            {runner.is_value && runner.edge !== null && runner.edge !== undefined && (
              <ValuePill edge={runner.edge} />
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/55">
            {runner.horse_no !== null && runner.horse_no !== undefined && (
              <span>#{runner.horse_no}</span>
            )}
            {runner.barrier !== null && runner.barrier !== undefined && (
              <span>Bar {runner.barrier}</span>
            )}
            {runner.jockey_name && <span className="truncate">{runner.jockey_name}</span>}
          </div>
        </div>

        <div className="text-right">
          <div className="num text-lg font-semibold leading-none text-white">
            {runner.win_pct.toFixed(1)}
            <span className="ml-0.5 text-[11px] font-medium text-white/55">%</span>
          </div>
          <div className="num mt-1 text-[11px] text-white/55">
            P {runner.place_pct.toFixed(0)}% · S {runner.show_pct.toFixed(0)}%
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/8 px-4 pb-4 pt-3">
          <div className="grid grid-cols-3 gap-2 pb-3">
            <SmallStat
              label="Odds"
              value={runner.public_odds ? runner.public_odds.toFixed(1) : "—"}
            />
            <SmallStat
              label="Market"
              value={
                runner.market_pct !== null && runner.market_pct !== undefined
                  ? `${runner.market_pct.toFixed(1)}%`
                  : "—"
              }
            />
            <SmallStat
              label="Edge"
              value={
                runner.edge !== null && runner.edge !== undefined
                  ? (runner.edge >= 0 ? "+" : "") + runner.edge.toFixed(1) + "%"
                  : "—"
              }
              tone={
                runner.edge !== null && runner.edge !== undefined
                  ? runner.edge > 0
                    ? "good"
                    : "bad"
                  : "default"
              }
            />
            <SmallStat label="OR" value={runner.official_rating?.toString() ?? "—"} />
            <SmallStat
              label="Days"
              value={runner.days_since_last_run?.toString() ?? "—"}
            />
            <SmallStat
              label="Actual"
              value={
                runner.actual_position
                  ? `${runner.actual_position}${ord(runner.actual_position)}`
                  : "—"
              }
              tone={
                runner.actual_position && runner.actual_position <= 3 ? "good" : "default"
              }
            />
            <div className="col-span-3 rounded-xl bg-white/4 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-wider text-white/45">
                Last 6
              </div>
              <div className="num mt-0.5 font-mono text-[13px] font-semibold tracking-wider">
                {runner.last_6_runs ?? "—"}
              </div>
            </div>
          </div>
          {runner.trainer_name && (
            <div className="pb-3 text-[12px] text-white/60">
              Trainer · {runner.trainer_name}
            </div>
          )}
          {runner.factors && <FactorBars factors={runner.factors} />}
        </div>
      )}
    </div>
  );
}

function ord(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function SmallStat({
  label,
  value,
  tone = "default",
  mono = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad";
  mono?: boolean;
}) {
  const tones: Record<string, string> = {
    default: "text-white",
    good: "text-accent-green",
    bad: "text-accent-red",
  };
  return (
    <div className="rounded-xl bg-white/4 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/45">{label}</div>
      <div
        className={`num mt-0.5 text-sm font-semibold ${tones[tone]} ${
          mono ? "font-mono text-[12px]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
