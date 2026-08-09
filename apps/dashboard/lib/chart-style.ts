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

// Height of the plot strip in an overview widget card, as a Tailwind class so
// the three cards and their loading placeholders can never drift apart.
//
// The card is min-h-[188px] and the strip bleeds to its bottom edge, so this is
// also what decides whether a hover fits: the tooltip opens upward from the
// strip's top edge, and a short strip pushed a four-row tooltip (run name,
// date, two series) past the card's clipped bottom. At 96px the strip is over
// half the card and the tooltip clears it.
export const WIDGET_CHART_HEIGHT = "h-32"
