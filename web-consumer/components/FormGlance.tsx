/**
 * FormGlance — a horse's recent past, readable in half a second.
 * Six dots (gold = won, green = placed, faint = out of the frame) and a
 * plain-English phrase. No tables, no abbreviations, no homework.
 */
export function parseRuns(last6: string | null | undefined): number[] {
  if (!last6) return [];
  return last6
    .split("/")
    .map((p) => parseInt(p.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

export function formPhrase(last6: string | null | undefined): string | null {
  const runs = parseRuns(last6);
  if (!runs.length) return null;
  const wins = runs.filter((n) => n === 1).length;
  const placed = runs.filter((n) => n <= 3).length;
  if (wins >= 2) return `won ${wins} of its last ${runs.length}`;
  if (wins === 1) return `a recent winner, in the frame ${placed} of ${runs.length}`;
  if (placed >= 2) return `placed ${placed} of its last ${runs.length}`;
  if (placed === 1) return `placed once in its last ${runs.length}`;
  return `out of the places its last ${runs.length}`;
}

export default function FormGlance({
  last6,
  career,
}: {
  last6: string | null | undefined;
  career?: { runs?: number; wins: number; places: number } | null;
}) {
  const runs = parseRuns(last6);
  const phrase = formPhrase(last6);
  if (!runs.length && !career) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {runs.length > 0 && (
        <span className="flex items-center gap-[3px]">
          {runs.map((n, i) => (
            <span
              key={i}
              className={`h-[7px] w-[7px] rounded-full ${
                n === 1
                  ? "bg-accent-gold shadow-[0_0_5px_rgba(200,132,31,0.5)]"
                  : n <= 3
                    ? "bg-accent-green/85"
                    : "bg-white/20"
              }`}
            />
          ))}
        </span>
      )}
      <span className="text-micro text-ink-70">
        {phrase}
        {phrase && career?.runs ? " · " : ""}
        {career?.runs
          ? `${career.wins} win${career.wins === 1 ? "" : "s"} from ${career.runs} starts`
          : ""}
      </span>
    </div>
  );
}
