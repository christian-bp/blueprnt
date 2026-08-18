// Shared geometry for the app's charts, so a bar's corners are one decision
// instead of a literal per call site.

// Corner radius for a chart bar. Sits a step under the card's own --radius
// (10px) so a bar reads as softened rather than as a pill, and the whole chart
// family rounds by the same amount.
//
// Safe to apply to bars that can go thin: recharts clamps each corner to half
// the rectangle's short side, so a one-person bar a few pixels tall rounds by
// what it can carry instead of distorting.
export const BAR_RADIUS = 6

// Type size for every chart hover. shadcn's ChartTooltipContent ships at
// text-xs, which reads smaller than the legends beside it and smaller than the
// other cards' hovers the moment one chart overrides it. Applying this
// everywhere keeps one hover size across the app.
export const CHART_TOOLTIP_TEXT = "text-sm"

// Type size for chart axis ticks, for a chart that is NOT inside a
// ChartCanvas (an inline panel chart). Charts had been shrinking their own
// ticks to 10-11px, below anything else in the app and barely legible next to
// a 14px hover.
//
// A chart in a widget card sets no fontSize at all: it inherits
// ChartContainer's text-xs, which is exactly this size, and inheriting is
// what lets the expanded dialog scale the whole chart's type in one place
// (EXPANDED_CHART_TEXT).
export const CHART_AXIS_FONT_SIZE = 12

// Hover motion for every chart, spread onto the ChartTooltip.
//
// Recharts positions its tooltip by translating one absolutely positioned
// wrapper and, while animation is on, puts `transition: transform 400ms ease`
// on it. The wrapper starts at the chart's own origin, so the first hover
// slides the panel in from the top-left corner and every move after that
// slides it between points: the tooltip is always arriving from somewhere
// other than the thing it describes, and on a dense scatter it visibly trails
// the pointer.
//
// Turning that off leaves the panel appearing AT the mark, which is where it
// belongs; the content fades instead (TOOLTIP_APPEAR), which reads as the
// hover answering rather than as a panel travelling across the chart.
//
// There is no recharts setting for "fade but do not slide": the only knob is
// this transition, so the fade has to live on our own content.
export const CHART_TOOLTIP_MOTION = { isAnimationActive: false } as const

// How the tooltip content appears, in place of the slide above.
//
// Fade AND a zoom, the same entrance every other overlay in the app uses (see
// the popover primitive). A bare fade was tried first and still read as a pop:
// 150ms of opacity on a small panel already at its final size gives the eye
// nothing to follow, and the panel opens under the pointer where attention
// already is. The zoom gives it somewhere to arrive from without moving it
// away from the mark it describes.
//
// One step deeper than the popovers' 95%. A tooltip is smaller than they are
// and it opens where the reader is already looking, so the same 5% covers a
// couple of pixels and passes unseen; the overlays that use 95% are larger,
// and open somewhere the eye has to travel to.
//
// motion-safe, not bare: the app's reduced-motion promise is kept by
// MotionConfig, which governs Motion only, and globals.css collapses CSS
// durations for toasts alone. A CSS animation added anywhere else has to
// carry its own guard or it plays for a reader who asked for no motion.
export const TOOLTIP_APPEAR =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-90 duration-150"

// The plot height a chart takes inside an expanded widget dialog.
//
// One value for every chart, so expanding feels the same wherever it is done,
// and viewport-relative rather than a fixed step: the dialog is capped at the
// screen height, so a chart that asked for a fixed 600px would push its own
// dialog header off a laptop screen. The rem cap is what stops a plot on a
// tall monitor from becoming a column of empty space with a few points in it.
//
// Charts read useWidgetExpanded() to choose between this and their own
// collapsed height, which stays per-surface: a card in a three-across strip
// and a card under a table are not the same shape.
export const EXPANDED_CHART_HEIGHT = "h-[min(34rem,58dvh)]"

// The type scale a chart takes inside an expanded widget dialog.
//
// Expanding without this produced a blown-up thumbnail: bars three times the
// size with the same 12px axis labels and legend beside them, which reads as
// a rendering mistake rather than as a bigger chart. Applied as a CLASS on
// the canvas rather than as a fontSize prop on each axis, because SVG text
// inherits font-size from the container: one class moves every tick, every
// axis label and every in-plot label at once, and no chart can forget one.
//
// It follows that a chart inside a ChartCanvas must NOT set fontSize on its
// axes; an explicit prop beats inheritance and pins that axis at 12px while
// everything around it grows.
export const EXPANDED_CHART_TEXT = "text-sm"

