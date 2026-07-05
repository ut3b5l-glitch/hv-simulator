"use client";

import { useEffect, useRef, useState } from "react";
import { loadPrefs, STYLE_META } from "@/lib/prefs";
import { SparkIcon, SendIcon } from "./Icons";
import AiProse from "./AiProse";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Which race looks safest tonight?",
  "Where do we disagree with the market?",
  "Any value bets flagged tonight?",
  "How has the model been doing lately?",
];

/**
 * Ask Zokki — a grounded chat with the racing analyst. The server rebuilds
 * the meeting digest per request; picking a race chip focuses the analyst on
 * that race's full field. History lives in sessionStorage for the night.
 */
export default function AskZokki({
  date,
  raceNumbers,
}: {
  date: string;
  raceNumbers: number[];
}) {
  const storeKey = `zokki:ask:${date}`;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [focusRace, setFocusRace] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Prefs are read post-hydration (localStorage) so SSR and client markup match.
  const [styleTitle, setStyleTitle] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  useEffect(() => {
    const prefs = loadPrefs();
    setStyleTitle(prefs ? STYLE_META[prefs.style].title : null);
    try {
      const raw = window.sessionStorage.getItem(storeKey);
      if (raw) setTurns(JSON.parse(raw) as Turn[]);
    } catch {
      /* ignore */
    }
    restored.current = true;
  }, [storeKey]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      window.sessionStorage.setItem(storeKey, JSON.stringify(turns.slice(-24)));
    } catch {
      /* ignore */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, storeKey]);

  async function send(message: string) {
    const q = message.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    setBusy(true);
    const history = turns;
    setTurns((t) => [...t, { role: "user", content: q }, { role: "assistant", content: "" }]);
    try {
      const prefs = loadPrefs();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          race_number: focusRace,
          history,
          message: q,
          style: prefs?.style,
          locale: "en",
        }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Zokki can't respond right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const snapshot = full;
        setTurns((t) => [...t.slice(0, -1), { role: "assistant", content: snapshot }]);
      }
    } catch (e) {
      setTurns((t) => (t[t.length - 1]?.content === "" ? t.slice(0, -2) : t));
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Race focus chips */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button
          onClick={() => setFocusRace(null)}
          className={`tap shrink-0 rounded-pill px-3.5 py-1.5 text-caption font-semibold transition-colors ${
            focusRace === null ? "butter-panel" : "glass-tile text-ink-60"
          }`}
        >
          Whole card
        </button>
        {raceNumbers.map((n) => (
          <button
            key={n}
            onClick={() => setFocusRace(n)}
            className={`tap num shrink-0 rounded-pill px-3.5 py-1.5 text-caption font-semibold transition-colors ${
              focusRace === n ? "butter-panel" : "glass-tile text-ink-60"
            }`}
          >
            R{n}
          </button>
        ))}
      </div>

      {/* Conversation */}
      <div className="space-y-3">
        {turns.length === 0 && (
          <div className="glass rounded-card p-5 text-center">
            <SparkIcon className="mx-auto h-8 w-8 text-accent-gold" />
            <h2 className="mt-3 text-headline font-semibold text-ink-50">
              Ask about tonight’s card
            </h2>
            <p className="mx-auto mt-1.5 max-w-[19rem] text-callout leading-relaxed text-ink-60">
              Grounded in the model’s own numbers for this meeting
              {styleTitle ? ` — tuned for ${styleTitle}` : ""}. A read, not a
              tip.
            </p>
            <div className="mt-4 space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="glass-tile tap w-full rounded-tile px-4 py-2.5 text-left text-callout font-medium text-ink-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="butter-panel max-w-[85%] rounded-card rounded-br-chip px-4 py-2.5 text-callout font-medium">
                {t.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5">
              <span className="glass-gold mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full">
                <SparkIcon className="h-3.5 w-3.5 text-accent-gold" />
              </span>
              <div className="glass max-w-[85%] rounded-card rounded-tl-chip px-4 py-3">
                {t.content ? (
                  <AiProse text={t.content} />
                ) : (
                  <span className="flex items-center gap-2 text-callout text-ink-60">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent-gold" />
                    Thinking…
                  </span>
                )}
              </div>
            </div>
          ),
        )}
        {error && <p className="text-center text-caption text-accent-red">{error}</p>}
        <div ref={endRef} />
      </div>

      {/* Composer — sticky above the bottom nav */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="glass-strong sticky bottom-[104px] z-40 flex items-center gap-2 rounded-pill p-1.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={focusRace ? `Ask about Race ${focusRace}…` : "Ask about tonight’s card…"}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-body font-medium text-ink-50 outline-none placeholder:text-ink-80"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="butter-panel tap grid h-9 w-9 shrink-0 place-items-center rounded-full disabled:opacity-40"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </form>

      <p className="px-4 pb-2 text-center text-micro leading-relaxed text-ink-70">
        Information &amp; entertainment only · 18+ · Zokki never tells you to
        bet. If gambling stops being fun: Ping Wo Fund 1834 633.
      </p>
    </div>
  );
}
