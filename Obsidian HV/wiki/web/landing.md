# Zokki Landing Page (`web-landing/`)

Marketing front door + **waitlist** for Zokki. Built for the June 2026 investor/owner meeting and as the report's #1 validation experiment ("prove willingness to pay before deepening the build"). See [[strategy/market-validation-2026-06]].

## What it is

A standalone Next.js 14 app (separate from the [[web/pwa]] product app and the consumer fork) so it can run a real serverless backend and deploy independently. Shares the **Visual Design v1** system with `web-consumer/` (since 2026-06-11): dark cinematic glassmorphism — studio-charcoal gradient + grain, smoked-glass cards, Urbanist at light display weights, butter `#F9EF98` / gold `#D3B358` / green `#6BC34B` / coal `#121212` accents, `.butter-panel` for the one loud surface. Reference screenshots live in `Visual Design v1/` at the project root. `globals.css`, `tailwind.config.ts`, `Wordmark`/`ZokkiMark`, and `public/icons/` are kept in lock-step with `web-consumer/`.

- **Dir:** `web-landing/` · **Dev port:** 3002 (`npm run dev --prefix web-landing`; launch config `zokki-landing`).
- **Ports across apps:** 3000 = analytic `web/`, 3001 = consumer `web-consumer/`, 3002 = landing.
- **Bilingual EN / 繁中** via a top-right `EN | 中` toggle (see i18n below).
- **Live:** https://web-landing-smoky.vercel.app (Vercel project `ut3b5l-3494s-projects/web-landing`, public — no deployment protection). Deploy = `cd web-landing && vercel deploy --prod --yes`.

## i18n (Eng | 中 toggle)

Lightweight cookie + dictionary, no library. `lib/i18n.ts` holds `en` + `zh` (HK Traditional Chinese, written by Claude) message dicts of identical shape (`Dict = typeof en`); interpolated strings (receipts/CTA/social) are functions. `getLocale()` reads the `zokki_lang` cookie server-side; `getDict(locale)` returns the dict. `components/LangToggle.tsx` (client) sets the cookie + `router.refresh()` so the server components re-render in the new language; `layout.tsx` flips `<html lang>`. `WaitlistForm` takes a `labels` prop, `AppPreview` takes `t.preview`. Horse/jockey names stay English (authentic to HK; our data is English). To add a string: add the key to BOTH `en` and `zh`.

## Page sections

Hero (headline + TC tagline + waitlist + phone mockup) → Problem → What Zokki does (3 feature cards) → **The receipts** (top pick 63% vs favourite 67% vs random 26%, same 27 live races) → Pricing (Free / **Starter HKD $48 — the anchor** / Pro "coming") → closing CTA → compliance footer (info-only, not affiliated with HKJC, 18+, Ping Wo Fund 1834 633).

The phone mockup (`components/AppPreview.tsx`) is an in-DOM recreation of the real 3 Jun HV R1 read — no raster screenshot to go stale.

## Waitlist backend

- **Route:** `app/api/waitlist/route.ts` — `POST {email, source, locale}` validates + stores; `GET` returns the count. `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- **Store:** `lib/waitlist.ts`. Production = **Vercel KV (Upstash Redis)** over its REST API via plain `fetch` (no extra dependency).
  - `SADD zokki:waitlist:emails <email>` (dedupe + `SCARD` count)
  - `LPUSH zokki:waitlist:log <json>` (full records, newest first)
- **Local dev fallback:** if `KV_REST_API_URL` / `KV_REST_API_TOKEN` are absent, writes to a gitignored `.waitlist.local.json` so the form works with zero cloud setup. Verified end-to-end (valid → `added:true`; invalid → 422; count + persistence OK).

## Env vars (production)

| Var | Source |
|---|---|
| `KV_REST_API_URL` | injected by Vercel when a KV store is linked |
| `KV_REST_API_TOKEN` | injected by Vercel when a KV store is linked |

## Deploy + KV state

- **Project created + deployed** (2026-06-07): `ut3b5l-3494s-projects/web-landing` → https://web-landing-smoky.vercel.app (public, bilingual). Redeploy: `cd web-landing && vercel deploy --prod --yes`.
- **KV NOT yet linked (user action).** Until it is, the production form returns `500 store_failed` on submit — the dev file-fallback can't write on Vercel's read-only FS (fails loudly, never drops signups silently). GET count returns 0 gracefully.
- **To finish (user, ~5 clicks):** Vercel → the `web-landing` project → **Storage → Create Database → Upstash for Redis (KV)** → accept terms, free plan, region **Singapore (ap-southeast-1)** → **Connect to project** (auto-injects `KV_REST_API_URL` + `KV_REST_API_TOKEN`). Then **redeploy** (`vercel deploy --prod --yes`) so the function sees the env.
- Point a domain when ready (metadataBase currently `https://zokki.app`).

Read signups: Vercel KV dashboard, or `GET /api/waitlist` for the live count, or `LRANGE zokki:waitlist:log 0 -1`.

## TODO / fast-follows

- **Link KV + redeploy** (above) — the only thing between here and a working production waitlist.
- **Wire `PROOF` to the live feed** — the receipts numbers in `app/page.tsx` are constants today (63/67/26, 27 races, 3 meetings; en + zh date range). Refresh after each meeting, or pull from the consumer Track Record.
- OG share image (`app/opengraph-image.tsx`).
- `next@14.2.18` carries a flagged security advisory (shared across all three apps) — upgrade together.

## Status

Built, bilingual (EN/繁中), browser-verified (desktop two-column hero + mobile, both languages, form end-to-end), tsc clean, `next build` green. **DEPLOYED** to https://web-landing-smoky.vercel.app (public). `web-landing/` is untracked in git (the `web-landing/.vercel` link is gitignored). Waitlist goes live once KV is linked + redeployed.
