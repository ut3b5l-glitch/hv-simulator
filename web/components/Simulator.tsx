"use client";

import { useEffect, useRef, useState } from "react";
import type { Meeting, Race, Runner } from "@/lib/types";
import ProbBar from "./ProbBar";
import FinishDistribution from "./FinishDistribution";

// ── Plackett–Luce Monte Carlo ───────────────────────────────────────────────
// Sample a full finishing order each iteration by repeatedly drawing the next
// finisher in proportion to the remaining runners' model win probabilities.
// The draws run *incrementally* in animation-frame chunks (see `run` below) so
// the on-screen probabilities visibly converge as the sample grows.
interface SimResult {
  win: number[];
  top3: number[];
  posDist: number[][]; // posDist[runner][place] = probability (%)
  exacta: { a: number; b: number; p: number }[];
  trifecta: { a: number; b: number; c: number; p: number }[];
  nSims: number;
}

// Mutable tally that survives across chunks of a single run.
interface SimAccum {
  n: number;
  baseW: number[];
  win: number[];
  top3: number[];
  posCount: number[][];
  exMap: Map<number, number>;
  triMap: Map<number, number>;
  done: number;
  w: number[];
  order: number[];
}

function makeAccum(runners: Runner[]): SimAccum {
  const n = runners.length;
  return {
    n,
    baseW: runners.map((r) => Math.max(r.win_pct, 1e-9)),
    win: new Array(n).fill(0),
    top3: new Array(n).fill(0),
    posCount: Array.from({ length: n }, () => new Array(n).fill(0)),
    exMap: new Map(),
    triMap: new Map(),
    done: 0,
    w: new Array(n).fill(0),
    order: new Array(n).fill(-1),
  };
}

function runChunk(acc: SimAccum, count: number) {
  const { n, baseW, w, order } = acc;
  for (let s = 0; s < count; s++) {
    for (let i = 0; i < n; i++) w[i] = baseW[i];
    let total = 0;
    for (let i = 0; i < n; i++) total += w[i];

    for (let pos = 0; pos < n; pos++) {
      let x = Math.random() * total;
      let pick = -1;
      for (let i = 0; i < n; i++) {
        if (w[i] <= 0) continue;
        x -= w[i];
        if (x <= 0) {
          pick = i;
          break;
        }
      }
      if (pick === -1) for (let i = n - 1; i >= 0; i--) if (w[i] > 0) { pick = i; break; }
      order[pos] = pick;
      acc.posCount[pick][pos]++;
      total -= w[pick];
      w[pick] = 0;
    }

    const first = order[0], second = order[1], third = order[2];
    acc.win[first]++;
    acc.top3[first]++;
    if (n > 1) acc.top3[second]++;
    if (n > 2) acc.top3[third]++;
    if (n > 1) acc.exMap.set(first * n + second, (acc.exMap.get(first * n + second) || 0) + 1);
    if (n > 2) {
      const key = (first * n + second) * n + third;
      acc.triMap.set(key, (acc.triMap.get(key) || 0) + 1);
    }
  }
  acc.done += count;
}

function snapshot(acc: SimAccum): SimResult {
  const n = acc.n;
  const d = acc.done || 1;
  const exacta = [...acc.exMap.entries()]
    .map(([k, c]) => ({ a: Math.floor(k / n), b: k % n, p: (c / d) * 100 }))
    .sort((x, y) => y.p - x.p)
    .slice(0, 5);
  const trifecta = [...acc.triMap.entries()]
    .map(([k, c]) => ({
      a: Math.floor(k / (n * n)),
      b: Math.floor(k / n) % n,
      c: k % n,
      p: (c / d) * 100,
    }))
    .sort((x, y) => y.p - x.p)
    .slice(0, 4);
  return {
    win: acc.win.map((c) => (c / d) * 100),
    top3: acc.top3.map((c) => (c / d) * 100),
    posDist: acc.posCount.map((row) => row.map((c) => (c / d) * 100)),
    exacta,
    trifecta,
    nSims: acc.done,
  };
}

const SIM_OPTIONS = [1000, 10000, 50000];
const FRAMES = 38; // chunks per run — the convergence animation lasts ~0.6s

// Result plus the exact runners/order it describes, set atomically so a render
// during a race switch never indexes a stale array.
interface Sim {
  result: SimResult;
  order: number[];
  runners: Runner[];
}

