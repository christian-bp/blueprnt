import type { PayMappingRunSummary } from "./pay-mapping-run-context"

// How this run's frozen figures compare with the mapping before it. Both the
// headcount and the org-level gap are written onto the run row at freeze time
// (ADR-0011), so every comparison here reads from subscriptions the run shell
// already holds; nothing in this file costs a query.

// The comparison is always against the most recent EARLIER run whatever its
// status. A run's figures are written when its snapshot is frozen, so a
// mapping still being documented already carries a final headcount and gap;
// requiring "completed" would silently skip the mapping the reader is most
// likely thinking of.
//
// Shared by both trends below rather than written twice: they answer the same
// question ("which mapping came before this one?") and only differ in which
// frozen field they then read.
export function previousRun(
  current: { referenceDate: number },
  runs: PayMappingRunSummary[]
): PayMappingRunSummary | null {
  return (
    runs
      .filter((run) => run.referenceDate < current.referenceDate)
      .sort((a, b) => b.referenceDate - a.referenceDate)[0] ?? null
  )
}

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

export function populationTrend(
  current: { referenceDate: number; populationCount: number },
  runs: PayMappingRunSummary[]
): PopulationTrend {
  const previous = previousRun(current, runs)
  if (previous === null) {
    return { count: current.populationCount, previous: null, delta: null }
  }
  return {
    count: current.populationCount,
    previous: { label: previous.label, count: previous.populationCount },
    delta: current.populationCount - previous.populationCount,
  }
}

export interface GapTrend {
  // The earlier mapping and ITS gap, so the statement can quote where the
  // figure came from ("down from 4.1% in 2025") rather than only how far it
  // moved. Null when there is no earlier mapping, or when that mapping had
  // no measurable gap: a run whose gap could not be measured is part of the
  // history but is not a number this one can be compared against.
  previous: { label: string; gapPct: number } | null
  // Signed, in percentage POINTS: negative = the gap narrowed. Null whenever
  // `previous` is, or when this run has no measurable gap of its own.
  delta: number | null
}

export function gapTrend(
  current: { referenceDate: number; gapPct: number | null },
  runs: PayMappingRunSummary[]
): GapTrend {
  const previous = previousRun(current, runs)
  if (
    previous === null ||
    previous.orgGapPct === null ||
    current.gapPct === null
  ) {
    return { previous: null, delta: null }
  }
  return {
    previous: { label: previous.label, gapPct: previous.orgGapPct },
    delta: current.gapPct - previous.orgGapPct,
  }
}
