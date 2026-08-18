"use client"

import { ageAt } from "@workspace/core"
import { type ChartConfig, ChartTooltip } from "@workspace/ui/components/chart"
import { cn } from "@workspace/ui/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useTranslations } from "next-intl"
import { useState } from "react"
import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  OTHER_ROLE_ID,
  ROLE_COLOR_SLOTS,
  ROLE_OTHER_COLOR,
  roleColorAt,
  roleColorsFor,
} from "@/lib/role-palette"
import { PointMark, PointShapeIcon } from "@/components/point-mark"
import { RoleLegend } from "@/components/role-mark"
import {
  GenderDotIcon,
  GenderLegend,
  GenderMenIcon,
  GenderPointHitArea,
  GenderPointMark,
  type GenderSeries,
} from "@/components/gender-mark"
import { WidgetCard } from "@/components/widget-card"
import { ChartCanvas, ChartCanvasSkeleton } from "@/components/chart-canvas"
import { useMoney } from "@/hooks/use-money"
import {
  CHART_TOOLTIP_MOTION,
  CHART_TOOLTIP_TEXT,
  moneyAxisWidth,
  TOOLTIP_APPEAR,
} from "@/lib/chart-style"
import {
  fteBaseMonthly,
  fteTotalMonthly,
  type PayMappingSnapshotRow,
} from "./pay-mapping-gap-types"

// The plot's height inside its card. Taller than the strip tiles: this chart
// is the surface where individual positions are read, not a glance.
const COLLAPSED_HEIGHT = "h-64"

// Each gender's average pay, drawn as a line across the plot. Null where that
// gender is absent or the group is masked, exactly as the engine reports it.
export interface ScatterMeans {
  women: number | null
  men: number | null
}

// Where each average's label sits: one at each END of its own line, women
// left and men right.
//
// Separating them VERTICALLY does not work, which is what this replaced. A
// horizontal reference line has no height for a label to sit inside, so
// "above the line" and "below the line" come out about a line-height apart at
// best, and the gaps that most need reading put the two lines a few pixels
// apart: both labels then landed in the same place and overprinted. Opposite
// ends of the plot are separated by its full width however small the gap
// gets.
//
// Fixed per series rather than by which average is higher. Women earn more in
// a real share of groups, so a rule based on the values would swap the two
// labels between one group and the next, and a reader stepping through a
// chapter would have to re-read which side is which every time.
const MEAN_LABEL_POSITION = {
  women: "insideBottomLeft",
  men: "insideTopRight",
} as const

// The Y axis, widened to contain the average lines as well as the dots.
//
// An auto domain fits the DOTS, and recharts silently drops a reference line
// that falls outside it. The averages come from the engine's group figures,
// which count everyone, while the plot can only draw people who also have a
// birth date (or start date): one omitted high earner is enough to put the
// men's average above every dot on screen, and the line for it would just not
// be there. The flat group is the same trap without any missing data, since
// identical pay collapses the domain to a single value.
//
// Recharts takes a function per bound, so this widens the fitted domain
// instead of replacing it: the dots keep their own framing whenever the means
// already sit inside.
export function meanAwareYDomain(
  means: ScatterMeans | undefined
): [YBound, YBound] {
  const values = [means?.women, means?.men].filter(
    (value): value is number => value !== null && value !== undefined
  )
  if (values.length === 0) return ["auto", "auto"]
  const low = Math.min(...values)
  const high = Math.max(...values)
  return [
    (dataMin: number) => Math.min(dataMin, low),
    (dataMax: number) => Math.max(dataMax, high),
  ]
}

type YBound = "auto" | ((value: number) => number)

// The scatter's X axis: age (from birthDate) or tenure (from
// employmentStartDate), both whole years at the run's frozen referenceDate.
export type ScatterXMode = "age" | "tenure"

// What the hue carries. Shape carries gender in both, so switching frees the
// hue channel rather than taking an encoding away.
export type ScatterColorMode = "gender" | "role"

// Which pay measure the Y axis draws. Total compensation by default; a caller
// whose surrounding figures are stated in base salary passes "base", so the
// dots, the average lines and the badges above the card are all the same
// measure. They were not, once: the equal-work card stated a group's base
// averages while the plot drew total comp, which put two different numbers
// called "average" on one screen, about 14 000 kr apart.
export type ScatterYMetric = "total" | "base"

