"use client";

import { useState } from "react";
import type { Runner } from "@/lib/types";
import ValuePill from "./ValuePill";
import FactorBars from "./FactorBars";
import ProbBar from "./ProbBar";
import WPSMeter from "./WPSMeter";
import { ChevronIcon } from "./Icons";

function rankBadge(rank: number, hit: boolean | null) {
  if (hit === true)
    return "bg-accent-green/20 text-accent-green ring-1 ring-accent-green/45 shadow-glow-green";
  if (hit === false && rank <= 3)
    return "bg-accent-red/15 text-accent-red ring-1 ring-accent-red/30";
  if (rank === 1)
    return "bg-accent-gold/20 text-accent-gold ring-1 ring-accent-gold/45 shadow-glow-gold";
  if (rank <= 3) return "bg-white/12 text-white ring-1 ring-white/15";
  return "bg-white/[0.05] text-ink-70 ring-1 ring-white/10";
}

export default function RunnerCard({
  runner,
  hasResults,
  maxWin,
  index = 0,
}: {
  runner: Runner;
  hasResults: boolean;
  maxWin: number;
  index?: number;
}) {
  const [open, setOpen] = useState(false);
  const actualHit =
    hasResults && runner.actual_position != null ? runner.actual_position <= 3 : null;
  const isValue = runner.is_value && runner.edge != null;

  return (
    <div
      className={`stagger overflow-hidden rounded-card ${isValue ? "glass-gold" : "glass shadow-glass-2"}`}
      style={{ ["--i" as string]: index }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="tap flex w-full flex-col gap-2.5 p-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-tile text-headline font-bold ${rankBadge(
              runner.rank,
              actualHit,
            )}`}
          >
            {runner.rank}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-body font-semibold leading-tight">
                {runner.horse_name}
              </span>
              {isValue && <ValuePill edge={runner.edge!} />}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-micro text-ink-70">
              {runner.horse_no != null && <span className="num">#{runner.horse_no}</span>}
              {runner.barrier != null && (
                <>
                  <Dot />
                  <span className="num">Bar {runner.barrier}</span>
                </>
              )}
              {runner.jockey_name && (
                <>
                  <Dot />
                  <span className="truncate">{runner.jockey_name}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="num text-title font-semibold leading-none text-white">
                {runner.win_pct.toFixed(1)}
                <span className="ml-0.5 text-micro font-medium text-ink-70">%</span>
              </div>
              <div className="eyebrow mt-1 text-[0.5625rem] text-ink-80">win</div>
            </div>
            <ChevronIcon
              className={`h-4 w-4 shrink-0 text-ink-80 transition-transform duration-300 ease-out-expo ${
                open ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>

        {/* Always-on comparative win bar (scaled to the field leader). */}
        <ProbBar value={runner.win_pct} max={maxWin} tone={isValue ? "gold" : "win"} height={4} />
      </button>

      {open && (
        <div className="animate-expand-down border-t hairline px-3.5 pb-4 pt-3">
          <div className="mb-3">
            <div className="eyebrow mb-1.5">Win · Place · Show</div>
            <WPSMeter win={runner.win_pct} place={runner.place_pct} show={runner.show_pct} />
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <SmallStat label="Odds" value={runner.public_odds ? runner.public_odds.toFixed(1) : "—"} />
            <SmallStat
              label="Market"
              value={runner.market_pct != null ? `${runner.market_pct.toFixed(1)}%` : "—"}
            />
            <SmallStat
              label="Edge"
              value={
                runner.edge != null
                  ? (runner.edge >= 0 ? "+" : "") + runner.edge.toFixed(1) + "%"
                  : "—"
              }
              tone={runner.edge != null ? (runner.edge > 0 ? "good" : "bad") : "default"}
            />
            <SmallStat label="Rating" value={runner.official_rating?.toString() ?? "—"} />
            <SmallStat label="Days" value={runner.days_since_last_run?.toString() ?? "—"} />
            <SmallStat
              label="Result"
              value={runner.actual_position ? `${runner.actual_position}${ord(runner.actual_position)}` : "—"}
              tone={runner.actual_position && runner.actual_position <= 3 ? "good" : "default"}
            />
          </div>

          {runner.last_6_runs && (
            <div className="mt-2.5">
              <div className="eyebrow mb-1.5">Last 6</div>
              <FormChips runs={runner.last_6_runs} />
            </div>
          )}

          {runner.trainer_name && (
            <div className="mt-2.5 text-caption text-ink-70">
              Trainer · <span className="text-ink-60">{runner.trainer_name}</span>
            </div>
          )}

          {runner.factors && (
            <div className="mt-3">
              <FactorBars factors={runner.factors} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Dot() {
  return <span className="h-0.5 w-0.5 rounded-full bg-white/30" />;
}

function ord(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function FormChips({ runs }: { runs: string }) {
  const parts = runs.split("/").map((p) => p.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p, i) => {
        const n = parseInt(p, 10);
        const tone = Number.isNaN(n)
          ? "bg-white/[0.06] text-ink-70"
          : n === 1
            ? "bg-accent-gold/20 text-accent-gold ring-1 ring-accent-gold/30"
            : n <= 3
              ? "bg-accent-green/15 text-accent-green ring-1 ring-accent-green/25"
              : "bg-white/[0.06] text-ink-60";
        return (
          <span
            key={i}
            className={`num grid h-6 w-6 place-items-center rounded-chip text-caption font-bold ${tone}`}
          >
            {p}
          </span>
        );
      })}
    </div>
  );
}

function SmallStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad";
}) {
  const tones: Record<string, string> = {
    default: "text-white",
    good: "text-accent-green",
    bad: "text-accent-red",
  };
  return (
    <div className="glass-tile rounded-tile px-2.5 py-2">
      <div className="text-micro2 uppercase tracking-wide text-ink-80">{label}</div>
      <div className={`num mt-0.5 text-callout font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}
