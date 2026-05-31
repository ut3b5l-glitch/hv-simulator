# Mobile PWA

A Next.js Progressive Web App that mirrors [[../workflow/operations|the dashboard]] for phone/iPad use. Installable to the iOS home screen — no App Store, no Apple Developer fee.

**Live URL:** https://hv-simulator.vercel.app
**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Vercel Hobby
**Repo path:** `web/`
**Built:** 2026-05-28

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

Glassmorphic / Apple-native: frosted-blur cards on a deep navy gradient with gold/green/red accents. Tabular-numeric mono for numbers. Bottom nav as a floating glass pill. Safe-area aware (notch + home indicator).

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
