"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { buildLevelOverview, type LevelOverview } from "@/lib/level-overview"

// Reads the same getResults query the /work level views read (Convex dedupes
// identical calls). undefined = loading; null = nothing to chart yet (no
// model, or no role has resolved a level).
export function useLevelOverview(
  orgId: string,
  locale: string
): LevelOverview | undefined | null {
  const results = useQuery(api.assessment.results.getResults, {
    orgId,
    locale,
  })
  if (results === undefined) return undefined
  return buildLevelOverview(results)
}
