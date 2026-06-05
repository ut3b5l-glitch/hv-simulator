# Mobile PWA — Zokki

A Next.js Progressive Web App that mirrors [[../workflow/operations|the dashboard]] for phone/iPad use. Installable to the iOS home screen — no App Store, no Apple Developer fee.

**App name:** **Zokki** (rebranded from "HV Simulator" on 2026-06-06). The name applies to the *product*; the underlying Python engine and this wiki keep the HV Simulator name.
**Live URL:** https://hv-simulator.vercel.app (Vercel project still named `hv-simulator`; the URL is unchanged)
**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Vercel Hobby
**Repo path:** `web/`
**Built:** 2026-05-28 · **Rebranded + light visual overhaul:** 2026-06-06

## How data flows

```
happy_valley.db          ─┐
predictions_*.json       ─┼─→  export_data.py  ─→  web/public/data/*.json  ─→  Vercel (Next.js)
results_*.json           ─┘
```

The PWA is **static-data-driven**: it reads JSON snapshots committed to the repo, not the SQLite DB. Each git push to `main` triggers a Vercel rebuild.

## Refresh workflow (after each meeting)

```bash
python export_data.py
git add web/public/data && git commit -m "data: YYYY-MM-DD" && git push
```

Vercel auto-deploys in ~30s.

## Pages

| Route | What it shows |
|---|---|
| `/` | Tonight's Races — race tab strip, per-race header with top-3 hits, runner cards with value pills, tap to expand for odds/edge/factor bars |
| `/performance` | Lifetime top-3 precision, top-pick rate, value-bet ROI, recent meetings list |
| `/profiles` | Searchable jockeys / trainers / horses with 60-day trailing form |

## Design

Glassmorphic, with a **single light theme** (since the Zokki overhaul, 2026-06-06): frosted near-white cards on a pale mint→blue gradient, navy text, semantic honey/sea-green/coral accents. Bottom nav as a floating glass pill. Safe-area aware (notch + home indicator). The current look is described in **Zokki visual overhaul** below; the Phase 2/3 sections are kept as history (note: the dark theme and light/dark toggle they describe were **removed** in the overhaul).

### Visual Uplift — Phase 2 design system (2026-05-30)

A full design-system pass turned the "subpar" first cut into a cohesive racing-analytics terminal. The data visualizations are the hero; typography stays on the native SF stack by intent (iOS-installed PWA).

- **Type scale** — semantic Tailwind `fontSize` tokens (`display`/`title`/`headline`/`body`/`callout`/`caption`/`micro`/`micro2`) with paired line-height + tracking, plus an `.eyebrow` utility. No more hand-tuned `text-[11px]`. `tailwind.config.ts` changes need a dev-server restart to recompile.
- **Glass system** — three depth levels (`.glass-tile` / `.glass` / `.glass-strong`) + gold-tinted `.glass-gold` for value picks; layered shadows (`shadow-glass-1/2/3`) and accent glows. Subtle SVG-noise grain overlay on `body::before`.
- **Accent tokens** — `accent.{gold,green,red,blue,purple,indigo,cyan}`; gold = model pick/value, green = win/positive, blue = place/market, indigo/violet = simulation.
- **Probability visualizations** — `ProbBar` (reusable gradient bar, left-anchored reveal), `WPSMeter` (nested win⊆place⊆show stacked bar), comparative win bars scaled to the field leader on every runner card, and `FactorBars` rebuilt as **diverging bars around ×1.0 neutral** (green right = tailwind, red left = headwind) — far truer to the multiplicative factors than the old left-anchored bars.
- **Finishing-position distribution chart** (`FinishDistribution`) — the MC now samples the *full* finishing order (not just top-3), yielding a per-runner position distribution. Rendered as a heatmap matrix (runners × positions, intensity = likelihood) plus a tap-to-select per-runner histogram with expected (mean) finish. Favourites cascade left, longshots concentrate right.
- **Motion** — staggered `rise` entrances (`.stagger` + `--i`), `bar-fill` grow, `expand-down` disclosure, chevron rotate, `.tap` press-scale; all gated by `prefers-reduced-motion`.
- **Nav** — emoji replaced with monoline SVG icons (`Icons.tsx`); active tab = gold icon + highlighted pill.
- **Shared primitives** — `PageHeader`, `EmptyState`, `GlassCard` (level/accent props) unify the four pages.

