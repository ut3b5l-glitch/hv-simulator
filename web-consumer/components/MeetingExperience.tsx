"use client";

import { useRef, useState } from "react";
import type { Meeting } from "@/lib/types";
import RaceTabs from "./RaceTabs";
import BankerStrip from "./BankerStrip";
import PickPodium, { type Career } from "./PickPodium";
import PayoutCalc from "./PayoutCalc";
import FullField from "./FullField";

/**
 * MeetingExperience — the whole race night on one thumb.
 * Order of information = order of need: the banker, the race strip, the three
 * picks, the money question, the story, and (folded away) everything else.
 */
export default function MeetingExperience({
  meeting,
  careers,
  trustLine,
  initialIdx = 0,
}: {
  meeting: Meeting;
  careers: Record<number, Career>;
  trustLine: string | null;
  initialIdx?: number;
}) {
  const [idx, setIdx] = useState(
    Math.min(Math.max(initialIdx, 0), meeting.races.length - 1),
  );
  const tabsRef = useRef<HTMLDivElement>(null);
  const race = meeting.races[idx];
  if (!race) return null;

  function jumpTo(i: number) {
    setIdx(i);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-4">
      <BankerStrip meeting={meeting} trustLine={trustLine} onJump={jumpTo} />

      <div ref={tabsRef} className="scroll-mt-3">
        <RaceTabs races={meeting.races} activeIdx={idx} onChange={setIdx} />
      </div>

      {/* key= re-runs the entrance stagger on each race switch. */}
      <div key={race.race_id} className="space-y-4">
        <PickPodium race={race} careers={careers} />
        <PayoutCalc race={race} />
        {race.narrative && (
          <section className="glass rounded-card p-4 shadow-glass-1">
            <div className="eyebrow">The read</div>
            <p className="mt-2 text-body leading-relaxed text-ink-50">
              {race.narrative}
            </p>
          </section>
        )}
        <FullField race={race} careers={careers} />
      </div>
    </div>
  );
}
