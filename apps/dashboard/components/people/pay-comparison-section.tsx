"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import { type ChartConfig, ChartTooltip } from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
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
import {
  GenderDotIcon,
  GenderPointHitArea,
  GenderPointMark,
  GenderLegend,
  GenderMenIcon,
} from "@/components/gender-mark"
import { useOrganization } from "@/components/org-context"
import { ChartCanvas, ChartCanvasSkeleton } from "@/components/chart-canvas"
import { WidgetCard } from "@/components/widget-card"
import { useMoney } from "@/hooks/use-money"
import {
  CHART_TOOLTIP_MOTION,
  CHART_TOOLTIP_TEXT,
  TOOLTIP_APPEAR,
} from "@/lib/chart-style"

// The plot's height inside its card: shorter than the pay-mapping scatter, in
// a section that sits among a person's other panels.
const COLLAPSED_HEIGHT = "h-48"
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
// plot on FTE-adjusted total monthly pay (x) by seniority (rows), dots
// colored by gender (the tool's core pay-gap lens) with the viewed person
// marked by a brand ring and dashed line. The tooltip names each person and
// breaks the figure into basic vs variable with the gap to the viewed
// person. The "Same role" chip scopes this to a per-role, per-person detail
// view (v3 P3 optional QC, ADR-0012), not the seed of v3's P1 primary
// gender-gap view: that is a separate gender-aggregate query (lika arbete =
// job_title+level+seniority, likvärdigt arbete = level; single-gender groups
// read as insufficient per the ADR-0012 amendment).
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

  // One rendering, used by the card and by its expanded dialog alike: the
  // pieces that grow read the dialog's own context rather than taking a flag
  // from here. The card is ALWAYS expandable so its header chrome stays
  // static across the loading, precondition, and chart states (expanding a
  // text state just shows the same message larger, a harmless no-op).
  const content = () =>
    comparison === undefined ? (
      <PayComparisonSkeleton />
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
    >
      {content()}
    </WidgetCard>
  )
}

// The waiting state, sized to whichever canvas the chart will land on, so the
// section does not resize the moment its data arrives.
function PayComparisonSkeleton() {
  return <ChartCanvasSkeleton collapsed={COLLAPSED_HEIGHT} />
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
  // The swatch mirrors the dot's own mark (solid for women, hatched for men),
  // so the tooltip and the plot state the same thing.
  const genderSeries = point.gender === "Man" ? "men" : "women"

  return (
    <div
      className={cn(
        "min-w-40 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md",
        CHART_TOOLTIP_TEXT,
        TOOLTIP_APPEAR
      )}
    >
      {/* Identity: name (brand for the viewed person) over a muted subtitle,
          with a gender swatch so gender is stated, not color-only. */}
      <p className={point.isSelf ? "font-medium text-brand" : "font-medium"}>
        {name}
      </p>
      <p className="text-muted-foreground">
        {point.seniority} &middot; {point.payYear}
      </p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        {/* The hover shows the same mark the plot draws: a point chart's
            key is its triangle or circle, never the area charts' square. */}
        <span aria-hidden="true" className="size-2.5 shrink-0">
          <GenderDotIcon series={genderSeries} />
        </span>
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
// Gender is the dot's own fill (solid women, outlined men: a hatch cannot
// survive on a 10px mark), which leaves the dot's stroke already spoken for on
// the men series. So the viewed person is marked by a SEPARATE outer halo
// instead of a thicker stroke, and the two encodings stop competing: any dot
// can be self, and any self dot still shows its gender.
function GenderDot({
  cx,
  cy,
  payload,
}: {
  cx?: number
  cy?: number
  payload?: PayComparisonPoint & { row: number }
}) {
  if (cx === undefined || cy === undefined) return null
  const isSelf = payload?.isSelf ?? false
  return (
    <>
      {isSelf && (
        <circle
          cx={cx}
          cy={cy}
          r={8.5}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={1.5}
        />
      )}
      {/* Through the shared mark, so this chart's hand-placed dots draw the
          same triangle/circle as the ones recharts places elsewhere. */}
      <GenderPointMark
        cx={cx}
        cy={cy}
        series={payload?.gender === "Man" ? "men" : "women"}
      />
    </>
  )
}

function GenderHit({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return null
  return <GenderPointHitArea cx={cx} cy={cy} />
}

function PayComparisonChart({
  currency,
  excludedCount,
  points,
  trackKey,
}: {
  currency: string
  excludedCount: number
  points: PayComparisonPoint[]
  trackKey: string | undefined
}) {
  const t = useTranslations("dashboard.people.payComparison")
  const tGender = useTranslations("dashboard.people.gender")
  const money = useMoney()
  const { seniorities, data } = buildPayComparisonRows(trackKey, points)
  // Dots are colored by gender (the tool's core pay-gap lens). Splitting into
  // two series is what gives the legend its Man / Woman entries; self-ness is a
  // separate cue (the brand ring on the dot + the dashed reference line).
  const men = data.filter((point) => point.gender === "Man")
  const women = data.filter((point) => point.gender === "Kvinna")
  // Self is always present in a rendered chart (>= 2 points including self);
  // the reference line and tooltip gaps read from it.
  const selfAmount = points.find((point) => point.isSelf)?.amount ?? 0

  const config = {
    man: {
      label: tGender("Man"),
      color: "var(--gender-man)",
      icon: GenderMenIcon,
    },
    woman: { label: tGender("Kvinna"), color: "var(--gender-woman)" },
  } satisfies ChartConfig

  return (
    <div className="space-y-1">
      <ChartCanvas config={config} collapsed={COLLAPSED_HEIGHT}>
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
          {/* Seniorities ride a numeric row axis (reversed: row 0 on top)
              instead of a category axis, so every ladder seniority shows as
              a row even without a dot. */}
          <YAxis
            type="number"
            dataKey="row"
            reversed
            domain={[-0.5, seniorities.length - 0.5]}
            ticks={seniorities.map((_, index) => index)}
            tickFormatter={(row: number) => seniorities[row] ?? ""}
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
            {...CHART_TOOLTIP_MOTION}
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
          {/* Pointer targets first, as their own layer: see
              GenderPointHitArea for why they cannot ride with their marks. */}
          <Scatter name="man-target" data={men} shape={GenderHit} />
          <Scatter name="woman-target" data={women} shape={GenderHit} />
          <Scatter name="man" data={men} shape={GenderDot} />
          <Scatter name="woman" data={women} shape={GenderDot} />
        </ScatterChart>
      </ChartCanvas>
      {/* Both series are named here, so gender is never mark-alone. */}
      <GenderLegend
        mark="point"
        items={[
          { series: "women", label: tGender("Kvinna") },
          { series: "men", label: tGender("Man") },
        ]}
      />
      <p className="text-muted-foreground text-sm">{t("footnote")}</p>
      {excludedCount > 0 && (
        <p className="text-muted-foreground text-sm">
          {t("excluded", { count: excludedCount })}
        </p>
      )}
    </div>
  )
}
