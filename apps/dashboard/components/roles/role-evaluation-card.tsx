"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { HelpMorphButton } from "@/components/help-morph-button"
import { RoleCriterionBreakdown } from "@/components/roles/role-criterion-breakdown"

// One card for the whole evaluation lifecycle. While incomplete it shows the
// progress and the entry into the blind stepper; once complete it shows the
// weighting, band, and per-criterion breakdown. Replaces the separate Rating
// and Result cards. The result view applies only to a live, fully-evaluated
// role: an archived role has left the results set, so it stays read-only.
export function RoleEvaluationCard({
  orgId,
  roleId,
  slug,
  archived,
  profileComplete,
  ratedCount,
  totalCriteria,
}: {
  orgId: string
  roleId: string
  slug: string
  archived: boolean
  profileComplete: boolean
  ratedCount: number
  totalCriteria: number
}) {
  const t = useTranslations("dashboard.roles.detail")
  const tRoles = useTranslations("dashboard.roles")
  const tHelp = useTranslations("dashboard.help")
  const tResult = useTranslations("dashboard.rating.result")
  const tAssessment = useTranslations("assessment")
  const locale = useLocale()

  const evaluated = totalCriteria > 0 && ratedCount === totalCriteria
  // The view is chosen from the props so it never flashes; the query only
  // fills the result data.
  const showResult = evaluated && !archived

  const result = useQuery(api.assessment.results.getRoleResult, {
    orgId,
    roleId,
    locale,
  })

  const ctaLabel = ratedCount === 0 ? t("rateCta") : t("resumeRateCta")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {t("evaluationHeading")}
          {showResult ? (
            <HelpMorphButton label={tHelp("scoreLabel")}>
              {tHelp("scoreBody")}
            </HelpMorphButton>
          ) : (
            <HelpMorphButton label={tHelp("blindRatingLabel")}>
              {tHelp("blindRatingBody")}
            </HelpMorphButton>
          )}
        </CardTitle>
        {showResult && result?.complete && (
          <div className="flex items-center gap-4">
            <span className="font-semibold text-2xl tabular-nums">
              {tResult("scoreOutOf", { score: result.score ?? 0 })}
            </span>
            {result.band != null && (
              <Badge>{`${tAssessment("band")} ${result.band}`}</Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showResult ? (
          result?.complete ? (
            <>
              <p className="text-muted-foreground text-sm">
                {tResult("bandHighest")}
              </p>
              <RoleCriterionBreakdown criteria={result.criteria} />
              <Button asChild variant="outline" size="sm">
                <Link href={`/roles/${slug}/rate`}>{t("adjustRateCta")}</Link>
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {tResult("computing")}
            </p>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              {evaluated ? tRoles("evaluated") : tRoles("notEvaluated")}
            </p>
            {!archived &&
              (profileComplete ? (
                <Button asChild>
                  <Link href={`/roles/${slug}/rate`}>{ctaLabel}</Link>
                </Button>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("profileIncomplete")}
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
