"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { useQuery } from "convex/react"
import { useLocale } from "next-intl"
import { useMemo } from "react"
import { countUnevaluated } from "@/lib/evaluation-summary"

// The live evaluation summary for an org: how many roles still lack a
// completed evaluation (no band in the results query). Shared source for the
// Roles tab's count badge, on the same listRoles + getResults pair the role
// register renders from, so the badge and the register's "not yet evaluated"
// rows can never disagree (the subscriptions dedupe with the pages').
export function useEvaluationSummary(orgId: string) {
  const locale = useLocale()
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })

  const remaining = useMemo(
    () =>
      roles === undefined || results === undefined
        ? 0
        : countUnevaluated(
            roles.map((role) => ({ roleId: role.roleId as string })),
            results.rows.map((row) => ({
              roleId: row.roleId as string,
              band: row.band ?? null,
            }))
          ),
    [roles, results]
  )

  return {
    // undefined while either query resolves.
    loading: roles === undefined || results === undefined,
    remaining,
  }
}