// One plottable dot: x is the active mode's whole-years figure, y is the
// FTE-adjusted total monthly comp (the tool's core gap measure), woman flags
// the gender series, row carries the full snapshot row for the tooltip, and
// groupLabel (equivalent-work only) names which group the row belongs to.
export interface ScatterPoint {
  x: number
  y: number
  woman: boolean
  row: PayMappingSnapshotRow
  groupLabel?: string
}

// Pure: rows -> plottable points on the active X mode + an omitted count.
// Priced rows only (basicMonthly !== null); the active mode's date field
// (birthDate for age, employmentStartDate for tenure) must also parse to a
// non-negative whole-years figure (ageAt handles both: "the same
// whole-years-at-instant math applies" to tenure), or the row is counted in
// `omitted` instead of plotted. `referenceDateMs` is the run's frozen freeze
// time (ADR-0011), never the live clock. Exported for direct unit testing.
export function buildScatterPoints(
  rows: PayMappingSnapshotRow[],
  xMode: ScatterXMode,
  referenceDateMs: number,
  groupLabelFor?: (row: PayMappingSnapshotRow) => string,
  yMetric: ScatterYMetric = "total"
): { points: ScatterPoint[]; omitted: number } {
  const points: ScatterPoint[] = []
  let omitted = 0
  for (const row of rows) {
    if (row.basicMonthly === null) {
      omitted += 1
      continue
    }
    const dateField = xMode === "age" ? row.birthDate : row.employmentStartDate
    const x = dateField === undefined ? null : ageAt(dateField, referenceDateMs)
    if (x === null) {
      omitted += 1
      continue
    }
    points.push({
      x,
      y: yMetric === "base" ? fteBaseMonthly(row) : fteTotalMonthly(row),
      woman: row.gender === "Kvinna",
      row,
      groupLabel: groupLabelFor?.(row),
    })
  }
  return { points, omitted }
}

