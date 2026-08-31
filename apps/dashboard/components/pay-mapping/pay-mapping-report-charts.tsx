import { G, Line, Rect, Svg, Text, View } from "@react-pdf/renderer"
// The doc's five-percentile spread shape, reused rather than redeclared so
// the chart's input and the doc's data cannot drift apart.
import type { ReportSpreadNums } from "./pay-mapping-report-data"

// Hand-drawn vector charts for the statutory report, on react-pdf's own SVG
// primitives: no rasterization, no extra dependency, deterministic output.
// Deliberately primitive-only (explicit width/height, no viewBox, no
// transforms): the kit's wordmark taught us the browser build rejects
// viewBox transforms ("unsupported number").
//
// The gender encoding mirrors the app's chart rules (CLAUDE.md): women in
// the terracotta ink, men in the denim ink, and never colour alone: the
// men's mark is hatched with a border in its own ink, the women's solid
// with its darker edge, and every bar prints its value. Inks are the LIGHT
// theme's --gender-* tokens (packages/ui/src/styles/globals.css) converted
// to sRGB hex, since a PDF cannot read CSS variables; a token retune must
// update these too.
export const PDF_WOMAN_INK = "#d57b3e"
export const PDF_WOMAN_EDGE = "#9a3d00"
export const PDF_MAN_INK = "#4284c5"

// Sized to the longest shipped row label (fi "Kvartiili 1 (matalin palkka)"
// measures ~91pt in Helvetica 8) plus headroom: SVG text has no clipping or
// wrapping, so a label longer than this column prints over the bar. A locale
// change that grows a chart label must be checked against this width.
const LABEL_WIDTH = 116
const VALUE_WIDTH = 78
const BAR_HEIGHT = 11
const ROW_GAP = 7
const FONT = 8
// The app's marks are rounded (BAR_RADIUS 6 on ~28px bars); at this bar
// height the proportional radius is 2. The hatch is computed on the square
// bounds, so at a larger radius its corner segments would visibly cross the
// rounded outline.
const BAR_CORNER_RADIUS = 2

// 45-degree hatch segments clipped to a rectangle, drawn as explicit lines
// because react-pdf's SVG has no pattern fills.
function hatchSegments(
  x: number,
  y: number,
  width: number,
  height: number,
  spacing = 5
): { x1: number; y1: number; x2: number; y2: number }[] {
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let c = -height; c < width; c += spacing) {
    const x1 = Math.max(x, x + c)
    const y1 = y + height - (x1 - (x + c))
    const x2 = Math.min(x + width, x + c + height)
    const y2 = y + height - (x2 - (x + c))
    if (x1 < x2) segments.push({ x1, y1, x2, y2 })
  }
  return segments
}

function WomanBar({
  x,
  y,
  width,
  height,
}: {
  x: number
  y: number
  width: number
  height: number
}) {
  return (
    <Rect
      x={x}
      y={y}
      rx={BAR_CORNER_RADIUS}
      width={Math.max(width, 0.5)}
      height={height}
      fill={PDF_WOMAN_INK}
      stroke={PDF_WOMAN_EDGE}
      strokeWidth={0.8}
    />
  )
}

function ManBar({
  x,
  y,
  width,
  height,
}: {
  x: number
  y: number
  width: number
  height: number
}) {
  const w = Math.max(width, 0.5)
  return (
    <>
      <Rect
        x={x}
        y={y}
        rx={BAR_CORNER_RADIUS}
        width={w}
        height={height}
        fill="#ffffff"
        stroke={PDF_MAN_INK}
        strokeWidth={0.8}
      />
      {hatchSegments(x, y, w, height).map((segment) => (
        <Line
          key={`${segment.x1}-${segment.y1}`}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={PDF_MAN_INK}
          strokeWidth={0.7}
        />
      ))}
    </>
  )
}

