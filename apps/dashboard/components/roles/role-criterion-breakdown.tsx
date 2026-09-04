"use client"

import {
  criterionShares,
  type DimensionKey,
  NOT_COVERED,
  type RatingValue,
  type WeightPoints,
} from "@workspace/core"
import { Accordion } from "@workspace/ui/components/accordion"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { AccordionSection } from "@/components/accordion-section"
import { HelpMorphButton } from "@/components/help-morph-button"
import { FIELD_LABEL_CLASS } from "@/lib/field-label"
import { SPRING } from "@/lib/motion"

// One criterion as it arrives from getRoleResult.criteria.
export interface BreakdownCriterion {
  criterionId: string
  name: string
  dimensionKey: DimensionKey
  value: number | null
  weightPoints: number
  motivation: string | null
}

// Whether a criterion carries words worth folding away. One shared predicate
// so the loading card's reserved disclosure and the rendered one can never
// disagree about which rows count (an empty string is stored as no
// motivation at all).
export function isMotivated(motivation: string | null): boolean {
  return motivation !== null && motivation.trim() !== ""
}

// The breakdown's own section label. Exported because the loading skeleton
// renders the same row: the help button sets the row's height, so a
// text-only stand-in measures 4px shorter and the card shrinks when the
// result lands.
export function BreakdownLabel() {
  const tHelp = useTranslations("dashboard.help")
  const tResult = useTranslations("dashboard.rating.result")
  return (
    // Section label for the breakdown, at the SAME scale and treatment as
    // the sheet's other field labels (Purpose, Responsibilities, Role
    // family). It sat at text-sm, which read as a heading of a different
    // rank rather than the fourth member of a set. The help sits after it
    // because this label is the concept's own title.
    <div className={`flex items-center gap-1.5 ${FIELD_LABEL_CLASS}`}>
      {tResult("breakdownLabel")}
      <HelpMorphButton label={tHelp("contributionLabel")}>
        {tHelp("contributionBody")}
      </HelpMorphButton>
    </div>
  )
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
  const tResult = useTranslations("dashboard.rating.result")

  // Shares are derived live by the engine (ADR-0002), never stored.
  const shares = criterionShares(
    criteria.map((c) => ({
      criterionId: c.criterionId,
      value: (c.value ?? 0) as RatingValue,
    })),
    criteria.map((c) => ({
      criterionId: c.criterionId,
      dimensionKey: c.dimensionKey,
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
  // The subset that has anything to fold away, in the same order the bars
  // are read in.
  const motivated = rows.filter(
    (row): row is typeof row & { motivation: string } =>
      isMotivated(row.motivation)
  )
  // Bars normalize to the top driver; the printed percentage is the true share.
  const maxShare = rows.reduce((max, row) => Math.max(max, row.share), 0)

  return (
    // space-y-1 so the label hugs its rows like the other section labels
    // (Purpose, Responsibilities, Role family) rather than floating above them.
    <div className="space-y-1">
      <BreakdownLabel />
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
            {/* h-5 is the line box a text-sm row occupies once it holds
                words: the skeleton's bars are shorter than their type, so
                without it the loading card is 4px per row too short. */}
            <div className="flex h-5 items-baseline justify-between gap-3">
              {/* One line, truncating: the rail is narrow enough that a long
                  criterion name wraps to two or three lines, which makes
                  every row a different height and leaves the card's height
                  unknowable until the result lands. The full name is the
                  element's title, and the model page carries the list in
                  full. */}
              <span className="min-w-0 truncate text-sm" title={row.name}>
                {row.name}
              </span>
              {/* A criterion the role is not covered by is not part of the
                  weighting at all (scoreRole drops it from both sides), so it
                  says so instead of printing a 0% that would read as
                  "measured, contributed nothing". The bar track stays, at the
                  zero width it would have had, so the row keeps its height. */}
              <span
                className={
                  row.value === NOT_COVERED
                    ? "shrink-0 text-muted-foreground text-sm"
                    : "shrink-0 font-medium text-sm tabular-nums"
                }
              >
                {row.value === NOT_COVERED
                  ? tResult("notCovered")
                  : tResult("contributionShare", {
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
          </motion.div>
        ))}
      </div>
      {/* The raters' own words, folded away rather than printed under every
          bar. On the surface they made each row a different height, which
          left the card's height unknowable until the result arrived and
          moved everything below it; they are also descriptive depth, which
          belongs in the opt-in layer rather than repeated per row. */}
      {motivated.length > 0 && (
        <Accordion className="pt-1">
          <AccordionSection
            value="motivations"
            title={tResult("motivationsLabel")}
            meta={motivated.length}
          >
            <div className="space-y-3 pb-1">
              {motivated.map((row) => (
                <div key={row.criterionId} className="space-y-0.5">
                  <div className="font-medium text-sm">{row.name}</div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {row.motivation}
                  </p>
                </div>
              ))}
            </div>
          </AccordionSection>
        </Accordion>
      )}
    </div>
  )
}
