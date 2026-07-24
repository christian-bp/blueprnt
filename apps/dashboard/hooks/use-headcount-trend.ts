"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { buildHeadcountTrend, type HeadcountPoint } from "@/lib/headcount-trend"

// Reads the same listPayMappingRuns query use-pay-mapping-headline.ts
// already subscribes to (Convex dedupes identical calls, no extra fetch).
// undefined = still loading; null = no runs yet to plot a trend from.
export function useHeadcountTrend(
  orgId: string
): HeadcountPoint[] | undefined | null {
  const runs = useQuery(api.payMapping.runs.listPayMappingRuns, { orgId })
  if (runs === undefined) return undefined
  const trend = buildHeadcountTrend(runs)
  return trend.length === 0 ? null : trend
}
