"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { buildPayGapTrend, type PayGapPoint } from "@/lib/pay-gap-trend"

// Reads the same listPayMappingRuns query use-pay-mapping-headline.ts and
// use-headcount-trend.ts already subscribe to (Convex dedupes identical
// calls, no extra fetch): each run carries its own frozen org-level gap, so
// the whole trend is a derivation off rows the page already has.
// undefined = still loading; null = no mappings yet to plot.
export function usePayGapTrend(
  orgId: string
): PayGapPoint[] | undefined | null {
  const runs = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  if (runs === undefined) return undefined
  const trend = buildPayGapTrend(runs)
  return trend.length === 0 ? null : trend
}
