"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"

// Per-role result breakdown: weighting, band, and each criterion's contribution
// share. The contribution is the only per-criterion number that is both
// role-specific and weight-dependent, so it answers "how was this role weighted
// across the criteria" and is what reacts when the model is reweighted. The
// per-criterion list lives in RoleCriterionBreakdown (shared with RoleSheet).
export function RoleResultCard({
  orgId,
  roleId,
}: {
  orgId: string
  roleId: string
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tHelp = useTranslations("dashboard.help")
  const tResult = useTranslations("dashboard.rating.result")
  const tAssessment = useTranslations("assessment")
  const locale = useLocale()
  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  if (result === undefined || result === null || !result.complete) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {t("resultHeading")}
          <HelpMorphButton label={tHelp("scoreLabel")}>
            {tHelp("scoreBody")}
          </HelpMorphButton>
        </CardTitle>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-2xl tabular-nums">
            {tResult("scoreOutOf", { score: result.score ?? 0 })}
          </span>
          <Badge>{`${tAssessment("band")} ${result.band}`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {tResult("bandHighest")}
        </p>
        <RoleCriterionBreakdown criteria={result.criteria} />
      </CardContent>
    </Card>
  )
}
