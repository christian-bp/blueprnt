"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { HelpMorphButton } from "@/components/help-morph-button"
import { useOrganization } from "@/components/org-context"
import { useMoney } from "@/hooks/use-money"
import {
  buildPayComparisonRows,
  type PayComparisonPoint,
} from "@/lib/pay-comparison"
import { displayNameFor } from "@/lib/person-display"

// The card's static header (title, help, scope chip): identical in the loading
// and loaded states, so it renders outside the state branches and never
// remounts across them. The chip sits right per the card-header anatomy (same
// as the salary card).
function PayComparisonHeader() {
  const t = useTranslations("dashboard.people.payComparison")
  const tHelp = useTranslations("dashboard.help")
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="flex items-center gap-2">
        <CardTitle>{t("heading")}</CardTitle>
        <HelpMorphButton label={tHelp("fteAdjustedLabel")}>
          {tHelp("fteAdjustedBody")}
        </HelpMorphButton>
      </div>
      <Badge variant="outline" className="text-muted-foreground">
        {t("scopeRole")}
      </Badge>
    </CardHeader>
  )
}

// The card's own loading state, exported so the person page's outer skeleton
// can reserve the same card and height: the swap to loaded content then cannot
// reflow the column.
export function PayComparisonSectionSkeleton() {
  return (
    <Card>
      <PayComparisonHeader />
      <CardContent>
        <Skeleton className="h-48 w-full" />
      </CardContent>
    </Card>
  )
}

// "Pay compared with the role" on the person page: same-role people as a dot
// plot on FTE-adjusted total monthly pay (x) by level (rows), dots colored by
// gender (the tool's core pay-gap lens) with the viewed person marked by a
// brand ring and dashed line. The tooltip names each person (respecting the
// org's pseudonymize-names setting, applied client-side as in the People
// register) and breaks the figure into basic vs variable with the gap to the
// viewed person. The single "Same role" chip is the seam where the same-band
// scope joins when the analysis pillar lands.
export function PayComparisonSection({
  personId,
  trackKey,
}: {
  personId: Id<"people">
  trackKey: string | undefined
}) {
  const t = useTranslations("dashboard.people.payComparison")
  const { orgId } = useOrganization()
  const comparison = useQuery(api.people.pay.getRolePayComparison, {
    orgId,
    personId,
  })
  // The pseudonymize setting gates only the chart (it decides how peer names
  // render); the precondition / only-person text states never touch it.
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, {
    orgId,
  })

  return (
    <Card>
      {/* Static header renders during loading (skeleton rule); only the chart
          area is data-shaped. */}
      <PayComparisonHeader />
      <CardContent>
        {comparison === undefined ? (
          <Skeleton className="h-48 w-full" />
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
        ) : settings === undefined ? (
          // The chart needs the pseudonymize setting to render names; hold the
          // same-height skeleton until it resolves so nothing reflows.
          <Skeleton className="h-48 w-full" />
        ) : (
          <PayComparisonChart
            currency={comparison.currency}
            excludedCount={comparison.excludedCount}
            points={comparison.points}
            trackKey={trackKey}
            pseudonymize={settings?.pseudonymizeNames ?? false}
          />
        )}
      </CardContent>
    </Card>
  )
}

// The tooltip for one dot. Exported and driven purely by props so it is
// unit-testable without simulating a recharts hover (recharts renders it only
// while hovering, which jsdom cannot drive). The viewed person shows their own
// name in brand and no self-comparison; peers show their (optionally
// pseudonymized) name and the signed gap to the viewed person.
export function PayComparisonTooltip({
  point,
  selfAmount,
  currency,
  pseudonymize,
}: {
  point: PayComparisonPoint
  selfAmount: number
  currency: string
  pseudonymize: boolean
}) {
  const t = useTranslations("dashboard.people.payComparison")
  const tOrg = useTranslations("dashboard.organization.general")
  const tGender = useTranslations("dashboard.people.gender")
  const money = useMoney()

  // The viewed person shows their real name (their own page already shows it,
  // pseudonymization is a register concern) in the brand color that matches
  // their dot; peers are pseudonymize-aware.
  const name = point.isSelf
    ? point.displayName
    : displayNameFor(point, pseudonymize, (ref) =>
        tOrg("pseudonymTemplate", { ref })
      )
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
  pseudonymize,
}: {
  currency: string
  excludedCount: number
  points: PayComparisonPoint[]
  trackKey: string | undefined
  pseudonymize: boolean
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
          section gets a fixed height matching the loading skeleton. */}
      <ChartContainer config={config} className="aspect-auto h-48 w-full">
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
                  pseudonymize={pseudonymize}
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
