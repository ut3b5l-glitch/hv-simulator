"use client";

import { useState } from "react";
import type { FormLabels } from "@/lib/i18n";

type Status = "idle" | "loading" | "done" | "error";

/**
 * Email capture for the waitlist. Posts to /api/waitlist (Vercel KV in prod,
 * local file in dev). One visual style works on both the dark hero and the
 * light closing section: a true-white input pill + an amber submit.
 *
 * All user-facing copy comes in via `labels` (localised in lib/i18n).
 * NB: in this theme `bg-white` is routed to navy via the --fg token, so the
 * input uses an explicit white (`bg-[#ffffff]`).
 */
export default function WaitlistForm({
  labels,
  source = "hero",
  note,
  onDark = true,
}: {
  labels: FormLabels;
  source?: string;
  note?: string;
  // Both current placements sit on the dark hero gradient, so light note text
  // is the default; pass onDark={false} if dropped onto a light surface.
  onDark?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source,
          locale: typeof navigator !== "undefined" ? navigator.language : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data?.error === "invalid_email" ? labels.errorInvalid : labels.errorGeneric);
        return;
      }
      setStatus("done");
      setMessage(data.added ? labels.successNew : labels.successDup);
    } catch {
      setStatus("error");
      setMessage(labels.errorNetwork);
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-pill border border-accent-green/30 bg-accent-green/12 px-5 py-3.5 text-body font-medium text-accent-green">
        {message}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={labels.placeholder}
          aria-label={labels.aria}
          className="min-w-0 flex-1 rounded-pill border border-[rgba(22,49,68,0.18)] bg-[#ffffff] px-5 py-3.5 text-body text-ink-50 shadow-glass-1 outline-none transition placeholder:text-ink-80 focus:border-accent-gold/60 focus:ring-2 focus:ring-accent-gold/25"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="btn-sheen tap shrink-0 rounded-pill bg-accent-gold px-6 py-3.5 text-body font-bold text-navy shadow-glow-gold transition disabled:opacity-70"
        >
          {status === "loading" ? labels.reserving : labels.button}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 px-1 text-caption font-medium text-accent-red">{message}</p>
      )}
      {note && status !== "error" && (
        <p className={`mt-2.5 px-1 text-caption ${onDark ? "text-mint/70" : "text-ink-70"}`}>
          {note}
        </p>
      )}
    </form>
  );
}