export default function Simulator({ meetings }: { meetings: Meeting[] }) {
  const [meetingDate, setMeetingDate] = useState(meetings[0]?.meeting_date ?? "");
  const meeting = meetings.find((m) => m.meeting_date === meetingDate) ?? meetings[0];
  const [raceNo, setRaceNo] = useState(meeting?.races[0]?.race_number ?? 1);
  const race: Race | undefined =
    meeting?.races.find((r) => r.race_number === raceNo) ?? meeting?.races[0];

  const [nSims, setNSims] = useState(10000);
  const [sim, setSim] = useState<Sim | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const runners = race?.runners ?? [];

  function run(sims = nSims) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (!runners.length) {
      setSim(null);
      return;
    }
    // Freeze display order by model win% so rows don't reshuffle mid-convergence.
    const order = runners
      .map((_, i) => i)
      .sort((x, y) => runners[y].win_pct - runners[x].win_pct);
    const snapRunners = runners;
    const acc = makeAccum(runners);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    setRunning(true);
    setProgress(0);

    if (reduce) {
      runChunk(acc, sims);
      setSim({ result: snapshot(acc), order, runners: snapRunners });
      setProgress(1);
      setRunning(false);
      return;
    }

    const chunk = Math.max(1, Math.ceil(sims / FRAMES));
    const step = () => {
      runChunk(acc, Math.min(chunk, sims - acc.done));
      setSim({ result: snapshot(acc), order, runners: snapRunners });
      setProgress(acc.done / sims);
      if (acc.done < sims) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        setRunning(false);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }

  // Auto-run on first mount and whenever the selected race changes.
  useEffect(() => {
    run(nSims);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingDate, raceNo]);

  const maxWin = sim ? Math.max(...sim.runners.map((r) => r.win_pct), 1) : 1;
  const actualName = (pos: number) => race?.actual_top3?.[pos - 1];
  const drawsShown = Math.round(progress * nSims);

  return (
    <div className="space-y-4">
      {/* Meeting chips */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {meetings.map((m) => {
          const on = m.meeting_date === meetingDate;
          return (
            <button
              key={m.meeting_date}
              onClick={() => {
                setMeetingDate(m.meeting_date);
                setRaceNo(m.races[0]?.race_number ?? 1);
              }}
              className={`tap num shrink-0 rounded-pill px-3.5 py-1.5 text-caption font-semibold transition ${
                on
                  ? "bg-white text-neutral-900 light:bg-neutral-900 light:text-neutral-50"
                  : "glass text-ink-60"
              }`}
            >
              {m.meeting_date}
            </button>
          );
        })}
      </div>

      {/* Race chips */}
      <div className="grid grid-cols-5 gap-2">
        {meeting?.races.map((r) => {
          const on = r.race_number === raceNo;
          return (
            <button
              key={r.race_number}
              onClick={() => setRaceNo(r.race_number)}
              className={`tap num rounded-tile py-2 text-callout font-bold transition ${
                on
                  ? "bg-gradient-to-br from-violet-400 to-indigo-500 text-neutral-50 shadow-glow-indigo"
                  : "glass text-ink-60"
              }`}
            >
              R{r.race_number}
            </button>
          );
        })}
      </div>

      {/* Race header */}
      {race && (
        <div className="glass shadow-glass-2 rounded-card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-headline font-semibold">Race {race.race_number}</h2>
            <span className="num text-caption text-ink-70">
              {race.distance_m}m · {race.course_config}
            </span>
          </div>
          <p className="mt-1 text-caption text-ink-70">
            {race.race_class ?? "—"}
            {race.going ? ` · ${race.going}` : ""} · {runners.length} runners
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <div className="glass flex rounded-tile p-1">
          {SIM_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setNSims(opt);
                run(opt);
              }}
              className={`tap num rounded-chip px-2.5 py-1.5 text-caption font-semibold transition ${
                nSims === opt
                  ? "bg-white text-neutral-900 light:bg-neutral-900 light:text-neutral-50"
                  : "text-ink-70"
              }`}
            >
              {opt / 1000}k
            </button>
          ))}
        </div>
        <button
          onClick={() => run()}
          disabled={running || !runners.length}
          className="tap flex-1 rounded-tile bg-gradient-to-r from-violet-400 to-indigo-500 py-2.5 text-body font-semibold text-neutral-50 shadow-glow-indigo disabled:opacity-50"
        >
          {running ? "Simulating…" : `Run ${nSims / 1000}k simulations`}
        </button>
      </div>

      {/* Live draw progress */}
      {running && (
        <div className="flex items-center gap-3 px-1">
          <ProbBar
            value={progress * 100}
            tone="indigo"
            height={4}
            animate={false}
            className="flex-1"
          />
          <span className="num shrink-0 text-micro2 tabular-nums text-ink-80">
            {drawsShown.toLocaleString()} / {nSims.toLocaleString()} draws
          </span>
        </div>
      )}

      {sim && (
        <>
          {/* Ranked runners */}
          <div className="flex items-center justify-between px-1 text-micro text-ink-80">
            <span>Ranked by model win probability</span>
            <span className="flex items-center gap-2.5">
              <Key dot="bg-emerald-400" label="Win" />
              <Key dot="bg-sky-400" label="Top-3" />
            </span>
          </div>

          <div className="space-y-1.5">
            {sim.order.map((i, idx) => {
              const r = sim.runners[i];
              if (!r) return null;
              const winV = sim.result.win[i] ?? 0;
              const top3V = sim.result.top3[i] ?? 0;
              return (
                <div
                  key={r.horse_id ?? i}
                  className="stagger glass shadow-glass-2 rounded-tile p-3"
                  style={{ ["--i" as string]: Math.min(idx, 12) }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`num grid h-6 w-6 shrink-0 place-items-center rounded-chip text-caption font-bold ${
                        idx < 3
                          ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25 light:text-emerald-700"
                          : "bg-white/[0.06] text-ink-70"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-callout font-semibold">{r.horse_name}</span>
                        {r.public_odds ? (
                          <span className="num shrink-0 text-micro text-ink-80">
                            @ {r.public_odds.toFixed(1)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="num shrink-0 text-right">
                      <div className="text-callout font-bold text-emerald-300 light:text-emerald-600">
                        {winV.toFixed(1)}%
                      </div>
                      <div className="text-micro2 text-ink-80">win</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
                    <ProbBar value={winV} max={maxWin} tone="win" height={5} animate={false} />
                    <span className="num w-16 text-right text-micro2 text-ink-80">
                      model {r.win_pct.toFixed(0)}%
                    </span>
                    <ProbBar value={top3V} tone="place" height={5} animate={false} />
                    <span className="num w-16 text-right text-micro2 text-sky-300/80 light:text-sky-700">
                      top-3 {top3V.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Finishing-position distribution */}
          <FinishDistribution
            runners={sim.runners}
            posDist={sim.result.posDist}
            order={sim.order}
          />

          {/* Exotics */}
          <Exotic title="Most likely exacta · 1st–2nd">
            {sim.result.exacta.map((e, k) => (
              <Combo
                key={k}
                pct={e.p}
                scale={2}
                names={[sim.runners[e.a]?.horse_name, sim.runners[e.b]?.horse_name]}
              />
            ))}
          </Exotic>
          <Exotic title="Most likely trifecta · 1st–2nd–3rd">
            {sim.result.trifecta.map((t, k) => (
              <Combo
                key={k}
                pct={t.p}
                scale={3}
                names={[
                  sim.runners[t.a]?.horse_name,
                  sim.runners[t.b]?.horse_name,
                  sim.runners[t.c]?.horse_name,
                ]}
              />
            ))}
          </Exotic>

          {race?.has_results ? (
            <div className="rounded-card border border-accent-gold/25 bg-accent-gold/[0.07] p-4">
              <div className="eyebrow text-accent-gold/80">Actual result</div>
              <div className="num mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-callout">
                {[1, 2, 3].map(
                  (p) =>
                    actualName(p) && (
                      <span key={p}>
                        <span className="text-accent-gold/60">{p}.</span> {actualName(p)}
                      </span>
                    ),
                )}
              </div>
            </div>
          ) : null}

          <p className="px-2 pb-2 pt-1 text-center text-micro text-ink-80">
            {sim.result.nSims.toLocaleString()} Plackett–Luce draws over the model&apos;s win
            probabilities · simulated win% converges to the model win% as draws increase.
          </p>
        </>
      )}
    </div>
  );
}

function Key({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function Exotic({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass shadow-glass-2 rounded-card p-4">
      <div className="eyebrow mb-2.5">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Combo({
  pct,
  names,
  scale,
}: {
  pct: number;
  names: (string | undefined)[];
  scale: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="min-w-0 flex-1 truncate text-caption text-ink-60">
        {names.filter(Boolean).join("  ›  ")}
      </div>
      <ProbBar value={pct * scale} tone="indigo" height={5} animate={false} className="w-16 shrink-0" />
      <span className="num w-10 shrink-0 text-right text-micro text-ink-60">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
