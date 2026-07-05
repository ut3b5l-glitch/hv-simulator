import { z } from "zod";
import { NextResponse } from "next/server";
import { getMeeting, getTrackRecord } from "@/lib/data";
import { meetingDigest, raceDigest } from "@/lib/ai/digest";
import { streamAsk, aiConfigured, type ZokkiLocale } from "@/lib/ai/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  race_number: z.number().int().min(1).max(14).nullable().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .max(40)
    .default([]),
  message: z.string().min(1).max(2000),
  style: z.enum(["banker", "value", "story"]).optional(),
  locale: z.enum(["en", "zh"]).default("en"),
});

const ERRORS: Record<ZokkiLocale, Record<string, string>> = {
  en: {
    notConfigured: "AI isn't configured yet — add an API key to .env.local.",
    badRequest: "Malformed request — please try again.",
    rateLimited: "You've hit the usage limit for now — please try again later.",
    notFound: "I can't find that meeting's card.",
    aiFailed: "Zokki can't respond right now — please try again shortly.",
  },
  zh: {
    notConfigured: "AI 尚未設定，請於 .env.local 填入 API key。",
    badRequest: "請求格式有誤，請重試。",
    rateLimited: "使用次數已達上限，請稍後再試。",
    notFound: "找不到這個賽期的賽事卡。",
    aiFailed: "Zokki 暫時無法回應，請稍後再試。",
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
  const { date, race_number, history, message, style, locale } = parsed.data;

  if (!aiConfigured) return err("notConfigured", locale, 503);

  const ip = clientIp(req);
  const [burst, daily] = await Promise.all([
    rateLimit(`ask:h:${ip}`, 30, 60 * 60),
    rateLimit(`ask:d:${ip}`, 150, 24 * 60 * 60),
  ]);
  if (!burst.ok || !daily.ok) return err("rateLimited", locale, 429);

  const meeting = await getMeeting(date).catch(() => null);
  if (!meeting) return err("notFound", locale, 404);
  const record = await getTrackRecord().catch(() => null);

  const race = race_number != null ? meeting.races.find((r) => r.race_number === race_number) : undefined;

  try {
    const stream = await streamAsk(
      meetingDigest(meeting, record),
      race ? raceDigest(meeting, race) : null,
      history,
      message,
      style,
      locale,
    );
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
