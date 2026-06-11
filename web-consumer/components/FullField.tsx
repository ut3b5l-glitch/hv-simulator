"use client";

import { useState } from "react";
import type { Race } from "@/lib/types";
import SaddleCloth from "./SaddleCloth";
import FormGlance from "./FormGlance";
import { ChevronIcon } from "./Icons";
import type { Career } from "./PickPodium";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * FullField — the rest of the runners, folded away. The three picks answer
 * the question; this exists for the curious, one tap deep, kept light.
 */
export default function FullField({
  race,
  careers,
}: {
  race: Race;
  careers: Record<number, Career>;
}) {
  const [open, setOpen] = useState(false);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const rest = [...race.runners].sort((a, b) => a.rank - b.rank).slice(3);
  if (!rest.length) return null;

  return (
    <section className="glass overflow-hidden rounded-card shadow-glass-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="tap flex w-full items-center justify-between gap-3 p-4"
      >
        <span className="text-callout font-semibold text-ink-60">
          The rest of the field
          <span className="num text-ink-80"> · {rest.length} runners</span>
        </span>
        <ChevronIcon
          className={`h-4 w-4 text-ink-80 transition-transform duration-300 ease-out-expo ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="animate-expand-down space-y-1 border-t hairline px-3 pb-3 pt-2">
          {rest.map((r) => {
            const expanded = openRow === r.rank;
            const pos = race.has_results ? r.actual_position : null;
            return (
              <div key={r.horse_name} className="overflow-hidden rounded-tile">
                <button
                  onClick={() => setOpenRow(expanded ? null : r.rank)}
                  className="tap flex w-full items-center gap-2.5 px-1.5 py-2 text-left"
                >
                  <SaddleCloth no={r.horse_no} size="sm" tone="muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-callout font-medium">
                      {r.horse_name}
                    </div>
                    {r.jockey_name && (
                      <div className="truncate text-micro text-ink-80">
                        {r.jockey_name}
                      </div>
                    )}
                  </div>
                  {pos != null && (
                    <span
                      className={`num shrink-0 text-caption font-bold ${
                        pos === 1
                          ? "text-accent-gold"
                          : pos <= 3
                            ? "text-accent-green"
                            : "text-ink-80"
                      }`}
                    >
                      {ordinal(pos)}
                    </span>
                  )}
                  <span className="num w-10 shrink-0 text-right text-caption font-semibold text-ink-70">
                    {Math.round(r.win_pct)}%
                  </span>
                </button>
                {expanded && (
                  <div className="animate-expand-down px-1.5 pb-2.5 pl-10">
                    <FormGlance
                      last6={r.last_6_runs}
                      career={r.horse_id != null ? careers[r.horse_id] : null}
                    />
                    <div className="mt-1 text-micro text-ink-80">
                      {r.public_odds ? (
                        <span className="num">odds {r.public_odds.toFixed(1)}</span>
                      ) : null}
                      {r.public_odds && r.trainer_name ? " · " : ""}
                      {r.trainer_name ? `trainer ${r.trainer_name}` : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
