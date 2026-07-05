import "server-only";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsStreaming,
} from "openai/resources/chat/completions";

/**
 * Server-only AI layer for Zokki — the same OpenRouter plumbing proven in
 * Aurellar (retries, reasoning disabled so hybrid models answer into
 * `content`, streamed byte responses with a localized fallback), pointed at a
 * Hong Kong racing analyst persona instead of a 命理師.
 *
 * Grounding invariant: prompts only ever include the server-built digest of
 * our own published model output (lib/ai/digest.ts). The model is told to
 * treat that digest as the only source of truth.
 */
const FORGE_URL = (process.env.BUILT_IN_FORGE_API_URL ?? "https://openrouter.ai/api").replace(/\/+$/, "");
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY ?? "";
const MODEL_DEFAULT = process.env.ZOKKI_LLM_MODEL ?? "deepseek/deepseek-chat";

export const aiConfigured = Boolean(FORGE_KEY);

export type ZokkiLocale = "en" | "zh";
export type PunterStyle = "banker" | "value" | "story";
export type ChatTurn = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are Zokki — the in-app racing analyst for a Hong Kong horse-racing companion covering Happy Valley (跑馬地) and Sha Tin (沙田). You sit on top of a transparent statistical model whose output is provided to you as a data digest.

Rules:
- The digest is your ONLY source of truth about horses, jockeys, odds and results. Never invent runners, prices, form lines or results that are not in it. Never state a specific figure (a percentage, odds price, count or rating) unless that exact figure appears in the digest — qualitative signals like "jockey in form" must stay qualitative. If asked something the digest can't answer, say so plainly.
- Be specific: cite the actual win percentages, odds, edges and signals from the digest, and explain in plain language WHY the model ranks a horse where it does.
- Be honest about uncertainty. The model is probabilistic — "our top pick lands in the top three about half the time" is the register, never certainty. No guarantees, no "sure thing", no 貼士-monger talk.
- You give reads, not tips. NEVER tell the user to bet, how much to stake, or that they should recover losses. If asked for betting instructions or guaranteed winners, decline warmly and reframe as an information read.
- HKJC quirk you may cite: rising in class or carrying more weight is a POSITIVE momentum signal in Hong Kong (the official rating went up) — opposite to Western racing intuition.
- Keep replies tight: 2–4 short paragraphs or a compact list. Lead with the answer.
- This is information and entertainment for adults (18+). If the user sounds distressed about gambling losses, gently mention the Ping Wo Fund counselling line 1834 633.`;

const STYLE_FRAGMENT: Record<PunterStyle, string> = {
  banker:
    "The user's profile is 'The Banker' — steady, risk-aware. Lead with the most reliable pick, flag how open the race is, and be explicit about what could go wrong.",
  value:
    "The user's profile is 'The Value Hunter' — they care about model-vs-market gaps. Lead with edges: where our probability beats the odds-implied one, and where the market is ahead of us.",
  story:
    "The user's profile is 'The Storyteller' — they want the shape of the race. Lead with the narrative: the pace, the draw, the in-form yards, who the danger is, told vividly but grounded in the digest.",
};

const LANG_DIRECTIVE: Record<ZokkiLocale, string> = {
  en: "OUTPUT LANGUAGE: natural English. Keep horse names exactly as they appear in the digest.",
  zh: "輸出語言要求：請全程以繁體中文（香港用語）撰寫回覆。馬名保留數據摘要中的原文寫法。賽馬地名用「跑馬地」和「沙田」。",
};

const FALLBACK: Record<ZokkiLocale, string> = {
  en: "Sorry — I lost my train of thought. Ask me that again?",
  zh: "抱歉，我一時想不通，請再問一次。",
};

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: FORGE_KEY,
      baseURL: `${FORGE_URL}/v1`,
      defaultHeaders: { "X-Title": "Zokki" },
      maxRetries: 4,
      timeout: 60_000,
    });
  }
  return _client;
}

function systemMessages(style: PunterStyle | undefined, locale: ZokkiLocale): ChatCompletionMessageParam[] {
  const sys = style ? `${SYSTEM_PROMPT}\n\n${STYLE_FRAGMENT[style]}` : SYSTEM_PROMPT;
  return [
    { role: "system", content: sys },
    { role: "system", content: LANG_DIRECTIVE[locale] },
  ];
}

/** Stream a completion as a plain UTF-8 byte stream with an empty-output fallback. */
async function streamCompletion(
  messages: ChatCompletionMessageParam[],
  maxTokens: number,
  locale: ZokkiLocale,
): Promise<ReadableStream<Uint8Array>> {
  const completion = await client().chat.completions.create({
    model: MODEL_DEFAULT,
    messages,
    max_tokens: maxTokens,
    // Hybrid reasoning models otherwise spend the budget "thinking" and return
    // empty content; harmless no-op for plain models.
    reasoning: { enabled: false },
    stream: true,
  } as ChatCompletionCreateParamsStreaming & { reasoning: { enabled: boolean } });

  const encoder = new TextEncoder();
  const fallback = FALLBACK[locale];
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let emitted = false;
      try {
        for await (const part of completion) {
          const delta = part.choices?.[0]?.delta as { content?: string | null } | undefined;
          const piece = delta?.content ?? "";
          if (piece) {
            emitted = true;
            controller.enqueue(encoder.encode(piece));
          }
        }
        if (!emitted) controller.enqueue(encoder.encode(fallback));
      } catch {
        if (!emitted) controller.enqueue(encoder.encode(fallback));
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Streaming deep-dive briefing for one race. Short Markdown prose: a bold
 * one-line verdict, then 2–3 tight paragraphs (the case for the top pick, the
 * danger + value angle, the honest caveat).
 */
export async function streamRaceIntel(
  digest: string,
  style: PunterStyle | undefined,
  locale: ZokkiLocale,
): Promise<ReadableStream<Uint8Array>> {
  const user =
    `Here is the model's data digest for tonight's race:\n\n${digest}\n\n` +
    `Write a deep-dive briefing as short Markdown prose: one bold lead line (**…**) with your sharpest one-sentence read, ` +
    `then 2–3 short paragraphs — the case for the top pick with the actual numbers, the main danger and any value angle, ` +
    `and one honest caveat about how this race could go sideways. No JSON, no bullet lists, no betting instructions.`;
  return streamCompletion(
    [...systemMessages(style, locale), { role: "user", content: user }],
    700,
    locale,
  );
}

/** Streaming Ask-Zokki chat, grounded on the meeting digest (plus an optional focused race digest). */
export async function streamAsk(
  meetingDigest: string,
  raceDigest: string | null,
  history: ChatTurn[],
  message: string,
  style: PunterStyle | undefined,
  locale: ZokkiLocale,
): Promise<ReadableStream<Uint8Array>> {
  const grounding =
    `Tonight's meeting digest:\n\n${meetingDigest}` +
    (raceDigest ? `\n\nThe user is currently focused on this race:\n\n${raceDigest}` : "");
  const messages: ChatCompletionMessageParam[] = [
    ...systemMessages(style, locale),
    { role: "system", content: grounding },
    ...history.slice(-8).map((t) => ({ role: t.role, content: t.content }) as ChatCompletionMessageParam),
    { role: "user", content: message },
  ];
  return streamCompletion(messages, 900, locale);
}
