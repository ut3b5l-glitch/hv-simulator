"use client";

import { useMemo, useState, useEffect } from "react";
import type { Meeting, Race, Runner } from "@/lib/types";

// ── Plackett–Luce Monte Carlo ───────────────────────────────────────────────
// Sample finishing orders by repeatedly drawing the next finisher in proportion
// to the remaining runners' model win probabilities — exactly the simulation
// race_simulator.py --mc runs, ported to the browser so it works offline.
interface SimResult {
  win: number[];
  top3: number[];
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
      if (pick === -1) for (let i = n - 1; i >= 0; i--) if (w[i] > 0) { pick = i; break; }
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

  return { win: win.map((c) => (c / nSims) * 100), top3: top3.map((c) => (c / nSims) * 100), exacta, trifecta, nSims };
}

// ── UI ───────────────────────────────────────────────────────────────────────
const SIM_OPTIONS = [1000, 10000, 50000];

function Bar({ pct, tone }: { pct: number; tone: "win" | "top3" }) {
  const grad = tone === "win" ? "from-emerald-400 to-teal-400" : "from-sky-400 to-indigo-400";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-[width] duration-500 ease-out`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function Simulator({ meetings }: { meetings: Meeting[] }) {
  const [meetingDate, setMeetingDate] = useState(meetings[0]?.meeting_date ?? "");
  const meeting = meetings.find((m) => m.meeting_date === meetingDate) ?? meetings[0];
  const [raceNo, setRaceNo] = useState(meeting?.races[0]?.race_number ?? 1);
  const race: Race | undefined = meeting?.races.find((r) => r.race_number === raceNo) ?? meeting?.races[0];

  const [nSims, setNSims] = useState(10000);
  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);

  const runners = race?.runners ?? [];

  function run(sims = nSims) {
    if (!runners.length) return;
    setRunning(true);
    setTimeout(() => { setResult(simulate(runners, sims)); setRunning(false); }, 30);
  }

  useEffect(() => {
    setResult(runners.length ? simulate(runners, nSims) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingDate, raceNo]);

  const ordered = useMemo(() => {
    const base = runners.map((r, i) => ({ r, i }));
    if (!result) return base;
    return base.sort((a, b) => result.top3[b.i] - result.top3[a.i]);
  }, [result, runners]);

  // actual_top3 is the reliable ordered source [1st, 2nd, 3rd]; the finishers
  // array's `position` field is not the true finishing place (and can dupe).
  const actualName = (pos: number) => race?.actual_top3?.[pos - 1];

  return (
    <div className="space-y-4">
      {/* Meeting chips */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {meetings.map((m) => {
          const on = m.meeting_date === meetingDate;
          return (
            <button
              key={m.meeting_date}
              onClick={() => { setMeetingDate(m.meeting_date); setRaceNo(m.races[0]?.race_number ?? 1); }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${on ? "bg-white text-neutral-900" : "glass text-white/70"}`}
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
              className={`num rounded-xl py-2 text-sm font-semibold transition ${on ? "bg-gradient-to-br from-violet-400 to-indigo-500 text-white shadow-lg shadow-indigo-500/25" : "glass text-white/65"}`}
            >
              R{r.race_number}
            </button>
          );
        })}
      </div>

      {/* Race header */}
      {race && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Race {race.race_number}</h2>
            <span className="num text-xs text-white/55">{race.distance_m}m · {race.course_config}</span>
          </div>
          <p className="mt-0.5 text-xs text-white/55">
            {race.race_class ?? "—"}{race.going ? ` · ${race.going}` : ""} · {runners.length} runners
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <div className="glass flex rounded-xl p-1 text-xs">
          {SIM_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => { setNSims(opt); run(opt); }}
              className={`num rounded-lg px-2.5 py-1.5 font-medium transition ${nSims === opt ? "bg-white text-neutral-900" : "text-white/55 hover:text-white/90"}`}
            >
              {opt / 1000}k
            </button>
          ))}
        </div>
        <button
          onClick={() => run()}
          disabled={running || !runners.length}
          className="flex-1 rounded-xl bg-gradient-to-r from-violet-400 to-indigo-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {running ? "Simulating…" : `Run ${nSims / 1000}k simulations`}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="flex items-center justify-between px-1 text-[11px] text-white/45">
            <span>Ranked by simulated top-3 chance</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-emerald-400" />Win</span>
              <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-sky-400" />Top-3</span>
            </span>
          </div>

          <div className="space-y-1.5">
            {ordered.map(({ r, i }, idx) => (
              <div key={r.horse_id} className="glass rounded-xl p-3">
                <div className="flex items-center gap-2.5">
                  <span className={`num grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-bold ${idx < 3 ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.06] text-white/45"}`}>{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{r.horse_name}</span>
                      {r.public_odds ? <span className="num shrink-0 text-[11px] text-white/45">@ {r.public_odds.toFixed(1)}</span> : null}
                    </div>
                  </div>
                  <div className="num shrink-0 text-right">
                    <div className="text-sm font-bold text-emerald-300">{result.win[i].toFixed(1)}%</div>
                    <div className="text-[10px] text-white/40">win</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                  <Bar pct={result.win[i]} tone="win" />
                  <span className="num w-14 text-right text-[10px] text-white/40">model {r.win_pct.toFixed(0)}%</span>
                  <Bar pct={result.top3[i]} tone="top3" />
                  <span className="num w-14 text-right text-[10px] text-sky-300/80">top-3 {result.top3[i].toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Exotics */}
          <Exotic title="Most likely exacta (1st–2nd)">
            {result.exacta.map((e, k) => <Combo key={k} pct={e.p} names={[runners[e.a]?.horse_name, runners[e.b]?.horse_name]} />)}
          </Exotic>
          <Exotic title="Most likely trifecta (1st–2nd–3rd)">
            {result.trifecta.map((t, k) => <Combo key={k} pct={t.p} names={[runners[t.a]?.horse_name, runners[t.b]?.horse_name, runners[t.c]?.horse_name]} />)}
          </Exotic>

          {race?.has_results ? (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/80">Actual result</div>
              <div className="mt-1.5 space-x-3 text-sm">
                {[1, 2, 3].map((p) => actualName(p) && (
                  <span key={p} className="num"><span className="text-amber-200/60">{p}.</span> {actualName(p)}</span>
                ))}
              </div>
            </div>
          ) : null}

          <p className="px-2 pb-2 pt-1 text-center text-[11px] text-white/35">
            {result.nSims.toLocaleString()} Plackett–Luce draws over the model&apos;s win probabilities ·
            simulated win% converges to the model win% as draws increase.
          </p>
        </>
      )}
    </div>
  );
}

function Exotic({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Combo({ pct, names }: { pct: number; names: (string | undefined)[] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 truncate text-xs text-white/70">{names.filter(Boolean).join("  ›  ")}</div>
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-500" style={{ width: `${Math.min(100, pct * 3)}%` }} />
      </div>
      <span className="num w-10 shrink-0 text-right text-[11px] text-white/55">{pct.toFixed(1)}%</span>
    </div>
  );
}
