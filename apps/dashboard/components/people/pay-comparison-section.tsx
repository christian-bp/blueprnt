"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"
import { useOrganization } from "@/components/org-context"
import { WidgetCard } from "@/components/widget-card"
import { useMoney } from "@/hooks/use-money"
import {
  buildPayComparisonRows,
  type PayComparisonPoint,
} from "@/lib/pay-comparison"

// The scope chip in the widget header (right slot), shared by the loaded and
// loading states so the chrome never changes across them.
function ScopeChip() {
  const t = useTranslations("dashboard.people.payComparison")
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {t("scopeRole")}
    </Badge>
  )
}

// The card's own loading state, exported so the person page's outer skeleton
// can reserve the same card and height: the swap to loaded content then cannot
// reflow the column.
export function PayComparisonSectionSkeleton() {
  const t = useTranslations("dashboard.people.payComparison")
  const tHelp = useTranslations("dashboard.help")
  return (
    <WidgetCard
      title={t("heading")}
      help={{
        label: tHelp("fteAdjustedLabel"),
        body: tHelp("fteAdjustedBody"),
      }}
      headerExtra={<ScopeChip />}
      expandable
    >
      <Skeleton className="h-48 w-full" />
    </WidgetCard>
  )
}

// "Pay compared with the role" on the person page: same-role people as a dot
// plot on FTE-adjusted total monthly pay (x) by level (rows), dots colored by
// gender (the tool's core pay-gap lens) with the viewed person marked by a
// brand ring and dashed line. The tooltip names each person and breaks the
// figure into basic vs variable with the gap to the viewed person. The
// "Same role" chip scopes this to a per-role, per-person detail view (v3 P3
// optional QC, ADR-0012), not the seed of v3's P1 primary gender-gap view:
// that is a separate gender-aggregate query (lika arbete =
// job_title+band+level, likvärdigt arbete = band; single-gender groups read
// as insufficient per the ADR-0012 amendment).
export function PayComparisonSection({
  personId,
  trackKey,
}: {
  personId: Id<"people">
  trackKey: string | undefined
}) {
  const t = useTranslations("dashboard.people.payComparison")
  const tHelp = useTranslations("dashboard.help")
  const { orgId } = useOrganization()
  const comparison = useQuery(api.people.pay.getRolePayComparison, {
    orgId,
    personId,
  })

  // One content renderer for both the card and the expanded dialog, so the
  // two can never diverge; only the chart grows in the dialog. The card is
  // ALWAYS expandable so its header chrome stays static across the loading,
  // precondition, and chart states (expanding a text state just shows the
  // same message larger, a harmless no-op).
  const content = (expanded: boolean) =>
    comparison === undefined ? (
      <Skeleton className={expanded ? "h-96 w-full" : "h-48 w-full"} />
    ) : comparison.status !== "ready" ? (
      // Preconditions in words, one shared line for both missing pieces
      // (classification and a recorded salary).
      <p className="text-muted-foreground text-sm">{t("precondition")}</p>
    ) : comparison.points.length < 2 ? (
      // Self is the only comparable point. If peers exist but were excluded
      // for currency, say so (decision #5: never hide the exclusion); only
      // when nothing was excluded is the person genuinely alone on the role.
      comparison.excludedCount > 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("excluded", { count: comparison.excludedCount })}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{t("onlyPerson")}</p>
      )
    ) : (
      <PayComparisonChart
        currency={comparison.currency}
        excludedCount={comparison.excludedCount}
        points={comparison.points}
        trackKey={trackKey}
        expanded={expanded}
      />
    )

  return (
    <WidgetCard
      title={t("heading")}
      help={{
        label: tHelp("fteAdjustedLabel"),
        body: tHelp("fteAdjustedBody"),
      }}
      headerExtra={<ScopeChip />}
      expandable
      expandedChildren={content(true)}
    >
      {content(false)}
    </WidgetCard>
  )
}

