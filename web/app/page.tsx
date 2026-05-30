import { getMeeting, getMeetingsIndex } from "@/lib/data";
import { formatDate } from "@/lib/format";
import RaceView from "@/components/RaceView";
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

  const settled = meeting.has_results;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow="Happy Valley"
        title={formatDate(meeting.meeting_date)}
        subtitle={
          <span className="num">
            {meeting.races.length} races · {settled ? "settled" : "live card"}
          </span>
        }
        right={<MeetingPicker current={meeting.meeting_date} meetings={index.meetings} />}
      />

      <RaceView meeting={meeting} />
    </div>
  );
}
