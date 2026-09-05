import { G, Line, Rect, Svg, Text, View } from "@react-pdf/renderer"

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
