"use client";

import { useEffect, useRef, useState } from "react";
import { loadPrefs } from "@/lib/prefs";
import { SparkIcon } from "./Icons";
import AiProse from "./AiProse";

type Status = "idle" | "streaming" | "done" | "error";

/**
 * Zokki Deep Dive — the on-demand AI briefing for one race. Grounded
 * server-side in the model's own digest; personalized by the punter style
 * chosen at onboarding. Streams token-by-token into the card and caches per
 * race for the session so tab-hopping doesn't re-bill the API.
 */
export default function RaceIntel({
  date,
  raceNumber,
}: {
  date: string;
  raceNumber: number;
}) {
  const cacheKey = `zokki:intel:${date}:r${raceNumber}`;
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore a briefing already generated this session.
  useEffect(() => {
    abortRef.current?.abort();
    setError(null);
    try {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) {
        setText(cached);
        setStatus("done");
        return;
      }
    } catch {
      /* private mode */
    }
    setText("");
    setStatus("idle");
  }, [cacheKey]);

  async function generate() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("streaming");
    setError(null);
    setText("");
    try {
      const prefs = loadPrefs();
      const res = await fetch("/api/race-intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          race_number: raceNumber,
          style: prefs?.style,
          locale: "en",
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "The analyst can't respond right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setText(full);
      }
      setStatus("done");
      try {
        window.sessionStorage.setItem(cacheKey, full);
      } catch {
        /* ignore */
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <section className="glass-gold rounded-card p-4 shadow-glass-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SparkIcon className="h-4 w-4 text-accent-gold" />
          <span className="text-micro font-semibold uppercase tracking-eyebrow text-accent-gold">
            Zokki AI · Deep dive
          </span>
        </div>
        {status === "done" && (
          <button
            onClick={generate}
            className="tap rounded-pill bg-white/10 px-2.5 py-1 text-micro font-semibold text-ink-60"
          >
            Regenerate
          </button>
        )}
      </div>

      {status === "idle" && (
        <div className="mt-3">
          <p className="text-callout leading-relaxed text-ink-60">
            A two-minute analyst read of this race — why the model likes its
            pick, where the danger is, and the honest caveat.
          </p>
          <button
            onClick={generate}
            className="butter-panel tap mt-3 w-full rounded-pill px-4 py-3 text-callout font-bold"
          >
            Generate the deep dive
          </button>
        </div>
      )}

      {(status === "streaming" || status === "done") && (
        <div className="mt-3">
          {text ? (
            <AiProse text={text} />
          ) : (
            <div className="flex items-center gap-2 py-2 text-callout text-ink-60">
              <span className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent-gold" />
              Reading the card…
            </div>
          )}
          {status === "streaming" && text && (
            <span className="ml-1 inline-block h-3.5 w-[2px] animate-pulse-soft rounded bg-accent-gold align-middle" />
          )}
          {status === "done" && (
            <p className="mt-3 text-micro leading-relaxed text-ink-70">
              AI-written from the model’s own numbers. A read, not a tip — races
              stay uncertain.
            </p>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="mt-3">
          <p className="text-callout text-accent-red">{error}</p>
          <button
            onClick={generate}
            className="tap mt-2 rounded-pill bg-white/10 px-3 py-1.5 text-caption font-semibold text-ink-50"
          >
            Try again
          </button>
        </div>
      )}
    </section>
  );
}
