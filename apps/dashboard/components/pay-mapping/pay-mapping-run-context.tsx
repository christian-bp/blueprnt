"use client"

import { createContext, type ReactNode, useContext, useMemo } from "react"
import type {
  GroupAnalysis,
  PayMappingActionWire,
  PayMappingGapResult,
  PayMappingNoteWire,
  PayMappingRunDetail,
} from "./pay-mapping-gap-types"
import { buildReviewQueue, type ReviewQueue } from "./review-queue"

// The run summaries this context's consumers need, structurally. The queue
// reads whether an EARLIER run was completed, which decides whether the
// "previous actions" praxis area belongs in this run's own queue; the KPI
// tiles read the previous run's frozen headcount and gap and name that run by
// its own label. Every field is already on listPayMappingRuns' wire.
export interface PayMappingRunSummary {
  status: string
  referenceDate: number
  label: string
  populationCount: number
  // Frozen at snapshot time beside populationCount, so a trend against an
  // earlier mapping never rescans that mapping's snapshot rows. Null when
  // that mapping had no measurable org-level gap.
  orgGapPct: number | null
}

// What the shell subscribes to and hands down.
export interface PayMappingRunData {
  run: PayMappingRunDetail | undefined
  gap: PayMappingGapResult | undefined
  analyses: GroupAnalysis[] | undefined
  // The action/note work layer (ADR-0015), shared by the detail views'
  // badges and the actions overview so both read one subscription.
  actions: PayMappingActionWire[] | undefined
  notes: PayMappingNoteWire[] | undefined
  // The org's other runs, for the praxis applicability rule above.
  runsList: PayMappingRunSummary[] | undefined
}

interface PayMappingRunContextValue extends PayMappingRunData {
  // Built ONCE here, not per consumer. Two surfaces used to derive it
  // independently from the same inputs, which is the shape a drift bug
  // grows in even when the two derivations start identical.
  queue: ReviewQueue | null
  // A completed run is read-only everywhere (ADR-0011).
  locked: boolean
}

// The resolved run + its gender-gap aggregate and documentation rows,
// provided once by the run shell (mounted from the [slug] route layout) and
// shared by the Overview / Analysis / Actions sub-pages. Keeping the queries
// in the persistent layout means switching sub-pages never re-issues them or
// flashes a skeleton; the pages stay thin and render their own loading
// shapes while a value is still undefined.
const PayMappingRunContext = createContext<PayMappingRunContextValue | null>(
  null
)

export function PayMappingRunProvider({
  value,
  children,
}: {
  value: PayMappingRunData
  children: ReactNode
}) {
  const { run, gap, analyses, runsList } = value
  const queue = useMemo<ReviewQueue | null>(() => {
    if (
      run === undefined ||
      gap === undefined ||
      analyses === undefined ||
      runsList === undefined
    ) {
      return null
    }
    return buildReviewQueue({
      gap,
      analyses,
      collaboration: run.collaboration ?? null,
      hasPreviousCompletedRun: runsList.some(
        (candidate) =>
          candidate.status === "completed" &&
          candidate.referenceDate < run.referenceDate
      ),
    })
  }, [run, gap, analyses, runsList])

  const resolved = useMemo<PayMappingRunContextValue>(
    () => ({ ...value, queue, locked: run?.status === "completed" }),
    [value, queue, run]
  )

  return (
    <PayMappingRunContext.Provider value={resolved}>
      {children}
    </PayMappingRunContext.Provider>
  )
}

export function usePayMappingRun(): PayMappingRunContextValue {
  const ctx = useContext(PayMappingRunContext)
  if (ctx === null) {
    throw new Error(
      "usePayMappingRun must be used inside PayMappingRunProvider"
    )
  }
  return ctx
}
