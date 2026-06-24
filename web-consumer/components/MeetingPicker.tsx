"use client";

import Link from "next/link";
import type { MeetingSummary } from "@/lib/types";
import { formatDate } from "@/lib/format";
import PickerMenu from "./PickerMenu";

export default function MeetingPicker({
  current,
  meetings,
  basePath = "/",
}: {
  current: string;
  meetings: MeetingSummary[];
  basePath?: string;
}) {
  return (
    <PickerMenu label={formatDate(current)} menuLabel="Choose a meeting">
      {(close) =>
        meetings.map((m) => (
          <Link
            key={m.date}
            href={`${basePath}?date=${m.date}`}
            onClick={close}
            className={`flex items-center justify-between gap-2 px-4 py-3 text-callout transition-colors ${
              m.date === current
                ? "bg-white/10 text-white"
                : "text-ink-60 hover:bg-white/5"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide ${
                  m.venue === "ST"
                    ? "bg-accent-cyan/15 text-accent-cyan"
                    : "bg-accent-gold/15 text-accent-gold"
                }`}
              >
                {m.venue === "ST" ? "ST" : "HV"}
              </span>
              {formatDate(m.date)}
            </span>
            <span className="num text-micro text-ink-80">{m.race_count} races</span>
          </Link>
        ))
      }
    </PickerMenu>
  );
}
