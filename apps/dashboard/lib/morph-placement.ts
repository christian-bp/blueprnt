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

// The panel's placement: the preferred side when it fits, the opposite side
// when that one does and the preferred one does not, and a pull inward when
// neither fits outright (a panel wider than the room beside its trigger).
//
// Flipping before shifting is deliberate. A shift moves the panel off the
// trigger it morphed from, so the cheapest correction is choosing the side
// with the room; shifting is the fallback for when there is no such side.
export function morphPanelPlacement({
  triggerLeft,
  triggerRight,
  panelWidth,
  viewportWidth,
  preferred,
  margin = MORPH_VIEWPORT_MARGIN,
}: MorphPlacementInput): MorphPlacement {
  const low = margin
  const high = viewportWidth - margin

  // Where each side would put the panel's far edge, and whether that is inside.
  const fitsGrowingRight = triggerLeft + panelWidth <= high
  const fitsGrowingLeft = triggerRight - panelWidth >= low

  let side = preferred
  if (preferred === "left" && !fitsGrowingRight && fitsGrowingLeft) {
    side = "right"
  } else if (preferred === "right" && !fitsGrowingLeft && fitsGrowingRight) {
    side = "left"
  }

  if (side === "left") {
    // Panel spans [triggerLeft - shift, triggerLeft - shift + panelWidth].
    // Pull left by the right-hand overflow, but never so far that the panel's
    // own left edge leaves the viewport: with a panel wider than the room, the
    // left edge is the one worth keeping (it carries the title).
    const needed = triggerLeft + panelWidth - high
    return {
      side,
      shift: clamp(Math.max(0, needed), 0, Math.max(0, triggerLeft - low)),
    }
  }
  // Panel spans [triggerRight - panelWidth + shift, triggerRight + shift].
  // Push right by the left-hand overflow, which lands the panel's left edge
  // exactly on the margin. Deliberately NOT capped at the far edge: when the
  // panel is wider than the room, capping would protect the RIGHT edge and let
  // the title-bearing left edge run off, the opposite of what the "left" branch
  // above decides for the identical situation. Both branches keep the left edge.
  //
  // Unreachable today (every consumer's panel is capped at max-w-[85vw], so
  // some side always fits), which is exactly why it is worth pinning: the two
  // branches have to agree about which edge is worth keeping before a wider
  // panel ever reaches them.
  const needed = low - (triggerRight - panelWidth)
  return { side, shift: Math.max(0, needed) }
}
