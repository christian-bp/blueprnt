import type { PayMappingRunSummary } from "./pay-mapping-run-context"

// How this run's frozen population compares with the mapping before it.
export interface PopulationTrend {
  count: number
  // The run this one is measured against: the most recent earlier mapping,
  // named by its own label. Null on the org's first mapping, which is a
  // real state rather than a zero delta.
  previous: { label: string; count: number } | null
  // Signed: positive = this mapping covers more people. Null when there is
  // no earlier mapping to compare against.
  delta: number | null
}

// The comparison is against the most recent EARLIER run whatever its status.
// A run's populationCount is written when its snapshot is frozen (ADR-0011),
// so a mapping still being documented already carries a final headcount;
// requiring "completed" would silently skip the mapping the reader is most
// likely thinking of.
export function populationTrend(
  current: { referenceDate: number; populationCount: number },
  runs: PayMappingRunSummary[]
): PopulationTrend {
  const previous = runs
    .filter((run) => run.referenceDate < current.referenceDate)
    .sort((a, b) => b.referenceDate - a.referenceDate)[0]
  if (previous === undefined) {
    return { count: current.populationCount, previous: null, delta: null }
  }
  return {
    count: current.populationCount,
    previous: { label: previous.label, count: previous.populationCount },
    delta: current.populationCount - previous.populationCount,
  }
}
