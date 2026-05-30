import { getMeetingsIndex, getMeeting } from "@/lib/data";
import type { Meeting } from "@/lib/types";
import Simulator from "@/components/Simulator";

export default async function SimulatorPage() {
  const index = await getMeetingsIndex().catch(() => null);
  if (!index || index.meetings.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="text-2xl font-semibold">No meetings yet</div>
        <div className="mt-2 max-w-xs text-sm text-white/60">
          Run <code className="rounded bg-white/8 px-1.5 py-0.5">python export_data.py</code> to publish a snapshot.
        </div>
      </div>
    );
  }

  const meetings = (
    await Promise.all(index.meetings.map((m) => getMeeting(m.date).catch(() => null)))
  ).filter(Boolean) as Meeting[];

  return (
    <div className="space-y-5 pb-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">Happy Valley</div>
        <h1 className="mt-0.5 text-[28px] font-semibold leading-tight">Race Simulator</h1>
        <div className="mt-0.5 text-xs text-white/55">
          Monte Carlo outcomes from the model&apos;s probabilities
        </div>
      </header>

      <Simulator meetings={meetings} />
    </div>
  );
}