// One gender key row: the series' own mark at key size beside its name, and
// optionally a value (the population stat block's count-and-share rows).
export function PdfGenderKeyRow({
  series,
  label,
  value,
}: {
  series: "women" | "men"
  label: string
  value?: string
}) {
  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
      <Svg width={10} height={10}>
        {series === "women" ? (
          <WomanBar x={0.5} y={0.5} width={9} height={9} />
        ) : (
          <ManBar x={0.5} y={0.5} width={9} height={9} />
        )}
      </Svg>
      <PdfText>{label}</PdfText>
      {value !== undefined && (
        <Text style={{ fontSize: FONT, color: "#111" }}>{value}</Text>
      )}
    </View>
  )
}

// The legend the charts share: each series' own mark at key size beside its
// name, so no chart encodes gender by colour alone. Always rendered BELOW
// its chart (the app's key sits under the plot), so the top margin is the
// chart-to-key gap.
export function PdfGenderLegend({
  womenLabel,
  menLabel,
}: {
  womenLabel: string
  menLabel: string
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 14,
        alignItems: "center",
        marginTop: 6,
        marginBottom: 2,
      }}
    >
      <PdfGenderKeyRow series="women" label={womenLabel} />
      <PdfGenderKeyRow series="men" label={menLabel} />
    </View>
  )
}

function PdfText({ children }: { children: string }) {
  return (
    // Plain flow text (not SVG text): rides the page's own typography.
    <Text style={{ fontSize: FONT, color: "#333" }}>{children}</Text>
  )
}

interface BarRow {
  label: string
  women: number
  men: number
  womenText: string
  menText: string
}