New component files: `ProbBar`, `WPSMeter`, `FinishDistribution`, `Icons`, `PageHeader`, `EmptyState`. `next build` passes (7/7 pages).

### Phase 3 — polish & theming (2026-05-31, shipped)

Shipped + deployed (commit `fd13fc7`). Covers the parked polish list (sharing was deliberately dropped this round).

- **Race Date dropdown fix** — the picker menu lost the z-order fight to the glass R-tabs: their `backdrop-filter` promotes them to composited layers that paint over any higher `z-index` ancestor inside `<main>` (WebKit/Blink bug). Fix: the menu is now **portalled to `<body>`** (`createPortal`, fixed-positioned from the trigger) — the same level `BottomNav` lives at. Inline `z-50` wrappers did **not** work; portalling is the reliable fix.
- **Loading & empty states** — shimmer `Skeleton` primitive (`.skeleton` in `globals.css`) + per-route `loading.tsx` for all four pages; `EmptyState` now used on Performance/Profiles too.
- **Animated Monte Carlo** (`Simulator.tsx`) — the sim runs **incrementally in `requestAnimationFrame` chunks** so win/top-3 probabilities visibly converge, with a live "N / total draws" progress bar. Row order frozen by model win% (no reshuffle); `FinishDistribution` gained an `order` prop to stay stable. `prefers-reduced-motion` → instant result.
- **Pull-to-refresh** (`PullToRefresh.tsx`) — top-drag gesture → `router.refresh()` for the installed PWA (no browser chrome of its own). Spring-y armed indicator; passive listeners; `overscroll-behavior-y: contain`.
- **Offline service worker** (`public/sw.js` + `ServiceWorkerRegister.tsx`) — network-first for navigations, cache-first for assets. **Registration is production-only** (a SW in `next dev` caches stale HMR chunks) → only verifiable on the deployed site.
- **Light / dark toggle** (`ThemeToggle.tsx`) — `white`/`ink`/`accent` routed through CSS variables (`--fg`, `--c-*`) so the whole UI flips centrally; glass surfaces themed per mode; a custom `light:` Tailwind variant (plugin) for the few white-on-colour exceptions. Persisted to `localStorage`, applied pre-paint by `public/theme-init.js`, `<html suppressHydrationWarning>` to avoid the hydration mismatch. Toggle sits in `PageHeader` (top-right, every page). **Default stays dark** (night meetings); status-bar/splash colours unchanged.
- **Gotcha:** editing `tailwind.config.ts` (the new var tokens + `light:` variant plugin) needs a dev-server **restart** to recompile.

Parked / not done: a launch (splash) screen — decided against an artificial timed one; a *native* iOS launch screen remains an option. App icon kept navy/gold (an HKJC-red recolor was prototyped then reverted).

### Zokki visual overhaul + rebrand (2026-06-06, shipped — commit `b79d93d`)

Major visual uplift drawing on the **Synthex** SaaS-dashboard aesthetic (Dribbble 27131881), plus the official rename to **Zokki**. Deployed live (HTTP 200, `vercel deploy --prod`). The app was already token-driven, so the reskin flowed mostly from `globals.css` + `tailwind.config.ts`.

