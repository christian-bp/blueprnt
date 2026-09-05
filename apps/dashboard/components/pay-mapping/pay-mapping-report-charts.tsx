import { G, Line, Path, Rect, Svg, Text, View } from "@react-pdf/renderer"
import { INK, INK_BODY, STATUS_RAMP } from "@/lib/pdf/palette"

// Hand-drawn vector charts for the statutory report, on react-pdf's own SVG
// primitives: no rasterization, no extra dependency, deterministic output.
// Deliberately primitive-only (explicit width/height, no viewBox, no
// transforms): the kit's wordmark taught us the browser build rejects
// viewBox transforms ("unsupported number").
//
// The gender encoding mirrors the app's chart rules (CLAUDE.md), mark for
// mark: each series is a WASH contoured in its own INK, the women's carrying
// diagonal stripes of that ink and the men's flat, and every bar prints its
// value so the reading never rests on colour. The stripes matter more on
// paper than anywhere else: a report is the one surface guaranteed to be
// printed, and in black and white the two washes are one grey.
//
// Inks are the LIGHT theme's --gender-* tokens (packages/ui/src/styles/
// globals.css) converted to sRGB hex, since a PDF cannot read CSS variables.
// A token retune must update these four, and there is a test that fails when
// they drift from the stylesheet.
export const PDF_GENDER_INKS = {
  womanInk: "#824cef",
  womanFill: "#a894ee",
  manInk: "#007cb1",
  manFill: "#6abce6",
} as const

const PDF_WOMAN_INK = PDF_GENDER_INKS.womanInk
const PDF_WOMAN_FILL = PDF_GENDER_INKS.womanFill
const PDF_MAN_INK = PDF_GENDER_INKS.manInk
const PDF_MAN_FILL = PDF_GENDER_INKS.manFill

// Sized to the longest shipped row label (fi "Kvartiili 1 (matalin palkka)"
// measures ~91pt in Helvetica 8) plus headroom: SVG text has no clipping or
// wrapping, so a label longer than this column prints over the bar. A locale
// change that grows a chart label must be checked against this width.
const LABEL_WIDTH = 116

// The share chart's own label column. Its labels are the two pay measures
// rather than the quartile names, so it is narrower than LABEL_WIDTH -- but
// sized the same way, off the longest SHIPPED label: nb "Gjennomsnittslonn"
// measures 66.7pt in Helvetica 8 and printed through the bar at 64. Every
// render test renders English, where the same label is 44.9pt, so no test
// can catch this; a locale change that grows a chart label must be measured
// against this width by hand.
const SHARE_LABEL_WIDTH = 78
const VALUE_WIDTH = 78
const BAR_HEIGHT = 11
const ROW_GAP = 7
const FONT = 8
const ROW_HEIGHT = BAR_HEIGHT * 2 + 2 + ROW_GAP
// The app's marks are rounded (BAR_RADIUS 6 on ~28px bars); at this bar
// height the proportional radius is 2. The hatch is computed on the square
// bounds, so at a larger radius its corner segments would visibly cross the
// rounded outline.
const BAR_CORNER_RADIUS = 2
// The bars' outline, centred on the shape's edge, so half of it falls
// OUTSIDE the rect. The drawing is inset by that half and the canvas grown by
// the whole, or the top row's outline is clipped by the Svg's own edge, which
// is what printed the first bar with a flat top.
const BAR_EDGE = 0.8
const EDGE_PAD = BAR_EDGE / 2

// The canvas a set of rows needs, its own drawing plus the outline the top
// and bottom rows hang over.
export function pairedBarsHeight(rowCount: number): number {
  return rowCount * ROW_HEIGHT + BAR_EDGE
}

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
  // A zero draws NOTHING. Given a minimum width it printed as a stub with an
  // outline, which reads as a mark for a series that has no one in the row;
  // the value beside it already says 0.
  if (width <= 0) return null
  const w = Math.max(width, 0.5)
  return (
    <>
      <Rect
        x={x}
        y={y}
        rx={BAR_CORNER_RADIUS}
        width={w}
        height={height}
        fill={PDF_WOMAN_FILL}
        stroke={PDF_WOMAN_INK}
        strokeWidth={BAR_EDGE}
      />
      {hatchSegments(x, y, w, height).map((segment) => (
        <Line
          key={`${segment.x1}-${segment.y1}`}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={PDF_WOMAN_INK}
          strokeWidth={0.7}
        />
      ))}
    </>
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
  if (width <= 0) return null
  return (
    <Rect
      x={x}
      y={y}
      rx={BAR_CORNER_RADIUS}
      width={Math.max(width, 0.5)}
      height={height}
      fill={PDF_MAN_FILL}
      stroke={PDF_MAN_INK}
      strokeWidth={BAR_EDGE}
    />
  )
}

