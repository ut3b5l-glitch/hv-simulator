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
