import {
  getMeeting,
  getMeetingsIndex,
  getProfiles,
  getTrackRecord,
} from "@/lib/data";
import { formatDate } from "@/lib/format";
import MeetingExperience from "@/components/MeetingExperience";
import type { Career } from "@/components/PickPodium";
import MeetingPicker from "@/components/MeetingPicker";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export default async function Page({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const index = await getMeetingsIndex().catch(() => null);
  if (!index || index.meetings.length === 0) {
    return <EmptyState />;
  }

  const target = searchParams.date ?? index.meetings[0].date;
  const meeting = await getMeeting(target).catch(() => null);
  if (!meeting) return <EmptyState />;

  // Career one-liners for every horse on the card (consumer feedback: novices
  // want the picks' past performance at a glance).
  const profiles = await getProfiles().catch(() => null);
  const careers: Record<number, Career> = {};
  if (profiles) {
    const onCard = new Set(
      meeting.races.flatMap((r) =>
        r.runners.map((x) => x.horse_id).filter((id): id is number => id != null),
      ),
    );
    for (const h of profiles.horses) {
      if (onCard.has(h.id)) {
        careers[h.id] = { runs: h.runs, wins: h.wins, places: h.places };
      }
    }
  }

  // Trust line under the banker — the honest live record, in one sentence.
  const record = await getTrackRecord().catch(() => null);
  const hb = record?.headline;
  const trustLine =
    hb?.top_pick_rate != null && hb.top_pick_attempts >= 20
      ? `Across ${hb.top_pick_attempts} live races, our top pick has made the top three ${Math.round(hb.top_pick_rate)}% of the time.`
      : null;

  // On a live night, open on the first race still to run.
  const firstOpen = meeting.races.findIndex((r) => !r.has_results);
  const initialIdx = firstOpen === -1 ? 0 : firstOpen;

  const venueName = meeting.venue === "ST" ? "Sha Tin" : "Happy Valley";
  const status = meeting.demo
    ? "practice card"
    : meeting.has_results
      ? "results in"
      : "tonight's card";

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        hero
        eyebrow={venueName}
        title={formatDate(meeting.meeting_date)}
        subtitle={
          <span className="num">
            {meeting.races.length} races · {status}
          </span>
        }
        right={<MeetingPicker current={meeting.meeting_date} meetings={index.meetings} />}
      />

      <MeetingExperience
        meeting={meeting}
        careers={careers}
        trustLine={trustLine}
        initialIdx={initialIdx}
      />
    </div>
  );
}
