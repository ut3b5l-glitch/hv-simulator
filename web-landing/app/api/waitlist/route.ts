import { NextRequest, NextResponse } from "next/server";
import { addSignup, signupCount } from "@/lib/waitlist";

// fs fallback + KV fetch both run fine on the Node runtime; force dynamic so the
// count is never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 422 });
  }
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 12) : undefined;
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : undefined;

  try {
    const { added, count } = await addSignup({
      email,
      locale,
      source,
      ts: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, added, count });
  } catch (err) {
    console.error("waitlist add failed:", err);
    return NextResponse.json({ ok: false, error: "store_failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ count: await signupCount() });
}
