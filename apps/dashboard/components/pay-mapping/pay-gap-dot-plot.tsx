"use client"

import { diffVsMenMean } from "@workspace/core"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import {
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  GENDER_DOT,
  GenderDotIcon,
  GenderLegend,
  GenderMenIcon,
} from "@/components/gender-mark"
import { WidgetCard } from "@/components/widget-card"
import { useMoney } from "@/hooks/use-money"
import { CHART_AXIS_FONT_SIZE, CHART_TOOLTIP_TEXT } from "@/lib/chart-style"
import { percentText } from "@/lib/percent"
import {
  fteBaseMonthly,
  fteTotalMonthly,
  type GapGroup,
  membersOf,
  type PayMappingSnapshotRow,
  primaryGapMetric,
} from "./pay-mapping-gap-types"

// The women's lane sits above the men's (Iteration 2 note 3's layout); the
// numbers are internal plot coordinates, never shown.
const WOMEN_LANE = 1
const MEN_LANE = 0

// One plottable dot: x is the member's FTE-adjusted value on the group's
// PRIMARY metric (base salary, or total comp for a tccDriven group), lane is
// the gender swimlane, diff is the member's signed difference against the
// men's mean on that same metric.
export interface DotPlotPoint {
  x: number
  lane: number
  woman: boolean
  name: string
  erased: boolean
  diffKr: number | null
  diffPct: number | null
}

export interface DotPlotModel {
  points: DotPlotPoint[]
  womenMean: number | null
  menMean: number | null
  gapKr: number | null
  gapPct: number | null
  // [min, max] for the X axis: padded around the data + reference lines so
  // the dots never sit on the plot edge. Deliberately NOT zero-based: this
  // plot encodes position, not magnitude (no bars/areas), and a zero-based
  // salary axis would compress every group into an unreadable strip.
  domain: [number, number]
}

// Pure: group + frozen rows -> the plot model. Exported for direct unit
// testing (recharts cannot be driven in jsdom).
export function buildDotPlotModel(
  group: GapGroup,
  rows: PayMappingSnapshotRow[]
): DotPlotModel {
  const metric = primaryGapMetric(group)
  const members = membersOf(rows, group)
  const points: DotPlotPoint[] = members.map((row) => {
    const x = group.tccDriven ? fteTotalMonthly(row) : fteBaseMonthly(row)
    const diff =
      metric.menMean === null ? null : diffVsMenMean(x, metric.menMean)
    return {
      x,
      lane: row.gender === "Kvinna" ? WOMEN_LANE : MEN_LANE,
      woman: row.gender === "Kvinna",
      name: row.displayName,
      erased: row.erased,
      diffKr: diff?.kr ?? null,
      diffPct: diff?.pct ?? null,
    }
  })
  const anchors = [
    ...points.map((point) => point.x),
    ...(metric.womenMean !== null ? [metric.womenMean] : []),
    ...(metric.menMean !== null ? [metric.menMean] : []),
  ]
  // Defensive: a caller with no members and no means would otherwise produce
  // an inverted Infinity domain.
  const min = anchors.length === 0 ? 0 : Math.min(...anchors)
  const max = anchors.length === 0 ? 0 : Math.max(...anchors)
  // 8% padding each side; a flat group (everyone on one value) still gets a
  // visible span instead of a zero-width domain.
  const span = max - min
  const pad = span === 0 ? Math.max(max * 0.05, 1000) : span * 0.08
  return {
    points,
    womenMean: metric.womenMean,
    menMean: metric.menMean,
    gapKr: metric.gapKr,
    gapPct: metric.gapPct,
    domain: [min - pad, max + pad],
  }
}

// Where each mean's label sits, so the two can never overprint. They ride
// on their OWN lines (women above men, matching the swimlane order): side by
// side they collide the moment the means are close, and a 9% gap on a phone
// puts the lines about 50px apart while each label is wider than that, which
// turned the two words into an unreadable smudge on exactly the gaps that
// most need reading. Each label also turns INWARD from its own line, or the
// outer one runs off the plot and is clipped; which line is left depends on
// the data, because women earn more in a real share of groups.
export function meanLabelPlacement(
  womenMean: number | null,
  menMean: number | null
): {
  women: "insideBottomLeft" | "insideBottomRight"
  men: "insideBottomLeft" | "insideBottomRight"
  womenDy: number
} {
  const womenLeft =
    womenMean === null || menMean === null ? true : womenMean <= menMean
  return {
    women: womenLeft ? "insideBottomLeft" : "insideBottomRight",
    men: womenLeft ? "insideBottomRight" : "insideBottomLeft",
    womenDy: -(CHART_AXIS_FONT_SIZE + 2),
  }
}