// The tooltip for one dot. Exported and driven purely by props so it is
// unit-testable without simulating a recharts hover (recharts renders it only
// while hovering, which jsdom cannot drive). The viewed person's name is
// brand-colored and shows no self-comparison; peers show the signed gap to the
// viewed person.
export function PayComparisonTooltip({
  point,
  selfAmount,
  currency,
}: {
  point: PayComparisonPoint
  selfAmount: number
  currency: string
}) {
  const t = useTranslations("dashboard.people.payComparison")
  const tGender = useTranslations("dashboard.people.gender")
  const money = useMoney()

  const name = point.displayName
  const diff = point.amount - selfAmount
  // The gender swatch reuses the same raw token the dot is filled with, so the
  // tooltip and the dot read as the same color.
  const genderColor =
    point.gender === "Man" ? "var(--gender-man)" : "var(--gender-woman)"

  return (
    <div className="min-w-40 rounded-md border bg-popover px-3 py-2 text-popover-foreground text-xs shadow-md">
      {/* Identity: name (brand for the viewed person) over a muted subtitle,
          with a gender swatch so gender is stated, not color-only. */}
      <p className={point.isSelf ? "font-medium text-brand" : "font-medium"}>
        {name}
      </p>
      <p className="text-muted-foreground">
        {point.level} &middot; {point.payYear}
      </p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: genderColor }}
        />
        {tGender(point.gender)}
      </p>

      {/* Figures: the total, broken into basic + variable only when there is
          variable pay (otherwise the total already is the basic). Amounts
          right-align in tabular figures so the column reads cleanly. */}
      <div className="mt-2 border-t pt-2">
        <p className="font-semibold text-sm tabular-nums">
          {money(point.amount, currency)}
        </p>
        {point.variable > 0 && (
          <dl className="mt-1 space-y-0.5">
            <div className="flex items-center justify-between gap-6">
              <dt className="text-muted-foreground">{t("tooltipBasic")}</dt>
              <dd className="tabular-nums">{money(point.basic, currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-6">
              <dt className="text-muted-foreground">{t("tooltipVariable")}</dt>
              <dd className="tabular-nums">
                {money(point.variable, currency)}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Gap to the viewed person (peers only). */}
      {!point.isSelf && diff !== 0 && (
        <p className="mt-2 border-t pt-2 text-muted-foreground">
          {t("vsThisPerson", { diff: money(diff, currency, { signed: true }) })}
        </p>
      )}
    </div>
  )
}

// A scatter dot whose fill (passed by its gender series) encodes gender. The
// viewed person gets a brand ring so "you" stays findable now that color means
// gender; every other dot gets a thin surface ring so overlapping dots still
// separate. Recharts calls the shape per point with the resolved cx/cy/fill.
function GenderDot({
  cx,
  cy,
  fill,
  payload,
}: {
  cx?: number
  cy?: number
  fill?: string
  payload?: PayComparisonPoint & { row: number }
}) {
  if (cx === undefined || cy === undefined) return null
  const isSelf = payload?.isSelf ?? false
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fill}
      stroke={isSelf ? "var(--brand)" : "var(--background)"}
      strokeWidth={isSelf ? 2.5 : 1}
    />
  )
}

function PayComparisonChart({
  currency,
  excludedCount,
  points,
  trackKey,
  expanded = false,
}: {
  currency: string
  excludedCount: number
  points: PayComparisonPoint[]
  trackKey: string | undefined
  expanded?: boolean
}) {
  const t = useTranslations("dashboard.people.payComparison")
  const tGender = useTranslations("dashboard.people.gender")
  const money = useMoney()
  const { levels, data } = buildPayComparisonRows(trackKey, points)
  // Dots are colored by gender (the tool's core pay-gap lens). Splitting into
  // two series is what gives the legend its Man / Woman entries; self-ness is a
  // separate cue (the brand ring on the dot + the dashed reference line).
  const men = data.filter((point) => point.gender === "Man")
  const women = data.filter((point) => point.gender === "Kvinna")
  // Self is always present in a rendered chart (>= 2 points including self);
  // the reference line and tooltip gaps read from it.
  const selfAmount = points.find((point) => point.isSelf)?.amount ?? 0

  const config = {
    man: { label: tGender("Man"), color: "var(--gender-man)" },
    woman: { label: tGender("Kvinna"), color: "var(--gender-woman)" },
  } satisfies ChartConfig

  return (
    <div className="space-y-1">
      {/* aspect-auto overrides the container's default aspect-video so the
          section gets a fixed height matching the loading skeleton; the
          expanded (dialog) variant gets the taller canvas. */}
      <ChartContainer
        config={config}
        className={
          expanded ? "aspect-auto h-96 w-full" : "aspect-auto h-48 w-full"
        }
      >
        <ScatterChart
          accessibilityLayer
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            type="number"
            dataKey="amount"
            domain={["auto", "auto"]}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value: number) => money(value, currency)}
          />
          {/* Levels ride a numeric row axis (reversed: row 0 on top) instead
              of a category axis, so every ladder level shows as a row even
              without a dot. */}
          <YAxis
            type="number"
            dataKey="row"
            reversed
            domain={[-0.5, levels.length - 0.5]}
            ticks={levels.map((_, index) => index)}
            tickFormatter={(row: number) => levels[row] ?? ""}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          {/* A dashed brand line at the viewed person's pay anchors every
              peer's horizontal distance to "where I sit". */}
          <ReferenceLine
            x={selfAmount}
            stroke="var(--brand)"
            strokeDasharray="4 4"
          />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (active !== true || payload === undefined) return null
              const point = payload[0]?.payload as
                | PayComparisonPoint
                | undefined
              if (point === undefined) return null
              return (
                <PayComparisonTooltip
                  point={point}
                  selfAmount={selfAmount}
                  currency={currency}
                />
              )
            }}
          />
          {/* Two series (man/woman) give the legend its labels: gender is
              never color-alone. The `name` is the raw config key, which
              ChartLegendContent resolves to the translated label + swatch. */}
          <ChartLegend content={<ChartLegendContent />} />
          <Scatter
            name="man"
            data={men}
            fill="var(--color-man)"
            shape={GenderDot}
          />
          <Scatter
            name="woman"
            data={women}
            fill="var(--color-woman)"
            shape={GenderDot}
          />
        </ScatterChart>
      </ChartContainer>
      <p className="text-muted-foreground text-xs">{t("footnote")}</p>
      {excludedCount > 0 && (
        <p className="text-muted-foreground text-xs">
          {t("excluded", { count: excludedCount })}
        </p>
      )}
    </div>
  )
}
