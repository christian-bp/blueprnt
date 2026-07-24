"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { PayGapFlag } from "@workspace/core"
import { useQuery } from "convex/react"
import { pickHeadlineRun } from "@/lib/pay-mapping-headline"

export type PayMappingHeadline = {
  slug: string
  label: string
  status: "active" | "paused" | "underReview" | "completed"
  gapPct: number | null
  flag: PayGapFlag
  quartiles: { women: number; men: number }[]
}

// Picks the run the overview's pay-mapping card should headline (the same
// rule buildOverviewStats' "open run" pick uses, falling back to the most
// recent completed run) and reads its org-level gap, the same
// getPayMappingGap query the run's own Overview tab reads (Convex dedupes
// identical calls). undefined = still loading (the run list, or the target
// run's gap); null = no run worth headlining yet (a fresh org that has
// never mapped), in which case the card stays on its plain
// empty/blocked/ready text.
export function usePayMappingHeadline(
  orgId: string
): PayMappingHeadline | undefined | null {
  const runs = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  const target = runs === undefined ? undefined : pickHeadlineRun(runs)
  const gap = useQuery(
    api.payMapping.gap.getPayMappingGap,
    target ? { orgId, runId: target.runId } : "skip"
  )

  if (runs === undefined) return undefined
  if (target === undefined) return null
  if (gap === undefined) return undefined
  if (gap === null) return null

  return {
    slug: target.slug,
    label: target.label,
    status: target.status,
    gapPct: gap.org.gapPct,
    flag: gap.org.flag,
    quartiles: gap.quartiles,
  }
}