// The per-dot tooltip, exported and driven purely by props (same jsdom
// rationale as buildDotPlotModel): name, the member's pay on the plot's
// metric, and the diff against the men's mean in kr and %. HR-only surface:
// individual pay is by design visible in-app.
export function DotPlotTooltipContent({
  point,
  currency,
}: {
  point: DotPlotPoint
  currency: string
}) {
  const t = useTranslations("dashboard.payMapping.dotPlot")
  const tDetail = useTranslations("dashboard.payMapping.detail")
  const tGender = useTranslations("dashboard.people.gender")
  const format = useFormatter()
  const money = useMoney()
  return (
    <div
      className={cn(
        "min-w-40 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md",
        CHART_TOOLTIP_TEXT
      )}
    >
      <p className="font-medium">
        {point.erased ? tDetail("erased") : point.name}
      </p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span aria-hidden="true" className="size-2.5 shrink-0">
          <GenderDotIcon series={point.woman ? "women" : "men"} />
        </span>
        {tGender(point.woman ? "Kvinna" : "Man")}
      </p>
      <dl className="mt-2 space-y-0.5 border-t pt-2">
        <div className="flex items-center justify-between gap-6">
          <dt className="text-muted-foreground">{t("pay")}</dt>
          <dd className="font-semibold tabular-nums">
            {money(point.x, currency)}
          </dd>
        </div>
        {point.diffKr !== null && point.diffPct !== null && (
          <div className="flex items-center justify-between gap-6">
            <dt className="text-muted-foreground">{t("diff")}</dt>
            <dd className="tabular-nums">
              {money(point.diffKr, currency, { signed: true })} (
              {percentText(point.diffPct, format)})
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}

// The equal-work detail view's opening visual (Iteration 2 note 3): every
// member as a dot on the group's primary pay measure, one swimlane per
// gender (women on top), vertical reference lines at both gender means, and
// the span between them shaded and labeled with the gap in kr and %. Women
// draw as a solid triangle, men as an outlined circle in the same ink
// (GENDER_DOT), with the text legend keeping the key honest.
export function PayGapDotPlot({
  group,
  rows,
  currency,
}: {
  group: GapGroup
  rows: PayMappingSnapshotRow[]
  currency: string
}) {
  const t = useTranslations("dashboard.payMapping.dotPlot")
  const tHelp = useTranslations("dashboard.help")
  const tGender = useTranslations("dashboard.people.gender")
  const money = useMoney()

  // Memoized: the model walks the whole group per build, and the detail
  // pane re-renders with its parent's checklist state.
  const model = useMemo(() => buildDotPlotModel(group, rows), [group, rows])
  const women = model.points.filter((point) => point.woman)
  const men = model.points.filter((point) => !point.woman)

  const config = {
    man: {
      label: tGender("Man"),
      color: "var(--gender-man)",
      icon: GenderMenIcon,
    },
    woman: { label: tGender("Kvinna"), color: "var(--gender-woman)" },
  } satisfies ChartConfig

  const meanLabels = meanLabelPlacement(model.womenMean, model.menMean)

  return (
    <WidgetCard
      title={t("title")}
      help={{
        label: tHelp("payGapDotPlotLabel"),
        body: tHelp("payGapDotPlotBody"),
      }}
      expandable
    >
      <div className="space-y-1">
        <ChartContainer config={config} className="aspect-auto h-44 w-full">
          <ScatterChart
            accessibilityLayer
            margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
          >
            <XAxis
              type="number"
              dataKey="x"
              domain={model.domain}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={CHART_AXIS_FONT_SIZE}
              tickFormatter={(value: number) => money(value, currency)}
            />
            {/* Two fixed swimlanes (women on top); the axis carries the lane
                names, the numbers are internal coordinates. */}
            <YAxis
              type="number"
              dataKey="lane"
              domain={[-0.6, 1.6]}
              ticks={[MEN_LANE, WOMEN_LANE]}
              tickLine={false}
              axisLine={false}
              width={72}
              fontSize={CHART_AXIS_FONT_SIZE}
              tickFormatter={(value: number) =>
                value === WOMEN_LANE ? tGender("Kvinna") : tGender("Man")
              }
            />
            {/* The gap band: a light fill between the two means, under the
                labeled reference lines (a fill stays light under visible
                strokes; the strokes carry the reading).

                The band carries NO figure of its own. The gap is already
                stated as a badge above the plot, and repeating it here put
                the same percentage on screen twice within one card. The
                band's job is showing how wide the gap is, which is
                something only it can do. */}
            {model.womenMean !== null && model.menMean !== null && (
              <ReferenceArea
                x1={Math.min(model.womenMean, model.menMean)}
                x2={Math.max(model.womenMean, model.menMean)}
                fill="var(--brand)"
                fillOpacity={0.06}
              />
            )}
            {/* Placement is meanLabelPlacement's call; see it for why. */}
            {model.womenMean !== null && (
              <ReferenceLine
                x={model.womenMean}
                stroke="var(--gender-woman)"
                strokeDasharray="4 3"
                label={{
                  value: t("womenMean"),
                  position: meanLabels.women,
                  dy: meanLabels.womenDy,
                  fontSize: CHART_AXIS_FONT_SIZE,
                  fill: "var(--muted-foreground)",
                }}
              />
            )}
            {model.menMean !== null && (
              <ReferenceLine
                x={model.menMean}
                stroke="var(--gender-man)"
                strokeDasharray="4 3"
                label={{
                  value: t("menMean"),
                  position: meanLabels.men,
                  fontSize: CHART_AXIS_FONT_SIZE,
                  fill: "var(--muted-foreground)",
                }}
              />
            )}
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active !== true || payload === undefined) return null
                const point = payload[0]?.payload as DotPlotPoint | undefined
                if (point === undefined) return null
                return (
                  <DotPlotTooltipContent point={point} currency={currency} />
                )
              }}
            />
            <Scatter name="man" data={men} {...GENDER_DOT.men} />
            <Scatter name="woman" data={women} {...GENDER_DOT.women} />
          </ScatterChart>
        </ChartContainer>
        {/* Both series named in text, so gender is never mark-alone. */}
        <GenderLegend
          mark="point"
          items={[
            { series: "women", label: tGender("Kvinna") },
            { series: "men", label: tGender("Man") },
          ]}
        />
      </div>
    </WidgetCard>
  )
}
