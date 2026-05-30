import { getMeetingsIndex, getMeeting } from "@/lib/data";
import type { Meeting } from "@/lib/types";
import Simulator from "@/components/Simulator";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export default async function SimulatorPage() {
  const index = await getMeetingsIndex().catch(() => null);
  if (!index || index.meetings.length === 0) {
    return <EmptyState />;
  }

  const meetings = (
    await Promise.all(index.meetings.map((m) => getMeeting(m.date).catch(() => null)))
  ).filter(Boolean) as Meeting[];

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow="Happy Valley"
        title="Race Simulator"
        subtitle="Monte Carlo outcomes from the model's probabilities"
      />

      <Simulator meetings={meetings} />
    </div>
  );
}
