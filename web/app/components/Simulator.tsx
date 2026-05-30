"use client";

import { useMemo, useState, useEffect } from "react";
import type { Meeting, Race, Runner } from "../lib/data";

// ── Plackett–Luce Monte Carlo ───────────────────────────────────────────────
// Sample finishing orders by repeatedly drawing the next finisher in proportion
// to the remaining runners' model win probabilities. This is exactly the
// simulation race_simulator.py --mc runs, ported to the browser so it works
// offline inside the PWA.
interface SimResult {
  win: number[];        // P(win) per runner index
  top3: number[];       // P(finish top-3) per runner index
  exacta: { a: number; b: number; p: number }[];
  trifecta: { a: number; b: number; c: number; p: number }[];
  nSims: number;
}

function simulate(runners: Runner[], nSims: number): SimResult {
  const n = runners.length;
  const baseW = runners.map((r) => Math.max(r.win_pct, 1e-9));
  const win = new Array(n).fill(0);
  const top3 = new Array(n).fill(0);
  const exMap = new Map<number, number>();
  const triMap = new Map<number, number>();

  const w = new Array(n).fill(0);
  for (let s = 0; s < nSims; s++) {
    for (let i = 0; i < n; i++) w[i] = baseW[i];
    let total = 0;
    for (let i = 0; i < n; i++) total += w[i];

    let first = -1, second = -1, third = -1;
    const last = Math.min(3, n);
    for (let pos = 0; pos < last; pos++) {
      let x = Math.random() * total;
      let pick = -1;
      for (let i = 0; i < n; i++) {
        if (w[i] <= 0) continue;
        x -= w[i];
        if (x <= 0) { pick = i; break; }
      }
      if (pick === -1) { for (let i = n - 1; i >= 0; i--) if (w[i] > 0) { pick = i; break; } }
      if (pos === 0) first = pick;
      else if (pos === 1) second = pick;
      else third = pick;
      total -= w[pick];
      w[pick] = 0;
    }
    win[first]++;
    top3[first]++; if (second >= 0) top3[second]++; if (third >= 0) top3[third]++;
    exMap.set(first * n + second, (exMap.get(first * n + second) || 0) + 1);
    if (third >= 0) {
      const key = (first * n + second) * n + third;
      triMap.set(key, (triMap.get(key) || 0) + 1);
    }
  }

  const exacta = [...exMap.entries()]
    .map(([k, c]) => ({ a: Math.floor(k / n), b: k % n, p: (c / nSims) * 100 }))
    .sort((x, y) => y.p - x.p).slice(0, 5);
  const trifecta = [...triMap.entries()]
    .map(([k, c]) => ({ a: Math.floor(k / (n * n)), b: Math.floor(k / n) % n, c: k % n, p: (c / nSims) * 100 }))
    .sort((x, y) => y.p - x.p).slice(0, 4);

  return {
    win: win.map((c) => (c / nSims) * 100),
    top3: top3.map((c) => (c / nSims) * 100),
    exacta, trifecta, nSims,
  };
}

// ── UI ───────────────────────────────────────────────────────────────────────
const SIM_OPTIONS = [1000, 10000, 50000];

