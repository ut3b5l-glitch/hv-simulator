# Log

Append-only chronological record of all wiki operations.

Format: `## [YYYY-MM-DD] <operation> | <description>`

Grep shortcuts:
```bash
grep "^## \[" "Obsidian HV/wiki/log.md" | tail -10      # last 10 entries
grep "ingest" "Obsidian HV/wiki/log.md"                  # all race night ingests
grep "experiment" "Obsidian HV/wiki/log.md"              # all walk-forward tests
```

---

## [2026-06-07] build | Jun-7 venue fix (ST) + consumer app deployed + landing 跑馬地

**Venue bug:** the Jun-7 Sha Tin meeting displayed as "Happy Valley" in the PWAs. Root cause = `predictions_2026-06-07.json` mis-tagged `venue:"HV"` (DB + results JSON were correctly ST); `export_data.py:113` derived the meeting venue from predictions. Fixed: hardened `export_data` to prefer the **results** venue (`(results or {}).get("venue") or preds.get("venue") or "HV"`) + corrected the predictions file to ST. Re-ran export_data + export_consumer; both snapshots + live banners now show **Sha Tin** (verified via hero eyebrow extraction). **Consumer Track Record now 4 live meetings / 38 races** (top pick 58%, top-3 46%, fav 61%, random 25% — Jun-7 ST pulled the avg down from the 3-meeting 63/51/67/26). **Consumer app DEPLOYED** (first time): https://web-consumer-eosin.vercel.app (Vercel project `ut3b5l-3494s-projects/web-consumer`, public). Analytic PWA redeployed (hv-simulator.vercel.app). Landing page: Happy Valley→跑馬地 in Chinese (user correction), redeployed. **OPEN:** predictions_2026-06-07 was HV-tagged → picks may have been *scored* with HV stats/blend, not ST — flagged to user for re-score decision; landing `PROOF` constants now stale vs 4-meeting numbers.

---

## [2026-06-07] build | Landing page DEPLOYED + bilingual EN|中 toggle

Deployed `web-landing/` to production (public, no protection): https://web-landing-smoky.vercel.app (Vercel project `ut3b5l-3494s-projects/web-landing`). Added a top-right `EN | 中` toggle — full Traditional Chinese (lightweight cookie + dictionary in `lib/i18n.ts`, `LangToggle.tsx`, `<html lang>` flip; HK TC written by Claude; horse names stay English). Verified both languages in-browser, tsc + build green, no console errors. **KV still unlinked → prod form 500s until the user creates+links a Vercel KV store and redeploys** (I can't provision it: no `vercel storage` CLI cmd, MCP tools deploy/read-only). See [[web/landing]].

---

## [2026-06-07] build | Track Record credibility fix + waitlist landing page (Tuesday prep)

Off the strategy synthesis below. **B (credibility):** consumer Track Record now carries same-sample honesty baselines — top pick 63% vs market favourite 67% vs random ~26% over the identical 27 live races (13 May–3 Jun 2026), plus date range, precise metric wording ("single top-rated pick … top three"), and exclusions. `export_consumer.build_track_record` computes the baselines; new fields in `web-consumer/lib/types.ts` + a "How we compare" block on the performance page. Confirmed demos were already excluded from the consumer headline (the leak is only in the analytic Pro app). **C (landing page):** new `web-landing/` Next app (port 3002) — on-brand marketing page + Vercel-KV waitlist (`fetch` to the Upstash REST API, local-file dev fallback). Verified end-to-end (form → success → persistence), tsc clean, `next build` green. See [[web/landing]]. NOT committed/deployed; KV store setup is the user's gate.

---

## [2026-06-07] query | Market-validation report → commercial strategy synthesis

Studied the external Manus AI market-demand report. Filed `strategy/market-validation-2026-06.md` (new `strategy/` section in index). Key conclusions: report validates the consumer-fork pivot (transparent, compliance-first, info-only); two report blind spots in OUR favour/against us — PWA is a compliance moat (sidesteps App Store gambling review + 30% cut), and the real legal blocker is HKJC DATA RIGHTS not gambling; biggest credibility risk is the 63% claim resting on only 3 live meetings (demos must be excluded from ALL aggregates). Pricing/tiering decision: the two apps already built = the two paid tiers (consumer fork = Starter ~$48, heavy-analytic = Pro ~$88, premium unlock is a roadmap item). Tuesday investor-meeting sequence locked: A (this note) → B (credibility fix) → C (waitlist landing page).

