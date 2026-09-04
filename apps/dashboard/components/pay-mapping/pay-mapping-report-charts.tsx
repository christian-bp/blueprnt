import { G, Line, Rect, Svg, Text, View } from "@react-pdf/renderer"

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
const PDF_WOMAN_INK = "#d57b3e"
const PDF_WOMAN_EDGE = "#9a3d00"
const PDF_MAN_INK = "#4284c5"

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