function Bar({ pct, tone }: { pct: number; tone: "win" | "top3" }) {
  const grad = tone === "win"
    ? "from-emerald-400 to-teal-500"
    : "from-sky-400 to-indigo-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${grad} transition-[width] duration-500 ease-out`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

export function Simulator({ meetings }: { meetings: Meeting[] }) {
  const [meetingDate, setMeetingDate] = useState(meetings[0]?.meeting_date ?? "");
  const meeting = meetings.find((m) => m.meeting_date === meetingDate) ?? meetings[0];
  const [raceNo, setRaceNo] = useState(meeting?.races[0]?.race_number ?? 1);
  const race: Race | undefined =
    meeting?.races.find((r) => r.race_number === raceNo) ?? meeting?.races[0];

  const [nSims, setNSims] = useState(10000);
  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);

  const runners = race?.runners ?? [];

  function run(sims = nSims) {
    if (!runners.length) return;
    setRunning(true);
    // defer so the spinner paints before the (fast) compute blocks the thread
    setTimeout(() => {
      setResult(simulate(runners, sims));
      setRunning(false);
    }, 30);
  }

  // auto-run whenever the selected race changes
  useEffect(() => {
    if (runners.length) {
      setResult(simulate(runners, nSims));
    } else {
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingDate, raceNo]);

  const ordered = useMemo(() => {
    if (!result) return runners.map((r, i) => ({ r, i }));
    return runners
      .map((r, i) => ({ r, i }))
      .sort((a, b) => result.top3[b.i] - result.top3[a.i]);
  }, [result, runners]);

  const actual = race?.actual_finishers ?? [];
  const actualName = (pos: number) =>
    actual.find((f) => f.position === pos)?.horse_name;

  return (
    <div className="px-4 max-w-lg mx-auto">
      {/* Meeting chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {meetings.map((m) => {
          const on = m.meeting_date === meetingDate;
          return (
            <button
              key={m.meeting_date}
              onClick={() => { setMeetingDate(m.meeting_date); setRaceNo(m.races[0]?.race_number ?? 1); }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                on ? "bg-white text-neutral-900" : "bg-white/[0.06] text-neutral-300 hover:bg-white/10"
              }`}
            >
              {m.meeting_date}
            </button>
          );
        })}
      </div>

      {/* Race chips */}
      <div className="grid grid-cols-5 gap-2 mt-3">
        {meeting?.races.map((r) => {
          const on = r.race_number === raceNo;
          return (
            <button
              key={r.race_number}
              onClick={() => setRaceNo(r.race_number)}
              className={`py-2 rounded-xl text-sm font-semibold tabular-nums transition-all ${
                on
                  ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-neutral-900 shadow-lg shadow-emerald-500/20"
                  : "bg-white/[0.05] text-neutral-300 hover:bg-white/10 ring-1 ring-white/5"
              }`}
            >
              R{r.race_number}
            </button>
          );
        })}
      </div>

      {/* Race header */}
      {race && (
        <div className="mt-4 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Race {race.race_number}</h2>
            <span className="text-xs text-neutral-400 tabular-nums">{race.distance_m}m · {race.course_config}</span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            {race.race_class ?? "—"}{race.going ? ` · ${race.going}` : ""} · {runners.length} runners
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex rounded-xl bg-white/[0.05] ring-1 ring-white/10 p-1 text-xs">
          {SIM_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => { setNSims(opt); run(opt); }}
              className={`px-2.5 py-1.5 rounded-lg font-medium tabular-nums transition-colors ${
                nSims === opt ? "bg-white text-neutral-900" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {opt >= 1000 ? `${opt / 1000}k` : opt}
            </button>
          ))}
        </div>
        <button
          onClick={() => run()}
          disabled={running || !runners.length}
          className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-neutral-900 bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {running ? "Simulating…" : `Run ${nSims >= 1000 ? `${nSims / 1000}k` : nSims} simulations`}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="mt-5 flex items-center justify-between text-[11px] text-neutral-500 px-1">
            <span>Ranked by simulated top-3 chance</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full bg-emerald-400" />Win</span>
              <span className="flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full bg-sky-400" />Top-3</span>
            </span>
          </div>

          <div className="mt-2 space-y-1.5">
            {ordered.map(({ r, i }, idx) => (
              <div key={r.horse_id} className="rounded-xl bg-white/[0.035] ring-1 ring-white/5 p-3">
                <div className="flex items-center gap-2.5">
                  <span className={`shrink-0 w-6 h-6 rounded-lg grid place-items-center text-xs font-bold tabular-nums ${
                    idx < 3 ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.06] text-neutral-400"
                  }`}>{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-sm">{r.horse_name}</span>
                      {r.public_odds ? (
                        <span className="shrink-0 text-[11px] text-neutral-500 tabular-nums">@ {r.public_odds.toFixed(1)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <div className="text-sm font-bold text-emerald-300">{result.win[i].toFixed(1)}%</div>
                    <div className="text-[10px] text-neutral-500">win</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-center">
                  <Bar pct={result.win[i]} tone="win" />
                  <span className="text-[10px] text-neutral-500 tabular-nums w-10 text-right">model {r.win_pct.toFixed(0)}%</span>
                  <Bar pct={result.top3[i]} tone="top3" />
                  <span className="text-[10px] text-sky-300/80 tabular-nums w-10 text-right">{result.top3[i].toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Exotics */}
          <div className="mt-5 grid grid-cols-1 gap-3">
            <ExoticCard title="Most likely exacta (1st–2nd)">
              {result.exacta.map((e, k) => (
                <ComboRow key={k} pct={e.p} names={[runners[e.a]?.horse_name, runners[e.b]?.horse_name]} />
              ))}
            </ExoticCard>
            <ExoticCard title="Most likely trifecta (1st–2nd–3rd)">
              {result.trifecta.map((t, k) => (
                <ComboRow key={k} pct={t.p} names={[runners[t.a]?.horse_name, runners[t.b]?.horse_name, runners[t.c]?.horse_name]} />
              ))}
            </ExoticCard>
          </div>

          {actual.length > 0 && (
            <div className="mt-5 rounded-2xl bg-amber-400/[0.06] ring-1 ring-amber-400/20 p-4">
              <div className="text-[11px] uppercase tracking-wider text-amber-300/80 font-semibold">Actual result</div>
              <div className="mt-1.5 text-sm space-x-3">
                {[1, 2, 3].map((p) => actualName(p) && (
                  <span key={p} className="tabular-nums">
                    <span className="text-amber-300/70">{p}.</span> {actualName(p)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 mb-2 text-[11px] text-neutral-600 text-center">
            {result.nSims.toLocaleString()} Plackett–Luce draws over the model's win probabilities ·
            simulated win% converges to the model win% as draws increase.
          </p>
        </>
      )}
    </div>
  );
}

function ExoticCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ComboRow({ pct, names }: { pct: number; names: (string | undefined)[] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 truncate text-xs text-neutral-300">
        {names.filter(Boolean).join("  ›  ")}
      </div>
      <div className="shrink-0 w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-purple-500" style={{ width: `${Math.min(100, pct * 3)}%` }} />
      </div>
      <span className="shrink-0 w-10 text-right text-[11px] tabular-nums text-neutral-400">{pct.toFixed(1)}%</span>
    </div>
  );
}