// Width reserved for a vertical axis whose ticks are money.
//
// Derived from the labels the axis will actually draw, never a single
// constant. Both failure modes are real and they pull opposite ways: recharts
// CLIPS an overflowing tick instead of widening the axis, so an axis sized to
// the salaries in front of you eats a character the first time a customer has
// a six-figure one ("SEK 106,208" rendered as "iEK 106,208" at the 72px this
// once was), while a width padded for that worst case leaves a Swedish
// monthly salary sitting 33px inside the card with the plot squeezed by the
// same amount.
//
// recharts' own width="auto" would answer this exactly, and was tried: it
// measures the rendered ticks with getComputedTextLength, which jsdom returns
// 0 for, so the axis collapses and the plot renders with a negative width in
// every component test. Measuring the strings ourselves is what keeps the
// charts testable.
//
// Per-character width for a money label. Measured with getComputedTextLength
// across the money shapes we render in the app's own font, at the axis's
// normal 12px (worst case 5.07 per character, grouped digits being the widest
// glyphs a money label has), then scaled to the larger of the two type sizes
// an axis can take (EXPANDED_CHART_TEXT, 14px): the same axis renders at both
// sizes and only one width is reserved, so it has to fit the bigger one.
//
// A chart that can never be expanded therefore reserves about 8px it does not
// use. That is the price of one number instead of a size-aware one, against
// the 33px a fixed constant wasted.
const MONEY_CHAR_WIDTH = 5.95

// The gap between a tick's text and the plot: the axis's own tickMargin plus
// the couple of pixels recharts keeps for the (hidden) axis line.
const MONEY_AXIS_GAP = 14

// Never narrower than this, so an axis of tiny values still reads as an axis
// rather than as numbers floating beside the plot.
const MONEY_AXIS_MIN = 44

// The width an axis needs for `values` under `format`. Takes the extremes
// rather than the ticks, which recharts computes later and which never carry
// more digits than the domain does, plus one character of headroom for the
// tick that rounds PAST the data (99 500 -> 100 000 gains a digit).
export function moneyAxisWidth(
  values: readonly number[],
  format: (value: number) => string
): number {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return MONEY_AXIS_MIN
  const longest = Math.max(
    ...[Math.min(...finite), Math.max(...finite)].map(
      (value) => format(value).length
    )
  )
  return Math.max(
    MONEY_AXIS_MIN,
    Math.ceil((longest + 1) * MONEY_CHAR_WIDTH) + MONEY_AXIS_GAP
  )
}

// Horizontal breathing room for a chart whose stroke and point marks reach
// the very edge of the plot area (a trend line spanning its full domain).
// Without it, the endpoint mark and half the stroke sit exactly ON the
// card's own border, so the card's rounded corners and overflow clipping
// cut them off: a mark loses its edge instead of just fading toward it.
// Sized past the largest mark that can sit at an endpoint (the active dot's
// radius, 4px) plus a couple of pixels of clearance. Left/right only: the
// gradient area's fill is allowed to bleed to the card's bottom edge by
// design, so no vertical inset is added.
export const CHART_EDGE_INSET = 6

// Height of the plot strip in the assistant's chart-part cards (TrendPanel,
// via widget-viz.tsx), as a Tailwind class so the strip and its loading
// placeholder (trend-panel.tsx's TrendBody) can never drift apart.
//
// The strip sits inset within the card's own padding (TrendPanel never
// bleeds to the card's edges), so this is also what decides whether a hover
// fits: the tooltip opens upward from the strip's top edge, and a short
// strip pushed a four-row tooltip (run name, date, two series) past the
// card's clipped bottom. At 96px the strip clears it.
export const WIDGET_CHART_HEIGHT = "h-32"

// Height of the admin AI-usage overview's daily cost trend (one area per
// org, x axis per day of the selected month), as a Tailwind class shared by
// all three states: loading, empty, and ready. Unlike a ranked bar chart
// (one row per org, so its height had to grow with the row count), a stacked
// area plot draws the same number of vertical pixels whatever it holds, so
// the panel never resizes once real data arrives.
export const AI_USAGE_TREND_HEIGHT = "h-72"

// The ink for the Nth series (0-based) of a categorical, non-gender chart:
// cycles through the five --chart-* tokens shadcn ships. gender-mark.tsx's
// hue/mark rules are for the women/men split specifically and do not apply
// to org-categorical data like this one. A chart with more series than
// tokens repeats them; distinguishing more than five adjacent stacked bands
// by hue alone is already past what a reader can hold, so a repeat this far
// into the cycle reads as "another one of these", which is honest about
// what the chart can actually show.
export function chartSeriesInk(index: number): string {
  const CHART_TOKEN_COUNT = 5
  return `var(--chart-${(index % CHART_TOKEN_COUNT) + 1})`
}
