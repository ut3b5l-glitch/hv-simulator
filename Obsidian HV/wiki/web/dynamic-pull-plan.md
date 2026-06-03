# Dynamic Pull & 11pm Auto-Reconcile — Design Plan

Status: **PLAN ONLY (not built).** Drafted 2026-06-03 after the morning racecard cron
failed silently on a meeting day (the card had to be pulled by hand). Goal: let the
phone trigger a race-day data pull on demand, surface the new meeting in the app, and
auto-summarise results by 11pm HKT.

Related: [[web/pwa]] · [[operations]] · [[known-issues]]

## User stories

1. **On race day I tap a button in the PWA** → the app pulls today's racecard + WIN
   odds, the model scores the card, and the **new date appears in the Race Date
   selector** with full picks.
2. **By 11pm HKT a job runs automatically** → fetches results, reconciles picks vs
   finishers, refreshes the app, and **tells me how we did** (top-3 precision, #1
   win/place, per-race hits) — ideally a push to my phone.

## The governing constraint

The scrape + model work is **Python + Playwright + the 614-race SQLite history +
an HKJC-reachable network path + a writable filesystem.** A static Vercel site has
none of these. So a button can *trigger* a pull, but a capable machine must *run* it.
That machine already exists and already works: **the Mac.** This plan makes the Mac
the backend and the PWA the trigger/viewer, over **Tailscale** (already installed).

Cloud-native (porting model+DB+Playwright to Vercel/GitHub Actions) is rejected:
HKJC geo-blocks non-HK IPs for odds, serverless Playwright is fragile, and the model
is Python against a local DB. High effort, low reliability.

## Architecture

```
 iPhone PWA (Vercel)                         Mac (always-on-ish, on tailnet)
 ┌──────────────────┐   POST /pull/{date}    ┌─────────────────────────────┐
 │ "Pull today" btn │ ─────────────────────▶ │ hv_service.py (FastAPI)      │
 │ Race Date select │                        │  ├ wednesday_agent.py --date │
 │ Tonight scorecard│ ◀──── git push ─────── │  ├ hkjc_odds.py --date       │
 └──────────────────┘   Vercel redeploy      │  ├ results_agent.py --date   │
        ▲   ~30–60s          (≈30–60s)        │  └ export_data.py            │
        │                                     │     → web/public/data/*.json │
        └───────── cron 11pm HKT ──────────── │  + git add/commit/push       │
                  (results+export+push+notify)│  + notify (ntfy/Pushover)    │
                                              └─────────────────────────────┘
```

The new date appears with **zero app-code changes**: `export_data.py`
`find_meeting_dates()` scans `predictions_*.json` / `results_*.json`, so once a pull
writes `predictions_<date>.json` and `export_data` runs, `meetings.json` includes the
date and `MeetingPicker` shows it after the redeploy.

## Component 1 — `hv_service.py` (NEW, on the Mac)

A ~60–80 line FastAPI app wrapping the existing scripts as subprocess calls.

| Endpoint | Runs | Returns |
|---|---|---|
| `POST /pull/{date}` | `wednesday_agent.py --date` → `hkjc_odds.py --date` → `export_data.py` → git push | `{date, races, picks_per_race, value_bets}` |
| `POST /reconcile/{date}` | `results_agent.py --date` → `export_data.py` → git push | `{date, precision, p1_win, p1_place, per_race}` |
| `GET /status/{date}` | reads the JSONs | what's present (card? odds? results?) |
| `GET /health` | — | liveness for the app to show button-enabled state |

Details:
- **Serialise runs** with a file lock — never two scrapes at once (Playwright + DB).
- **Reuse the live blend** — these scripts already call `mc.score_race(blend_coef="auto")`,
  so picks match the deployed model exactly.
- **Auth:** Tailscale gives network-level identity. If we use Tailscale **Funnel**
  (public HTTPS) add a shared-secret header (`X-HV-Token`) so only the app can trigger.
- **Idempotent:** re-pulling a date just overwrites that date's JSON.
- Long runs (scrape can take minutes): make `/pull` return a job id + have the app
  poll `/status`, OR keep it synchronous with a generous client timeout. Phase 1 =
  synchronous; Phase 2 = job id + poll.