---

## [2026-05-28] ingest | HV Meeting 2026-05-27 — results & reconciliation

22.2% top-3 precision (6/27). 14 value bets flagged; 0 won, 3 placed, 11 lost. Worst live meeting to date.
4 complete misses (R1, R4, R6, R9). jf×tf overconfidence dominant failure mode — HONEST WITNESS 84.1% model win, finished out of frame.
Going updated to GOOD TO FIRM (was GOOD on early fetch). Standby runner parser bug fixed (16 reserves excluded).

Updated pages:
- `performance/live-meetings.md` — added full May 27 section with race-by-race and value bet breakdown
- `overview.md` — updated live performance table (2-meeting average now 37.1%)

---

## [2026-05-28] build | Mobile PWA shipped to hv-simulator.vercel.app

Next.js 14 PWA in `web/` with glass / Apple-native design — installable to iOS home screen. Three pages: Tonight's Races (race tab strip, value pills, tap-to-expand factor breakdown), Performance (lifetime ROI / hit rate / recent meetings), Profiles (searchable jockeys/trainers/horses with 60-day trailing form). Fed by `export_data.py` which converts `happy_valley.db` + `predictions_*.json` + `results_*.json` into static JSON snapshots committed to the repo. Deployed to Vercel Hobby (project `ut3b5l-3494s-projects/hv-simulator`). Created `wiki/web/pwa.md`, updated `overview.md` and `index.md`. Streamlit `dashboard.py` retained as local race-day cockpit.

---

## [2026-05-28] query | May 27 race day workflow — racecard, odds, dashboard, results

Racecard: 9 races via GraphQL fallback. Odds: 106 entries (14 value bets). Results: 9 races fetched, 22.2% precision.
Technical fixes made: Standby filter in wednesday_agent.py, edge/market_pct/public_odds added to build_predictions(), both committed to git.

---

## [2026-05-17] ingest | Project raw sources (baselines 4A–4D, predictions/results JSON, agent.log)

Updated pages:
- `performance/walkforward.md` — added full per-fold tables for all phases (previously summary only)
- `performance/live-meetings.md` — added full race-by-race picks vs actuals for May 13; added Apr 29 partial entry note
- `model/factors/class.md` — added empirical calibration table (325/4363/541 runs, actual place rates from DB)
- `model/factors/weight-change.md` — added empirical calibration table (5,229 transitions, actual place rates)
- `model/factors/going.md` — added precise walk-forward regression numbers (VB ROI −27.8% when active) and statistical reasoning

Raw sources ingested: `baseline_phase4a.txt`, `baseline_phase4b.txt`, `baseline_phase4c.txt`, `baseline_phase4d.txt`, `predictions_2026-05-13.json`, `results_2026-05-13.json`, `results_2026-04-29.json`, `agent.log`

---

## [2026-05-17] init | Wiki created from Handoff_May_2026.md and project memory

Initial wiki scaffolded from the May 13, 2026 handoff note. All pages synthesised from existing sources — no new knowledge added. Covers phases A through 4D. Live as of May 13, 2026.

Pages created:
- overview, model/architecture, all 8 factor pages
- performance/walkforward, performance/live-meetings (May 13 meeting)
- data/database, data/api
- workflow/operations
- issues/known-issues


## [2026-05-30] experiment | Phase 5 — market-blend combiner (Benter conditional logit)
Discovered the model ignored market odds entirely (used only for value bets).
Benchmarked: market favourite already places top-3 ~61% / wins ~28% vs the
factor model's 34% / 14%. Built a race-grouped conditional logit fusing the
de-vigged market prob with the log-factors (`train_blend.py` → `blend_coef.json`,
applied via `score_race(blend_coef="auto")`). Walk-forward (204 races,
`validate_blend.py`): #1-place 34%→~60%, top-3 precision 34%→50%. Established the
oracle top-3 precision ceiling ~52% (60% is physically unreachable on HV fields).
jf×tf overconfidence and inert hf both resolved by the joint fit. Live in
export_data/dashboard/phase6_importer/race_simulator. New page [[market-blend]].

## [2026-05-30] experiment | Visual Uplift Phase 2 — PWA design-system pass (type scale, layered glass + accent tokens, ProbBar/WPSMeter probability viz, diverging factor bars, finishing-position distribution heatmap+histogram in simulator, SVG nav icons, motion). next build 7/7 green. See [[web/pwa]].

