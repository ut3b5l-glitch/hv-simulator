import { getMeeting, getMeetingsIndex } from "@/lib/data";
import { formatDate } from "@/lib/format";
import MeetingPicker from "@/components/MeetingPicker";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ResultsSummary from "@/components/ResultsSummary";

export default async function ResultsPage({
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

  const venueName = meeting.venue === "ST" ? "Sha Tin" : "Happy Valley";
  const settled = meeting.races.filter((r) => r.has_results).length;
  const total = meeting.races.length;
  const status =
    settled === 0
      ? "awaiting the first race"
      : settled === total
        ? "all races settled"
        : `${settled} of ${total} races in`;

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow={`${venueName} · results`}
        title={formatDate(meeting.meeting_date)}
        subtitle={<span className="num">{status}</span>}
        right={
          <MeetingPicker
            current={meeting.meeting_date}
            meetings={index.meetings}
            basePath="/results"
          />
        }
      />

      <ResultsSummary meeting={meeting} />
    </div>
  );
}