// One gender key row: the series' own mark at key size beside its name, and
// optionally a value (the population stat block's count-and-share rows).
function PdfGenderKeyRow({
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
        <Text style={{ fontSize: FONT, color: INK }}>{value}</Text>
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
    <Text style={{ fontSize: FONT, color: INK_BODY }}>{children}</Text>
  )
}

interface BarRow {
  label: string
  women: number
  men: number
  womenText: string
  menText: string
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
  const scale = (value: number) => (value / max) * barArea
  return (
    <Svg width={width} height={pairedBarsHeight(rows.length)}>
      {rows.map((row, index) => {
        const top = EDGE_PAD + index * ROW_HEIGHT
        const womenY = top
        const menY = top + BAR_HEIGHT + 2
        return (
          // Row labels are unique (the quartile names), so they key the
          // group without the index.
          <G key={row.label}>
            <Text
              x={0}
              y={top + BAR_HEIGHT + 1}
              style={{ fontSize: FONT, fill: INK_BODY }}
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
              style={{ fontSize: FONT, fill: INK_BODY }}
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
              style={{ fontSize: FONT, fill: INK_BODY }}
            >
              {row.menText}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}

// Women's pay as a share of men's, one row per measure (mean, median), with
// men's level drawn as the reference the bar is read against.
//
// A share IS the finding, so it gets the finding's own form rather than a
// row in a table of percentages: the bar shows how far short the women's
// figure falls, and the reference line shows what it falls short OF. The
// bar is the women's mark (wash, stripes, contour), the line the men's ink,
// so the chart carries the same encoding as every other gender mark in the
// product, and the value prints beside it for the reading that must survive
// a photocopy.
//
// A masked measure prints its dash where the bar would be: the row stays, so
// the reader sees that the measure exists and why it is not shown.
export function ShareBarsChart({
  rows,
  width,
}: {
  rows: { label: string; share: number | null; text: string }[]
  width: number
}) {
  if (rows.length === 0) return null
  const barArea = width - SHARE_LABEL_WIDTH - VALUE_WIDTH
  // The track runs to the reference, and a share over parity runs past it,
  // so the scale leaves room for the longest bar in the set.
  const max = Math.max(100, ...rows.map((row) => row.share ?? 0))
  const scale = (value: number) => (value / max) * barArea
  const referenceX = SHARE_LABEL_WIDTH + scale(100)
  const height = pairedBarsHeight(rows.length)
  return (
    <Svg width={width} height={height}>
      {/* Men's level, once and full height: a line drawn per row read as a
          stray tick beside each bar rather than as the thing the bars are
          measured against. */}
      <Line
        x1={referenceX}
        y1={0}
        x2={referenceX}
        y2={height}
        stroke={PDF_MAN_INK}
        strokeWidth={1}
      />
      {rows.map((row, index) => {
        const top = EDGE_PAD + index * ROW_HEIGHT
        const barY = top + BAR_HEIGHT / 2
        return (
          <G key={row.label}>
            <Text
              x={0}
              y={barY + BAR_HEIGHT - 3}
              style={{ fontSize: FONT, fill: INK_BODY }}
            >
              {row.label}
            </Text>
            {row.share !== null && (
              <WomanBar
                x={SHARE_LABEL_WIDTH}
                y={barY}
                width={scale(row.share)}
                height={BAR_HEIGHT}
              />
            )}
            <Text
              x={SHARE_LABEL_WIDTH + scale(row.share ?? 0) + 6}
              y={barY + BAR_HEIGHT - 3}
              style={{ fontSize: FONT, fill: INK_BODY }}
            >
              {row.text}
            </Text>
          </G>
        )
      })}
    </Svg>
  )
}

// A rounded rectangle as a path, with a radius per corner. react-pdf's Rect
// takes one rx for all four, and a stacked bar rounds only the ends of the
// whole bar: rounding every segment turns one bar into a row of pills, and
// rounding none leaves a bar with square ends beside the rounded ones this
// document already draws. Same rule as the app's own stacked bars.
function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  [topLeft, topRight, bottomRight, bottomLeft]: [number, number, number, number]
): string {
  const cap = Math.min(width, height) / 2
  const tl = Math.min(topLeft, cap)
  const tr = Math.min(topRight, cap)
  const br = Math.min(bottomRight, cap)
  const bl = Math.min(bottomLeft, cap)
  return [
    `M${x + tl},${y}`,
    `H${x + width - tr}`,
    tr > 0 ? `A${tr},${tr} 0 0 1 ${x + width},${y + tr}` : "",
    `V${y + height - br}`,
    br > 0 ? `A${br},${br} 0 0 1 ${x + width - br},${y + height}` : "",
    `H${x + bl}`,
    bl > 0 ? `A${bl},${bl} 0 0 1 ${x},${y + height - bl}` : "",
    `V${y + tl}`,
    tl > 0 ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : "",
    "Z",
  ]
    .filter(Boolean)
    .join(" ")
}

const STATUS_BAR_HEIGHT = 13
// The proportional radius at this bar height, the same relation the gender
// bars keep to theirs.
const STATUS_BAR_RADIUS = 3
const STATUS_LEGEND_GAP = 6

// Each segment's DEPTH, taken from its position in the caller's own list and
// only then dropping the empty ones, so one status is one ink on every bar
// in the document. Colouring by position among the SURVIVING segments looks
// identical until a bar has a hole in it, and then every status after the
// hole prints one step too dark: the equivalent-work bar can never carry a
// noActionNeeded segment (every comparison owes documentation), and it
// prints directly under an equal-work bar that usually does, so the two
// showed the same status at two weights. On an ordered ramp, where depth is
// the only channel, that is the scale itself going wrong.
//
// Exported so the mapping is pinned by a test rather than by the render.
export function inkedSegments<T extends { value: number }>(
  segments: readonly T[]
): (T & { fill: string })[] {
  return segments
    .map((segment, index) => ({
      ...segment,
      fill: STATUS_RAMP[index % STATUS_RAMP.length] ?? STATUS_RAMP[0],
    }))
    .filter((segment) => segment.value > 0)
}

// One horizontal bar carrying a set of counts as segments, with the counts
// named underneath. It answers "what is analysed and what is left" in one
// shape, which is the question a table of five counts makes the reader
// assemble for themselves. A count of zero draws no segment and no legend
// row, because an empty band is a mark for something that is not there.
export function StatusBarChart({
  segments,
  width,
  emptyLabel,
}: {
  segments: { label: string; value: number }[]
  width: number
  // Printed instead of the bar when every count is zero: a bar of nothing at
  // all reads as a rendering fault.
  emptyLabel: string
}) {
  const shown = inkedSegments(segments)
  const total = shown.reduce((sum, segment) => sum + segment.value, 0)
  if (total === 0) {
    return <Text style={{ fontSize: FONT, color: INK_BODY }}>{emptyLabel}</Text>
  }
  let offset = 0
  const placed = shown.map((segment) => {
    const segmentWidth = (segment.value / total) * width
    const x = offset
    offset += segmentWidth
    return { ...segment, x, width: segmentWidth }
  })
  return (
    <View>
      <Svg width={width} height={STATUS_BAR_HEIGHT + BAR_EDGE}>
        {placed.map((segment, index) => {
          const first = index === 0
          const last = index === placed.length - 1
          const r = STATUS_BAR_RADIUS
          return (
            <Path
              key={segment.label}
              d={roundedRectPath(
                segment.x,
                EDGE_PAD,
                Math.max(segment.width, 0.5),
                STATUS_BAR_HEIGHT,
                [first ? r : 0, last ? r : 0, last ? r : 0, first ? r : 0]
              )}
              fill={segment.fill}
              stroke="#ffffff"
              strokeWidth={BAR_EDGE}
            />
          )
        })}
      </Svg>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginTop: STATUS_LEGEND_GAP,
        }}
      >
        {placed.map((segment) => (
          <View
            key={segment.label}
            style={{ flexDirection: "row", gap: 4, alignItems: "center" }}
          >
            <Svg width={8} height={8}>
              <Path
                d={roundedRectPath(0, 0, 8, 8, [2, 2, 2, 2])}
                fill={segment.fill}
              />
            </Svg>
            <PdfText>{`${segment.label}: ${segment.value}`}</PdfText>
          </View>
        ))}
      </View>
    </View>
  )
}
