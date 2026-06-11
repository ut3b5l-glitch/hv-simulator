"use client";

import { useEffect, useState } from "react";
import type { Race } from "@/lib/types";
import SaddleCloth from "./SaddleCloth";

/**
 * PayoutCalc — "what would I collect?"
 * One stake, instant math, zero jargon. HK tote win odds are total-return
 * per $1, so a $100 ticket at 2.8 collects $280. We only ever compute from
 * published win odds — no invented place dividends.
 */
const CHIPS = [20, 50, 100, 200];
const STORE_KEY = "zokki-stake";

function hk(n: number): string {
  return `HK$${Math.round(n).toLocaleString("en-US")}`;
}

export default function PayoutCalc({ race }: { race: Race }) {
  const [stake, setStake] = useState(100);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(STORE_KEY) ?? "", 10);
    if (!Number.isNaN(saved) && saved >= 10) {
      setStake(saved);
      setCustom(!CHIPS.includes(saved));
    }
  }, []);

  function pick(v: number, isCustom = false) {
    const clamped = Math.max(10, Math.min(1_000_000, v));
    setStake(clamped);
    setCustom(isCustom);
    localStorage.setItem(STORE_KEY, String(clamped));
  }

  const picks = [...race.runners].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const priced = picks.filter((p) => p.public_odds != null && p.public_odds > 0);
  const settled = race.has_results;
  const winningPick = settled
    ? picks.find((p) => p.actual_position === 1) ?? null
    : null;
  const bestPlaced = settled
    ? [...picks]
        .filter((p) => p.actual_position != null)
        .sort((a, b) => a.actual_position! - b.actual_position!)[0] ?? null
    : null;

  // No odds yet (card is up before race-day evening) — say so, plainly.
  if (!priced.length) {
    return (
      <section className="glass rounded-card p-4 shadow-glass-2">
        <div className="eyebrow">What would you collect?</div>
        <p className="mt-2 text-body text-ink-60">
          Live odds land on race-day evening — come back then and we&apos;ll do
          the maths for you.
        </p>
      </section>
    );
  }

  return (
    <section className="glass rounded-card p-4 shadow-glass-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="eyebrow">
          {settled ? "How the money went" : "What would you collect?"}
        </div>
        {!settled && (
          <span className="text-micro text-ink-80">at current win odds</span>
        )}
      </div>

      {/* One stake, four chips, one optional field. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {CHIPS.map((v) => {
          const active = !custom && stake === v;
          return (
            <button
              key={v}
              onClick={() => pick(v)}
              className={`tap num rounded-pill px-3.5 py-1.5 text-callout font-bold transition-all duration-200 ${
                active
                  ? "glass-strong text-white ring-1 ring-accent-gold/50 shadow-glow-gold"
                  : "glass-tile text-ink-60"
              }`}
            >
              ${v}
            </button>
          );
        })}
        <label
          className={`flex items-center gap-1 rounded-pill px-3 py-1.5 transition-all duration-200 ${
            custom
              ? "glass-strong ring-1 ring-accent-gold/50 shadow-glow-gold"
              : "glass-tile"
          }`}
        >
          <span className="text-micro font-semibold text-ink-70">HK$</span>
          <input
            inputMode="numeric"
            value={custom ? stake : ""}
            placeholder="other"
            onFocus={(e) => {
              setCustom(true);
              e.target.select();
            }}
            onChange={(e) => {
              const v = parseInt(e.target.value.replace(/\D/g, ""), 10);
              pick(Number.isNaN(v) ? 10 : v, true);
            }}
            className="num w-14 bg-transparent text-callout font-bold text-white outline-none placeholder:text-ink-80"
          />
        </label>
      </div>

      {settled ? (
        /* Receipt — what actually happened, at the stake you chose. */
        <div className="mt-4">
          {winningPick && winningPick.public_odds ? (
            <div className="glass-gold rounded-tile p-3.5">
              <div className="flex items-center gap-3">
                <SaddleCloth no={winningPick.horse_no} size="sm" tone="gold" />
                <div className="min-w-0 flex-1 text-callout leading-snug text-ink-50">
                  <span className="font-bold text-white">
                    {winningPick.horse_name}
                  </span>{" "}
                  won at {winningPick.public_odds.toFixed(1)} — a{" "}
                  <span className="num font-bold">{hk(stake)}</span> win ticket
                  collected{" "}
                  <span
                    key={stake}
                    className="num animate-fade-in font-bold text-accent-gold"
                  >
                    {hk(stake * winningPick.public_odds)}
                  </span>
                  <span className="num text-accent-green">
                    {" "}
                    (+{hk(stake * (winningPick.public_odds - 1))})
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-body leading-relaxed text-ink-60">
              {bestPlaced && bestPlaced.actual_position! <= 3 ? (
                <>
                  <span className="font-semibold text-white">
                    {bestPlaced.horse_name}
                  </span>{" "}
                  ran {bestPlaced.actual_position === 2 ? "second" : "third"} —
                  close, but a win ticket needs the win. No collect here.
                </>
              ) : (
                <>None of our three got there — no collect on this one.</>
              )}
            </p>
          )}
        </div>
      ) : (
        /* The three tickets, instantly priced. */
        <>
          <div className="mt-4 space-y-2">
            {priced.map((p) => {
              const collect = stake * p.public_odds!;
              return (
                <div
                  key={p.horse_name}
                  className="glass-tile flex items-center gap-3 rounded-tile px-3 py-2.5"
                >
                  <SaddleCloth no={p.horse_no} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-callout font-semibold">
                      {p.horse_name}
                    </div>
                    <div className="num text-micro text-ink-70">
                      odds {p.public_odds!.toFixed(1)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      key={`${stake}-${p.horse_name}`}
                      className="num animate-fade-in text-headline font-bold leading-none"
                    >
                      {hk(collect)}
                    </div>
                    <div className="num mt-0.5 text-micro font-semibold text-accent-green">
                      +{hk(collect - stake)} if it wins
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {priced.length === 3 && (
            <p className="num mt-3 text-caption text-ink-70">
              Cover all three for {hk(stake * 3)} — whichever wins pays as
              above.
            </p>
          )}
        </>
      )}

      <p className="mt-3 border-t hairline pt-2.5 text-micro text-ink-80">
        Just for fun — odds move until the off, and nothing here is a promise.
        18+ · play responsibly.
      </p>
    </section>
  );
}