## [2026-05-31] build | PWA Phase 3 — Race Date dropdown portal fix (backdrop-filter z-order), loading skeletons + empty states, incremental rAF Monte Carlo (live convergence + draw progress), pull-to-refresh, offline service worker (prod-only), full light/dark toggle (CSS-var tokens + `light:` variant, no-flash). next build 7/7 green. Committed fd13fc7, pushed, vercel deploy --prod → hv-simulator.vercel.app (verified 200). See [[web/pwa]].

## [2026-06-03] query | Feasibility + plan — in-app dynamic race-day pull + 11pm auto-reconcile. Verdict: feasible via Mac-as-backend (FastAPI over Tailscale) + cron loop closure; cloud rewrite rejected (HK-IP geo-block, serverless Playwright, Python model/DB). New plan page [[web/dynamic-pull-plan]]. Triggered by today's silent 7am racecard-cron failure on a meeting day.

## [2026-06-03] ingest | HV Meeting 2026-06-03 (special between-week, 9 races). Top-3 51.9% (14/27); #1 win 44.4% (4/9), place 55.6% (5/9); R5 perfect, only R4 0/3; no value bets. First true live blend run — ties best night, #1 win well above market. 7am racecard cron failed silently (manual post-hoc pull). 3-meeting avg 42.0% (34/81). See [[performance/live-meetings#2026-06-03]].

## [2026-06-03] build | Weekly automation BUILT (`hv_auto.sh`) — cron pull (11:00/17:30/19:30) + reconcile (23:00/23:30) on Wednesdays, each running scrape → export_data → git → `vercel deploy --prod`. No-ops if no meeting (catches special weeks); Mac-unattended, no laptop/Tailscale needed. Also FIXED a GraphQL bug: bet.hkjc.com serves the NEAREST meeting for a non-meeting date → `_parse_graphql_racecard` now filters by requested date + HV venue (caught during no-op testing; had briefly imported a bogus 2026-06-04 = June-3 data — cleaned up). See [[workflow/operations]], [[web/dynamic-pull-plan]].

## [2026-06-03] build | Betting P&L now a final reconciliation step. `results_agent` scrapes the dividend table (WIN/PLACE/QUINELLA/QUINELLA PLACE) into results JSON; new `bet_report.py` computes flat-$10 P&L on the model top-3 (Win on #1, Place box, Quinella box, Quinella Place box) and prints + saves `bet_report_<date>.json`. Runs after every reconcile (manual + cron). 2026-06-03: Win +$31, QPL +$29, Place −$25.50, Quinella −$134.50. See [[workflow/operations]].

## [2026-06-03] build | PWA Performance page now shows Betting Returns (bet_report → export_data.build_betting → performance.json.betting → BettingReturns.tsx). Lifetime flat-$10 P&L on model top-3: Win-on-#1 +$23.50 (+8.7%, only profitable), Place −$253, Q-Place −$318, Quinella −$493 over 3 mtgs. Backfilled May 13/27 dividends. Verified mobile preview + live (commit 70a745f, vercel deploy, 200). See [[web/pwa]].

## [2026-06-06] build | PWA rebranded **HV Simulator → Zokki** + Synthex-inspired visual overhaul (commit `b79d93d`, deployed live, verified 200). Single LIGHT theme (dark mode + toggle removed): pale mint→blue gradient, frosted near-white glass, #163144 navy text, **Urbanist** font. Palette → navy(#1B405B)+mint(#DFF3EB); gold/green/red kept semantic but retuned to honey/sea-green/coral in that family; all raw Tailwind colors rewired to tokens. Signature navy→teal gradient hero + Zokki wordmark + crisp white active nav pill. New "Z" app icon (PNGs via qlmanage). Deploy also shipped the parked Sha Tin expansion (WinEdge + 2024-11-09 ST demo). User decisions: light-only, near-monochrome navy+mint keeping the 3 functional accents. See [[web/pwa]].

## [2026-06-06] ingest | ST historical backfill COMPLETE — 1,307 Sha Tin races / 16,833 entries now in `happy_valley.db` (2024-01-01 → 2026-05-31, from tianxi-database via `st_backfill`). This run inserted 1,091 races / 14,083 entries, zero errors, auto-resumed once after an overnight pause. Odds 98.5%, finish 98.3%, structural fields ~100%. DB is now two-venue (HV 614 + ST 1,307 = 1,921 races). ST adds `AWT` (Sha Tin all-weather dirt) config + 2000m/2400m distances. See [[data/database]].

