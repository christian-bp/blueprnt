"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useMemo } from "react"
import { countClassified } from "@/lib/classification-summary"

// The live classification summary for an org, shared by the People page's
// "N of M classified" line and the Classify tab's remaining-count badge so
// the two can never disagree. Flattens every title group's people ONCE:
// listPeopleByTitle returns each active person exactly once (including the
// title: null group), so this is the complete, non-duplicated person set.
export function useClassificationSummary(orgId: string) {
  const byTitle = useQuery(api.people.classificationQueries.listPeopleByTitle, {
    orgId,
  })

  const people = useMemo(
    () => (byTitle ?? []).flatMap((group) => group.people),
    [byTitle]
  )

  const summary = useMemo(() => countClassified(people), [people])

  return {
    // undefined while the query resolves.
    loading: byTitle === undefined,
    people,
    summary,
    remaining: summary.total - summary.classified,
  }
}