Exposure: **Tailscale Serve** (tailnet-only, simplest/safest) for "when I'm on my
tailnet," or **Tailscale Funnel** (public HTTPS URL) so it works off-network. Start
with Serve.

## Component 2 — App UI (web/)

- **`PullButton.tsx`** (new): posts to the Mac service, shows spinner → on success
  calls `router.refresh()` (pairs with existing `PullToRefresh`). Reads the service
  base URL from `NEXT_PUBLIC_HV_SERVICE_URL`. Hidden/disabled if `/health` fails.
- **Race Date selector:** no change needed for the rebuild path (date arrives via
  regenerated `meetings.json`). *Phase 2 option:* when on the tailnet, fetch today's
  meeting JSON live from the Mac (`data.ts` gains an optional remote source) so the
  date shows instantly with no redeploy.
- **Tonight scorecard view** (enhancement): a compact card on the Races/Performance
  page showing top-3 precision, #1 win, #1 place, and per-race ✓/✗. The numbers exist
  in `summarise_meeting()` (accuracy) — extend it to also emit `p1_win` / `p1_place`
  so the app doesn't recompute.

## Component 3 — Cron loop closure (the cheap, high-value half)

Current crontab gaps (confirmed 2026-06-03):
- 7am racecard cron runs `wednesday_agent.py` only — **failed silently today.**
- **No odds cron** — odds are always manual.
- 11pm cron runs `results_agent.py` only — **does NOT run `export_data.py` or git
  push**, so the PWA never auto-updates after results.

Changes:
1. **11pm cron** → append `&& export_data.py && git add web/public/data && git commit
   && git push && notify`. This alone delivers user story #2's "summarise by 11pm."
2. **Add a ~6pm HKT odds cron** → `hkjc_odds.py --date` + `export_data` + push, so
   the card+odds land without a manual step (button becomes the fallback, not the
   only path).
3. **Harden the 7am cron** → on failure, send a notification so a silent miss like
   today's is visible (and the button is the manual recovery).
4. **Notifications:** `ntfy.sh` (free, has an iOS app, one `curl` line) or Pushover.
   True PWA Web Push on iOS is possible (app is installed; `sw.js` exists) but needs
   VAPID keys + a push server — defer to a later phase.

## Phasing

| Phase | Scope | Effort |
|---|---|---|
| **0** | Close the cron loop (11pm export+push+notify, add odds cron, alert on 7am fail) | ~1–2 hrs |
| **1** | `hv_service.py` + `PullButton` (synchronous, rebuild/redeploy path, Tailscale Serve) | ~half day |
| **2** | Job-id+poll for long runs, live tailnet fetch (instant new date), scorecard view, Funnel for off-network, optional Web Push | ~1 day |

Phase 0 delivers most of user story #2 immediately and is independently useful.

## Risks & mitigations

- **Mac asleep / off network** → button + cron silently no-op. Mitigate: `caffeinate`
  during race window or a `pmset` wake schedule; app shows service `/health` state so
  the button greys out honestly instead of failing.
- **HKJC not posted yet** (today's R9 case) → scripts already handle "not found —
  stopping"; service returns partial status; re-pull/re-reconcile is safe (idempotent).
- **git push from a service** → needs the osxkeychain credential helper already in use;
  no token in the service. Keep `predictions_*.json` / `*.db` gitignored (they are).
- **Methodology** → a button pull captures *odds at tap time*. Picks are only a fair
  forward test if pulled **before the off**; a post-off pull is closing-odds (flag it
  in the scorecard, same caveat as the 2026-06-03 manual run).
- **Security** → never expose the Mac via raw port-forward; Tailscale only. Funnel +
  shared secret if public reach is needed.

## Open decisions for the user

1. **Tailscale Serve (tailnet-only) vs Funnel (works anywhere)?** Serve is safer;
   Funnel is more convenient off home Wi-Fi.
2. **Notification channel:** ntfy (free, simplest) vs Pushover (paid, polished) vs
   full PWA Web Push (most work).
3. **Instant new-date (live tailnet fetch) or accept the ~30–60s redeploy?** Redeploy
   is simpler and durable; live fetch is snappier but adds app complexity.
4. **Do Phase 0 now** (independently valuable) or bundle everything into one build?

## Out of scope

Cloud rewrite of model/scrapers; changing the blend; any Phase 5 ML work
(parked to ≥ Nov 2026).