## [2026-06-06] experiment | ST market-blend VALIDATED + integrated. Pure-factor walk-forward (`walkforward_test.py --venue ST`, 906 races): #1 win 19.8%, #1 place 45.3%, precision 36.7% vs 23.4% random — on par with HV. Edge backtest (`edge_backtest.py --venue ST`, 716 leak-free test races): blend #1 ROI −12.28% vs market −15.52%, **edge gap +3.24 pts → real edge** (bigger than HV's +1.79); disagree-with-fav pocket n=47 ROI **+14.5%**. Trained `blend_coef_ST.json` (`log_mkt` β=1.117). Made `model_core.load_blend_coef(venue=…)` venue-aware (score_race passes `stats["venue"]`, falls back to HV file) — HV path byte-identical. Merged ST + refreshed HV blocks into `win_edge.json`. PWA frontend already venue-aware (WinEdge.tsx VenueBlock per venue). See [[performance/walkforward]], [[model/market-blend]].

## [2026-06-06] build | Live Sha Tin automation BUILT (venue-aware pipeline). Generalized the HV-Wednesday automation to handle weekend ST meetings: `wednesday_agent.py` + `results_agent.py` gain `--venue {HV,ST}` (parameterized racecard/results URLs, bet.hkjc GraphQL venue filter, `build_stats(venue=)`, and a `venue` field now written into predictions/results JSON); `phase6_importer.insert_race_day(…, venue=)`; `hkjc_odds.py` was already venue-aware. `hv_auto.sh` now probes both venues per date (`VENUES="HV ST"`, default) and processes whichever is racing, attributing the date-keyed JSON by its `venue` tag (`file_is_venue`). Validated the ST live-scoring path on real DB races: ST stats + `blend_coef_ST.json` resolve via `load_blend_coef(venue=…)`, and the market-blend engages on complete-odds ST races (pure-factor 65.5% win → blend 30.7%, anchored to market 35.7%). Weekend ST cron block documented in [[workflow/operations]] but NOT yet installed (activation enables auto prod-deploy). Network fetch layer mirrors the proven HV path but is not yet exercised against a live ST card. See [[workflow/operations]], [[overview]].

## [2026-06-06] build | Weekend Sha Tin cron INSTALLED + ST live-fetch validated + 2nd ST demo added. Installed the weekend block in the live crontab (Sat=6/Sun=0: pull 09:00/11:30/12:30/15:00, reconcile 18:00/18:30; default VENUES="HV ST"), first fire = 2026-06-07 Sunday ST meeting. Validated the previously-untested ST network path: `wednesday_agent.py --venue ST --date 2026-06-07 --dry-run` pulled tomorrow's 11-race Sha Tin card cleanly (distances/classes/runners/going) — the venue-parameterized scraper + GraphQL fallback work for ST. Added a recent ST demo meeting to the PWA: `regen_predictions.py 2026-05-31 --venue ST --with-results` (11 races, blended, settled) → export_data → snapshot now has 5 meetings (2× ST demo: 2026-05-31 + 2024-11-09). Verified in preview: header "SHA TIN · Sun 31 May · 11 races · settled", blended picks, picker lists both ST + HV. See [[workflow/operations]].

## [2026-06-07] ingest | Sha Tin Meeting 2026-06-07 — FIRST LIVE ST meeting (11 races). Top-3 36.4% (12/33); #1 win 18.2% (2/11: FIREFOOT R1, ACE R6), place 45.5% (5/11) — both exactly on ST backtest baselines (19.8%/45.3%), so model variance not breakdown. All 4 bet strategies lost (Win −$44/−40%, Place −$91, Quinella −$293, Q-Place −$233) — both winners short favs ($2.80/$3.80). Recovered manually after cron bugs (below). See [[performance/live-meetings#2026-06-07]], [[overview]].
## [2026-06-07] fix | THREE automation bugs surfaced on first weekend ST cron fire. (1) `hv_auto.sh` zsh word-split: `for V in $VENUES` (default "HV ST") ran once with V="HV ST" → all 6 cron fires crashed on `--venue "HV ST"` but were masked as `no meeting — no-op`; fixed → `${=VENUES}`. (2) `results_agent.py` off-by-one: `range(1, MAX_RACES)` with MAX_RACES=11 only probed R1–R10 → R11 of every ST card silently dropped; fixed → `range(1, MAX_RACES+1)`. (3) Weekend reconcile slots 18:00/18:30 too early for a ~21:00 ST settle — STILL OPEN, recommend adding ~20:30/21:00 slot. Latent silent-failure masking in the no-op branch flagged. See [[issues/known-issues]].

