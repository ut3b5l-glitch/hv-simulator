"use client";

import Link from "next/link";
import { useState } from "react";
import type { MeetingSummary } from "@/lib/types";
import { formatDate } from "@/lib/format";

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
        className="glass flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-medium text-white/85"
      >
        {formatDate(current)}
        <span className="text-[10px] text-white/55">▼</span>
      </button>
      {open && (
        <div className="glass-strong absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl shadow-glass">
          {meetings.map((m) => (
            <Link
              key={m.date}
              href={`/?date=${m.date}`}
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-white/8 ${
                m.date === current ? "bg-white/8 text-white" : "text-white/75"
              }`}
            >
              <span>{formatDate(m.date)}</span>
              <span className="text-[11px] text-white/50">{m.race_count} races</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
