import { getMeeting, getMeetingsIndex, getLatestMeeting } from "@/lib/data";
import { formatDate } from "@/lib/format";
import RaceView from "@/components/RaceView";
import MeetingPicker from "@/components/MeetingPicker";

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
      <header className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">
            Happy Valley
          </div>
          <h1 className="mt-0.5 text-[28px] font-semibold leading-tight">
            {formatDate(meeting.meeting_date)}
          </h1>
          <div className="mt-0.5 text-xs text-white/55">
            {meeting.races.length} races · {settled ? "settled" : "live card"}
          </div>
        </div>
        <MeetingPicker current={meeting.meeting_date} meetings={index.meetings} />
      </header>

      <RaceView meeting={meeting} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-2xl font-semibold">No meetings yet</div>
      <div className="mt-2 max-w-xs text-sm text-white/60">
        Run <code className="rounded bg-white/8 px-1.5 py-0.5">python export_data.py</code> to
        publish a snapshot.
      </div>
    </div>
  );
}
