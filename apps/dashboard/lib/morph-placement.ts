// Where a hand-anchored morph panel may sit so it never leaves the viewport.
//
// MorphPopover positions its panel absolutely against the trigger's own box
// (the morph has to grow OUT of that rect, which a portaled positioner cannot
// promise), so it gets no collision handling from a positioning library and
// has to do the arithmetic itself. This module is that arithmetic, kept pure
// and away from the component so it can be exercised at real viewport sizes
// instead of through a DOM that reports every rect as zero.

// The gap the panel keeps from the viewport edge when it has to be pulled in.
// Small on purpose: the panel is anchored to its trigger, and every pixel of
// correction moves the morph's origin away from the button it grew out of.
export const MORPH_VIEWPORT_MARGIN = 8

// Which trigger edge the panel hangs from. "left" anchors the panel's left
// edge to the trigger's and grows rightward; "right" anchors the right edges
// and grows leftward.
export type MorphSide = "left" | "right"

export interface MorphPlacementInput {
  // The trigger's box in viewport coordinates.
  triggerLeft: number
  triggerRight: number
  // The panel's settled width (its content's, not the mid-morph box's).
  panelWidth: number
  viewportWidth: number
  // The side the call site asked for, honoured whenever it fits.
  preferred: MorphSide
  margin?: number
}

// The guarantee: the panel's box never extends past the viewport, and the
// edge it GREW toward keeps `margin` from that edge. The anchored edge is the
// trigger's own, so it follows the trigger; a trigger flush against the
// viewport gets a panel flush with it, which is the layout's decision and not
// this module's to override. Every real trigger sits inside the page padding.
//
// The one exception is a panel WIDER than the room between the margins, which
// cannot satisfy both edges: there the title-bearing left edge is kept and the
// far edge overflows, on both sides (see the two returns below).
export interface MorphPlacement {
  side: MorphSide
  // How far to pull the panel inward along its anchored side, in pixels.
  // Always >= 0, and 0 whenever the preferred placement already fits, so the
  // panel sits exactly on the trigger's edge in the common case. The consumer
  // applies it as a NEGATIVE inset on `side`.
  shift: number
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high)

// The one rule, over the two candidate positions a panel can take: the
// preferred side when it fits, the opposite side when that one does and the
// preferred one does not, and a pull inward when neither fits outright.
//
// Flipping before shifting is deliberate. A shift moves the panel off the
// trigger it morphed from, so the cheapest correction is choosing the side
// with the room; shifting is the fallback for when there is no such side.
//
// Both public entry points below feed this the same two numbers: where the
// panel's LEFT edge would sit if it opens rightward, and where its RIGHT edge
// would sit if it opens leftward. What differs between them is only how those
// two numbers are derived from the trigger.
function place({
  leftEdgeOpeningRight,
  rightEdgeOpeningLeft,
  panelWidth,
  viewportWidth,
  preferred,
  margin,
}: {
  leftEdgeOpeningRight: number
  rightEdgeOpeningLeft: number
  panelWidth: number
  viewportWidth: number
  preferred: MorphSide
  margin: number
}): MorphPlacement {
  const low = margin
  const high = viewportWidth - margin

  const fitsOpeningRight = leftEdgeOpeningRight + panelWidth <= high
  const fitsOpeningLeft = rightEdgeOpeningLeft - panelWidth >= low

  let side = preferred
  if (preferred === "left" && !fitsOpeningRight && fitsOpeningLeft) {
    side = "right"
  } else if (preferred === "right" && !fitsOpeningLeft && fitsOpeningRight) {
    side = "left"
  }

  if (side === "left") {
    // Panel spans [start - shift, start - shift + panelWidth].
    // Pull left by the right-hand overflow, but never so far that the panel's
    // own left edge leaves the viewport: with a panel wider than the room, the
    // left edge is the one worth keeping (it carries the title).
    const needed = leftEdgeOpeningRight + panelWidth - high
    return {
      side,
      shift: clamp(
        Math.max(0, needed),
        0,
        Math.max(0, leftEdgeOpeningRight - low)
      ),
    }
  }
  // Panel spans [end + shift - panelWidth, end + shift].
  // Push right by the left-hand overflow, so the panel's left edge lands
  // exactly on the margin. Deliberately NOT capped at the far edge: when the
  // panel is wider than the room, capping would protect the RIGHT edge and let
  // the title-bearing left edge run off, the opposite of what the "left"
  // branch above decides for the identical situation. Both branches keep the
  // left edge.
  //
  // Unreachable for today's consumers (the morph popover's panel is capped at
  // max-w-[85vw] and the weight meaning is 224px beside a 36px bar, so some
  // side always fits), which is exactly why it is worth pinning: the two
  // branches have to agree about which edge is worth keeping before a wider
  // panel ever reaches them.
  const needed = low - (rightEdgeOpeningLeft - panelWidth)
  return { side, shift: Math.max(0, needed) }
}