// One labeled bar per row, each row its own series: the org-level means
// pair, where "Kvinnor"/"Män" sit beside their own bars (the spread chart's
// reading) instead of an unlabeled pair hanging in the middle. The side
// labels NAME the series, so this chart carries no separate legend.
export function GenderBarsChart({
  rows,
  width,
}: {
  rows: {
    series: "women" | "men"
    label: string
    value: number
    text: string
  }[]
  width: number
}) {
  if (rows.length === 0) return null
  const barArea = width - LABEL_WIDTH - VALUE_WIDTH
  const max = Math.max(...rows.map((row) => row.value), 1)
  const rowHeight = BAR_HEIGHT + ROW_GAP
  return (
    <Svg width={width} height={rows.length * rowHeight}>
      {rows.map((row, index) => {
        const y = index * rowHeight
        const barWidth = (row.value / max) * barArea
        return (
          <G key={row.series}>
            <Text
              x={0}
              y={y + BAR_HEIGHT - 2}
              style={{ fontSize: FONT, fill: "#333333" }}
            >
              {row.label}
            </Text>
            {row.series === "women" ? (
              <WomanBar
                x={LABEL_WIDTH}
                y={y}
                width={barWidth}
                height={BAR_HEIGHT}
              />
            ) : (
              <ManBar
                x={LABEL_WIDTH}
                y={y}
                width={barWidth}
                height={BAR_HEIGHT}
              />
            )}
            <Text
              x={LABEL_WIDTH + barWidth + 4}
              y={y + BAR_HEIGHT - 3}
              style={{ fontSize: FONT, fill: "#333333" }}
            >
              {row.text}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}

// Horizontal paired bars, one pair per row: the report's one chart form.
// Bars scale against the rows' shared maximum; every bar prints its value,
// so the reading never depends on the axis (there is none).
export function PairedBarsChart({
  rows,
  width,
}: {
  rows: BarRow[]
  width: number
}) {
  if (rows.length === 0) return null
  const barArea = width - LABEL_WIDTH - VALUE_WIDTH
  const max = Math.max(...rows.map((row) => Math.max(row.women, row.men)), 1)
  const rowHeight = BAR_HEIGHT * 2 + 2 + ROW_GAP
  const chartHeight = rows.length * rowHeight
  const scale = (value: number) => (value / max) * barArea
  return (
    <Svg width={width} height={chartHeight}>
      {rows.map((row, index) => {
        const top = index * rowHeight
        const womenY = top
        const menY = top + BAR_HEIGHT + 2
        return (
          // Row labels are unique (the quartile names), so they key the
          // group without the index.
          <G key={row.label}>
            <Text
              x={0}
              y={top + BAR_HEIGHT + 1}
              style={{ fontSize: FONT, fill: "#333333" }}
            >
              {row.label}
            </Text>
            <WomanBar
              x={LABEL_WIDTH}
              y={womenY}
              width={scale(row.women)}
              height={BAR_HEIGHT}
            />
            <Text
              x={LABEL_WIDTH + scale(row.women) + 4}
              y={womenY + BAR_HEIGHT - 3}
              style={{ fontSize: FONT, fill: "#333333" }}
            >
              {row.womenText}
            </Text>
            <ManBar
              x={LABEL_WIDTH}
              y={menY}
              width={scale(row.men)}
              height={BAR_HEIGHT}
            />
            <Text
              x={LABEL_WIDTH + scale(row.men) + 4}
              y={menY + BAR_HEIGHT - 3}
              style={{ fontSize: FONT, fill: "#333333" }}
            >
              {row.menText}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}

// The pay-spread bands: per gender, a light P10-P90 band, a stronger Q1-Q3
// box and a median tick, on one shared scale so the two genders' positions
// compare directly. The exact figures live in the table beside it; the
// chart carries the SHAPE.
export function SpreadBandsChart({
  women,
  men,
  womenLabel,
  menLabel,
  width,
}: {
  women: ReportSpreadNums
  men: ReportSpreadNums
  womenLabel: string
  menLabel: string
  width: number
}) {
  const barArea = width - LABEL_WIDTH - VALUE_WIDTH
  const min = Math.min(women.p10, men.p10)
  const max = Math.max(women.p90, men.p90)
  const span = max - min || 1
  // A padded scale so the leftmost band does not start at the very edge.
  const pad = span * 0.06
  const scale = (value: number) =>
    LABEL_WIDTH + ((value - (min - pad)) / (span + pad * 2)) * barArea
  const bandHeight = 12
  const rowHeight = bandHeight + 12
  const rows = [
    { label: womenLabel, nums: women, woman: true },
    { label: menLabel, nums: men, woman: false },
  ]
  return (
    <Svg width={width} height={rows.length * rowHeight}>
      {rows.map((row, index) => {
        const y = index * rowHeight + 2
        const ink = row.woman ? PDF_WOMAN_INK : PDF_MAN_INK
        const p10x = scale(row.nums.p10)
        const q1x = scale(row.nums.q1)
        const q3x = scale(row.nums.q3)
        const p90x = scale(row.nums.p90)
        const medianX = scale(row.nums.median)
        return (
          <G key={row.label}>
            <Text
              x={0}
              y={y + bandHeight - 3}
              style={{ fontSize: FONT, fill: "#333333" }}
            >
              {row.label}
            </Text>
            {/* P10-P90 band: an outline in the series' own ink. */}
            <Rect
              x={p10x}
              y={y + 2}
              width={Math.max(p90x - p10x, 0.5)}
              height={bandHeight - 4}
              fill="#ffffff"
              stroke={ink}
              strokeWidth={0.8}
            />
            {/* Q1-Q3 box: the series' own mark (solid vs hatched). */}
            {row.woman ? (
              <WomanBar
                x={q1x}
                y={y}
                width={Math.max(q3x - q1x, 0.5)}
                height={bandHeight}
              />
            ) : (
              <ManBar
                x={q1x}
                y={y}
                width={Math.max(q3x - q1x, 0.5)}
                height={bandHeight}
              />
            )}
            {/* Median tick, full band height. */}
            <Line
              x1={medianX}
              y1={y - 2}
              x2={medianX}
              y2={y + bandHeight + 2}
              stroke={row.woman ? PDF_WOMAN_EDGE : PDF_MAN_INK}
              strokeWidth={1.6}
            />
          </G>
        )
      })}
    </Svg>
  )
}
