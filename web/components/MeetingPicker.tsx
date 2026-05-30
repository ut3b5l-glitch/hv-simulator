"use client";

import Link from "next/link";
import { useState } from "react";
import type { MeetingSummary } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { ChevronIcon } from "./Icons";

export default function MeetingPicker({
  current,
  meetings,
}: {
  current: string;
  meetings: MeetingSummary[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="glass tap flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-callout font-medium text-ink-50"
      >
        {formatDate(current)}
        <ChevronIcon
          className={`h-3.5 w-3.5 text-ink-80 transition-transform duration-300 ease-out-expo ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="glass-strong animate-expand-down absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-card shadow-glass-3">
            {meetings.map((m) => (
              <Link
                key={m.date}
                href={`/?date=${m.date}`}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between px-4 py-3 text-callout transition-colors ${
                  m.date === current ? "bg-white/10 text-white" : "text-ink-60 hover:bg-white/5"
                }`}
              >
                <span>{formatDate(m.date)}</span>
                <span className="num text-micro text-ink-80">{m.race_count} races</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