// A panel ALIGNED to its trigger: its left edge on the trigger's left when it
// opens rightward, its right edge on the trigger's right when it opens
// leftward. This is the morph popover's shape, where the panel grows out of
// the trigger's own rect and overlays it.
export function morphPanelPlacement({
  triggerLeft,
  triggerRight,
  panelWidth,
  viewportWidth,
  preferred,
  margin = MORPH_VIEWPORT_MARGIN,
}: MorphPlacementInput): MorphPlacement {
  return place({
    leftEdgeOpeningRight: triggerLeft,
    rightEdgeOpeningLeft: triggerRight,
    panelWidth,
    viewportWidth,
    preferred,
    margin,
  })
}

// The vertical shape: a panel STACKED over its trigger, centred on it, rather
// than sitting to one side. The weight row's step meanings are this one.
//
// Two independent corrections, because the two axes fail differently: the
// panel flips between above and below (the axis it is anchored on), and slides
// horizontally to stay inside the side edges (the axis it is centred on).
export type MorphVerticalSide = "top" | "bottom"

export interface MorphStackPlacement {
  // "top" hangs the panel above the trigger, "bottom" drops it below.
  side: MorphVerticalSide
  // Horizontal correction for a panel centred on its trigger, in pixels:
  // positive moves it right, negative left. SIGNED, unlike the horizontal
  // shapes' inward-only pull, because a centred panel can overflow either
  // side.
  shift: number
}

export function morphStackPlacement({
  triggerLeft,
  triggerRight,
  triggerTop,
  triggerBottom,
  gap,
  panelWidth,
  panelHeight,
  viewportWidth,
  viewportHeight,
  preferred,
  margin = MORPH_VIEWPORT_MARGIN,
}: {
  triggerLeft: number
  triggerRight: number
  triggerTop: number
  triggerBottom: number
  gap: number
  panelWidth: number
  panelHeight: number
  viewportWidth: number
  viewportHeight: number
  preferred: MorphVerticalSide
  margin?: number
}): MorphStackPlacement {
  const low = margin
  const high = viewportWidth - margin

  // Vertical: flip only, never shift. A panel nudged down over the control it
  // explains would cover the thing the reader is pointing at.
  const fitsAbove = triggerTop - gap - panelHeight >= margin
  const fitsBelow = triggerBottom + gap + panelHeight <= viewportHeight - margin
  let side = preferred
  if (preferred === "top" && !fitsAbove && fitsBelow) {
    side = "bottom"
  } else if (preferred === "bottom" && !fitsBelow && fitsAbove) {
    side = "top"
  }

  // Horizontal: the panel is centred on the trigger, so correct whichever edge
  // leaves the viewport. The left-edge rule is applied SECOND and therefore
  // wins, exactly as it does in the horizontal shapes: with a panel wider than
  // the room, the left edge is the one worth keeping.
  const naturalLeft = (triggerLeft + triggerRight) / 2 - panelWidth / 2
  let shift = 0
  if (naturalLeft + panelWidth > high) shift = high - (naturalLeft + panelWidth)
  if (naturalLeft + shift < low) shift = low - naturalLeft
  return { side, shift }
}