## [2026-06-10] build | Consumer app overhaul — race-day experience (Apple-simplicity rework)

All-in on the consumer product (investor dropped; Path B closed after null edge result). `web-consumer/` reworked around three customer demands: top-3 picks as the headline (saddle-cloth podium, "Your numbers N·N·N"), stake→payout calculator (HK win odds, receipt mode on settled races), past form at a glance (form dots + career line from profiles). Added Banker-of-the-night strip with track-record trust line; nav cut to 3 tabs (Races/Simulator/Track Record); full field folded behind disclosure. Fixed pre-existing layout bug: safe-bottom padding on height-pinned <body> let the floating nav cover the last card — moved to <main>. No data-pipeline changes. Verified via production build + Playwright (iPhone viewport, live & settled states).

## [2026-06-10] ingest | HV Meeting 2026-06-10 (9 races) — best HV night of live era. Top-3 13/27 = 48.1% (vs 32.2% walk-forward); #1 win 3/9 (33.3%: GRAND NOVA R4, TYCOON RESOURCES R8, TARGET AUDIENCE R9), #1 place 5/9 (55.6%). R8 perfect 1-2-3 sweep; R9 TARGET AUDIENCE WIN @ $43 longshot (FLYING WROTE 2nd). First clearly green betting night: Win-on-#1 +$54/+60%, Quinella box +$60/+22.2%, Q-Place box +$7/+2.6%, Place −$49.50/−18.3%. Two of three winning #1 picks were not the shortest favourite → edge over market, not just riding it. **Reconcile caveat:** 23:00 auto-reconcile captured only R1–R8 (R9, the last race, had not posted yet) and stopped on the break-on-first-miss probe; manual re-run pulled all 9 cleanly. R9 was a normal full 12-horse field (complete dividend pool incl. First 4/Quartet/Trio/$547,863 Six Up) — no stewards' incident. Filed new issue [[issues/known-issues#reconcile-before-last-race-posts]]. Re-exported PWA snapshot + deployed. See [[performance/live-meetings#2026-06-10]], [[overview]].

## [2026-06-10] build | Consumer app handoff — persistent localhost + next-session agenda

Persistent dev server installed as a macOS LaunchAgent (`com.zokki.consumer`, port 3001, `RunAtLoad`+`KeepAlive`, hot-reload) so localhost:3001 is always up across reboots without a manual restart. Plist: `~/Library/LaunchAgents/com.zokki.consumer.plist`; logs: `/tmp/zokki-consumer-dev.log`. Consumer overhaul (race-day experience) complete and verified, still NOT committed/deployed. A throwaway unsettled demo card `2099-01-01` is kept in `web-consumer/public/data/meetings/` so the pre-race view is viewable at `/?date=2099-01-01` (direct URL only; not in the date picker). **Next session focus:** (1) the outstanding Path-B question, (2) MAJOR simulator overhaul, (3) consumer-app branding overhaul. Follow-ups recorded in project memory.

## [2026-06-11] build | Visual Design v1 — dark-glass overhaul of consumer app + landing; Day Pass HK$12 default

Full visual redesign of `web-consumer/` and `web-landing/` cloning the user's "Visual Design v1" reference (3 screenshots, project root): dark cinematic glassmorphism — warm charcoal gradient + grain, smoked-glass cards, white Urbanist type at lighter display weights, butter #F9EF98 / gold #D3B358 / green #6BC34B / coal #121212 palette. Done at the CSS-token layer (`--fg` flip + accent remap; legacy `navy`/`mint` names keep semantics as coal/ivory), plus `.butter-panel` signature surface (active nav, primary buttons, default plan card). Landing pricing rebuilt around a **Day Pass at HK$12/race day as the default offering** (butter card, "Most popular"), 4-tier grid, EN+ZH copy updated. Gotcha fixed: `background-attachment: fixed` + backdrop-filter renders black (and breaks iOS Safari) — page gradient moved to a fixed `body::before` layer. Both apps build clean; verified in preview (desktop + mobile). NOT committed/deployed yet.

