import "server-only";

/**
 * Minimal fixed-window rate limiter over the same Upstash Redis (REST) instance
 * the waitlist uses — no SDK, just the REST pipeline. Used to protect the open
 * vision endpoint (palm/face reader) from abuse/cost blow-ups *before* real auth
 * exists; once accounts land (Phase 2) the per-user entitlement becomes the gate.
 *
 * Reads either naming convention (Vercel KV or Upstash direct), matching
 * `lib/waitlist.ts`. If neither is configured (local dev), limiting is a no-op so
 * the feature still works — callers get `{ ok: true }`.
 */
const REST_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

export const rateLimitConfigured = Boolean(REST_URL && REST_TOKEN);

export type RateLimitResult = {
  /** True when the request is allowed through. */
  ok: boolean;
  /** Requests remaining in the current window (best-effort). */
  remaining: number;
};

/**
 * Increment a fixed-window counter for `key` and report whether it's within
 * `limit` per `windowSec`. The first hit of a window sets the TTL. Fails open:
 * on a store error (or when unconfigured) the request is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  if (!rateLimitConfigured) return { ok: true, remaining: limit };

  const redisKey = `rl:${key}`;
  try {
    // One round-trip: INCR the counter, then set its TTL. EXPIRE with NX only
    // arms the TTL on the first hit of the window (Redis ≥ 7); harmless if the
    // server ignores NX (worst case the window slides slightly).
    const pipeline = [
      ["INCR", redisKey],
      ["EXPIRE", redisKey, String(windowSec), "NX"],
    ];
    const res = await fetch(`${REST_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(pipeline),
      cache: "no-store",
    });
    if (!res.ok) return { ok: true, remaining: limit }; // fail open
    const data = (await res.json()) as Array<{ result?: number | string; error?: string }>;
    const count = Number(data?.[0]?.result ?? 0);
    const remaining = Math.max(0, limit - count);
    return { ok: count <= limit, remaining };
  } catch {
    return { ok: true, remaining: limit }; // fail open — never block on infra errors
  }
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
