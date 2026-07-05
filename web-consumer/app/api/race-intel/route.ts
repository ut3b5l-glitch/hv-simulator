import { z } from "zod";
import { NextResponse } from "next/server";
import { getMeeting } from "@/lib/data";
import { raceDigest } from "@/lib/ai/digest";
import { streamRaceIntel, aiConfigured, type ZokkiLocale } from "@/lib/ai/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  race_number: z.number().int().min(1).max(14),
  style: z.enum(["banker", "value", "story"]).optional(),
  locale: z.enum(["en", "zh"]).default("en"),
});

const ERRORS: Record<ZokkiLocale, Record<string, string>> = {
  en: {
    notConfigured: "AI isn't configured yet — add an API key to .env.local.",
    badRequest: "Malformed request — please try again.",
    rateLimited: "You've hit the usage limit for now — please try again later.",
    notFound: "That race isn't in tonight's card.",
    aiFailed: "The analyst can't respond right now — please try again shortly.",
  },
  zh: {
    notConfigured: "AI 尚未設定，請於 .env.local 填入 API key。",
    badRequest: "請求格式有誤，請重試。",
    rateLimited: "使用次數已達上限，請稍後再試。",
    notFound: "今晚的賽事卡找不到這場賽事。",
    aiFailed: "分析員暫時無法回應，請稍後再試。",
  },
};

function err(key: string, locale: ZokkiLocale, status: number) {
  return NextResponse.json({ error: ERRORS[locale][key] }, { status });
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return err("badRequest", "en", 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return err("badRequest", "en", 400);
  const { date, race_number, style, locale } = parsed.data;

  if (!aiConfigured) return err("notConfigured", locale, 503);

  // Open endpoint → per-IP fixed windows (generous for humans, hostile to scripts).
  const ip = clientIp(req);
  const [burst, daily] = await Promise.all([
    rateLimit(`intel:h:${ip}`, 20, 60 * 60),
    rateLimit(`intel:d:${ip}`, 80, 24 * 60 * 60),
  ]);
  if (!burst.ok || !daily.ok) return err("rateLimited", locale, 429);

  const meeting = await getMeeting(date).catch(() => null);
  const race = meeting?.races.find((r) => r.race_number === race_number);
  if (!meeting || !race) return err("notFound", locale, 404);

  try {
    const stream = await streamRaceIntel(raceDigest(meeting, race), style, locale);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return err("aiFailed", locale, 502);
  }
}
