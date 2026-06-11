# HV Simulator — Mobile PWA

A glass / Apple-native Progressive Web App for the Happy Valley simulator. Installable to the iPhone/iPad home screen — no App Store, no signing.

## Architecture

```
[ happy_valley.db ]
[ predictions_*.json ]   →   export_data.py   →   web/public/data/*.json   →   Next.js app on Vercel
[ results_*.json ]
```

The web app is **static-data-driven**: it reads JSON snapshots from `public/data/`. Every commit triggers a Vercel rebuild.

## Local development

```bash
cd web
npm install
npm run dev
# open http://localhost:3000
```

## Refresh the data snapshot

After each meeting (or any model change):

```bash
python export_data.py          # writes web/public/data/*.json
cd web && npm run build        # optional: verify locally
git add web/public/data && git commit -m "data: meeting YYYY-MM-DD"
git push                       # Vercel auto-deploys
```

## Deploy to Vercel (one-time)

1. Push this repo to GitHub.
2. https://vercel.com/new → import the repo.
3. **Root directory** → `web`
4. Framework preset → **Next.js** (auto-detected)
5. Deploy. You'll get a `*.vercel.app` URL.

## Install on iPhone / iPad

1. Open the Vercel URL in **Safari**.
2. Share sheet → **Add to Home Screen**.
3. The HV icon appears like a native app — opens full-screen, no browser chrome.

## Pages

- `/` — Tonight's Races (race tab strip, top-3, value pills, tap for factor breakdown)
- `/performance` — Lifetime ROI / hit-rate / per-meeting list
- `/profiles` — Searchable horses / jockeys / trainers with trailing 60-day form
