/**
 * Waitlist store.
 *
 * Production: Vercel KV (Upstash Redis), reached over its REST API with plain
 * `fetch` so we carry no extra dependency. Set `KV_REST_API_URL` and
 * `KV_REST_API_TOKEN` (Vercel injects these when a KV store is linked).
 *
 * Local dev (no KV env): falls back to a gitignored JSON file so the form can be
 * exercised end-to-end without any cloud setup.
 *
 *   emails  → Redis SET  `zokki:waitlist:emails`  (dedupe + count via SCARD)
 *   log     → Redis LIST `zokki:waitlist:log`     (full records, newest first)
 */
import { promises as fs } from "fs";
import path from "path";

export type Signup = {
  email: string;
  locale?: string;
  source?: string;
  ts: string;
};

const EMAILS_KEY = "zokki:waitlist:emails";
const LOG_KEY = "zokki:waitlist:log";

function kvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvPipeline(commands: unknown[][]): Promise<Array<{ result?: unknown; error?: string }>> {
  const res = await fetch(`${process.env.KV_REST_API_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`KV ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ── Local dev fallback ──────────────────────────────────────────────
const LOCAL = path.join(process.cwd(), ".waitlist.local.json");

async function localReadAll(): Promise<Signup[]> {
  try {
    return JSON.parse(await fs.readFile(LOCAL, "utf-8")) as Signup[];
  } catch {
    return [];
  }
}

async function localAdd(s: Signup): Promise<{ added: boolean; count: number }> {
  const all = await localReadAll();
  const added = !all.some((d) => d.email === s.email);
  if (added) all.unshift(s);
  await fs.writeFile(LOCAL, JSON.stringify(all, null, 2));
  return { added, count: all.length };
}

// ── Public API ──────────────────────────────────────────────────────
export async function addSignup(s: Signup): Promise<{ added: boolean; count: number }> {
  if (!kvConfigured()) return localAdd(s);
  const out = await kvPipeline([
    ["SADD", EMAILS_KEY, s.email],
    ["LPUSH", LOG_KEY, JSON.stringify(s)],
    ["SCARD", EMAILS_KEY],
  ]);
  const added = Number(out[0]?.result ?? 0) === 1;
  const count = Number(out[2]?.result ?? 0);
  return { added, count };
}

export async function signupCount(): Promise<number> {
  try {
    if (!kvConfigured()) return (await localReadAll()).length;
    const out = await kvPipeline([["SCARD", EMAILS_KEY]]);
    return Number(out[0]?.result ?? 0);
  } catch {
    return 0;
  }
}
