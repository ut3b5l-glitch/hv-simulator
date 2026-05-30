import { getMeetingSummaries, getMeeting, type Meeting } from "../lib/data";
import { Simulator } from "../components/Simulator";
import { BottomNav } from "../components/BottomNav";

export const dynamic = "force-static";

export default function SimulatorPage() {
  const summaries = getMeetingSummaries();
  const meetings = summaries
    .map((s) => getMeeting(s.meeting_date))
    .filter(Boolean) as Meeting[];

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 pb-24">
      <header className="px-5 pt-12 pb-5">
        <h1 className="text-3xl font-bold tracking-tight">Simulator</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Monte Carlo race outcomes from the model&apos;s probabilities
        </p>
      </header>

      {meetings.length ? (
        <Simulator meetings={meetings} />
      ) : (
        <div className="px-5 text-neutral-400">No meeting data yet.</div>
      )}

      <BottomNav />
    </main>
  );
}
