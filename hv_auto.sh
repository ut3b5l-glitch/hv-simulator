#!/bin/zsh
# ─────────────────────────────────────────────────────────────────────────────
# HV Simulator — weekly automation orchestrator
#
#   hv_auto.sh pull       [YYYY-MM-DD]   racecard + odds → export → deploy
#   hv_auto.sh reconcile  [YYYY-MM-DD]   results        → export → deploy
#
# Designed to run from cron every Wednesday. It is SAFE to run repeatedly:
#   - insert_race_day() reuses existing race rows (no duplicates; entries use
#     INSERT OR REPLACE), so multiple pulls/day just refresh odds + re-score.
#   - When there is no meeting, the scrapers produce no races and the script
#     no-ops (no export, no deploy) — so it can fire every Wednesday blindly and
#     still correctly catch the irregular "special between-week" meetings.
#
# Requires the Mac to be AWAKE at the scheduled times (set it to never sleep).
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

MODE="${1:-}"
DATE="${2:-$(date +%F)}"            # today, local time (Mac is on HKT)
VENUES="${3:-HV ST}"                # venues to probe; HKJC runs one fixture/day,
                                    # so we try each and process whichever races.

PROJECT_DIR="/Users/ryanx.x/AI Playground/HV_Simulator"
PY="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
# vercel is a Node CLI under nvm — its bin dir must be on PATH for both node + vercel.
NODE_BIN="/Users/ryanx.x/.nvm/versions/node/v24.15.0/bin"
export PATH="$NODE_BIN:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
LOG="$PROJECT_DIR/agent.log"

# Optional push notification: set HV_NTFY_TOPIC in the crontab to enable (else no-op).
notify() { [ -n "${HV_NTFY_TOPIC:-}" ] && curl -s -d "$1" "https://ntfy.sh/${HV_NTFY_TOPIC}" >/dev/null 2>&1; return 0; }

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [hv_auto:$MODE] $*" >> "$LOG"; }

cd "$PROJECT_DIR" || { echo "FATAL: cannot cd to $PROJECT_DIR" >&2; exit 1; }

# True if the given predictions/results JSON exists and contains ≥1 race.
has_races() {
  [ -f "$1" ] || return 1
  "$PY" - "$1" <<'PYEOF'
import json, sys
try:
    sys.exit(0 if json.load(open(sys.argv[1])).get("races") else 1)
except Exception:
    sys.exit(1)
PYEOF
}

# True if the JSON has ≥1 race AND its venue tag matches $2 (default HV).
# Used to attribute a date-keyed file to the venue we just pulled, so a stale
# file from the *other* venue can't be mis-claimed during multi-venue probing.
file_is_venue() {
  [ -f "$1" ] || return 1
  "$PY" - "$1" "$2" <<'PYEOF'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    sys.exit(0 if (d.get("races") and d.get("venue", "HV") == sys.argv[2]) else 1)
except Exception:
    sys.exit(1)
PYEOF
}

# Refresh the PWA snapshot, commit the data, and deploy to Vercel.
deploy() {
  log "meeting data present → refreshing PWA snapshot"
  "$PY" export_data.py >> "$LOG" 2>&1 || { log "ERROR: export_data.py failed — aborting deploy"; return 1; }
  # Commit the data snapshot for the record (predictions_*.json and *.db are gitignored).
  git add web/public/data >> "$LOG" 2>&1
  if git commit -m "data: $DATE (auto $MODE)" >> "$LOG" 2>&1; then
    git push >> "$LOG" 2>&1 || log "WARN: git push failed (deploy continues)"
  else
    log "no data changes to commit (deploy continues)"
  fi
  if ( cd web && vercel deploy --prod --yes >> "$LOG" 2>&1 ); then
    log "✓ deployed to https://hv-simulator.vercel.app"
    return 0
  fi
  log "ERROR: vercel deploy failed"
  return 1
}

case "$MODE" in
  pull)
    log "── start pull for $DATE (venues: $VENUES) ──"
    MEETING_VENUE=""
    for V in ${=VENUES}; do   # ${=…} forces zsh word-splitting (off by default)
      "$PY" wednesday_agent.py --venue "$V" --date "$DATE" --retry 0 >> "$LOG" 2>&1
      if file_is_venue "predictions_$DATE.json" "$V"; then
        "$PY" hkjc_odds.py --venue "$V" --date "$DATE" >> "$LOG" 2>&1
        MEETING_VENUE="$V"
        break
      fi
    done
    if [ -n "$MEETING_VENUE" ]; then
      if deploy; then notify "$MEETING_VENUE $DATE: card + odds live in the app ✅"; fi
      log "── pull complete ($MEETING_VENUE) ──"
    else
      rm -f "predictions_$DATE.json"   # drop any stray race-less file so export_data won't pick it up
      log "no meeting on $DATE (any of: $VENUES) — no-op"
    fi
    ;;
  reconcile)
    log "── start reconcile for $DATE (venues: $VENUES) ──"
    MEETING_VENUE=""
    for V in ${=VENUES}; do   # ${=…} forces zsh word-splitting (off by default)
      "$PY" results_agent.py --venue "$V" --date "$DATE" >> "$LOG" 2>&1
      if file_is_venue "results_$DATE.json" "$V"; then
        MEETING_VENUE="$V"
        break
      fi
    done
    if [ -n "$MEETING_VENUE" ]; then
      acc="$("$PY" - "results_$DATE.json" <<'PYEOF'
import json,sys
try:
    d=json.load(open(sys.argv[1])); print(d.get("accuracy",""))
except Exception: pass
PYEOF
)"
      if deploy; then notify "$MEETING_VENUE $DATE results in — ${acc:-see app} 🏇"; fi
      log "── reconcile complete ($MEETING_VENUE: ${acc:-n/a}) ──"
    else
      rm -f "results_$DATE.json"   # drop any stray race-less file
      log "no results on $DATE yet (any of: $VENUES) — no-op"
    fi
    ;;
  *)
    echo "Usage: $(basename "$0") pull|reconcile [YYYY-MM-DD]" >&2
    exit 2
    ;;
esac
