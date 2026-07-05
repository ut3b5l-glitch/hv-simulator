/**
 * A lightweight device frame + four hand-built screens that mirror the real
 * Zokki consumer app (same tokens: smoked glass, butter, gold, green on
 * coal). Used by the pinned Showcase — each screen is one scroll stage.
 * Pure CSS, no screenshots: crisp at any DPR and ~0 bytes of images.
 */

export default function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative h-[560px] w-[272px] shrink-0 rounded-[44px] border border-white/15 bg-[#1b1a18] p-2.5 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)]"
      aria-hidden
    >
      {/* Dynamic-island notch */}
      <div className="absolute left-1/2 top-4 z-20 h-[18px] w-[76px] -translate-x-1/2 rounded-pill bg-black/90" />
      <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-[#211f1d]">
        {/* in-screen page gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(320px 220px at 80% -8%, rgba(249,239,152,0.09), transparent 60%), linear-gradient(180deg,#34322e 0%,#252320 55%,#171614 100%)",
          }}
        />
        <div className="relative h-full w-full">{children}</div>
      </div>
    </div>
  );
}

/* ── shared bits ─────────────────────────────────────────────── */

function ScreenChrome({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="px-4 pt-9">
      <div className="rounded-[18px] border border-white/10 bg-black/30 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[0.6rem] font-bold tracking-wide text-white/90">ZOKKI</span>
          <span className="h-1.5 w-8 rounded-pill bg-white/15" />
        </div>
        <div className="mt-2.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-accent-yellow/80">
          {eyebrow}
        </div>
        <div className="mt-0.5 text-[1.05rem] font-medium tracking-tight text-mint">{title}</div>
      </div>
    </div>
  );
}

function Row({
  medal,
  name,
  pct,
  width,
  gold = false,
}: {
  medal: string;
  name: string;
  pct: string;
  width: string;
  gold?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-2.5 ${gold ? "border-accent-gold/40 bg-accent-gold/10" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="text-[0.7rem]">{medal}</span>
          <span className="text-[0.7rem] font-semibold text-white/90">{name}</span>
        </span>
        <span className="num text-[0.7rem] font-bold text-accent-yellow">{pct}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-pill bg-white/10">
        <div className={`h-full rounded-pill ${gold ? "bg-accent-gold" : "bg-accent-yellow/80"}`} style={{ width }} />
      </div>
    </div>
  );
}

/* ── Stage 1 · Tonight's picks ──────────────────────────────── */
export function PicksScreen() {
  return (
    <div>
      <ScreenChrome eyebrow="Happy Valley · 8 races" title="Tonight’s card" />
      <div className="space-y-2 px-4 pt-3">
        <div className="flex gap-1.5">
          {["R1", "R2", "R3", "R4", "R5"].map((r, i) => (
            <span
              key={r}
              className={`num rounded-pill px-2.5 py-1 text-[0.6rem] font-bold ${
                i === 2 ? "bg-[#f4e990] text-[#121212]" : "bg-white/10 text-white/60"
              }`}
            >
              {r}
            </span>
          ))}
        </div>
        <Row medal="🥇" name="GOLDEN COMET" pct="24.1%" width="72%" gold />
        <Row medal="🥈" name="VALLEY THUNDER" pct="16.8%" width="52%" />
        <Row medal="🥉" name="LUCKY EXPRESS" pct="12.2%" width="38%" />
        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
          <div className="text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-white/50">
            The read
          </div>
          <p className="mt-1 text-[0.62rem] leading-relaxed text-white/75">
            Golden Comet gets the nod — in-form jockey, handy draw. Valley
            Thunder is the danger if the pace collapses.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Stage 2 · AI deep dive ─────────────────────────────────── */
export function DeepDiveScreen() {
  return (
    <div>
      <ScreenChrome eyebrow="Race 3 · 1200m · Class 4" title="Zokki AI · Deep dive" />
      <div className="space-y-2 px-4 pt-3">
        <div className="rounded-xl border border-accent-gold/35 bg-accent-gold/10 p-3">
          <div className="flex items-center gap-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-accent-gold">
            <span>✦</span> Analyst briefing
          </div>
          <p className="mt-1.5 text-[0.64rem] leading-relaxed text-white/85">
            <span className="font-bold text-accent-yellow">
              A two-horse race the market is only half reading.
            </span>{" "}
            Our model gives Golden Comet a 24% win chance against 4.5 odds —
            a +2.1pt edge. The yard is firing at 21% this month…
          </p>
          <p className="mt-1.5 text-[0.64rem] leading-relaxed text-white/70">
            The honest caveat: draw bias at 1200m here is real, and gate 11
            has cost better horses than this one.
          </p>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <span className="text-[0.6rem] text-white/60">Tuned for</span>
          <span className="rounded-pill bg-accent-green/15 px-2 py-0.5 text-[0.6rem] font-bold text-accent-green">
            The Value Hunter
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Stage 3 · Ask Zokki ────────────────────────────────────── */
export function AskScreen() {
  return (
    <div>
      <ScreenChrome eyebrow="Grounded in tonight’s numbers" title="Ask Zokki" />
      <div className="space-y-2 px-4 pt-3">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#f4e990] px-3 py-2 text-[0.64rem] font-medium text-[#121212]">
            Which race looks safest tonight?
          </div>
        </div>
        <div className="flex items-start gap-1.5">
          <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-accent-gold/40 bg-accent-gold/15 text-[0.55rem] text-accent-gold">
            ✦
          </span>
          <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[0.64rem] leading-relaxed text-white/85">
              Race 6. Our top pick lands the top three in{" "}
              <span className="font-bold text-accent-yellow">68%</span> of
              simulations — the field behind it is thin. But “safest” still
              isn’t “safe”: it’s racing.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-pill border border-white/15 bg-white/5 px-3 py-2">
          <span className="flex-1 text-[0.62rem] text-white/40">Ask about tonight’s card…</span>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#f4e990] text-[0.55rem] text-[#121212]">
            ➤
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Stage 4 · Track record ─────────────────────────────────── */
export function RecordScreen({
  ours,
  fav,
  rand,
}: {
  ours: number;
  fav: number;
  rand: number;
}) {
  const rows = [
    { label: "Our top pick", v: ours, color: "bg-accent-yellow", strong: true },
    { label: "The favourite", v: fav, color: "bg-white/40", strong: false },
    { label: "Random pick", v: rand, color: "bg-white/25", strong: false },
  ];
  return (
    <div>
      <ScreenChrome eyebrow="Every pick on the books" title="Track record" />
      <div className="space-y-2 px-4 pt-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          {rows.map((r) => (
            <div key={r.label} className="py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[0.62rem] text-white/70">{r.label}</span>
                <span className={`num text-[0.66rem] font-bold ${r.strong ? "text-accent-yellow" : "text-white/70"}`}>
                  {r.v}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-white/10">
                <div className={`h-full rounded-pill ${r.color}`} style={{ width: `${r.v}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-accent-green/30 bg-accent-green/10 p-2.5">
          <p className="text-[0.62rem] leading-relaxed text-white/80">
            Wins <span className="font-bold text-accent-green">and misses</span>{" "}
            — published after every meeting, with the baselines beside them.
          </p>
        </div>
      </div>
    </div>
  );
}