// The per-dot tooltip, exported and driven purely by props (mirrors
// PayComparisonTooltip in pay-comparison-section.tsx): recharts renders its
// tooltip content only while hovering, which jsdom cannot drive, so the
// component test exercises this function directly instead. HR-only surface:
// individual pay is by design visible in-app (small-cell minimums apply at
// the export boundary only, not here).
export function ScatterTooltipContent({
  point,
  currency,
  xMode,
  roleColor,
}: {
  point: ScatterPoint
  currency: string
  xMode: ScatterXMode
  // The hue the hovered point is drawn in when the plot encodes jobs rather
  // than gender. Given, the hover shows that mark beside the job it names,
  // and the gender line drops its own: a mark that means the job cannot sit
  // next to the word "gender".
  roleColor?: string
}) {
  const t = useTranslations("dashboard.payMapping.scatter")
  const tDetail = useTranslations("dashboard.payMapping.detail")
  const tGap = useTranslations("dashboard.payMapping.gap")
  const tGender = useTranslations("dashboard.people.gender")
  const money = useMoney()
  const { row } = point
  const variable = row.components.reduce((sum, c) => sum + c.monthlyAmount, 0)
  // From the ROW, not from point.y: the axis may be drawing base salary, and a
  // "Total" line showing the base would be a wrong number, not a shorter one.
  const total = fteTotalMonthly(row)
  const genderSeries = row.gender === "Man" ? "men" : "women"

  return (
    <div
      className={cn(
        "min-w-40 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md",
        CHART_TOOLTIP_TEXT,
        TOOLTIP_APPEAR
      )}
    >
      <p className="font-medium">
        {row.erased ? tDetail("erased") : row.displayName}
      </p>
      <p className="text-muted-foreground">
        {row.roleTitle} &middot; {row.seniority}
      </p>
      {row.level !== null && (
        <p className="text-muted-foreground">
          {tGap("levelLabel", { level: row.level })}
        </p>
      )}
      <p className="flex items-center gap-1.5 text-muted-foreground">
        {/* The hover shows the same mark the plot draws: a point chart's key
            is its triangle or circle, never the area charts' square. In role
            mode the plot draws no gender mark at all, so this line is left as
            plain text rather than showing one the chart is not using. */}
        {roleColor === undefined && (
          <span aria-hidden="true" className="size-2.5 shrink-0">
            <GenderDotIcon series={genderSeries} />
          </span>
        )}
        {tGender(row.gender)}
      </p>

      <dl className="mt-2 space-y-0.5 border-t pt-2">
        <div className="flex items-center justify-between gap-6">
          <dt className="text-muted-foreground">{t("basic")}</dt>
          <dd className="tabular-nums">
            {money(row.basicMonthly ?? 0, currency)}
          </dd>
        </div>
        {variable > 0 && (
          <div className="flex items-center justify-between gap-6">
            <dt className="text-muted-foreground">{t("variable")}</dt>
            <dd className="tabular-nums">{money(variable, currency)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-6">
          <dt className="text-muted-foreground">{t("total")}</dt>
          <dd className="font-semibold tabular-nums">
            {money(total, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="text-muted-foreground">{t(xMode)}</dt>
          <dd className="tabular-nums">{point.x}</dd>
        </div>
        {point.groupLabel !== undefined && (
          <div className="flex items-center justify-between gap-6">
            <dt className="text-muted-foreground">{t("group")}</dt>
            <dd className="flex min-w-0 items-center gap-1.5">
              {/* The mark belongs on the line it names: in role mode this row
                  IS what the shape and the hue encode. */}
              {roleColor !== undefined && (
                <span aria-hidden="true" className="size-2.5 shrink-0">
                  <PointShapeIcon shape="circle" fill={roleColor} />
                </span>
              )}
              <span className="truncate">{point.groupLabel}</span>
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}

// The scatter card embedded under a group's detail (both the equal-work and
// equivalent-work views): every priced member plotted by age/tenure (x, toggled in
// the header) against FTE-adjusted total pay (y), colored by gender via the
// man/woman tokens with a text legend (gender is never color-alone). `rows`
// undefined means the caller's own data (the run) has not resolved yet; the
// card still renders its real title/help/toggle chrome with a fixed-height
// skeleton standing in for the plot area, per the skeleton rule.
export function PayMappingScatter({
  rows,
  currency,
  referenceDateMs,
  groupLabelFor,
  highlightGroupLabel,
  title,
  yMetric = "total",
  means,
  roleOrder,
}: {
  rows: PayMappingSnapshotRow[] | undefined
  currency: string
  referenceDateMs: number
  groupLabelFor?: (row: PayMappingSnapshotRow) => string
  // When set, only people whose group label matches stay at full strength
  // and the rest recede. It is what ties a selected table row to the
  // individuals behind its average, so the two are one object rather than
  // two lists to hold in your head.
  highlightGroupLabel?: string | null
  title: string
  // Which pay measure the Y axis draws; see ScatterYMetric.
  yMetric?: ScatterYMetric
  // Each gender's average, drawn across the plot. Passed only where a single
  // group is on screen (equal work): under equivalent work the plot holds a
  // group and its comparators at once, so one pair of lines would average
  // across jobs that are deliberately being kept apart.
  means?: ScatterMeans
  // The jobs on the plot, in the order the surface already shows them (the
  // comparator table's own order: the group first, then its comparators).
  // Its presence is what offers the role mode at all, and the order is what
  // fixes each job's hue: filtering the table must never repaint the jobs
  // that remain. Only the first six get a hue; the rest share the neutral.
  roleOrder?: readonly string[]
}) {
  const t = useTranslations("dashboard.payMapping.scatter")
  const tHelp = useTranslations("dashboard.help")
  const tGender = useTranslations("dashboard.people.gender")
  const money = useMoney()
  const [xMode, setXMode] = useState<ScatterXMode>("age")
  // Which encoding the hue carries. Shape carries gender in BOTH modes, so
  // switching never takes gender off the chart, it only frees the hue channel
  // to answer "which job is this point" instead of repeating what the shape
  // already says.
  const [colorMode, setColorMode] = useState<ScatterColorMode>("gender")
  // The keys the reader has clicked off. One set per mode, because the two
  // modes key on different things and a filter should still be there when
  // you come back to the mode you set it in.
  const [hiddenGenders, setHiddenGenders] = useState<ReadonlySet<GenderSeries>>(
    new Set()
  )
  const [hiddenRoles, setHiddenRoles] = useState<ReadonlySet<string>>(new Set())
  const toggleIn = <T,>(
    set: ReadonlySet<T>,
    value: T,
    apply: (next: ReadonlySet<T>) => void
  ) => {
    const next = new Set(set)
    if (!next.delete(value)) next.add(value)
    apply(next)
  }
  const roleColors = roleColorsFor(roleOrder ?? [])
  // Which key a job belongs to: its own past the first six, the shared
  // neutral after that. Hiding "other roles" hides the whole bucket, which is
  // what the one chip standing for them promises.
  const roleKeyIds = new Map(
    (roleOrder ?? []).map((label, index) => [
      label,
      index < ROLE_COLOR_SLOTS ? label : OTHER_ROLE_ID,
    ])
  )
  const roleMode = colorMode === "role" && (roleOrder?.length ?? 0) > 0
  // The legend's chips: the named jobs, plus ONE for the neutral when the
  // slots run out. Listing every leftover job under the same mark would
  // promise a hue that cannot tell them apart.
  const roleKeys = [
    ...(roleOrder ?? []).slice(0, ROLE_COLOR_SLOTS).map((label, index) => ({
      id: label,
      label,
      color: roleColorAt(index),
    })),
    ...((roleOrder?.length ?? 0) > ROLE_COLOR_SLOTS
      ? [
          {
            id: OTHER_ROLE_ID,
            label: t("colorRoleOther"),
            color: ROLE_OTHER_COLOR,
          },
        ]
      : []),
  ]
  // Which key a point belongs to in each mode.
  const roleKeyOf = (point: ScatterPoint) =>
    roleKeyIds.get(point.groupLabel ?? "") ?? OTHER_ROLE_ID
  // Whether a point is currently filtered out by the key.
  const pointHidden = (point: ScatterPoint) =>
    roleMode
      ? hiddenRoles.has(roleKeyOf(point))
      : hiddenGenders.has(point.woman ? "women" : "men")
  // The hue a point wears in role mode: its job's, or the neutral for a job
  // past the last slot.
  const roleColorFor = (groupLabel: string | undefined): string =>
    roleColors.get(groupLabel ?? "") ?? ROLE_OTHER_COLOR

  // One point's pointer target. Same guard as the mark below: recharts calls
  // a custom shape before it has a position for it.
  // biome-ignore lint/suspicious/noExplicitAny: recharts types a custom shape's props as any
  const hitArea = (props: any) => {
    if (props?.cx === undefined || props?.cy === undefined) return <g />
    return <GenderPointHitArea cx={props.cx} cy={props.cy} />
  }

  // A point's own mark, so the highlight rides on the point rather than on
  // its series. Recedes everyone outside the selected group; with no
  // selection every point draws at full strength.
  const markFor =
    (series: GenderSeries) =>
    // biome-ignore lint/suspicious/noExplicitAny: recharts types a custom shape's props as any
    (props: any) => {
      const point = props?.payload as ScatterPoint | undefined
      if (
        props?.cx === undefined ||
        props?.cy === undefined ||
        point === undefined
      ) {
        return <g />
      }
      const dimmed =
        highlightGroupLabel !== undefined &&
        highlightGroupLabel !== null &&
        point.groupLabel !== highlightGroupLabel
      // In role mode every point is the same circle and the hue answers
      // "which job". Gender is not encoded there at all, and its key comes
      // off the legend with it. Shape is left to the gender mode, where two
      // categories have to survive greyscale and print; six jobs is more than
      // a silhouette a few pixels across can carry, and what keeps identity
      // off colour alone here is the legend, the hover, and being able to
      // click every other job away.
      return (
        <g opacity={dimmed ? 0.25 : 1}>
          {roleMode ? (
            <PointMark
              cx={props.cx}
              cy={props.cy}
              shape="circle"
              fill={roleColorFor(point.groupLabel)}
            />
          ) : (
            <GenderPointMark cx={props.cx} cy={props.cy} series={series} />
          )}
        </g>
      )
    }

  const help = {
    label: tHelp("payGapScatterLabel"),
    // The averages exist only on the surfaces that pass them, so their
    // sentence is appended rather than folded into the shared body. Two whole
    // sentences joined by a space share no grammar across the join, so every
    // locale keeps its own wording on both sides of it.
    body:
      means === undefined
        ? tHelp("payGapScatterBody")
        : `${tHelp("payGapScatterBody")} ${tHelp("payGapScatterMeansBody")}`,
  }
  const toggle = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Offered only where a role order exists to colour by (the
          equivalent-work comparison). Elsewhere the plot is one job, and a
          control that could only ever say "one colour" is noise. */}
      {roleOrder !== undefined && roleOrder.length > 0 && (
        <Tabs
          value={colorMode}
          onValueChange={(value) => setColorMode(value as ScatterColorMode)}
        >
          <TabsList>
            <TabsTrigger value="gender">{t("colorGender")}</TabsTrigger>
            <TabsTrigger value="role">{t("colorRole")}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <Tabs
        value={xMode}
        onValueChange={(value) => setXMode(value as ScatterXMode)}
      >
        <TabsList>
          <TabsTrigger value="age">{t("xAge")}</TabsTrigger>
          <TabsTrigger value="tenure">{t("xTenure")}</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )

  if (rows === undefined) {
    return (
      <WidgetCard title={title} help={help} headerExtra={toggle} expandable>
        <ChartCanvasSkeleton collapsed={COLLAPSED_HEIGHT} />
      </WidgetCard>
    )
  }

  const { points, omitted } = buildScatterPoints(
    rows,
    xMode,
    referenceDateMs,
    groupLabelFor,
    yMetric
  )

  if (points.length === 0) {
    return (
      <WidgetCard title={title} help={help} headerExtra={toggle} expandable>
        <p className="text-muted-foreground text-sm">
          {xMode === "age" ? t("emptyAge") : t("emptyTenure")}
        </p>
      </WidgetCard>
    )
  }

  // Sized to the money labels this plot will actually draw, from every value
  // the axis can reach: the points it plots plus the averages it draws lines
  // for, which the domain widens to include.
  const axisWidth = moneyAxisWidth(
    [
      ...points.map((point) => point.y),
      ...(means === undefined ? [] : [means.women, means.men]),
    ].filter((value): value is number => value !== null),
    (value) => money(value, currency)
  )

  const shown = points.filter((point) => !pointHidden(point))
  const women = shown.filter((point) => point.woman)
  const men = shown.filter((point) => !point.woman)

  // The last key with anything ON the plot cannot be switched off: an empty
  // plot has nothing left on it to click back. Counted over the keys that
  // actually draw something, so a key standing for people the plot could not
  // place (no birth date) never counts as the one holding the chart up.
  const drawnRoleKeys = new Set(points.map(roleKeyOf))
  const visibleRoleKeys = roleKeys.filter(
    (key) => drawnRoleKeys.has(key.id) && !hiddenRoles.has(key.id)
  ).length
  const drawnGenders = new Set(
    points.map((point) => (point.woman ? "women" : "men"))
  )
  const visibleGenders = (["women", "men"] as const).filter(
    (series) => drawnGenders.has(series) && !hiddenGenders.has(series)
  ).length

  // A hatch cannot survive on a scatter dot, so the men series is the same
  // ink drawn as an outline instead; the legend icon keeps the
  // key honest about which mark belongs to which series.
  const config = {
    man: {
      label: tGender("Man"),
      color: "var(--gender-man)",
      icon: GenderMenIcon,
    },
    woman: { label: tGender("Kvinna"), color: "var(--gender-woman)" },
  } satisfies ChartConfig

  return (
    <WidgetCard title={title} help={help} headerExtra={toggle} expandable>
      <div className="space-y-1">
        <ChartCanvas config={config} collapsed={COLLAPSED_HEIGHT}>
          <ScatterChart
            accessibilityLayer
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              name={t(xMode)}
              domain={["auto", "auto"]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={meanAwareYDomain(means)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={axisWidth}
              tickFormatter={(value: number) => money(value, currency)}
            />
            <ChartTooltip
              {...CHART_TOOLTIP_MOTION}
              cursor={false}
              content={({ active, payload }) => {
                if (active !== true || payload === undefined) return null
                const point = payload[0]?.payload as ScatterPoint | undefined
                if (point === undefined) return null
                return (
                  <ScatterTooltipContent
                    point={point}
                    currency={currency}
                    xMode={xMode}
                    {...(roleMode
                      ? { roleColor: roleColorFor(point.groupLabel) }
                      : {})}
                  />
                )
              }}
            />
            {/* Each gender's average, in its own series' ink, dashed so it
                reads as a reference rather than as data. Before the dots, so
                the individuals paint over the lines.

                These are the engine's group averages, not the mean of the
                dots drawn: anyone without a birth date (or start date) is
                missing from the plot but still counts towards the group's
                figure, and a line that quietly averaged only the visible
                people would disagree with the statutory number stated above
                the chart.

                No band or figure between them. The gap is already a badge
                above the plot, and repeating it inside the card put the same
                percentage on screen twice. */}
            {means !== undefined && (
              <>
                {/* A hidden series takes its average with it: a dashed line
                    for people who are not on the plot is a number with
                    nothing to read it against. */}
                {means.women !== null && !hiddenGenders.has("women") && (
                  <ReferenceLine
                    y={means.women}
                    stroke="var(--gender-woman)"
                    strokeDasharray="4 3"
                    label={{
                      value: t("womenMean"),
                      position: MEAN_LABEL_POSITION.women,
                      fill: "var(--muted-foreground)",
                    }}
                  />
                )}
                {means.men !== null && !hiddenGenders.has("men") && (
                  <ReferenceLine
                    y={means.men}
                    stroke="var(--gender-man)"
                    strokeDasharray="4 3"
                    label={{
                      value: t("menMean"),
                      position: MEAN_LABEL_POSITION.men,
                      fill: "var(--muted-foreground)",
                    }}
                  />
                )}
              </>
            )}
            {/* One series per gender, always the same points in the
                same series. The highlight is drawn per POINT through
                `shape`. Splitting the data into a kept and a dimmed series
                instead made recharts animate: a point moving between
                series reads as new data, so every selection change sent
                dots flying from their old positions. */}
            {/* The pointer targets, as their own layer BEFORE every mark.
                Each is far wider than the ink it stands for, so an isolated
                point is easy to land on; painting them all first is what stops
                one target burying the neighbour behind it, because a mark
                always paints over every target including its own. Nothing here
                is visible, so the order costs the drawing nothing. */}
            <Scatter name="man-target" data={men} shape={hitArea} />
            <Scatter name="woman-target" data={women} shape={hitArea} />
            <Scatter name="man" data={men} shape={markFor("men")} />
            <Scatter name="woman" data={women} shape={markFor("women")} />
          </ScatterChart>
        </ChartCanvas>
        {/* One key per mode, naming exactly what the plot is drawing. The two
            never appear together: in role mode nothing on the chart encodes
            gender, so a gender key there would name a distinction the reader
            cannot make. The roles keep the order the table lists them in. */}
        {roleMode ? (
          <RoleLegend
            items={roleKeys.map((key) => ({
              ...key,
              hidden: hiddenRoles.has(key.id),
              onToggle: () => toggleIn(hiddenRoles, key.id, setHiddenRoles),
              toggleDisabled:
                drawnRoleKeys.has(key.id) &&
                !hiddenRoles.has(key.id) &&
                visibleRoleKeys === 1,
            }))}
          />
        ) : (
          <GenderLegend
            mark="point"
            layout="row"
            items={(["women", "men"] as const).map((series) => ({
              series,
              label: tGender(series === "women" ? "Kvinna" : "Man"),
              hidden: hiddenGenders.has(series),
              onToggle: () => toggleIn(hiddenGenders, series, setHiddenGenders),
              toggleDisabled:
                drawnGenders.has(series) &&
                !hiddenGenders.has(series) &&
                visibleGenders === 1,
            }))}
          />
        )}
        {omitted > 0 && (
          <p className="text-muted-foreground text-xs">
            {xMode === "age"
              ? t("omittedAge", { count: omitted })
              : t("omittedTenure", { count: omitted })}
          </p>
        )}
      </div>
    </WidgetCard>
  )
}
