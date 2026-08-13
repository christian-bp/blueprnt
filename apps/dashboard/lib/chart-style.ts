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

// Type size for chart axis ticks. Charts had been shrinking their own ticks to
// 10-11px, below anything else in the app and barely legible next to a 14px
// hover; recharts otherwise inherits ChartContainer's text-xs, which is this.
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

// Width reserved for a vertical axis whose ticks are money.
//
// A money tick is the widest label a chart draws (currency + grouped digits),
// and recharts CLIPS the overflow instead of widening the axis, so an axis
// sized to the salaries in front of you silently eats a character the first
// time a customer has a six-figure one: "SEK 106,208" rendered as "iEK
// 106,208" at the 72px this used to be. Sized for a seven-digit amount at
// CHART_AXIS_FONT_SIZE, which covers a monthly salary in every currency we
// support, including the ones with small units.
export const MONEY_AXIS_WIDTH = 92

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