## [2026-06-11] experiment | Zokki consumer — RaceBroadcast viewer

Added `web-consumer/components/RaceBroadcast.tsx`: a broadcast-style animated race viewer (canvas) on the Simulator tab, modelled on virtual-sports TV feeds. Each playback samples one finishing order from the model win probabilities (Plackett–Luce), then choreographs a believable running: tracking camera, procedural galloping horses in numbered silks, rails/billboards, live top-4 ticker, photo-finish flash, results card. HV meetings render a floodlit night theme; ST renders daytime.

## [2026-06-11] experiment | RaceBroadcast v2 — true 3D broadcast camera

Rewrote the viewer with a real perspective engine: pinhole camera + telephoto auto-zoom, elevated trackside camera towers with TV-style pass-by cuts, curved course geometry (back straight → 100° turn → 330m home straight), Happy Valley backdrop (night sky, lit city towers, hill ridge, floodlight masts, infield big screens, blue 跑馬地 boards), yaw-foreshortened galloping horses, starting gates, striped finish post. ST renders the daytime look.

## [2026-06-11] build | Zokki splash — Visual Design v1 alignment

Consumer app splash brought onto the dark-glass design: regenerated all 11 iOS startup images (scripts/gen_splash.py — charcoal gradient, butter bloom, grain, bgless F-Horseshoe glyph, zokki wordmark + gold dot), swapped the navy-tile mark for the glyph in SplashScreen.tsx (now token-driven page-grad + grain), fixed manifest colors from light-mint #eef5f2 to #161513/#2c2a27.

## [2026-06-12] experiment | RaceBroadcast v3 — Three.js with animated horse meshes

Rebuilt the broadcast viewer on Three.js (r184): real-time 3D with the three.js project's animated GLB horse (morph-target gallop cycle, 12 tinted instances with jockeys + saddlecloth number planes), curved course geometry, instanced rails/posts, billboard + infield-screen canvas textures (live distance), city-tower skyline with lit windows, floodlight glow sprites, pack-tracking shadow key light (camera-relative so the field is always lit toward the lens), fog, ACES tone mapping. Six-tower TV directing with auto-zoom pass-by cuts and broadcast slow-mo on photo finishes. Plackett-Luce sampled outcomes unchanged. Verified frame-by-frame via a dev-only __rbRenderAt hook (HV night + ST day, gates/pass-by/straight/finish, mobile + desktop).

## [2026-06-12] experiment | RaceBroadcast v3.1 — Quaternius rigged horse

Swapped the morph-target three.js horse for the Quaternius Animated Animal Pack horse (CC0): rigged SkinnedMesh with a true skeletal Gallop cycle, cloned per runner via SkeletonUtils, coat tints applied through the model's named materials (Main/Main_Dark/Main_Light/Hair) so bays, chestnuts, greys read distinctly. Jockey + saddlecloth refitted to the new anatomy. Asset repacked 3.6MB gltf to 2.2MB GLB (scripts/gltf2glb.py), served from public/models/HorseQuaternius.glb. Verified pass-by, home straight, finish, ST day + HV night, result flow; tsc + console clean.

## [2026-06-19] ingest | HV Meeting 2026-06-13 (Sha Tin, 11 races) + 06-13 card reconciliation

06-13 ST meeting was only half-settled on race night (R1–R5; the 18:30 auto-pull caught the first races mid-card and never reconciled the back half). Pulled R6–R11 via `results_agent.py --venue ST --date 2026-06-13`. Full card: **top-3 18/33 = 54.5%** (best of the live era; two perfect sweeps R1/R7), but #1 win only 2/11 (18.2%) — both winners short, Win-on-#1 −70%, only Q-Place box green (+11.4%). New section in [[performance/live-meetings]]; [[overview]] table + ST average updated.

## [2026-06-19] experiment | Closing-odds contamination found & mitigated (3 meetings)

