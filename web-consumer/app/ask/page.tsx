import { getMeeting, getMeetingsIndex } from "@/lib/data";
import { formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import MeetingPicker from "@/components/MeetingPicker";
import AskZokki from "@/components/AskZokki";

export const metadata = { title: "Ask Zokki" };

export default async function AskPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const index = await getMeetingsIndex().catch(() => null);
  if (!index || index.meetings.length === 0) return <EmptyState />;

  const target = searchParams.date ?? index.meetings[0].date;
  const meeting = await getMeeting(target).catch(() => null);
  if (!meeting) return <EmptyState />;

  const venueName = meeting.venue === "ST" ? "Sha Tin" : "Happy Valley";

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow={`${venueName} · ${formatDate(meeting.meeting_date)}`}
        title="Ask Zokki"
        subtitle="The AI analyst, grounded in tonight’s numbers."
        right={
          <MeetingPicker
            current={meeting.meeting_date}
            meetings={index.meetings}
            basePath="/ask"
          />
        }
      />
      <AskZokki
        date={meeting.meeting_date}
        raceNumbers={meeting.races.map((r) => r.race_number)}
      />
    </div>
  );
}
