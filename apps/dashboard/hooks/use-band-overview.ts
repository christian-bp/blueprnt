"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { buildBandOverview, type BandOverview } from "@/lib/band-overview"

// Reads the same getResults query the /work band views read (Convex dedupes
// identical calls). undefined = loading; null = nothing to chart yet (no
// model, or no role has resolved a band).
export function useBandOverview(
  orgId: string,
  locale: string
): BandOverview | undefined | null {
  const results = useQuery(api.assessment.results.getResults, {
    orgId,
    locale,
  })
  if (results === undefined) return undefined
  return buildBandOverview(results)
}