- **Single light theme — dark mode dropped.** `ThemeToggle.tsx` + `public/theme-init.js` deleted; `<html data-theme="light">` is hardcoded (so the existing `light:` Tailwind variant still matches). Pale mint→blue page gradient, frosted near-white glass, `#163144` navy text (`--fg`). User decision: light-only.
- **Font → Urbanist** via `next/font/google` (`--font-urbanist`, led in `fontFamily.sans`). Geometric/rounded — the Zokki identity.
- **Palette = navy + mint** (Synthex family). Brand anchors `--c-navy` #1B405B + `--c-mint` #DFF3EB (exposed as Tailwind `navy`/`mint`). Functional accents kept their **semantics** but were retuned into the family: `--c-gold` honey #B27A1C (value), `--c-green` sea-green #0D8A65 (win), `--c-red` coral #D1543F (loss), `--c-blue` teal #1C6E8C (top-3/place), `--c-cyan` mint-teal #239696, `--c-indigo` → navy. User decision: "near-monochrome navy+mint but keep gold/green/red recoded into complementary hues."
- **All raw Tailwind colors rewired to tokens.** `ProbBar`, `Simulator` (was purple/violet buttons + black active pills → navy+mint; emerald/sky → accent-green/blue), `WPSMeter`, `FinishDistribution`, `FactorBars`, `ModelCalibration`. A grep for `(emerald|sky|violet|indigo|rose|amber)-\d00` should now return nothing; only tokenized `bg-white`/`text-white` (which resolve to navy via `--fg`) remain.
- **Signature touches:** navy→teal gradient **hero** (`.hero-grad`) on Races + Performance via a `hero` prop on `PageHeader`; **Zokki wordmark** (`Wordmark.tsx`, light in the hero / navy top-right on plain pages); **crisper white active pill** in the bottom nav.
- **Rebranded assets:** `icon.svg` = a "Z" wordmark, navy→mint gradient + teal dot; PNGs (192/512/180) regenerated from it with macOS `qlmanage -t -s <size>` (no rsvg/imagemagick available; qlmanage outputs transparent RGBA but overwrites `icon.svg.png`, so render each size into its own tmpdir). Manifest + layout metadata + appleWebApp title → "Zokki"; theme/bg colour → `#eef5f2`; `package.json` name → `zokki-web`.
- **Gotcha (unchanged):** editing `tailwind.config.ts` needs a dev-server **restart** to recompile theme tokens.

New component files: `Wordmark.tsx`. Removed: `ThemeToggle.tsx`, `public/theme-init.js`. This deploy also shipped the previously-parked **Sha Tin expansion** (`WinEdge.tsx` + the 2024-11-09 ST demo meeting), which was sharing the working tree.

## Key files

| File | Role |
|---|---|
| `export_data.py` (project root) | Reads DB + predictions/results JSONs, writes the `web/public/data/` snapshot. Run after each meeting. |
| `web/app/page.tsx` | Tonight's Races landing page |
| `web/app/performance/page.tsx` | Performance / ROI page |
| `web/app/profiles/page.tsx` | Profile browser |
| `web/components/RunnerCard.tsx` | Expandable runner card with factor bars |
| `web/lib/data.ts` | `fs.readFile`-based data loaders (server components) |
| `web/public/manifest.webmanifest` | PWA manifest |
| `web/README.md` | Local dev + deploy guide |

## Deployment

Linked Vercel project: `ut3b5l-3494s-projects/hv-simulator`. Production alias: `hv-simulator.vercel.app`.

To enable git auto-deploys (recommended): https://vercel.com/ut3b5l-3494s-projects/hv-simulator/settings/git → connect repo `ut3b5l-glitch/hv-simulator`, branch `main`, root directory `web`. Once connected, `git push` triggers a deploy automatically.

Manual deploy from the CLI:
```bash
cd web && vercel deploy --prod --yes
```

## Betting Returns panel (Performance page, 2026-06-03)

`web/components/BettingReturns.tsx` renders lifetime flat-HK$10 P&L for four
strategies on the model's top-3 picks (Win on #1 / Place box / Quinella Place
box / Quinella box), plus a per-meeting net breakdown. Fed by `performance.json`
→ `betting` block, produced by `export_data.build_betting()` which aggregates
`bet_report.compute()` across meetings (official HKJC dividends). Lifetime so far:
**Win-on-#1 is the only profitable strategy** (+$23.50, +8.7% over 3 meetings);
all spread/exotic boxes lose. Numbers refresh whenever `export_data.py` runs
(i.e. after every reconcile via `hv_auto.sh`). See [[../workflow/operations]].

## Phase 2 ideas (parked)

- Pull-to-refresh + offline service-worker caching
- Per-horse detail page (form history chart from `horse_form` table)
- Light-mode toggle (matches iOS appearance setting)
- Walk-forward phase table on the Performance page
- GitHub Action that runs `export_data.py` on a cron (removes the manual refresh step)
- Replace value-bet ROI calc with real `paper_trades` table once populated

## Related

- [[../workflow/operations]] — Streamlit dashboard remains the local race-day cockpit
- [[../performance/live-meetings]] — source data for the Performance page
- [[../data/database]] — schema the exporter reads from