Discovered the raw `predictions_*.json` for 2026-05-13, 2026-05-27 and 2026-06-07 had been overwritten by post-meeting re-scores against closing odds (May meetings batch-regenerated 2026-05-30; June 7 during same-night bug-recovery), inflating app-reported top-3 to 59.3% / 40.7% / 45.5% vs the live records 51.9% / 22.2% / 36.4%. Added a `PICK_CORRECTIONS` overlay in `export_data.py` that re-ranks those meetings to the contemporaneous live picks at export time (raw sources untouched). Honest consumer headline now **44.3%** (77/174, 6 live meetings). See [[issues/known-issues#closing-odds-contamination]]. Root cause (regen overwriting settled meetings with closing odds) left open.

## [2026-06-19] ingest | Zokki consumer app refreshed + deployed

Re-ran `export_data.py` → `export_consumer.py`; the consumer app now carries 06-10 and 06-13 (previously missing) and the corrected 05-13 / 05-27 / 06-07 numbers. Deployed `web-consumer` to production Vercel. See [[web/pwa]].

## [2026-06-24] ingest | HV Meeting 2026-06-24 (9 races) — weak precision, strong WIN payout. Top-3 12/27 = 44.4% (softest live HV night, vs 32.2% walk-forward); #1 win 3/9 (33.3%: ROSEWOOD FLEETFOOT @$32 R1, ALL ARE MINE @$42 R2, SKY CAP @$71.5 R7), #1 place 4/9 (44.4%). Longshot-heavy card — 6/9 winners ≥ $42, incl. BLOSSOMY $151.5 (R4) and DEFINITIVE $133.5 (R9). All three #1 winners well-priced → flat Win-on-#1 +$55.50/+61.7% ✅ (2nd straight green HV WIN night), Place +$36/+13.3% ✅, Q-Place box −$6.50/−2.4%, Quinella box −$120.50/−44.6% ❌. **Zero value bets flagged** (market blend) → live paper-trading flat; P&L is the hypothetical flat-top-3 book. R8 had a dead-heat for 3rd (our #2 THE HEIR in it). **Reconcile caveat (3rd recurrence):** 23:00 auto-reconcile captured only R1–R8 (R9 DEFINITIVE not yet posted, break-on-first-miss); manual `results_agent.py --venue HV --date 2026-06-24` pulled all 9. Promoted [[issues/known-issues#reconcile-before-last-race-posts]] to recurring/priority. See [[performance/live-meetings#2026-06-24]], [[overview]].

## [2026-06-25] fix | Reconcile no longer truncates the last race — RESOLVED [[issues/known-issues#reconcile-before-last-race-posts]]. Two coupled changes: (1) `results_agent.py` probe loop no longer `break`s on the first not-yet-posted race — it reads the true card size from `predictions_<date>.json` (`max(race_number)`, capped at `MAX_RACES`), probes `R1..card_size`, **skips** missing/unparseable races into a `missing` list, and prints a `⚠ N of M not yet posted` backfill notice; idempotent (UPDATEs + settle guarded on `result IS NULL`) so a later run backfills gaps cleanly. (2) Added a third HV reconcile fire at **00:15 Thu HKT** (`15 0 * * 4`) to the live crontab and [[workflow/operations]] as a safety net for a late final race, mirroring the weekend ST block. Verified on 2026-06-24: `--dry-run` captures full R1–R9 (incl. R9 DEFINITIVE) in one pass; offline mid-card-gap test (force R8 missing) confirms the probe reaches R9 and reports R8 for backfill instead of truncating.

## [2026-06-25] query | Jun 13→24 coverage gap — 2026-06-21 Sha Tin (11 races) was MISSED, not absent. While building the consumer "Results" tab, investigated why meetings jump from 06-13 to 06-24. HKJC fixture calendar shows three meetings in that window: 06-13 ST ✓, **06-21 ST (Sun twilight, 11 races) ✗ missed**, 06-24 HV ✓. No meetings on 06-14/06-17/06-20 (06-17 Wed + 06-20 Sat confirmed by live cron no-op logs). Root cause: the cron host (personal Mac) was asleep on Sun 06-21 — `agent.log` has zero lines for that date — so neither pull nor reconcile fired. NOT recoverable as a live record: racecard endpoint is pre-race only (`wednesday_agent` returns "no races found", `regen_predictions` skips "no races in DB"); only closing-odds results remain, which would reintroduce [[issues/known-issues#closing-odds-contamination]]. Decision: leave 06-21 as an honest gap (omitted from apps), filed new issue [[issues/known-issues#asleep-host-missed-meetings]] with audit/alert + always-on-host todos. Consumer app (new Results tab + Simulator meeting dropdown + Picks/Results/Track Record rename) deployed without 06-21.
