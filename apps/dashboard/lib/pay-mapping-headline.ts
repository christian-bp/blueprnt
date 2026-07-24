// Pure selection of which run the overview's pay-mapping card should show a
// gap headline for: the run list is already newest-first (the backend's own
// order), so the first non-completed run wins (matches buildOverviewStats'
// own "open run" pick); with none open, the most recent completed run is
// still worth headlining (a finished mapping's own result). undefined only
// once there is neither an open nor any completed run (a fresh org that has
// never mapped): the card then stays on its plain empty/blocked/ready text.
export type HeadlineRunCandidate = {
  runId: string
  slug: string
  label: string
  status: "active" | "paused" | "underReview" | "completed"
}

export function pickHeadlineRun<T extends HeadlineRunCandidate>(
  runs: T[]
): T | undefined {
  return (
    runs.find((r) => r.status !== "completed") ??
    runs.find((r) => r.status === "completed")
  )
}
