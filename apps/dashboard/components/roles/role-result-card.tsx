"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import {
  criterionShares,
  type RatingValue,
  type WeightPoints,
} from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SPRING } from "@/lib/motion"

// Per-role result breakdown: the role's assessed value per criterion plus each
// criterion's contribution share (rating x weight, normalized to the total),
// sorted biggest-driver-first and animated on reweight. The contribution is the
// only per-criterion number that is both role-specific and weight-dependent, so
// it answers "how was this role weighted across the criteria" and is what reacts
// when the model is reweighted. The org-global model weight is not shown here
// (it is identical on every role; it lives in the model view).
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

  // Contribution shares are derived live by the engine (ADR-0002), never
  // stored. The card only renders when complete, so every rating is present.
  const shares = criterionShares(
    result.criteria.map((c) => ({
      criterionId: c.criterionId,
      value: (c.value ?? 0) as RatingValue,
    })),
    result.criteria.map((c) => ({
      criterionId: c.criterionId,
      weightPoints: c.weightPoints as WeightPoints,
    }))
  )
  const shareById = new Map(shares.map((s) => [s.criterionId, s.share]))
  // Sort by contribution descending; ties keep the model's canonical order (the
  // payload arrives sorted by criterion order, so the array index is canonical).
  const rows = result.criteria
    .map((c, index) => ({
      ...c,
      share: shareById.get(c.criterionId) ?? 0,
      order: index,
    }))
    .sort((a, b) => b.share - a.share || a.order - b.order)
  // Bars normalize to the biggest contributor so the top driver fills its
  // track; the printed percentage stays the true share.
  const maxShare = rows.reduce((max, row) => Math.max(max, row.share), 0)

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
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
          {tResult("breakdownLabel")}
          <HelpMorphButton label={tHelp("contributionLabel")}>
            {tHelp("contributionBody")}
          </HelpMorphButton>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <motion.div
              key={row.criterionId}
              layout="position"
              transition={SPRING}
              className="space-y-1"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{row.name}</span>
                <span className="shrink-0 text-muted-foreground text-sm tabular-nums">
                  {tResult("ratingOutOf", { value: row.value ?? 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={false}
                    animate={{
                      width: `${maxShare > 0 ? (row.share / maxShare) * 100 : 0}%`,
                    }}
                    transition={SPRING}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
                  {tResult("contributionShare", {
                    share: Math.round(row.share * 100),
                  })}
                </span>
              </div>
              {row.motivation !== null && (
                <p className="text-muted-foreground text-xs">
                  {row.motivation}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
