"use client"

import {
  criterionShares,
  type RatingValue,
  type WeightPoints,
} from "@workspace/core"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SPRING } from "@/lib/motion"

// One criterion as it arrives from getRoleResult.criteria.
export interface BreakdownCriterion {
  criterionId: string
  name: string
  value: number | null
  weightPoints: number
  motivation: string | null
}

// The per-criterion contribution list: each criterion's share of the role's
// weighting (rating x weight, normalized to the total), sorted
// biggest-driver-first and animated on reweight. Shared by RoleEvaluationCard
// (role page) and RoleSheet (overview quick-look) so the animation-sensitive
// logic lives in exactly one place (docs/ui-animation.md).
export function RoleCriterionBreakdown({
  criteria,
}: {
  criteria: BreakdownCriterion[]
}) {
  const tHelp = useTranslations("dashboard.help")
  const tResult = useTranslations("dashboard.rating.result")

  // Shares are derived live by the engine (ADR-0002), never stored.
  const shares = criterionShares(
    criteria.map((c) => ({
      criterionId: c.criterionId,
      value: (c.value ?? 0) as RatingValue,
    })),
    criteria.map((c) => ({
      criterionId: c.criterionId,
      weightPoints: c.weightPoints as WeightPoints,
    }))
  )
  const shareById = new Map(shares.map((s) => [s.criterionId, s.share]))
  // Sort by contribution desc; ties keep the model's canonical order (the
  // payload arrives in criterion order, so the array index is canonical).
  const rows = criteria
    .map((c, index) => ({
      ...c,
      share: shareById.get(c.criterionId) ?? 0,
      order: index,
    }))
    .sort((a, b) => b.share - a.share || a.order - b.order)
  // Bars normalize to the top driver; the printed percentage is the true share.
  const maxShare = rows.reduce((max, row) => Math.max(max, row.share), 0)

  return (
    // space-y-1 so the label hugs its rows like the other section labels
    // (Purpose, Responsibilities, Role family) rather than floating above them.
    <div className="space-y-1">
      {/* Section label for the breakdown: text-sm (muted) so it reads as a
          heading for the rows below rather than a tiny caption. */}
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
            {/* The section is "Contribution", so the contribution share is the
                row's headline next to the name; the bar shows it relative to the
                biggest driver. */}
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">{row.name}</span>
              <span className="shrink-0 font-medium text-sm tabular-nums">
                {tResult("contributionShare", {
                  share: Math.round(row.share * 100),
                })}
              </span>
            </div>
            {/* Thinner, softer fill (primary/80) so the rows read calmly; the
                override stays local to the bar. */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary/80"
                initial={false}
                animate={{
                  width: `${maxShare > 0 ? (row.share / maxShare) * 100 : 0}%`,
                }}
                transition={SPRING}
              />
            </div>
            {row.motivation !== null && (
              <p className="text-muted-foreground text-xs">{row.motivation}</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
