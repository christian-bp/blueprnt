import { ConvexError } from "convex/values"

// Distinguishes the one reachable backend rejection shared by every
// mutation that writes to a run's documentation (upsertGroupAnalysis,
// setPayMappingCollaboration) once the run is completed and locked, from
// transient failures, so the toast can name the real problem instead of a
// generic error. Same instanceof-ConvexError + data.code idiom as the
// group/praxis steps' own isDocumentationRequiredError and review-finish.tsx's
// isGateUnmetError. Shared here (not redefined per call site) so the three
// consumers (PayMappingGroupAnalysisForm, ReviewPraxisStep, ReviewStartStep)
// cannot drift.
export function isRunCompletedError(error: unknown): boolean {
  return (
    error instanceof ConvexError &&
    (error.data as { code?: string } | null)?.code ===
      "errors.payMappingRunCompleted"
  )
}
