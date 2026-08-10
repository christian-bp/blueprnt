"use client"

import { Coins01Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { flagWomenBehind } from "@workspace/core"
import { useFormatter, useTranslations } from "next-intl"
import { GenderDotIcon, type GenderSeries } from "@/components/gender-mark"
import { HelpMorphButton } from "@/components/help-morph-button"
import { useMoney } from "@/hooks/use-money"
import { percentText } from "@/lib/percent"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { ReactNode } from "react"
import { EvidenceDisclosure } from "./evidence-disclosure"
import { GroupMemberTable } from "./group-member-table"
import {
  type GapGroup,
  type GapMetric,
  membersOf,
  type PayMappingActionWire,
  type PayMappingNoteWire,
  type PayMappingSnapshotRow,
  primaryGapMetric,
} from "./pay-mapping-gap-types"
import { PayMappingScatter } from "./pay-mapping-scatter"

// One metric's compact "Kv. medel · M. medel · gap" line for the summary
// strip; null means when a side is missing render nothing (the entry
// conditions make that unreachable for shown groups, kept total anyway).
// Exported: the per-level likvärdigt analysis renders the same line.
// A small two-line figure card. Line one names WHAT the figure is about
// (the series, or the gap); line two carries the money. The one-line form
// this replaces read "1 · 53 859 kr", which needs the reader to already
// know that the first number is a headcount and the second a mean.
//
// The icons do the labelling the compact form could not: a people mark for
// the count, a coins mark for the money, both already used elsewhere in the
// app for exactly these. The gender mark ties the card to its own series in
// the plot below, and the series is NAMED as well as marked, because
// identity is never left to a mark alone.
function FigureCard({
  children,
  title,
}: {
  children: ReactNode
  title: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 text-sm">{title}</div>
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
        {children}
      </div>
    </div>
  )
}

function MeanCard({
  series,
  count,
  mean,
  currency,
}: {
  series: GenderSeries
  count: number
  mean: number | null
  currency: string
}) {
  const t = useTranslations("dashboard.payMapping.detail.summary")
  const tGap = useTranslations("dashboard.payMapping.gap.columns")
  const money = useMoney()
  if (mean === null) return null
  return (
    <FigureCard
      title={
        <>
          <span aria-hidden="true" className="size-3 shrink-0">
            <GenderDotIcon series={series} />
          </span>
          <span className="font-medium">
            {tGap(series === "women" ? "women" : "men")}
          </span>
          <HugeiconsIcon
            icon={UserMultiple02Icon}
            strokeWidth={2}
            aria-hidden="true"
            className="ml-1 size-3.5 shrink-0 text-muted-foreground"
          />
          <span className="text-muted-foreground tabular-nums">{count}</span>
        </>
      }
    >
      <HugeiconsIcon
        icon={Coins01Icon}
        strokeWidth={2}
        aria-hidden="true"
        className="size-3.5 shrink-0"
      />
      <span className="text-foreground tabular-nums">
        {money(mean, currency)}
      </span>
      <span>{t("meanSuffix")}</span>
    </FigureCard>
  )
}

// The gap itself, signed so the direction is in the number rather than in a
// sentence beside it.
function GapCard({
  metric,
  currency,
  prefix,
}: {
  metric: GapMetric
  currency: string
  prefix?: string
}) {
  const t = useTranslations("dashboard.payMapping.detail.summary")
  const format = useFormatter()
  const money = useMoney()
  if (metric.gapKr === null || metric.gapPct === null) return null
  return (
    <FigureCard
      title={<span className="font-medium">{prefix ?? t("gapLabel")}</span>}
    >
      <span className="text-foreground tabular-nums">
        {money(-metric.gapKr, currency, { signed: true })}
      </span>
      <span className="tabular-nums">
        ({percentText(metric.gapPct, format)})
      </span>
    </FigureCard>
  )
}

// The equal-work detail view (Iteration 2 note 3): a compact summary strip
// (counts, per-gender means, the gap in kr and %), the scatter as the first
// visual, then the individual member table.
//
// The visual used to be a swimlane dot plot: pay along the x axis, one lane
// per gender. It was replaced by the SAME scatter the equivalent-work chapter
// draws, on review feedback that gender on an axis reads as unclear. Pay
// against age or tenure answers the question this step actually asks the
// documenter, which is whether something objective explains the difference; a
// lane per gender only restated the averages the badges above already carry.
// One chart family across both chapters also means one place to improve. The group's primary
// metric leads (base salary, or total comp for a tccDriven group); the
// other metric rides along as a muted parallel line, and the table always
// carries both columns.
export function EqualWorkDetail({
  group,
  rows,
  currency,
  referenceDateMs,
  documentation,
}: {
  group: GapGroup
  rows: PayMappingSnapshotRow[]
  currency: string
  // The run's frozen freeze time (ADR-0011), which is what the scatter's age
  // and tenure axes count to. Never the live clock, or a group's plot would
  // drift with every day that passes after the run.
  referenceDateMs: number
  // The run's work layer (ADR-0015): present, the group heading and every
  // member row carry their own documentation badge + "..." menu.
  documentation?: {
    runId: Id<"payMappingRuns">
    actions: PayMappingActionWire[] | undefined
    notes: PayMappingNoteWire[] | undefined
    locked: boolean
  }
}) {
  const t = useTranslations("dashboard.payMapping.detail")
  const tGapRoot = useTranslations("dashboard.payMapping.gap")
  const tScatter = useTranslations("dashboard.payMapping.scatter")
  const tHelp = useTranslations("dashboard.help")

  const primary = primaryGapMetric(group)
  const secondary = group.tccDriven ? group.base : group.tcc
  // The badge form of the label, without the sentence colon the line
  // version carries.
  const secondaryPrefix = group.tccDriven
    ? t("summary.baseBadge")
    : t("summary.tccBadge")
  // The second measure earns its place only when it says something the
  // first one does not: a different flag (its gap crosses a threshold the
  // primary does not) or the opposite direction. Otherwise it restates the
  // same krona difference against a bigger base.
  const secondaryMatters =
    secondary.gapPct !== null &&
    primary.gapPct !== null &&
    (flagWomenBehind(group.womenCount, group.menCount, secondary.gapPct) !==
      flagWomenBehind(group.womenCount, group.menCount, primary.gapPct) ||
      Math.sign(secondary.gapPct) !== Math.sign(primary.gapPct))

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        {/* The figures as badges rather than three sentences. Everything
            the plot below already shows (the gap's size, where the means
            sit, the spread) is not repeated here; what a plot cannot give
            is the exact means and the headcount when points overlap, so
            that is what these carry. The gender marks tie each badge to
            its own series in the plot.

            The secondary metric appears ONLY when it changes the picture
            (see secondaryMatters). Base and total comp usually differ by a
            percentage point because the base is larger, not because
            anything different is happening, and a second row of near
            identical numbers is the noise this replaces. */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <MeanCard
            series="women"
            count={group.womenCount}
            mean={primary.womenMean}
            currency={currency}
          />
          <MeanCard
            series="men"
            count={group.menCount}
            mean={primary.menMean}
            currency={currency}
          />
          <GapCard metric={primary} currency={currency} />
          {secondaryMatters && (
            <GapCard
              metric={secondary}
              currency={currency}
              prefix={secondaryPrefix}
            />
          )}
        </div>
      </div>
      {/* This group's members only, drawn on the SAME measure the badges
          above state (base salary, or total comp for a tccDriven group) with
          that measure's own averages as the two reference lines. All three
          have to agree: a card reading "SEK 84,000 on average" over a line
          labelled "Women's avg" sitting at 98,333 is one screen contradicting
          itself. */}
      <PayMappingScatter
        rows={membersOf(rows, group)}
        currency={currency}
        referenceDateMs={referenceDateMs}
        yMetric={group.tccDriven ? "total" : "base"}
        means={{ women: primary.womenMean, men: primary.menMean }}
        title={tScatter("titleEqualWork")}
      />
      {/* The summary strip and the plot stay visible: they are WHY this
          group is flagged. The per-person table is the evidence behind
          that, collapsed so every opened step starts at roughly the same
          height with the form at the bottom (rung 3). */}
      <EvidenceDisclosure
        label={tGapRoot("groupMembers")}
        count={group.womenCount + group.menCount}
      >
        <div className="space-y-2">
          {/* The caption gives the help button something to sit beside: a
              lone icon at the top of the panel explains nothing. */}
          <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
            {t("diffCaption")}
            <HelpMorphButton label={tHelp("payGapMemberDiffLabel")}>
              {tHelp("payGapMemberDiffBody")}
            </HelpMorphButton>
          </p>
          <GroupMemberTable
            group={group}
            rows={rows}
            currency={currency}
            {...(documentation === undefined
              ? {}
              : {
                  documentation: {
                    runId: documentation.runId,
                    scope: "equalWork" as const,
                    actions: documentation.actions,
                    notes: documentation.notes,
                    locked: documentation.locked,
                  },
                })}
          />
        </div>
      </EvidenceDisclosure>
    </div>
  )
}
